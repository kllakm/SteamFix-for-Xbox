# XboxSteamBridge

Bridging your Steam library seamlessly into the modern PC Xbox App.

[![Release](https://img.shields.io/badge/release-v1.3.1-00E575.svg?style=flat-square)](https://github.com/your-org/SteamFix-for-Xbox/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-107C10.svg?style=flat-square)](https://www.microsoft.com/windows)
[![Gamepad](https://img.shields.io/badge/controller-Xbox%20%26%20Handheld%20Gamepad-107C10.svg?style=flat-square)](#controller-navigation)
[![Handheld](https://img.shields.io/badge/device-ROG%20Ally%20%2F%20Legion%20Go%20Ready-1A9FFF.svg?style=flat-square)](#handheld-experience)
[![License](https://img.shields.io/badge/license-MIT-64748B.svg?style=flat-square)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow.svg?style=flat-square&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/enufstyle)

---

## Overview

The modern PC Xbox App (`Microsoft.GamingApp`) is built to unify your games into a single dashboard, launcher, and handheld game bar. However, it frequently overlooks installed Steam titles stored across secondary drives, custom folders, or removable storage.

**XboxSteamBridge** automatically inspects your Steam installation, queries the PC Xbox App's local database (`%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState`), identifies missing titles, and registers them directly into the Xbox App library with:

- Verified title metadata and executable paths
- Native launch protocols (`steam://run/<appid>`)
- High-definition Steam CDN artwork (`header.jpg` and `library_600x900_2x.jpg`)
- Multi-tier deduplication against existing Xbox and sideloaded games
- Automatic timestamped backups (`.bak`) and one-click database rollback
- Console and handheld UI/UX built for Full Screen Experience (FSE) and Desktop mode
- Full Windows Xbox gamepad controller navigation and touch controls

---

## Console UI and Handheld Experience

Designed from the ground up for handheld PCs (ASUS ROG Ally, Lenovo Legion Go, Steam Deck running Windows) as well as desktop gaming setups:

- **Cinematic Console Aesthetics:** Roomy layout with breathing space, subtle ambient radial gradient background, and no cluttered card borders or nested boxes.
- **Widescreen 16:9 Showcase Cards:** Spacious game showcase cards featuring authentic Steam CDN header banners, clear status indicators, and clean typographic metadata.
- **Tactile Touch Targets:** Generous 44px-48px touch targets across tabs, buttons, checkboxes, and modals for easy navigation on 7-inch and 8-inch touchscreens.
- **Full Screen Experience (FSE):** Dedicated FSE toggle button and shortcut (`F11` or controller `Menu` button) to expand into an immersive borderless console experience.

---

## Controller Navigation

XboxSteamBridge provides out-of-the-box Windows controller support:

- **Spatial Navigation:** Navigate seamlessly across cards, tabs, and action buttons using the D-Pad or Left Analog Stick.
- **Xbox Emerald Halo Glow:** High-visibility green halo glow clearly highlights the active element during controller navigation.
- **Controller Button Shortcuts:**
  - `A`: Select / Toggle game or activate button
  - `B`: Back / Close modals
  - `X`: Toggle Select All
  - `Y`: Scan Steam and Xbox libraries
  - `LB` / `RB`: Cycle previous / next library tabs
  - `Menu (Start)`: Toggle Full Screen Experience (FSE)
  - `View (Select)`: Open Safety Backups manager
- **Dynamic Helper HUD:** A floating, translucent HUD appears in the bottom right corner when a controller is active, displaying real-time button hints.
- **Intelligent Input Switching:** Moving the mouse or touching the display instantly switches to desktop mode and restores the mouse cursor; engaging the controller hides the mouse cursor and enables the gamepad focus ring.

---

## Key Features

- **Automated Steam Library Discovery:**
  - Resolves Steam library locations via Windows Registry (`HKCU` and `HKLM`) and secondary drives.
  - Automatically parses `libraryfolders.vdf` across all mounted storage partitions (e.g., C:, D:, E:, G:).
  - Reads individual `appmanifest_<id>.acf` files to extract `appid`, `name`, `installdir`, and primary executable.
  - Supports adding custom library directories on demand.
- **Deep Xbox App State Inspection & Deduplication:**
  - Parses `CustomLibraryManagement.manifest` in the Xbox App LocalState folder.
  - Eliminates duplicate entries using AppID, normalized game titles, and executable signatures.
  - Ignores uninstalled remote store catalog caches (`AsyncCache.db`) to ensure only actual library entries are displayed.
- **Safety Backups & Rollback:**
  - Automatically detects whether `XboxPcApp.exe` is active and offers graceful closure before database writes to avoid file lock errors.
  - Generates automated timestamped backups (`.bak`) in the `XboxSteamBridge_Backups` directory before every write.
  - Integrated Backups & Rollback manager allows one-click restoration of any snapshot.

---

## Quick Start

### Option 1: Standalone Portable Binary (No Installation)

Download and launch:
```powershell
.\dist\XboxSteamBridge-portable.exe
```

### Option 2: Windows Installer Package

Download and run the installer:
```powershell
.\dist\XboxSteamBridge-Setup.exe
```

---

## Building from Source

### Prerequisites

- Windows 10 or 11 (64-bit)
- Node.js (v20+ recommended)
- npm (v10+)

### Setup

```powershell
# Clone the repository
git clone https://github.com/your-org/SteamFix-for-Xbox.git
cd "SteamFix for Xbox"

# Install dependencies
npm install

# Run in development mode
npm start
```

### Dual Distribution Packaging

To compile both the Standalone Portable Executable and the NSIS Windows Setup package:

```powershell
npm run dist
```

Outputs generated in `/dist/`:
- `dist/XboxSteamBridge-portable.exe`
- `dist/XboxSteamBridge-Setup.exe`

---

## Support & Donations

If XboxSteamBridge made organizing your PC handheld or desktop gaming library easier, please consider supporting continued development and maintenance:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-enufstyle-orange.svg?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/enufstyle)

**Buy Me a Coffee:** [www.buymeacoffee.com/enufstyle](https://www.buymeacoffee.com/enufstyle)

---

## Project Governance

This project adheres to the quality standards defined in [PROJECT_RULES.md](PROJECT_RULES.md):
- Version increments follow Semantic Versioning (SemVer).
- Every release validates both portable and installer binaries.
- Release notes and changelogs are updated with every feature release.

---

## Changelog

### [v1.3.1] - 2026-10-12
- **FSE Freeze Resolution:**
  - Fixed an unhandled startup exception in legacy DOM event binding that prevented the FSE toggle button, `F11` shortcut, and gamepad `Menu` button from firing.
  - Added full defensive null guards across event listeners and ribbon statistics.
- **Two-Tier Console Layout Architecture:**
  - Separated header into a dedicated Horizon Topbar (brand and system utilities) and an expansive Category Tabs Strip (`Missing`, `Synced`, `All Steam`, `Xbox Library`).
  - Completely eliminated horizontal button collision and prevented the `Scan` button from clipping on narrow window widths or handheld 720p/800p displays.
- **Anti-Squash Layout Hardening:**
  - Locked touch checkboxes to rigid 22x22px square dimensions (`flex-shrink: 0`) to prevent vertical oval distortion.
  - Enforced `white-space: nowrap` across all pills, tabs, status indicators, and buttons, preventing awkward text wrapping inside button capsules.
  - Added responsive flex-wrapping to action buttons to ensure smooth reflow across all display sizes.

### [v1.3.0] - 2026-10-12
- **Console & Handheld UI/UX Overhaul:**
  - Redesigned interface into an authentic, spacious game/console dashboard suited for both Full Screen Experience (FSE) and Desktop mode.
  - Clean Horizon navigation header with streamlined tabs (`Missing`, `Synced`, `All Steam`, `Xbox Library`).
  - Spacious 16:9 widescreen showcase game cards with smooth hover scaling and high-contrast typography.
  - High-visibility Xbox emerald halo focus states for gamepad and touch selection.
  - Replaced busy status containers and nested cards with a clean contextual action bar.
- **GitHub Documentation Polish:**
  - Modernized README with standard shields/badges and clean formatting.
  - Removed informal emoji icons from section headers.
  - Added dedicated Support & Donations section for Buy Me a Coffee (`www.buymeacoffee.com/enufstyle`).

### [v1.2.0] - 2026-10-12
- **Windows Controller Navigation:**
  - Xbox gamepad D-pad and left analog stick spatial navigation.
  - Dedicated controller shortcuts (`A` Select, `B` Back, `X` Select All, `Y` Scan, `LB/RB` Tabs, `Menu` FSE, `View` Backups).
  - Floating controller hints HUD layer with dynamic auto-hide.
  - Cursor auto-hiding during gamepad interaction with instant mouse wake-up.
- **Full Screen Experience (FSE):**
  - Added FSE toggle button and shortcut (`F11` or `Menu` button) for immersive handheld gaming.

### [v1.1.1] - 2026-10-12
- **Responsive Layout Improvements:**
  - Resolved button truncation and wrapping issues when the window is resized.
  - Removed uninstalled Microsoft Store cache items (`AsyncCache.db`) to ensure accurate library counts.

### [v1.1.0] - 2026-10-12
- **Touch & Branding Optimization:**
  - Standardized 44px-48px touch targets for ROG Ally, Legion Go, and Windows handhelds.
  - Integrated high-resolution unified application logo across executable, installer, titlebar, and UI.

### [v1.0.0] - 2026-10-12
- **Initial Release:**
  - Complete Steam library scanner and PC Xbox App LocalState manifest injector.
  - Automated backups, rollback manager, and deduplication engine.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
