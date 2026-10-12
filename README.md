# XboxSteamBridge

<p align="center">
  <strong>Bridge your Steam library seamlessly into the modern PC Xbox App.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.1-00E575.svg?style=flat-square" alt="Version 1.1.1" />
  <img src="https://img.shields.io/badge/platform-Windows-107C10.svg?style=flat-square" alt="Platform Windows" />
  <img src="https://img.shields.io/badge/device-ROG%20Ally%20%2F%20Handheld%20Ready-1A9FFF.svg?style=flat-square" alt="Handheld Ready" />
  <img src="https://img.shields.io/badge/framework-Electron%20%2B%20Node.js-1A9FFF.svg?style=flat-square" alt="Electron + Node.js" />
  <img src="https://img.shields.io/badge/license-MIT-64748B.svg?style=flat-square" alt="License MIT" />
</p>

---

## 🎮 Overview

The modern PC Xbox App (`Microsoft.GamingApp`) is designed to aggregate your PC games into a centralized dashboard and handheld game bar. However, it frequently misses installed Steam games across secondary drives or non-standard library folders.

**XboxSteamBridge** scans your local Steam libraries, reads the Xbox App's local state database (`%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState`), identifies any installed Steam games that the Xbox app failed to integrate, and injects them into the Xbox App's library with:
- Full Title Metadata and install locations
- Official launch protocols (`steam://run/<appid>`)
- High-definition Steam CDN grid artwork (`https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg` and `library_600x900_2x.jpg`)
- Intelligent deduplication against native Xbox and existing sideloaded titles
- Automated safety backups (`.bak`) and one-click rollback protection
- **ROG Ally & Handheld PC Touch Optimization:** Generous touch targets (44px-48px+), whole-card tap selection, high-contrast readable typography, and collapsible diagnostics drawer.
- **Unified Brand Identity:** Bespoke high-resolution icon artwork consistently utilized across installer, portable executable, window titlebar, and in-app header.

---

## ✨ Key Features

- **ROG Ally & Handheld Touch Optimization:**
  - Designed specifically for 7-inch handheld screens (ROG Ally, Legion Go, Steam Deck running Windows).
  - Whole-surface tap selection for game cards—no precision checkbox tapping required.
  - Generous 44px-48px touch targets across tabs, buttons, inputs, and modals.
  - Less busy, decluttered status ribbon and collapsible live activity drawer to maximize game browsing view.
- **Unified High-Definition App Icon & Identity:**
  - High-quality Xbox emerald and Steam cyan fusion emblem embedded across the app.
  - Multi-resolution Windows ICO (256x256 down to 16x16) for `XboxSteamBridge.exe`, NSIS installer package, portable binary, and titlebar.
- **Automated Steam Library Discovery:**
  - Discovers Steam installation paths via Windows Registry (`HKCU\Software\Valve\Steam`, `HKLM\SOFTWARE\Valve\Steam`, `HKLM\SOFTWARE\WOW6432Node\Valve\Steam`) and fallback drives.
  - Automatically parses `libraryfolders.vdf` to discover all mounted Steam library drives (D:, E:, G:, etc.).
  - Reads and extracts `appmanifest_<id>.acf` to capture `appid`, `name`, `installdir`, and primary executable.
  - Allows manual addition of custom Steam library folders.
- **Deep Xbox App State Inspection & Deduplication:**
  - Reads `CustomLibraryManagement.manifest` and `ThirdPartyLibraries\CustomLibraryManagement\CustomLibraryManagement.manifest`.
  - Rigorously deduplicates against existing Xbox entries using App IDs, normalized title matching (stripping punctuation/trademarks), and executable binaries.
  - Excludes misleading uninstalled remote store catalog caches (`AsyncCache.db`), focusing purely on games genuinely in the user's custom library.
- **Process Safety & Automated Backups:**
  - Detects if `XboxPcApp.exe` or background services are active and handles graceful closure to release SQLite/file locks.
  - Automatically generates timestamped backups (`.bak`) in `%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\XboxSteamBridge_Backups` before writing.
  - Provides a built-in **Backup & Rollback Manager** to revert changes at any time.

---

## 🚀 Quick Start & Installation

