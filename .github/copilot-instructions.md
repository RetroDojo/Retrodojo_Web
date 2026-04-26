# RetroDojo Web — Copilot Instructions

## Project Overview
Personal web hub hosted on Azure Static Web Apps. Static frontend (`src/`) + Azure Functions API (`api/`). Deployed from GitHub via GitHub Actions on push to `main` or `dev`.

## Environments
| Environment | Branch | URL |
|---|---|---|
| Production | `main` | https://gray-bush-05176c40f.7.azurestaticapps.net |
| Dev/Staging | `dev` | https://zealous-grass-0f449b70f.7.azurestaticapps.net |

To look up URLs anytime:
```bash
az staticwebapp list --resource-group retrodojo-rg --query "[].{Name:name, URL:defaultHostname}" -o table
```

## Azure Resources
- **Subscription:** Visual Studio Enterprise (`edde4ab4-73c5-4a10-a722-7ae38c55ea2f`)
- **Resource group:** `retrodojo-rg` (East US 2)
- **Production SWA:** `retrodojo-web`
- **Dev SWA:** `retrodojo-web-dev`

## GitHub
- **Repo:** https://github.com/RetroDojo/Retrodojo_Web (personal account: `RetroDojo`)
- **Identity:** All commits use `RetroDojo <279508929+RetroDojo@users.noreply.github.com>` — real name is intentionally not exposed
- **Auth:** Use PAT stored separately; run `$env:GITHUB_TOKEN = "<pat>"` before `gh` commands

## Project Structure
```
src/          Static site — HTML/CSS/JS served at root
api/hello/    Azure Function — GET /api/hello (proves full stack)
.github/workflows/
  azure-static-web-apps-gray-bush-05176c40f.yml   ← prod CI/CD
  azure-static-web-apps-zealous-grass-0f449b70f.yml ← dev CI/CD
```

## Deploy Workflow
```bash
# Develop
git checkout dev
# ...edit...
git push personal dev        # → deploys to Dev URL

# Release to prod
git checkout main
git merge dev
git push personal main       # → deploys to Production URL
```

## Add a Custom Domain (when ready)
```bash
az staticwebapp hostname set \
  --name retrodojo-web \
  --resource-group retrodojo-rg \
  --hostname yourdomain.com
```
Azure auto-provisions a free TLS cert. No other changes needed.

## Local API Development
```bash
cd api && func start         # runs Functions at http://localhost:7071
```
Open `src/index.html` directly in browser — it will call the local API.

## Standards Reference
Brand, content, and production standards live in the private repo:
**`RetroDojo/RetroDojo-Standards`** (private) — https://github.com/RetroDojo/RetroDojo-Standards

Key files to reference when building web features:
- `00_Canonical/Brand & Design System.md` — colors, fonts, visual identity
- `02_Content_Format/Content Pillars.md` — content categories for the site
- `04_Reference_Data/` — devices, games, emulators, benchmarks (potential web pages)

## Key Conventions
- `src/` is the app root (`--app-location "src"`) — no build step, files served as-is
- `api/` uses Azure Functions v4 Node.js runtime
- `CHANGELOG.md` at repo root tracks all significant changes
- When adding new pages or features, check `RetroDojo/RetroDojo-Standards` standards first
