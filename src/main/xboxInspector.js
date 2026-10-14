const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Standard path to Xbox App LocalState directory
 */
function getXboxLocalStatePath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  return path.join(localAppData, 'Packages', 'Microsoft.GamingApp_8wekyb3d8bbwe', 'LocalState');
}

/**
 * Generate a deterministic UUIDv4-compliant GUID from a Steam AppID
 */
function appIdToGuid(appId) {
  const hash = crypto.createHash('md5').update(`steam_app_guid_${String(appId)}`).digest('hex');
  const p1 = hash.substring(0, 8);
  const p2 = hash.substring(8, 12);
  const p3 = '4' + hash.substring(13, 16);
  const p4 = ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20);
  const p5 = hash.substring(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`.toLowerCase();
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
 * Validate whether a string is a standard UUID/GUID
 */
function isValidGuid(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Test whether a title is a valid, readable game title (not raw GUIDs, hashes, or image filenames)
 */
function isValidHumanTitle(title) {
  if (!title || typeof title !== 'string') return false;
  const trimmed = title.trim();
  if (trimmed.length < 2) return false;
  // Ignore raw GUIDs used as titles
  if (isValidGuid(trimmed)) return false;
  // Ignore raw image/binary filenames
  if (/\.(png|jpg|jpeg|ico|exe|dll|json|manifest|tmp|vdf|bin)$/i.test(trimmed)) return false;
  // Ignore pure numbers (e.g. "123456", "730")
  if (/^\d+$/.test(trimmed)) return false;
  // Ignore hex hashes (e.g. md5/sha1/sha256 24+ hex chars)
  if (/^[0-9a-fA-F]{24,}$/.test(trimmed)) return false;
  return true;
}

/**
 * Enumerate all games currently recognized, scanned, or sideloaded in the Xbox App
 */
function inspectXboxApp() {
  const localStateDir = getXboxLocalStatePath();
  const exists = fs.existsSync(localStateDir);

  // Clean rogue legacy directories created by earlier versions
  try {
    const rogueThirdPartyCustom = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement');
    if (fs.existsSync(rogueThirdPartyCustom)) {
      fs.rmSync(rogueThirdPartyCustom, { recursive: true, force: true });
    }
  } catch (e) {}

  const manifestPath = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const manifest = readCustomManifest(manifestPath);

  const existingEntries = new Map();

  // Helper to register an entry only if it has a verified, readable title
  const registerEntry = (key, entry) => {
    if (!key || !entry) return;
    const normKey = String(key).toLowerCase();
    if (!existingEntries.has(normKey)) {
      existingEntries.set(normKey, entry);
    }
  };

  // 1. Process CustomLibraryManagement manifest (injected / custom titles)
  if (manifest && manifest.gameCache) {
    for (const [key, entry] of Object.entries(manifest.gameCache)) {
      if (!entry || typeof entry !== 'object') continue;
      const titleCandidate = entry.title || entry.name || '';
      if (!isValidHumanTitle(titleCandidate)) continue;

      registerEntry(key, {
        ...entry,
        id: entry.id || key,
        originalId: key,
        title: titleCandidate.trim(),
        sourceFile: 'CustomLibraryManagement.manifest',
        sourceType: 'custom_manifest',
        isCustom: true
      });
    }
  }

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
            const titleCandidate = item.title || item.name || '';
            // Strictly require a human-readable title: never create entries from raw file hashes or empty strings
            if (!isValidHumanTitle(titleCandidate)) continue;

            const entryId = `${prov}_${rawId}`;
            registerEntry(entryId, {
              ...item,
              id: entryId,
              originalId: rawId,
              provider: prov,
              title: titleCandidate.trim(),
              installLocation: item.installLocation || item.installPath || '',
              executableName: item.executableName || '',
              sourceFile: path.basename(mFile),
              sourceType: `${prov}_manifest`,
              isCustom: false
            });
          }
        }
      }
    }
  }

  return {
    localStateExists: exists,
    localStatePath: localStateDir,
    manifestPath,
    customGames: Array.from(existingEntries.values()),
    storeGames: [],
    totalRegisteredXboxTitles: existingEntries.size
  };
}

/**
 * Strictly deduplicate a list of Steam games against current Xbox App registrations
 * Prevents false positives by only matching verified GUIDs, explicit AppIDs, Launch URIs, or exact titles.
 */
function deduplicateSteamGames(steamGames, xboxData) {
  const customGames = (xboxData && xboxData.customGames) ? xboxData.customGames : [];

  // Build lookup sets and maps for rigorous, exact matching
  const knownGuids = new Set();
  const knownAppIds = new Set();
  const knownLaunchUris = new Set();
  const knownNormalizedTitles = new Map();

  for (const cg of customGames) {
    // 1. GUIDs (only valid GUIDs)
    if (cg.id && isValidGuid(cg.id)) {
      knownGuids.add(cg.id.toLowerCase());
    }
    if (cg.originalId && isValidGuid(cg.originalId)) {
      knownGuids.add(cg.originalId.toLowerCase());
    }

    // 2. Explicit Steam AppIDs
    // Match explicit steam://run/<appid> or steam://rungameid/<appid>
    if (cg.launchUri) {
      const lowerUri = cg.launchUri.toLowerCase().trim();
      knownLaunchUris.add(lowerUri);
      const m = lowerUri.match(/steam:\/\/(?:run|rungameid)\/(\d+)/i);
      if (m) {
        knownAppIds.add(m[1]);
      }
    }
    // Match explicit steam_<appid> or pure numeric id
    if (cg.id) {
      const idLower = String(cg.id).toLowerCase().trim();
      const mSteam = idLower.match(/^steam_(\d+)$/i);
      if (mSteam) {
        knownAppIds.add(mSteam[1]);
      } else if (/^\d+$/.test(idLower)) {
        knownAppIds.add(idLower);
      }
    }
    if (cg.originalId) {
      const origLower = String(cg.originalId).toLowerCase().trim();
      const mSteam = origLower.match(/^steam_(\d+)$/i);
      if (mSteam) {
        knownAppIds.add(mSteam[1]);
      } else if (/^\d+$/.test(origLower)) {
        knownAppIds.add(origLower);
      }
    }

    // 3. Titles (only meaningful titles, length >= 3, not pure numbers)
    if (cg.title && isValidHumanTitle(cg.title)) {
      const norm = normalizeTitle(cg.title);
      if (norm && norm.length >= 3) {
        knownNormalizedTitles.set(norm, cg.title);
      }
    }
  }

  return steamGames.map(game => {
    const appIdStr = String(game.appid);
    const deterministicGuid = appIdToGuid(appIdStr);
    const normTitle = normalizeTitle(game.name);
    const launchUri = `steam://run/${appIdStr}`.toLowerCase();

    let isDuplicate = false;
    let matchReason = '';

    if (knownGuids.has(deterministicGuid)) {
      isDuplicate = true;
      matchReason = `Synchronized to Xbox App (GUID: ${deterministicGuid.substring(0, 8)}...)`;
    } else if (knownAppIds.has(appIdStr)) {
      isDuplicate = true;
      matchReason = `Matched Steam AppID (${game.appid}) in Xbox library`;
    } else if (knownLaunchUris.has(launchUri)) {
      isDuplicate = true;
      matchReason = `Matched Launch URI (${launchUri})`;
    } else if (normTitle && normTitle.length >= 3 && knownNormalizedTitles.has(normTitle)) {
      isDuplicate = true;
      matchReason = `Matched Xbox title "${knownNormalizedTitles.get(normTitle)}"`;
    }

    return {
      ...game,
      guid: deterministicGuid,
      isDuplicate,
      matchReason
    };
  });
}

module.exports = {
  getXboxLocalStatePath,
  normalizeTitle,
  appIdToGuid,
  isValidGuid,
  isValidHumanTitle,
  readCustomManifest,
  inspectXboxApp,
  deduplicateSteamGames
};
