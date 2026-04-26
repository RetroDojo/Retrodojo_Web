# RetroDojo Web

Personal web hub — static site + Azure Functions API, hosted on Azure Static Web Apps.

**Live:** https://gray-bush-05176c40f.7.azurestaticapps.net

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
