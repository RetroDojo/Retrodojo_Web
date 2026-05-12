# RetroDojo Web

Personal web hub — static site + Azure Functions API, hosted on Azure Static Web Apps.

## Environments
| | Branch | URL |
|---|---|---|
| 🟢 Production | `main` | https://gray-bush-05176c40f.7.azurestaticapps.net |
| 🔵 Dev | `dev` | https://zealous-grass-0f449b70f.7.azurestaticapps.net |

> To look these up anytime: `az staticwebapp list --resource-group retrodojo-rg --query "[].{Name:name, URL:defaultHostname}" -o table`

## Structure

```
src/        Static site (HTML/CSS/JS)
api/        Azure Functions (backend API)
```

## Local Development

**Static site** — open `src/index.html` in a browser, or use any static file server.

**API (Azure Functions)**
```bash
cd api
npm install
func start
```
Then visit http://localhost:7071/api/hello

## Deploy

Push to `main` → GitHub Actions auto-deploys to Azure.

## Daily Data Agent (Automated HTML Report)

This repo includes a daily automation that collects configured data sources and publishes a formatted HTML report:

- Config: `src/data/daily-report-sources.json`
- Generator: `.github/scripts/generate-daily-report.mjs`
- Output HTML: `src/daily-report.html`
- Output JSON snapshot: `src/data/daily-report-latest.json`
- Schedule workflow: `.github/workflows/daily-data-agent.yml`

### Run Locally

```bash
node .github/scripts/generate-daily-report.mjs
```

### Configure Data Sources

Edit `src/data/daily-report-sources.json` and add/update `sources` entries.

Supported source shapes:

```json
{
  "id": "your-source-id",
  "label": "Friendly Name",
  "type": "url",
  "format": "json",
  "url": "https://example.com/api/data",
  "dataPath": "results.items",
  "headers": {
    "Authorization": "Bearer ${TOKEN_IF_NEEDED}"
  },
  "previewFields": ["name", "value"],
  "previewLimit": 5
}
```

or local file:

```json
{
  "id": "local-dataset",
  "label": "Local Dataset",
  "type": "file",
  "format": "json",
  "path": "src/data/devices.json",
  "dataPath": "devices",
  "previewFields": ["name", "brand"],
  "previewLimit": 5
}
```

Use `dataPath` when the JSON response is wrapped (for example `{ "_meta": {...}, "devices": [...] }`).

The GitHub Action runs daily at `06:00 UTC` and can also be triggered manually from the Actions tab.

## Add a Custom Domain

```bash
az staticwebapp hostname set \
  --name retrodojo-web \
  --resource-group retrodojo-rg \
  --hostname yourdomain.com
```
Azure provisions a free TLS cert automatically.
