const fs = require('fs');
const path = require('path');

/**
 * Standard path to Xbox App LocalState directory
 */
function getXboxLocalStatePath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'Packages', 'Microsoft.GamingApp_8wekyb3d8bbwe', 'LocalState');
}

/**
 * Normalize string for resilient deduplication comparisons
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Read and parse JSON manifest file safely
 */
function readJsonManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8').trim().replace(/^\uFEFF/, '');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.error(`Error parsing manifest at ${manifestPath}:`, err.message);
    return null;
  }
}

/**
 * Read and parse CustomLibraryManagement.manifest
 */
function readCustomManifest(manifestPath) {
  const parsed = readJsonManifest(manifestPath);
  if (!parsed) {
    return { version: 1, provider: { version: 1, enabled: true }, gameCache: {} };
  }
  if (!parsed.gameCache) {
    parsed.gameCache = {};
  }
  return parsed;
}

/**
 * Enumerate all games currently recognized, scanned, or sideloaded in the Xbox App
 */
function inspectXboxApp() {
  const localStateDir = getXboxLocalStatePath();
  const exists = fs.existsSync(localStateDir);

  const manifestPath1 = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const manifestPath2 = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');

  const manifest1 = readCustomManifest(manifestPath1);
  const manifest2 = readCustomManifest(manifestPath2);

  const existingEntries = new Map();

  // Helper to register an entry
  const registerEntry = (key, entry) => {
    if (!key) return;
    const normKey = String(key).toLowerCase();
    if (!existingEntries.has(normKey)) {
      existingEntries.set(normKey, entry);
    }
  };

  // 1. Process CustomLibraryManagement manifests
  const processCustomManifest = (manifest, sourceName) => {
    if (manifest && manifest.gameCache) {
      for (const [key, entry] of Object.entries(manifest.gameCache)) {
        if (!entry || typeof entry !== 'object') continue;
        registerEntry(key, {
          ...entry,
          id: entry.id || key,
          sourceFile: sourceName,
          sourceType: 'custom_manifest',
          isCustom: true
        });
      }
    }
  };

  processCustomManifest(manifest1, 'CustomLibraryManagement.manifest');
  processCustomManifest(manifest2, 'ThirdPartyLibraries/CustomLibraryManagement');

  // 2. Scan Xbox ThirdPartyLibraries provider directories (steam, epic, gog, bnet, ea, ubi)
  const thirdPartyDir = path.join(localStateDir, 'ThirdPartyLibraries');
  const providers = ['steam', 'epic', 'gog', 'bnet', 'ea', 'ubi'];

  if (fs.existsSync(thirdPartyDir)) {
    for (const prov of providers) {
      const provDir = path.join(thirdPartyDir, prov);
      if (!fs.existsSync(provDir)) continue;

      // Check provider manifests (.manifest and .json)
      const manifestFiles = [
        path.join(provDir, `${prov}.manifest`),
        path.join(provDir, `${prov}.json`)
      ];

      for (const mFile of manifestFiles) {
        const mData = readJsonManifest(mFile);
        if (mData && mData.gameCache) {
          const cache = mData.gameCache;
          const entries = [];
          if (Array.isArray(cache.games)) {
            entries.push(...cache.games);
          } else if (Array.isArray(cache)) {
            entries.push(...cache);
          } else if (typeof cache === 'object') {
            for (const [k, v] of Object.entries(cache)) {
              if (k !== 'version' && v && typeof v === 'object') {
                entries.push({ ...v, _key: k });
              }
            }
          }

          for (const item of entries) {
            const rawId = item.id || item._key || item.title;
            if (!rawId) continue;
            const entryId = `${prov}_${rawId}`;
            registerEntry(entryId, {
              ...item,
              id: entryId,
              originalId: rawId,
              provider: prov,
              title: item.title || item.name || '',
              installLocation: item.installLocation || item.installPath || '',
              executableName: item.executableName || '',
              sourceFile: path.basename(mFile),
              sourceType: `${prov}_manifest`,
              isCustom: false
            });
          }
        }
      }

      // Check provider thumbnail files (e.g. steam_<appid>.png, <appid>.png)
      try {
        const files = fs.readdirSync(provDir);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (lower.endsWith('.png') || lower.endsWith('.jpg')) {
            const base = path.parse(file).name;
            let appId = base;
            if (base.startsWith(`${prov}_`)) {
              appId = base.substring(prov.length + 1);
            }
            const key = `${prov}_${appId}`;
            if (!existingEntries.has(key.toLowerCase())) {
              registerEntry(key, {
                id: key,
                originalId: appId,
                provider: prov,
                title: appId,
                thumbnailFile: path.join(provDir, file),
                sourceFile: file,
                sourceType: `${prov}_thumbnail`,
                isCustom: false
              });
            }
          }
        }
      } catch (e) {}
    }
  }

  // 3. Scan ExternalAppShortcut directory (manual shortcuts added in Xbox App)
  const shortcutDir = path.join(localStateDir, 'ExternalAppShortcut');
  if (fs.existsSync(shortcutDir)) {
    try {
      const files = fs.readdirSync(shortcutDir);
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.manifest')) {
          const sPath = path.join(shortcutDir, file);
          const sData = readJsonManifest(sPath);
          if (sData) {
            const sId = sData.id || path.parse(file).name;
            const sTitle = sData.title || sData.name || '';
            const sPathTarget = sData.targetPath || sData.installPath || sData.executablePath || '';
            registerEntry(`shortcut_${sId}`, {
              ...sData,
              id: `shortcut_${sId}`,
              originalId: sId,
              title: sTitle,
              installLocation: sData.installPath || (sPathTarget ? path.dirname(sPathTarget) : ''),
              executableName: sPathTarget ? path.basename(sPathTarget) : '',
              sourceFile: file,
              sourceType: 'external_shortcut',
              shortcutManifestPath: sPath,
              isCustom: true
            });
          }
        }
      }
    } catch (e) {}
  }

  return {
    localStateExists: exists,
    localStatePath: localStateDir,
    manifestPath1,
    manifestPath2,
    customGames: Array.from(existingEntries.values()),
    storeGames: [],
    totalRegisteredXboxTitles: existingEntries.size
  };
}

