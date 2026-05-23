import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const configPath = path.join(rootDir, "src", "data", "daily-report-sources.json");
const outputHtmlPath = path.join(rootDir, "src", "daily-report.html");
const outputJsonPath = path.join(rootDir, "src", "data", "daily-report-latest.json");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripTags(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  let output = String(value);

  for (let i = 0; i < 3; i += 1) {
    const next = output
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&nbsp;/g, " ");

    if (next === output) break;
    output = next;
  }

  return output;
}

function extractTagValue(xmlChunk, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xmlChunk.match(pattern);
  if (!match) return null;
  return decodeHtmlEntities(stripTags(match[1]));
}

function extractAtomLink(xmlChunk) {
  const hrefMatch = xmlChunk.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
  if (hrefMatch) return decodeHtmlEntities(hrefMatch[1]);
  const textMatch = extractTagValue(xmlChunk, "link");
  return textMatch;
}

function parseRssFeed(rawXml) {
  const rssItems = [...rawXml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomEntries = [...rawXml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const units = rssItems.length > 0 ? rssItems : atomEntries;

  return units.map((itemXml) => {
    const title = extractTagValue(itemXml, "title") || extractTagValue(itemXml, "dc:title") || extractTagValue(itemXml, "summary");
    const link = extractTagValue(itemXml, "link") || extractAtomLink(itemXml) || extractTagValue(itemXml, "guid");

    return {
      title,
      pubDate: extractTagValue(itemXml, "pubDate") || extractTagValue(itemXml, "updated") || extractTagValue(itemXml, "published"),
      link,
      summary: extractTagValue(itemXml, "description")
    };
  });
}

function parseHtmlSummary(rawHtml, sourceUrl) {
  const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? decodeHtmlEntities(stripTags(titleMatch[1])) : "(no title)";

  const headingMatches = [...rawHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeHtmlEntities(stripTags(match[1])))
    .filter(Boolean);

  const uniqueHeadlines = [...new Set(headingMatches)].slice(0, 12);

  if (uniqueHeadlines.length === 0) {
    return [{ headline: pageTitle, url: sourceUrl }];
  }

  return uniqueHeadlines.map((headline) => ({
    headline,
    url: sourceUrl
  }));
}

function readPathValue(obj, dotPath) {
  if (!dotPath) return undefined;
  return dotPath.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function summarizeData(data) {
  if (Array.isArray(data)) {
    return { kind: "array", count: data.length };
  }
  if (data && typeof data === "object") {
    return { kind: "object", count: Object.keys(data).length };
  }
  if (typeof data === "string") {
    return { kind: "text", count: data.length };
  }
  return { kind: typeof data, count: 0 };
}

function pickCollection(data, dataPath) {
  if (dataPath) {
    const selected = readPathValue(data, dataPath);
    return selected !== undefined ? selected : data;
  }

  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    const arrayEntry = Object.entries(data).find(([, value]) => Array.isArray(value));
    if (arrayEntry) return arrayEntry[1];
  }

  return data;
}

function buildPreviewRows(data, previewFields = [], previewLimit = 5) {
  let items = data;
  
  // Convert object-shaped data (e.g., { "key1": {...}, "key2": {...} }) into an array of values
  if (!Array.isArray(data) && data && typeof data === "object") {
    items = Object.entries(data)
      .map(([key, value]) => {
        if (value && typeof value === "object") {
          // Include the key as an identifier in the preview
          return { ...value, _key: key };
        }
        return value;
      });
  }
  
  if (!Array.isArray(items)) return [];
  
  return items.slice(0, previewLimit).map((item) => {
    if (!item || typeof item !== "object") {
      return escapeHtml(String(item));
    }
    if (previewFields.length > 0) {
      const pairs = previewFields
        .map((field) => ({ field, value: readPathValue(item, field) }))
        .filter((pair) => pair.value !== undefined && pair.value !== null && String(pair.value).trim().length > 0)
        .map((pair) => `${escapeHtml(pair.field)}: ${escapeHtml(String(pair.value))}`);
      if (pairs.length > 0) return pairs.join(" | ");
    }
    return escapeHtml(JSON.stringify(item));
  });
}

function normalizeDiscordContent(message) {
  const text = (message.content || "").trim();
  if (text.length > 0) return text;

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return `[attachment] ${message.attachments[0].url}`;
  }

  if (Array.isArray(message.embeds) && message.embeds.length > 0) {
    const embed = message.embeds[0];
    return (embed.title || embed.description || "[embed]").trim();
  }

  return "[no text content]";
}

function normalizeXText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadXTimeline(source) {
  const authEnv = source.authEnv || "X_API_BEARER_TOKEN";
  const token = process.env[authEnv];

  if (!token) {
    return {
      skippedReason: `Missing ${authEnv}. Set it in GitHub Actions secrets to enable X collection.`,
      rows: []
    };
  }

  const username = source.username || source.accountHandle || source.handle;
  if (!username) {
    return {
      skippedReason: "No X username configured.",
      rows: []
    };
  }

  const userResponse = await fetch(`https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!userResponse.ok) {
    throw new Error(`X API ${userResponse.status} ${userResponse.statusText} for user ${username}`);
  }

  const userPayload = await userResponse.json();
  const userId = userPayload?.data?.id;
  if (!userId) {
    throw new Error(`X API user lookup returned no id for ${username}`);
  }

  const maxResults = Math.min(Math.max(Number(source.maxResults || 8), 5), 100);
  const includeReplies = Boolean(source.includeReplies);
  const includeRetweets = Boolean(source.includeRetweets);
  const exclude = [];
  if (!includeReplies) exclude.push("replies");
  if (!includeRetweets) exclude.push("retweets");

  const params = new URLSearchParams({
    max_results: String(maxResults),
    "tweet.fields": "created_at,public_metrics"
  });

  if (exclude.length > 0) {
    params.set("exclude", exclude.join(","));
  }

  const timelineResponse = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!timelineResponse.ok) {
    throw new Error(`X API ${timelineResponse.status} ${timelineResponse.statusText} for timeline ${username}`);
  }

  const timelinePayload = await timelineResponse.json();
  const tweets = Array.isArray(timelinePayload?.data) ? timelinePayload.data : [];

  const rows = tweets.map((tweet) => ({
    username,
    text: normalizeXText(tweet.text),
    created_at: tweet.created_at,
    url: `https://x.com/${username}/status/${tweet.id}`,
    likes: tweet.public_metrics?.like_count ?? 0,
    reposts: tweet.public_metrics?.retweet_count ?? 0,
    replies: tweet.public_metrics?.reply_count ?? 0,
    quotes: tweet.public_metrics?.quote_count ?? 0
  }));

  return {
    skippedReason: null,
    rows
  };
}

