# Project Rules & Development Workflow: XboxSteamBridge

This document establishes the mandatory **Definition of Done (DoD)** that must be strictly followed on **every single change, prompt, or bug fix** made to this repository.

## 📜 Definition of Done (Mandatory on Every Prompt)

Whenever any code, bug fix, feature, or UI modification is performed in this repository, you **MUST** complete all of the following steps before considering the task complete:

### 1. Implement & Verify Changes

* Complete the requested code implementation, bug fix, optimization, or UI design change.
* Verify that changes compile cleanly and pass any build checks without warnings or errors.

### 2. Auto-Increment Version (SemVer)

* Evaluate whether the change represents a:
* Major (breaking architectural changes, complete re-architecture)
* Minor (new feature, metadata scraper, new UI views)
* Patch (bug fixes, UI polish, performance improvements, documentation changes)


* Update the version in the project manifest (`package.json` or `.csproj`).
* Ensure the version number is synchronized and dynamically displayed in the application UI (e.g., Titlebar badge, Footer, or Settings modal).

### 3. Update Documentation & Changelog (`README.md`)

* Add a new entry under `## Changelog` in `README.md`.
* Include the version number, release date (`YYYY-MM-DD`), and a clear bulleted list of what was added, improved, or fixed.
* Keep the setup, build, and feature documentation in `README.md` completely up to date.

### 4. Recompile Both Distribution Binaries (`/dist/`)

* Execute the dual-build release command to produce both target distributions:
1. Standalone Portable Executable: `dist/XboxSteamBridge-portable.exe`
2. Windows Installer Package: `dist/XboxSteamBridge-Setup.exe`


* NEVER mark a prompt or turn complete without verifying that the compiled binaries in `/dist/` reflect the latest changes.

### 5. Provide One-Click GitHub CLI Release Command

* In your final response on every prompt, ALWAYS include a ready-to-run GitHub CLI PowerShell command formatted with the current version and concise release notes:
`gh release create v<VERSION> .\dist\XboxSteamBridge-portable.exe .\dist\XboxSteamBridge-Setup.exe --title "v<VERSION> - <TITLE>" --notes "<CONCISE_CHANGELOG_SUMMARY>"`
