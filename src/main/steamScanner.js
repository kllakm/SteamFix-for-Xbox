const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseVdf } = require('./vdfParser');

/**
 * Common ignored executable filenames
 */
const IGNORED_EXES = new Set([
  'unins000.exe',
  'uninstall.exe',
  'crashreporter.exe',
  'crashpad_handler.exe',
  'unitycrashhandler64.exe',
  'unitycrashhandler32.exe',
  'dxsetup.exe',
  'vcredist_x64.exe',
  'vcredist_x86.exe',
  'dotNetFx40_Full_x86_x64.exe',
  'setup.exe',
  'easyanticheat_setup.exe',
  'epicgameslauncher.exe'
]);

/**
 * Query Windows Registry for Steam install paths
 */
function getSteamPathsFromRegistry() {
  const paths = new Set();

  const regQueries = [
    { key: 'HKCU\\Software\\Valve\\Steam', val: 'SteamPath' },
    { key: 'HKLM\\SOFTWARE\\Valve\\Steam', val: 'InstallPath' },
    { key: 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', val: 'InstallPath' }
  ];

  for (const query of regQueries) {
    try {
      const output = execSync(`reg query "${query.key}" /v "${query.val}"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true
      });
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes(query.val)) {
          const parts = line.trim().split(/\s{2,}/);
          if (parts.length >= 3) {
            const rawPath = parts[2].trim().replace(/\//g, '\\');
            if (fs.existsSync(rawPath)) {
              paths.add(rawPath);
            }
          }
        }
      }
    } catch {
      // Ignore registry query failures
    }
  }

  return Array.from(paths);
}

/**
 * Get standard default fallback Steam installation paths
 */
function getDefaultSteamPaths() {
  const fallbacks = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'E:\\Steam',
    'F:\\Steam',
    'D:\\SteamLibrary',
    'E:\\SteamLibrary',
    'F:\\SteamLibrary',
    'C:\\SteamLibrary'
  ];

  return fallbacks.filter(p => fs.existsSync(p));
}

/**
 * Find the primary game executable within an installation directory
 */
function findPrimaryExecutable(gameInstallDir, gameName) {
  if (!fs.existsSync(gameInstallDir)) {
    return null;
  }

  try {
    const entries = fs.readdirSync(gameInstallDir, { withFileTypes: true });
    const exes = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
        const lowerName = entry.name.toLowerCase();
        if (!IGNORED_EXES.has(lowerName)) {
          try {
            const stat = fs.statSync(path.join(gameInstallDir, entry.name));
            exes.push({ name: entry.name, size: stat.size });
          } catch {
            exes.push({ name: entry.name, size: 0 });
          }
        }
      }
    }

    if (exes.length === 0) {
      // Check one level deeper in subdirectories (e.g., bin/ or game/)
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(gameInstallDir, entry.name);
          try {
            const subEntries = fs.readdirSync(subDirPath, { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isFile() && sub.name.toLowerCase().endsWith('.exe')) {
                const lowerName = sub.name.toLowerCase();
                if (!IGNORED_EXES.has(lowerName)) {
                  try {
                    const stat = fs.statSync(path.join(subDirPath, sub.name));
                    exes.push({ name: path.join(entry.name, sub.name), size: stat.size });
                  } catch {
                    exes.push({ name: path.join(entry.name, sub.name), size: 0 });
                  }
                }
              }
            }
          } catch {
            // Ignore permission errors
          }
        }
      }
    }

    if (exes.length === 0) {
      return `${gameName}.exe`;
    }

    // Prioritize executable matching the game title closely
    const normalizedName = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = exes.find(e => {
      const exeBase = path.basename(e.name, '.exe').toLowerCase().replace(/[^a-z0-9]/g, '');
      return exeBase.includes(normalizedName) || normalizedName.includes(exeBase);
    });

    if (matched) {
      return matched.name;
    }

    // Otherwise pick the largest executable file (usually the main game binary)
    exes.sort((a, b) => b.size - a.size);
    return exes[0].name;
  } catch (err) {
    return `${gameName}.exe`;
  }
}

/**
 * Parse libraryfolders.vdf and return all library folder paths
 */
function getLibraryFolders(steamRoot) {
  const libraries = new Set();
  libraries.add(steamRoot);

  const libraryVdfPath = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
  if (fs.existsSync(libraryVdfPath)) {
    try {
      const content = fs.readFileSync(libraryVdfPath, 'utf8');
      const parsed = parseVdf(content);
      const rootObj = parsed.libraryfolders || parsed;

      for (const key of Object.keys(rootObj)) {
        const item = rootObj[key];
        if (typeof item === 'object' && item !== null && item.path) {
          const libPath = item.path.replace(/\//g, '\\');
          if (fs.existsSync(libPath)) {
            libraries.add(libPath);
          }
        } else if (typeof item === 'string' && fs.existsSync(item)) {
          libraries.add(item.replace(/\//g, '\\'));
        }
      }
    } catch (e) {
      console.error(`Error parsing libraryfolders.vdf at ${libraryVdfPath}:`, e);
    }
  }

  return Array.from(libraries);
}

/**
 * Scan all discovered library folders for installed Steam games
 */
function scanSteamLibraries(customPaths = []) {
  const allSteamRoots = new Set([
    ...getSteamPathsFromRegistry(),
    ...getDefaultSteamPaths(),
    ...customPaths
  ]);

  const allLibraries = new Set();

  for (const root of allSteamRoots) {
    allLibraries.add(root);
    const discovered = getLibraryFolders(root);
    for (const lib of discovered) {
      allLibraries.add(lib);
    }
  }

  const games = [];

  for (const libPath of allLibraries) {
    const steamAppsDir = path.join(libPath, 'steamapps');
    if (!fs.existsSync(steamAppsDir)) continue;

    try {
      const files = fs.readdirSync(steamAppsDir);
      for (const file of files) {
        if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
          const manifestPath = path.join(steamAppsDir, file);
          try {
            const content = fs.readFileSync(manifestPath, 'utf8');
            const parsed = parseVdf(content);
            const appState = parsed.AppState || parsed;

            const appid = appState.appid || appState.appId;
            const name = appState.name || appState.Name;
            const installdir = appState.installdir || appState.InstallDir;

            // Skip Steamworks redistributables and proton runtimes (e.g., 228980, 1070560)
            if (
              !appid ||
              !name ||
              name.startsWith('Steamworks Shared') ||
              name.startsWith('Proton') ||
              name.startsWith('Steam Linux Runtime')
            ) {
              continue;
            }

            const gameInstallLocation = path.join(steamAppsDir, 'common', installdir || name);
            const primaryExe = findPrimaryExecutable(gameInstallLocation, name);

            games.push({
              appid: String(appid),
              name: String(name),
              installdir: installdir || name,
              installLocation: gameInstallLocation,
              primaryExecutable: primaryExe,
              libraryFolder: libPath,
              manifestFile: manifestPath,
              launchUri: `steam://run/${appid}`,
              headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
              capsuleUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`,
              heroUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
              storeUrl: `https://store.steampowered.com/app/${appid}/`,
              sizeOnDisk: appState.SizeOnDisk ? parseInt(appState.SizeOnDisk, 10) : 0,
              lastUpdated: appState.LastUpdated ? parseInt(appState.LastUpdated, 10) : 0
            });
          } catch (acfErr) {
            console.error(`Error parsing ACF ${manifestPath}:`, acfErr);
          }
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${steamAppsDir}:`, err);
    }
  }

  // Deduplicate by App ID
  const uniqueGamesMap = new Map();
  for (const g of games) {
    if (!uniqueGamesMap.has(g.appid)) {
      uniqueGamesMap.set(g.appid, g);
    }
  }

  return {
    steamRoots: Array.from(allSteamRoots),
    libraries: Array.from(allLibraries),
    games: Array.from(uniqueGamesMap.values())
  };
}

module.exports = {
  getSteamPathsFromRegistry,
  getDefaultSteamPaths,
  getLibraryFolders,
  scanSteamLibraries,
  findPrimaryExecutable
};