async function loadDiscordMessages(source) {
  const authEnv = source.authEnv || "DISCORD_BOT_TOKEN";
  const token = process.env[authEnv];

  if (!token) {
    return {
      skippedReason: `Missing ${authEnv}. Set it in GitHub Actions secrets to enable Discord collection.`,
      rows: []
    };
  }

  if (!Array.isArray(source.channels) || source.channels.length === 0) {
    return {
      skippedReason: "No Discord channels configured.",
      rows: []
    };
  }

  const rows = [];
  const channelErrors = [];
  const perChannelLimit = Math.min(Math.max(Number(source.messageLimitPerChannel || 3), 1), 25);

  for (const channel of source.channels) {
    const endpoint = `https://discord.com/api/v10/channels/${channel.id}/messages?limit=${perChannelLimit}`;
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bot ${token}`
      }
    });

    if (!response.ok) {
      channelErrors.push({
        channel: channel.name || channel.id,
        status: response.status,
        statusText: response.statusText
      });
      continue;
    }

    const messages = await response.json();
    for (const message of messages) {
      rows.push({
        channel: channel.name || channel.id,
        channelId: channel.id,
        author: message.author?.global_name || message.author?.username || "unknown",
        content: normalizeDiscordContent(message),
        timestamp: message.timestamp,
        url: source.guildId && message.id
          ? `https://discord.com/channels/${source.guildId}/${channel.id}/${message.id}`
          : null
      });
    }
  }

  rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    skippedReason: null,
    rows,
    channelErrors
  };
}