/**
 * Deduplicate a list of Steam games against current Xbox App registrations
 */
function deduplicateSteamGames(steamGames, xboxData) {
  const customGames = xboxData.customGames || [];

  // Build lookup sets and maps for fast, rigorous matching
  const knownAppIds = new Set();
  const knownLaunchUris = new Set();
  const knownNormalizedTitles = new Map();
  const knownExecutables = new Set();
  const knownInstallDirs = new Set();

  for (const cg of customGames) {
    // 1. AppIDs and keys
    if (cg.id) {
      const idStr = String(cg.id).toLowerCase();
      knownAppIds.add(idStr);
      const m = idStr.match(/(\d+)/);
      if (m) knownAppIds.add(m[1]);
    }
    if (cg.originalId) {
      const origStr = String(cg.originalId).toLowerCase();
      knownAppIds.add(origStr);
      const m = origStr.match(/(\d+)/);
      if (m) knownAppIds.add(m[1]);
    }

    // 2. Launch URIs
    if (cg.launchUri) {
      knownLaunchUris.add(cg.launchUri.toLowerCase());
      const m = cg.launchUri.match(/steam:\/\/run\/(\d+)/i);
      if (m) knownAppIds.add(m[1]);
    }

    // 3. Titles
    if (cg.title) {
      const norm = normalizeTitle(cg.title);
      if (norm) knownNormalizedTitles.set(norm, cg.title);
    }

    // 4. Executables
    if (cg.executableName) {
      knownExecutables.add(path.basename(cg.executableName).toLowerCase());
    }

    // 5. Install locations
    if (cg.installLocation) {
      knownInstallDirs.add(path.normalize(cg.installLocation).toLowerCase());
    }
  }

  return steamGames.map(game => {
    const normTitle = normalizeTitle(game.name);
    const exeName = game.primaryExecutable ? path.basename(game.primaryExecutable).toLowerCase() : '';
    const normInstall = game.installLocation ? path.normalize(game.installLocation).toLowerCase() : '';

    let isDuplicate = false;
    let matchReason = '';

    if (knownAppIds.has(String(game.appid)) || knownAppIds.has(`steam_${game.appid}`)) {
      isDuplicate = true;
      matchReason = `Matched Steam AppID (${game.appid}) in Xbox library`;
    } else if (knownLaunchUris.has(`steam://run/${game.appid}`.toLowerCase())) {
      isDuplicate = true;
      matchReason = `Matched Launch URI (steam://run/${game.appid})`;
    } else if (knownNormalizedTitles.has(normTitle)) {
      isDuplicate = true;
      matchReason = `Matched Xbox title "${knownNormalizedTitles.get(normTitle)}"`;
    } else if (exeName && knownExecutables.has(exeName)) {
      isDuplicate = true;
      matchReason = `Matched executable name (${exeName})`;
    } else if (normInstall && knownInstallDirs.has(normInstall)) {
      isDuplicate = true;
      matchReason = `Matched game folder in Xbox library`;
    }

    return {
      ...game,
      isDuplicate,
      matchReason
    };
  });
}

module.exports = {
  getXboxLocalStatePath,
  normalizeTitle,
  readCustomManifest,
  inspectXboxApp,
  deduplicateSteamGames
};