### Option 1: Standalone Portable Binary (No Installation)
Download and run:
```powershell
.\dist\XboxSteamBridge-portable.exe
```

### Option 2: Windows Installer
Download and execute the installer:
```powershell
.\dist\XboxSteamBridge-Setup.exe
```

---

## 🛠️ Development & Building

### Prerequisites
- Windows 10/11 (x64)
- Node.js (v20+ recommended)
- npm (v10+)

### Setup
```powershell
# Clone the repository
git clone https://github.com/your-org/SteamFix-for-Xbox.git
cd "SteamFix for Xbox"

# Install dependencies
npm install

# Start in development mode
npm start
```

### Dual-Build Release Packaging
To recompile both the Standalone Portable Executable and the Windows Installer Package into `/dist/`:
```powershell
npm run dist
```
Outputs produced:
- `dist/XboxSteamBridge-portable.exe`
- `dist/XboxSteamBridge-Setup.exe`

---

## 📜 Definition of Done & Project Governance

XboxSteamBridge strictly enforces the mandatory workflow rules defined in [PROJECT_RULES.md](PROJECT_RULES.md):
1. **Implement & Verify Changes:** Clean code, passing tests, and no runtime errors.
2. **Auto-Increment Version (SemVer):** Synchronized in `package.json`, Titlebar badge, and Footer.
3. **Update Documentation & Changelog (`README.md`):** Complete release history and setup notes.
4. **Recompile Both Distribution Binaries (`/dist/`):** Both portable executable and setup installer verified.
5. **Provide One-Click GitHub CLI Release Command:** Formatted with version tag and concise summary.

---

## ## Changelog

### [v1.1.1] - 2026-10-12
- **Responsive Layout & Crop Prevention:**
  - Separated navigation tabs and action buttons into a two-tier command layout (`toolbar-nav` and `action-command-bar`).
  - Added responsive flex-wrapping so `Add Folder`, `Samples`, and `Sync to Xbox App` are never cut off or pushed off screen, even when the window is resized halfway or running in windowed mode.
- **Removed Phantom "1488 in Xbox App" Store Cache:**
  - Removed reading of `AsyncCache.db` product summaries (which was caching remote Microsoft Store catalog items browsed over HTTP rather than actual installed games).
  - Xbox library count now accurately reflects only genuinely registered custom and bridged titles in `CustomLibraryManagement.manifest`.
  - Eliminated false-positive deduplication collisions against unowned store catalog items.

### [v1.1.0] - 2026-10-12
- **ROG Ally & Handheld Touch Optimization:**
  - Decluttered layout: replaced crowded multi-card rows with an expansive Handheld Status Ribbon.
  - Whole-card touch selection: tapping anywhere on a missing game card now toggles selection instantly for thumb navigation.
  - Increased base typography to 15px/16px and enlarged headings/badges for handheld display legibility.
  - Standardized all buttons, inputs, tabs, and checkboxes to minimum 44px-48px touch targets.
  - Implemented collapsible live diagnostics drawer to maximize screen estate for game browsing.
  - Added instant search clear button and touch response animations.
- **Unified High-Definition App Branding:**
  - Created and integrated a bespoke Xbox & Steam fusion emblem with neon green and cyan glow accents.
  - Generated multi-resolution Windows `.ico` asset (256x256, 128x128, 64x64, 48x48, 32x32, 16x16).
  - Uniform icon applied across NSIS Windows installer, portable executable, window titlebar, and in-app UI header.

### [v1.0.0] - 2026-10-12
- **Initial Release:** Complete desktop application implementation for Windows.
- **Steam Discovery Engine:** Full VDF and ACF parser supporting multiple library drives and custom folders.
- **Xbox App LocalState Inspector:** SQLite and JSON manifest reader for `%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState`.
- **Deduplication Pipeline:** Multi-level title, AppID, and executable matching to eliminate duplicate entries.
- **Safety & Injection Pipeline:** Automatic timestamped `.bak` backups and graceful Xbox process handling.
- **Modern UI Dashboard:** Built with dark gaming aesthetics, Xbox green and Steam blue accents, live search, and activity console.
- **Dual Packaging:** Configured `electron-builder` producing `XboxSteamBridge-portable.exe` and `XboxSteamBridge-Setup.exe`.