async function loadSource(source) {
  const startedAt = Date.now();
  const baseResult = {
    id: source.id,
    label: source.label || source.id,
    type: source.type,
    location: source.type === "url"
      ? source.url
      : source.type === "discord"
        ? `discord:guild:${source.guildId || "unknown"}`
        : source.type === "x"
          ? `x:${source.username || source.accountHandle || source.handle || "unknown"}`
        : source.path,
    startedAt: new Date(startedAt).toISOString()
  };

  try {
    let raw;
    let httpStatus = null;

    if (source.type === "url") {
      const response = await fetch(source.url, {
        headers: source.headers || {}
      });
      httpStatus = response.status;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      raw = await response.text();
    } else if (source.type === "file") {
      const absolutePath = path.resolve(rootDir, source.path);
      raw = await fs.readFile(absolutePath, "utf8");
    } else if (source.type === "discord") {
      const discord = await loadDiscordMessages(source);
      const summary = summarizeData(discord.rows);
      const previewRows = discord.skippedReason
        ? [escapeHtml(`status: ${discord.skippedReason}`)]
        : buildPreviewRows(discord.rows, source.previewFields, source.previewLimit || 5);

      if (Array.isArray(discord.channelErrors) && discord.channelErrors.length > 0) {
        for (const chError of discord.channelErrors) {
          previewRows.push(
            escapeHtml(`status: channel ${chError.channel} returned ${chError.status} ${chError.statusText}`)
          );
        }
      }

      return {
        ...baseResult,
        ok: true,
        httpStatus: null,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        summary,
        previewRows,
        detail: discord.skippedReason
          ? "Skipped (token not configured)"
          : Array.isArray(discord.channelErrors) && discord.channelErrors.length > 0
            ? "Discord API (partial)"
            : "Discord API"
      };
      } else if (source.type === "x") {
        const xResult = await loadXTimeline(source);
        const summary = summarizeData(xResult.rows);
        const previewRows = xResult.skippedReason
          ? [escapeHtml(`status: ${xResult.skippedReason}`)]
          : buildPreviewRows(xResult.rows, source.previewFields, source.previewLimit || 5);

        return {
          ...baseResult,
          ok: true,
          httpStatus: null,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          summary,
          previewRows,
          detail: xResult.skippedReason ? "Skipped (token not configured)" : "X API"
        };
    } else {
      throw new Error(`Unsupported source type: ${source.type}`);
    }

    let data;

    if (source.format === "json") {
      data = JSON.parse(raw);
    } else if (source.format === "rss") {
      data = parseRssFeed(raw);
    } else if (source.format === "html") {
      data = parseHtmlSummary(raw, source.url || source.path || "");
    } else {
      data = raw;
    }

    const collection = pickCollection(data, source.dataPath);
    const summary = summarizeData(collection);
    const previewRows = buildPreviewRows(collection, source.previewFields, source.previewLimit || 5);

    return {
      ...baseResult,
      ok: true,
      httpStatus,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary,
      previewRows
    };
  } catch (error) {
    return {
      ...baseResult,
      ok: false,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function generateHtml({ title, subtitle, generatedAt, results }) {
  const successful = results.filter((r) => r.ok).length;
  const failed = results.length - successful;

  const tableRows = results
    .map((result) => {
      const statusClass = result.ok ? "ok" : "fail";
      const statusText = result.ok ? "OK" : "FAILED";
      const metric = result.ok ? `${result.summary.count} (${result.summary.kind})` : "n/a";
      const location = escapeHtml(result.location || "-");
      const detail = result.ok
        ? result.detail || (result.httpStatus
          ? `HTTP ${result.httpStatus}`
          : "Local file")
        : escapeHtml(result.error || "Unknown error");
      return `<tr>
        <td>${escapeHtml(result.label)}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>${metric}</td>
        <td>${result.durationMs} ms</td>
        <td class="mono">${location}</td>
        <td>${detail}</td>
      </tr>`;
    })
    .join("\n");

  const cards = results
    .map((result) => {
      const items = (result.previewRows || []).map((row) => `<li>${row}</li>`).join("\n");
      return `<article class="card ${result.ok ? "" : "error"}">
        <h3>${escapeHtml(result.label)}</h3>
        <p class="meta">${result.ok ? "Latest sample rows" : "Source failed"}</p>
        ${
          result.ok && items
            ? `<ul>${items}</ul>`
            : `<p class="small">${result.ok ? "No preview rows available." : escapeHtml(result.error || "No error details")}</p>`
        }
      </article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f3efe7;
      --ink: #1f2933;
      --accent: #a63d40;
      --accent-2: #1d7874;
      --panel: #fffdf9;
      --line: #d8cfc0;
      --ok: #157f1f;
      --fail: #b42318;
      --mono: "JetBrains Mono", "Consolas", monospace;
      --display: "Space Grotesk", "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--display);
      color: var(--ink);
      background:
        radial-gradient(circle at 10% 10%, #f8d9a0 0%, transparent 35%),
        radial-gradient(circle at 90% 20%, #b8e0d2 0%, transparent 25%),
        linear-gradient(140deg, #f3efe7 0%, #ece3d4 100%);
      min-height: 100vh;
      padding: 2rem 1rem 3rem;
    }

    .wrap {
      max-width: 1100px;
      margin: 0 auto;
    }

    .hero {
      background: linear-gradient(120deg, #fffdf9 0%, #f9f4ea 100%);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 1.5rem;
      box-shadow: 0 12px 35px rgba(57, 45, 26, 0.14);
      animation: fadeIn 700ms ease-out;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.6rem, 4vw, 2.3rem);
      letter-spacing: 0.02em;
    }

    .subtitle {
      margin-top: 0.4rem;
      margin-bottom: 0.8rem;
      color: #5f5a4f;
    }

    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
    }

    .pill {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 999px;
      padding: 0.45rem 0.85rem;
      font-size: 0.9rem;
    }

    .panel {
      margin-top: 1rem;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow-x: auto;
      box-shadow: 0 10px 24px rgba(52, 45, 33, 0.08);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 800px;
    }

    th, td {
      text-align: left;
      padding: 0.8rem 0.9rem;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }

    th {
      background: #f8f4eb;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #5f5a4f;
    }

    .badge {
      border-radius: 999px;
      font-size: 0.75rem;
      padding: 0.22rem 0.55rem;
      color: #fff;
      font-weight: 600;
    }

    .ok { background: var(--ok); }
    .fail { background: var(--fail); }

    .mono {
      font-family: var(--mono);
      font-size: 0.82rem;
      color: #3a3a3a;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 1rem;
      animation: fadeIn 850ms ease-out;
    }

    .card.error {
      border-color: #e5b3ac;
      background: #fff7f5;
    }

    .card h3 {
      margin-top: 0;
      margin-bottom: 0.2rem;
    }

    .meta {
      margin-top: 0;
      margin-bottom: 0.7rem;
      font-size: 0.85rem;
      color: #5f5a4f;
    }

    ul {
      margin: 0;
      padding-left: 1rem;
      display: grid;
      gap: 0.45rem;
      font-size: 0.92rem;
    }

    .small {
      margin: 0;
      color: #5f5a4f;
      font-size: 0.9rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <div class="stats">
        <span class="pill">Generated: ${escapeHtml(generatedAt)}</span>
        <span class="pill">Sources: ${results.length}</span>
        <span class="pill">Successful: ${successful}</span>
        <span class="pill">Failed: ${failed}</span>
      </div>
    </section>

    <section class="panel">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Status</th>
            <th>Items</th>
            <th>Latency</th>
            <th>Location</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </section>

    <section class="cards">
      ${cards}
    </section>
  </div>
</body>
</html>`;
}

async function main() {
  const configRaw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(configRaw);
  const results = [];

  for (const source of config.sources || []) {
    results.push(await loadSource(source));
  }

  const generatedAt = new Date().toISOString();
  const html = generateHtml({
    title: config.title || "Daily Data Report",
    subtitle: config.subtitle || "Automated daily snapshot",
    generatedAt,
    results
  });

  const summaryPayload = {
    title: config.title || "Daily Data Report",
    subtitle: config.subtitle || "Automated daily snapshot",
    generatedAt,
    results
  };

  await fs.writeFile(outputHtmlPath, html, "utf8");
  await fs.writeFile(outputJsonPath, JSON.stringify(summaryPayload, null, 2), "utf8");

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.warn(`Generated report with ${failed.length} failed source(s).`);
  } else {
    console.log("Generated report successfully.");
  }
}

main().catch((error) => {
  console.error("Daily report generation failed:", error);
  process.exitCode = 1;
});