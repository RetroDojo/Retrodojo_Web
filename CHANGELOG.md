# Changelog

All notable changes to RetroDojo Web are documented here.

## [0.3.0] — 2026-04-26
### Added
- `systems.json` — emulation platform/system data repository with console, handheld, and POC categories
- Generation-era tier IDs replacing abstract 7-tier system (e.g., `n64_dc_saturn`, `gc_wii_3ds`)
- Multi-service streaming entries (GameNative, Nvidia, Steam) replacing Moonlight-only

### Changed
- **Full site rebrand**: neon green "hacker terminal" theme → warm dojo palette derived from brand banner
  - Accent: `#00ff41` → `#FFD700` (brand gold)
  - Background: `#0a0a0a` → `#1E0F00` (dark brown)
  - Card BG: `#111` → `#2A1A08`
  - Text: `#ccc` → `#F5E6C8` (cream/gi white)
  - Red accent: `#B11217` (brand red)
- **Typography**: `Courier New` → Press Start 2P (Google Fonts) for headings, labels, badges, nav; `Courier New` retained for body/table data readability
- All badge, tier, and cell-rating colors updated to match warm palette
- Tier platform type breakdown added to chipsets.html (console/handheld/POC)

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
