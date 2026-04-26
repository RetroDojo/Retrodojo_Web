# Changelog

All notable changes to RetroDojo Web are documented here.

## [0.2.0] — 2026-04-26
### Added
- Dev/staging environment (`dev` branch → `retrodojo-web-dev` Azure SWA)
- Separate production environment (`main` branch → `retrodojo-web` Azure SWA)
- `.github/copilot-instructions.md` — documents architecture, URLs, and workflow for future sessions
- `CHANGELOG.md` — this file

### Changed
- Git identity anonymized: all commits (past + future) authored as `RetroDojo` with GitHub noreply email — real name not exposed publicly

## [0.1.0] — 2026-04-26
### Added
- Initial project scaffold: `src/index.html`, `src/styles.css` (retro terminal theme)
- Azure Functions API: `GET /api/hello` — returns live status message + timestamp
- GitHub Actions CI/CD via Azure Static Web Apps auto-wired workflow
- Azure resource group `retrodojo-rg` (East US 2, Visual Studio Enterprise subscription)
- Production Azure Static Web App `retrodojo-web` — Free tier
- Live URL: https://gray-bush-05176c40f.7.azurestaticapps.net
