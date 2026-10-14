# XboxSteamBridge

Bridging your Steam library seamlessly into the modern PC Xbox App.

[![Release](https://img.shields.io/badge/release-v1.6.0-00A2FF.svg?style=flat-square)](https://github.com/your-org/SteamFix-for-Xbox/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-107C10.svg?style=flat-square)](https://www.microsoft.com/windows)
[![Gamepad](https://img.shields.io/badge/controller-Xbox%20%26%20Handheld%20Gamepad-107C10.svg?style=flat-square)](#controller-navigation)
[![Handheld](https://img.shields.io/badge/device-ROG%20Ally%20%2F%20Legion%20Go%20Ready-00A2FF.svg?style=flat-square)](#handheld-experience)
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
- **Console Stepper & Navigation:** Full LB / RB section hopping, LT / RT category switching, and glowing cyan focus halos.
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

### [v1.6.0] - 2026-10-14
- **Rigid 340px Card Minimum Dimensions & Responsive Artwork Scaling:**
  - Standardized all game cards with rigid 340px min-width and 295px min-height across every page and category tab (`Missing`, `Synced`, `All Steam`, `Hidden`, `Xbox Library`), permanently preventing cards from collapsing or scaling unintelligently.
  - Locked 16:9 widescreen banners to guaranteed 180px minimum height with two-line title clamping for crystal-clear readability.
- **Overhauled 2D Spatial Controller Navigation Engine:**
  - True 2D spatial grid navigation with column detection: navigating Up/Down dynamically moves across rows, and Left/Right moves within rows.
  - Continuous `requestAnimationFrame` polling loop ensures responsive input without frame drops or sleep throttling.
  - Foreground window focus on launch enables immediate gamepad input without requiring a mouse click.
  - Dedicated controller mappings: `(A)` Select / Toggle or Uninject, `(B)` Back, `(X)` Toggle Select All, `(Y)` Scan, `(LB/RB)` Top Pages, `(LT/RT)` Category Tabs, `(☰)` FSE.
- **Console Horizon Topbar & Clean Centered Navigation:**
  - Center menu navigation (`Library`, `Sync Center`, `Backups`, `Settings`) centered at all times with zero pill borders, using high-end typographic color and luminous glowing underline bars.
  - Brand header stripped to minimal clean logo mark with title text and version badges removed from topbar.
  - Cluttered "Xbox App Closed" and "Controller Ready" pills removed; controller input navigates immediately when plugged in.
  - Scan button replaced with clean refresh icon button; FSE button replaced with dynamic expand / contract icon.
- **Full-Page Architecture with Directional Slide-In Transitions:**
  - Replaced Backups and Settings modals with dedicated full-page console views.
  - Smooth GPU-accelerated directional slide transitions (`slide-left` and `slide-right`) following navigation direction.
  - Dedicated Sync Center page featuring an injection hero dashboard and batch selection controls.
- **Full-Screen Dynamic Ambient Parallax Background:**
  - Multi-layer radial ambient glow canvas shifting position and gradient tones smoothly as users switch between tabs and pages.
- **Unobtrusive Xbox App Process Notification:**
  - Discarded persistent process pills; when Xbox App is active, an unobtrusive pulsing alert icon appears in the topbar utilities.
- **Native Xbox Manifest GUID Schema Fix & Robust Uninject Support:**
  - Replaced legacy keys with deterministic UUIDv4-compliant GUIDs in `CustomLibraryManagement.manifest`, resolving `FormatException` crashes when adding apps manually in the PC Xbox App "Apps" section.
  - Purged rogue provider directories and stray files to guarantee Xbox App database health.
  - Prominent "Uninject" capability across all synced and Xbox titles with automatic timestamped safety backups.

### [v1.5.1] - 2026-10-13
- **Universal Windows Controller Engine:**
  - Full compatibility with all Windows-supported input devices: native XInput, DirectInput, Windows.Gaming.Input (WGI), Bluetooth gamepads, ASUS ROG Ally, Lenovo Legion Go, and virtual controllers.
  - Chromium engine flags enabled for unthrottled gamepad polling and USB device access (`disable-usb-blocklist`, `enable-gamepad-button-axis-events`, `disable-background-timer-throttling`, `disable-renderer-backgrounding`).
  - POV Hat switch decoding on generic DirectInput controllers across axes 9 and 4.
  - Refined analog stick deadzone to `0.22` with repeat debounce for fluid spatial navigation.
- **Intelligent Desktop vs Controller State Switching:**
  - Default Desktop Mode: mouse cursor visible, controller button prompts HUD and bumper/trigger badges completely hidden, card halos disabled.
  - Controller Mode: touching any controller button, D-pad, or stick immediately hides the mouse cursor (`cursor: none`), displays the docked footer controller legend HUD and bumper/trigger badges, and illuminates glowing cyan focus halos.
  - Instant Desktop Mode Return: moving the mouse deliberately (>25px) or clicking immediately restores standard mouse cursor, hides controller button hints, and removes halos.
  - Handheld gyro and stick mouse-emulation protection (700ms cooldown) prevents micro-jitter from prematurely kicking users out of controller mode.
- **Full Screen Experience (FSE) Fix & Overhaul:**
  - Seamless borderless fullscreen toggle via `F11`, header `FSE` button, and controller `Menu (Start)` button.
  - Added dedicated `.fse-active` responsive layout stylesheet rules optimizing topbar, category strip, cards grid, and footer for handheld 16:9 / 16:10 displays.
  - Robust IPC and HTML5 fullscreen fallback mechanism.
- **Documentation & Terminology Cleanup:**
  - Removed all references to external UI code names from the README and source comments.

### [v1.5.0] - 2026-10-13
- **Console-First Navigation UI Redesign:**
  - Horizon Topbar overhauled with centered Section Navigation (`Library`, `Sync Center`, `Backups`, `Settings`) flanked by `[LB]` and `[RB]` shoulder bumper badges.
  - Sub-Navigation category strip flanked by `[LT]` and `[RT]` trigger badges, featuring `Missing from Xbox`, `Synced`, `All Steam`, `Hidden`, and `Xbox Library` with count badges and signature glowing cyan underline indicator.
  - Section Header strip (`My Games | Steam Bridge (X games)`) with capsule search bar, custom checkbox selector, and primary glowing CTA button.
  - Docked Console Footer Base HUD displaying live connection dots, package state path, SemVer badge, and gamepad button prompt badges (`(A) Select`, `(B) Back`, `(X) Toggle All`, `(Y) Scan`, `(LB/RB) Section`, `(LT/RT) Category`, `(☰) FSE`).
  - Enhanced controller focus halo with vibrant cyan glow ring and subtle scale lift on all interactive elements.
- **Minimalist Brand Logo & Iconography Overhaul:**
  - Redesigned application logo from scratch into an ultra-minimal, modern flat vector emblem fusing the Xbox crescent and Steam crank piston in emerald green and electric cyan gradient.
  - Recompiled Windows application icon (`build/icon.ico`), installer graphics (`build/icon.png`), and in-app assets (`logo.png`, `logo-64.png`).
  - Added minimalist platform badges directly onto game card headers (Steam and Xbox circular vector marks).
  - Standardized all UI icons across buttons, search bar, modals, and status indicators with clean 2px vector strokes.
- **Settings & Library Management Center:**
  - Added dedicated Settings modal (`#settingsModal`) to inspect all detected Steam library directories.
  - Interactive custom folder addition and removal with real-time automatic library rescanning.
  - Reset option to unhide all previously hidden titles with a single click or button tap.

### [v1.4.0] - 2026-10-13
- **Gamepad & Controller Engine Overhaul:**
  - Multi-gamepad discovery across all controller slots, eliminating silent failures on systems with virtual controller adapters or background utilities.
  - Added smart mouse movement filtering (requires cumulative distance > 30px), completely preventing micro-jitter from optical mice or handheld gyros from prematurely deactivating controller navigation.
  - First-class Keyboard navigation fallback (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Enter`, `Space`, `Escape`, `Tab`) for seamless interaction in Desktop mode on ROG Ally, Legion Go, and Windows handhelds.
  - Dynamic Gamepad Status Pill in Horizon Topbar displaying real-time controller connectivity (`Xbox Controller Active`, `Gamepad Connected`).
- **Responsive Game Tiles & Clean Proportions:**
  - Standardized showcase cards with rigid 340px minimum width (`minmax(340px, 1fr)`) and media query breakpoints (down to 290px and 1-column mobile/handheld layout) to completely eliminate squashed or clipped cards.
  - Authentic 16:9 widescreen presentation with minimum 175px artwork height, ensuring high-definition CDN banners never minimize or overlap selection checkboxes.
  - Dynamic 2-line title clamping (`-webkit-line-clamp: 2`) with uniform height to keep long game titles 100% legible, clean, and unclipped.
  - Formatted metadata tags and flexible card action bar with dedicated tooltips and clear visual hierarchy.
- **Deep Xbox App Discovery & Zero False Positives:**
  - Comprehensive inspection across Xbox App's `ThirdPartyLibraries` (`steam`, `epic`, `gog`, `bnet`, `ea`, `ubi`) and `ExternalAppShortcut` repositories.
  - Games previously scanned or added to the Xbox App library are now accurately identified and will NEVER appear as injectable in the "Missing" tab.
  - Multi-attribute deduplication engine matching AppIDs, launch protocols, normalized titles, executable filenames, and installation folders.
- **Full Game Uninject & Database Rollback:**
  - Added one-click "Uninject" capability directly on game cards in "Synced" and "Xbox Library" tabs.
  - Safely purges injected entries from `CustomLibraryManagement.manifest`, `ThirdPartyLibraries`, and `ExternalAppShortcut`, removing companion thumbnail files while generating automatic timestamped `.bak` safety snapshots.
  - Interactive uninject confirmation dialog with real-time UI updates and automated rescan.

### [v1.3.4] - 2026-10-12
- **Empty Library State Cleanup & Polish:**
  - Removed remaining "Load Samples" CTA button and click listener from the "No Steam Games Detected" empty view.
  - Updated empty state description text to remove references to loading sample titles, guiding users directly to add custom Steam library folders for Xbox synchronization.
  - Linked controller and keyboard focus navigation directly to the "Add Folder" button when the library is empty.

### [v1.3.3] - 2026-10-12
- **Title Hiding & Dedicated "Hidden" Category Tab:**
  - Added ability to hide any game from Xbox injection suggestions and auto-selection with a single click or tap.
  - Added dedicated "Hidden" tab in the navigation strip with full count badge (`badgeHidden`) to review and unhide hidden titles at any time.
  - Persistent storage preserves hidden game preferences across app restarts.
  - Controller navigation updated to seamlessly cycle across all 5 library categories (`Missing`, `Synced`, `All Steam`, `Hidden`, `Xbox Library`).
- **Cleaned Action Controls:**
  - Removed sample fixtures buttons from the action bar and empty library state for a streamlined, clutter-free console workflow.
- **Living Glass Console Interface & Empty State Proportions:**
  - Deep atmospheric obsidian aesthetic (`#080c10`) with frosted acrylic horizon strips and translucent pill buttons.
  - Fixed empty-state SVG sizing by constraining icon to 28px inside a 60px frosted circular badge.

### [v1.3.2] - 2026-10-12
- **Living Glass UI & Empty State Proportions:**
  - Modernized visual aesthetics with frosted acrylic panels, soft blur, and refined translucent pills.
  - Fixed empty library state icon sizing with circular badge and proper dimensions.

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
