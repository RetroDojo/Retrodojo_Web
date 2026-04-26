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

## Add a Custom Domain

```bash
az staticwebapp hostname set \
  --name retrodojo-web \
  --resource-group retrodojo-rg \
  --hostname yourdomain.com
```
Azure provisions a free TLS cert automatically.
