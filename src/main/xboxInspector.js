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
 * Read and parse CustomLibraryManagement.manifest
 */
function readCustomManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { version: 1, provider: { version: 1, enabled: true }, gameCache: {} };
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.gameCache) {
      parsed.gameCache = {};
    }
    return parsed;
  } catch (err) {
    console.error(`Error parsing manifest at ${manifestPath}:`, err);
    return { version: 1, provider: { version: 1, enabled: true }, gameCache: {} };
  }
}

/**
 * Read games cached in AsyncCache.db if possible
 */
function readAsyncCacheGames(dbPath) {
  const games = [];
  if (!fs.existsSync(dbPath)) return games;

  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });
    
    // Inspect product summaries
    const rows = db.prepare("SELECT key, value FROM AsyncCache WHERE scope = 'product_summary' LIMIT 3000").all();
    for (const row of rows) {
      try {
        const val = JSON.parse(row.value);
        const data = val.data || val;
        if (data.title || data.name) {
          games.push({
            id: row.key,
            title: data.title || data.name,
            source: 'XboxStore',
            launchUri: `ms-windows-store://pdp/?productid=${row.key}`,
            isNative: true
          });
        }
      } catch {
        // Ignore single parse error
      }
    }
  } catch (err) {
    // If node:sqlite is unavailable or locked, silently proceed
    console.log('AsyncCache.db reading skipped or locked:', err.message);
  }

  return games;
}

/**
 * Enumerate all games currently recognized or sideloaded in the Xbox App
 */
function inspectXboxApp() {
  const localStateDir = getXboxLocalStatePath();
  const exists = fs.existsSync(localStateDir);

  const manifestPath1 = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const manifestPath2 = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const asyncCachePath = path.join(localStateDir, 'AsyncCache.db');

  const manifest1 = readCustomManifest(manifestPath1);
  const manifest2 = readCustomManifest(manifestPath2);

  const existingEntries = new Map();

  // Combine entries from both manifest locations
  const combineEntries = (manifest, sourceName) => {
    if (manifest && manifest.gameCache) {
      for (const [key, entry] of Object.entries(manifest.gameCache)) {
        if (!existingEntries.has(key)) {
          existingEntries.set(key, {
            ...entry,
            sourceFile: sourceName,
            isCustom: true
          });
        }
      }
    }
  };

  combineEntries(manifest1, 'CustomLibraryManagement.manifest');
  combineEntries(manifest2, 'ThirdPartyLibraries');

  // Enumerate AsyncCache games (Native / store titles)
  const storeGames = readAsyncCacheGames(asyncCachePath);

  return {
    localStateExists: exists,
    localStatePath: localStateDir,
    manifestPath1,
    manifestPath2,
    asyncCachePath,
    customGames: Array.from(existingEntries.values()),
    storeGames,
    totalRegisteredXboxTitles: existingEntries.size + storeGames.length
  };
}

/**
 * Deduplicate a list of Steam games against current Xbox App registrations
 */
function deduplicateSteamGames(steamGames, xboxData) {
  const customGames = xboxData.customGames || [];
  const storeGames = xboxData.storeGames || [];

  // Build lookup sets and maps for fast, rigorous matching
  const knownAppIds = new Set();
  const knownLaunchUris = new Set();
  const knownNormalizedTitles = new Map();
  const knownExecutables = new Set();

  for (const cg of customGames) {
    if (cg.id) {
      knownAppIds.add(String(cg.id).toLowerCase());
      const m = String(cg.id).match(/(\d+)/);
      if (m) knownAppIds.add(m[1]);
    }
    if (cg.launchUri) {
      knownLaunchUris.add(cg.launchUri.toLowerCase());
      const m = cg.launchUri.match(/steam:\/\/run\/(\d+)/i);
      if (m) knownAppIds.add(m[1]);
    }
    if (cg.title) {
      const norm = normalizeTitle(cg.title);
      if (norm) knownNormalizedTitles.set(norm, cg.title);
    }
    if (cg.executableName) {
      knownExecutables.add(path.basename(cg.executableName).toLowerCase());
    }
  }

  for (const sg of storeGames) {
    if (sg.title) {
      const norm = normalizeTitle(sg.title);
      if (norm) knownNormalizedTitles.set(norm, sg.title);
    }
  }

  return steamGames.map(game => {
    const normTitle = normalizeTitle(game.name);
    const exeName = game.primaryExecutable ? path.basename(game.primaryExecutable).toLowerCase() : '';

    let isDuplicate = false;
    let matchReason = '';

    if (knownAppIds.has(game.appid) || knownAppIds.has(`steam_${game.appid}`)) {
      isDuplicate = true;
      matchReason = `Matched Steam AppID (${game.appid}) in Xbox library`;
    } else if (knownLaunchUris.has(`steam://run/${game.appid}`.toLowerCase())) {
      isDuplicate = true;
      matchReason = `Matched Launch URI (steam://run/${game.appid})`;
    } else if (knownNormalizedTitles.has(normTitle)) {
      isDuplicate = true;
      matchReason = `Matched game title "${knownNormalizedTitles.get(normTitle)}"`;
    } else if (exeName && knownExecutables.has(exeName)) {
      isDuplicate = true;
      matchReason = `Matched executable name (${exeName})`;
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
