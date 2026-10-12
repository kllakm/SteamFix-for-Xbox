# XboxSteamBridge

<p align="center">
  <strong>Bridge your Steam library seamlessly into the modern PC Xbox App.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-00E575.svg?style=flat-square" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/platform-Windows-107C10.svg?style=flat-square" alt="Platform Windows" />
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

---

## ✨ Key Features

- **Automated Steam Library Discovery:**
  - Discovers Steam installation paths via Windows Registry (`HKCU\Software\Valve\Steam`, `HKLM\SOFTWARE\Valve\Steam`, `HKLM\SOFTWARE\WOW6432Node\Valve\Steam`) and fallback drives.
  - Automatically parses `libraryfolders.vdf` to discover all mounted Steam library drives (D:, E:, G:, etc.).
  - Reads and extracts `appmanifest_<id>.acf` to capture `appid`, `name`, `installdir`, and primary executable.
  - Allows manual addition of custom Steam library folders.

- **Deep Xbox App State Inspection & Deduplication:**
  - Reads `CustomLibraryManagement.manifest`, `ThirdPartyLibraries\CustomLibraryManagement\CustomLibraryManagement.manifest`, and `AsyncCache.db`.
  - Rigorously deduplicates against existing Xbox entries using App IDs, normalized title matching (stripping punctuation/trademarks), and executable binaries.

- **Process Safety & Automated Backups:**
  - Detects if `XboxPcApp.exe` or background services are active and handles graceful closure to release SQLite/file locks.
  - Automatically generates timestamped backups (`.bak`) in `%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\XboxSteamBridge_Backups` before writing.
  - Provides a built-in **Backup & Rollback Manager** to revert changes at any time.

- **Modern Desktop Dashboard:**
  - Real-time statistics: Total Steam Games, Registered Xbox Games, Missing vs Synced counts.
  - Filterable tabs: *Missing from Xbox*, *Already Synced*, *All Steam Games*, and *Xbox Library*.
  - Live activity and diagnostic terminal drawer.
  - Dynamic SemVer badge synchronization in titlebar and footer.

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

### [v1.0.0] - 2026-10-12
- **Initial Release:** Complete desktop application implementation for Windows.
- **Steam Discovery Engine:** Full VDF and ACF parser supporting multiple library drives and custom folders.
- **Xbox App LocalState Inspector:** SQLite and JSON manifest reader for `%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState`.
- **Deduplication Pipeline:** Multi-level title, AppID, and executable matching to eliminate duplicate entries.
- **Safety & Injection Pipeline:** Automatic timestamped `.bak` backups and graceful Xbox process handling.
- **Modern UI Dashboard:** Built with dark gaming aesthetics, Xbox green and Steam blue accents, live search, and activity console.
- **Dual Packaging:** Configured `electron-builder` producing `XboxSteamBridge-portable.exe` and `XboxSteamBridge-Setup.exe`.
