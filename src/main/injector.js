const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { getXboxLocalStatePath, readCustomManifest, normalizeTitle } = require('./xboxInspector');

/**
 * Format timestamp YYYYMMDD_HHMMSS
 */
function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

/**
 * Generate a deterministic UUIDv4-compliant GUID from a Steam AppID.
 * Xbox App parses custom app keys via Guid.Parse(entry.Key).
 * Non-GUID keys cause Xbox App's internal database manager to throw a
 * FormatException and crash when viewing or clicking "Add an app".
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
 * Validate whether a string is a standard GUID
 */
function isValidGuid(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Ensure directory exists
 */
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Download a remote image or create a fallback
 */
async function downloadArtworkBuffer(url) {
  if (typeof fetch === 'function') {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch (e) {
      // Fallback
    }
  }

  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { timeout: 6000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        } else {
          resolve(null);
        }
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  let crc = 0xFFFFFFFF;
  const chunkData = Buffer.concat([typeBuf, data]);
  for (let i = 0; i < chunkData.length; i++) {
    crc ^= chunkData[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) crc = (crc >>> 1) ^ 0xEDB88320;
      else crc = crc >>> 1;
    }
  }
  crc = (crc ^ 0xFFFFFFFF) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Generate a binary-valid 16:9 solid PNG image buffer (Emerald Xbox green)
 * Guarantees Windows Imaging Component (WIC) and DirectX can decode it without crashing
 */
function generateFallbackArtwork(width = 460, height = 215, r = 16, g = 124, b = 65) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 2; // Color type: Truecolor (RGB)
  const ihdrChunk = makePngChunk('IHDR', ihdr);

  const rowSize = width * 3 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const offset = y * rowSize + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makePngChunk('IDAT', compressed);
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Save game artwork locally for Xbox App consumption
 */
async function saveGameArtwork(appId, title, targetPaths) {
  const cdnUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
  let buffer = await downloadArtworkBuffer(cdnUrl);

  if (!buffer || buffer.length === 0) {
    const backupUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`;
    buffer = await downloadArtworkBuffer(backupUrl);
  }

  if (!buffer || buffer.length === 0) {
    buffer = generateFallbackArtwork();
  }

  for (const targetPath of targetPaths) {
    try {
      ensureDirSync(path.dirname(targetPath));
      fs.writeFileSync(targetPath, buffer);
    } catch (e) {
      console.warn(`[Injector] Failed writing artwork to ${targetPath}:`, e.message);
    }
  }

  return targetPaths[0];
}

/**
 * Perform timestamped backups of target manifest and state files
 */
function createSafetyBackups(localStateDir) {
  const timestamp = getTimestamp();
  const backupDir = path.join(localStateDir, 'XboxSteamBridge_Backups');
  ensureDirSync(backupDir);

  const targets = [
    {
      source: path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest'),
      name: `CustomLibraryManagement.manifest.${timestamp}.bak`
    }
  ];

  const createdBackups = [];

  for (const item of targets) {
    if (fs.existsSync(item.source)) {
      const dest = path.join(backupDir, item.name);
      fs.copyFileSync(item.source, dest);
      createdBackups.push({
        source: item.source,
        backup: dest,
        size: fs.statSync(dest).size,
        timestamp
      });
    }
  }

  return {
    timestamp,
    backupDir,
    backups: createdBackups
  };
}

/**
 * List all available backups
 */
function listBackups(localStateDir) {
  const backupDir = path.join(localStateDir, 'XboxSteamBridge_Backups');
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir);
  return files
    .filter(f => f.endsWith('.bak'))
    .map(f => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return {
        filename: f,
        fullPath,
        size: stat.size,
        createdAt: stat.mtime
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Restore a backup file safely
 */
function restoreBackup(backupFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist: ${backupFilePath}`);
  }

  const localStateDir = getXboxLocalStatePath();
  const targetPath = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');

  // Clean rogue directories
  cleanLegacyRogueFiles(localStateDir);

  // Read backup content and validate that it's valid JSON
  const rawContent = fs.readFileSync(backupFilePath, 'utf8').trim().replace(/^\uFEFF/, '');
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Corrupted backup file: ${err.message}`);
  }

  // Ensure gameCache entries have type: 1 (Game) so restored backups don't crash Xbox App
  if (parsed && parsed.gameCache) {
    for (const [key, entry] of Object.entries(parsed.gameCache)) {
      if (entry && typeof entry === 'object') {
        if (entry.type === undefined) {
          entry.type = 1;
        }
      }
    }
  }

  ensureDirSync(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf8');

  return {
    restoredFrom: backupFilePath,
    restoredTo: targetPath,
    success: true
  };
}

/**
 * Completely repair and reset Xbox App custom library manifest and purge any corrupt rogue files
 */
function repairXboxDatabase() {
  const localStateDir = getXboxLocalStatePath();
  ensureDirSync(localStateDir);

  // 1. Create a safety backup of whatever exists before touching anything
  const backupInfo = createSafetyBackups(localStateDir);

  // 2. Clean legacy rogue directories that cause Xbox App provider failures
  cleanLegacyRogueFiles(localStateDir);

  // 3. Reset CustomLibraryManagement.manifest to clean valid default
  const customLibDir = path.join(localStateDir, 'CustomLibraryManagement');
  ensureDirSync(customLibDir);
  const manifestPath = path.join(customLibDir, 'CustomLibraryManagement.manifest');

  const cleanManifest = {
    version: 1,
    provider: {
      version: 1,
      enabled: true
    },
    gameCache: {}
  };

  fs.writeFileSync(manifestPath, JSON.stringify(cleanManifest, null, 2), 'utf8');

  // 4. Remove any orphaned images or corrupted temporary files in CustomLibraryManagement
  try {
    const files = fs.readdirSync(customLibDir);
    for (const f of files) {
      if (f !== 'CustomLibraryManagement.manifest') {
        const full = path.join(customLibDir, f);
        try {
          fs.rmSync(full, { recursive: true, force: true });
        } catch (e) {}
      }
    }
  } catch (e) {}

  return {
    success: true,
    message: 'Xbox App database repaired and reset to clean state.',
    backupInfo
  };
}

/**
 * Clean up legacy rogue directories created by previous buggy versions
 * (e.g. ThirdPartyLibraries/CustomLibraryManagement which breaks Xbox App provider loading)
 */
function cleanLegacyRogueFiles(localStateDir) {
  try {
    const rogueThirdPartyCustom = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement');
    if (fs.existsSync(rogueThirdPartyCustom)) {
      fs.rmSync(rogueThirdPartyCustom, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[Injector] Notice cleaning rogue directory:', e.message);
  }
}

/**
 * Inject Steam games into Xbox App CustomLibraryManagement.manifest using native GUID keys.
 * This guarantees 100% stability in Xbox Game Pass PC and prevents "Apps" section crashes.
 */
async function injectSteamGames(gamesToInject, onProgress = () => {}) {
  const localStateDir = getXboxLocalStatePath();
  ensureDirSync(localStateDir);

  // Clean rogue directories from past releases
  cleanLegacyRogueFiles(localStateDir);

  // Step 1: Create Safety Backups
  onProgress({ stage: 'backup', message: 'Creating timestamped safety backup of Xbox App state...' });
  const backupInfo = createSafetyBackups(localStateDir);

  // Primary Manifest Path
  const customLibDir = path.join(localStateDir, 'CustomLibraryManagement');
  const manifestPath = path.join(customLibDir, 'CustomLibraryManagement.manifest');
  ensureDirSync(customLibDir);

  // Step 2: Read existing manifest
  onProgress({ stage: 'read', message: 'Reading existing Xbox App manifest...' });
  const manifest = readCustomManifest(manifestPath);

  // Clean any legacy invalid non-GUID keys that may have corrupted gameCache in earlier versions
  const sanitizedCache = {};
  for (const [k, v] of Object.entries(manifest.gameCache || {})) {
    if (isValidGuid(k) && v && typeof v === 'object') {
      sanitizedCache[k] = {
        ...v,
        type: v.type !== undefined ? v.type : 1
      };
    } else if (k.startsWith('steam_') && v && v.launchUri) {
      // Re-key legacy entry to proper deterministic GUID
      const m = v.launchUri.match(/steam:\/\/run\/(\d+)/);
      if (m) {
        const correctGuid = appIdToGuid(m[1]);
        sanitizedCache[correctGuid] = {
          ...v,
          id: correctGuid,
          type: 1
        };
      }
    }
  }
  manifest.gameCache = sanitizedCache;

  let injectedCount = 0;
  const injectedTitles = [];

  // Step 3: Inject each game with standard Xbox schema
  onProgress({ stage: 'inject', message: `Injecting ${gamesToInject.length} Steam games into Xbox database...` });

  for (let i = 0; i < gamesToInject.length; i++) {
    const game = gamesToInject[i];
    const appId = String(game.appid);
    const guid = appIdToGuid(appId);

    // Save artwork locally directly inside CustomLibraryManagement
    const artPath = path.join(customLibDir, `${guid}.png`);

    onProgress({
      stage: 'artwork',
      index: i + 1,
      total: gamesToInject.length,
      title: game.name,
      message: `Downloading artwork for ${game.name}...`
    });

    await saveGameArtwork(appId, game.name, [artPath]);

    // Determine proper directory and executable
    let exeName = '';
    let installLoc = '';

    if (game.primaryExecutable && fs.existsSync(game.primaryExecutable)) {
      exeName = path.basename(game.primaryExecutable);
      installLoc = path.dirname(game.primaryExecutable);
    } else if (game.installLocation && fs.existsSync(game.installLocation)) {
      installLoc = game.installLocation;
      exeName = `${game.name}.exe`;
    } else {
      installLoc = game.installLocation || '';
      exeName = `${game.name}.exe`;
    }

    const nowMs = Date.now();

    // Standard Xbox CustomLibraryManagement schema with native GUID key and required WinRT CustomLibraryItemType
    manifest.gameCache[guid] = {
      id: guid,
      type: 1, // REQUIRED: 1 = Game, 0 = Application (WinRT CustomLibraryItemType)
      title: game.name,
      executableName: exeName,
      installLocation: installLoc,
      executableCommandArgs: '',
      imagePath: artPath,
      addedDate: nowMs,
      lastPlayedDate: 0,
      launchUri: `steam://run/${appId}`,
      source: 'Steam'
    };

    injectedCount++;
    injectedTitles.push(game.name);

    onProgress({
      stage: 'item',
      index: i + 1,
      total: gamesToInject.length,
      title: game.name,
      message: `Injected: ${game.name} (AppID: ${appId})`
    });
  }

  // Step 4: Write manifest cleanly with formatted JSON
  onProgress({ stage: 'commit', message: 'Writing updated manifest files and committing changes...' });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  onProgress({ stage: 'done', message: `Successfully synchronized ${injectedCount} titles into Xbox App!` });

  return {
    success: true,
    injectedCount,
    injectedTitles,
    backupInfo,
    manifestPath
  };
}

/**
 * Remove an injected game or list of games from the Xbox App library (Uninject)
 */
function uninjectSteamGames(appIdsOrKeys, onProgress = () => {}) {
  const localStateDir = getXboxLocalStatePath();
  const rawList = Array.isArray(appIdsOrKeys) ? appIdsOrKeys : [appIdsOrKeys];

  // Purge any rogue directories
  cleanLegacyRogueFiles(localStateDir);

  // Step 1: Safety Backup
  onProgress({ stage: 'backup', message: 'Creating safety backup before uninjecting games...' });
  const backupInfo = createSafetyBackups(localStateDir);

  const customLibDir = path.join(localStateDir, 'CustomLibraryManagement');
  const manifestPath = path.join(customLibDir, 'CustomLibraryManagement.manifest');
  const manifest = readCustomManifest(manifestPath);

  // Manifests that may contain injected or registered entries
  const extraManifestPaths = [
    path.join(localStateDir, 'ThirdPartyLibraries', 'steam', 'steam.manifest'),
    path.join(localStateDir, 'ThirdPartyLibraries', 'steam', 'steam.json'),
    path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest')
  ];

  // Normalize targets into Sets
  const targetGuids = new Set();
  const targetAppIds = new Set();
  const targetTitles = new Set();
  const targetNormTitles = new Set();
  const targetKeys = new Set();

  for (const item of rawList) {
    if (!item) continue;

    // Handle object target e.g. { appId, title, guid, id }
    if (typeof item === 'object') {
      if (item.appId || item.appid) {
        const id = String(item.appId || item.appid).replace(/^steam_/, '').trim();
        targetAppIds.add(id);
        targetKeys.add(`steam_${id}`);
        targetGuids.add(appIdToGuid(id));
      }
      if (item.guid && isValidGuid(String(item.guid))) {
        targetGuids.add(String(item.guid).toLowerCase());
      }
      if (item.id) {
        const idStr = String(item.id).trim();
        if (isValidGuid(idStr)) targetGuids.add(idStr.toLowerCase());
        else {
          targetKeys.add(idStr.toLowerCase());
          const clean = idStr.replace(/^steam_/, '');
          if (/^\d+$/.test(clean)) {
            targetAppIds.add(clean);
            targetGuids.add(appIdToGuid(clean));
          }
        }
      }
      if (item.title) {
        const t = String(item.title).trim();
        targetTitles.add(t.toLowerCase());
        const norm = normalizeTitle(t);
        if (norm) targetNormTitles.add(norm);
      }
      continue;
    }

    const str = String(item).trim();
    if (!str) continue;

    if (isValidGuid(str)) {
      targetGuids.add(str.toLowerCase());
    } else {
      targetKeys.add(str.toLowerCase());
      const cleanId = str.replace(/^steam_/, '');
      if (/^\d+$/.test(cleanId)) {
        targetAppIds.add(cleanId);
        targetGuids.add(appIdToGuid(cleanId));
        targetKeys.add(`steam_${cleanId}`);
      } else {
        // Assume str is a title
        targetTitles.add(str.toLowerCase());
        const norm = normalizeTitle(str);
        if (norm) targetNormTitles.add(norm);
      }
    }
  }

  let removedCount = 0;
  const removedTitles = [];

  // Helper function to check if an entry matches any target
  const isMatch = (key, entry) => {
    if (!entry && !key) return false;
    const lowerKey = String(key || '').toLowerCase();
    if (targetGuids.has(lowerKey) || targetKeys.has(lowerKey)) return true;

    if (entry) {
      if (entry.id) {
        const idStr = String(entry.id).toLowerCase();
        if (targetGuids.has(idStr) || targetKeys.has(idStr) || targetAppIds.has(idStr)) return true;
      }
      if (entry.originalId) {
        const origStr = String(entry.originalId).toLowerCase();
        if (targetGuids.has(origStr) || targetKeys.has(origStr) || targetAppIds.has(origStr)) return true;
      }
      if (entry.launchUri) {
        const m = entry.launchUri.match(/steam:\/\/run\/(\d+)/i);
        if (m && targetAppIds.has(m[1])) return true;
      }
      if (entry.title) {
        const lowerTitle = String(entry.title).toLowerCase();
        if (targetTitles.has(lowerTitle)) return true;
        const norm = normalizeTitle(entry.title);
        if (norm && targetNormTitles.has(norm)) return true;
      }
    }
    return false;
  };

  // Step 2: Remove matching entries from primary manifest.gameCache
  for (const [guidKey, entry] of Object.entries(manifest.gameCache || {})) {
    if (isMatch(guidKey, entry)) {
      const title = (entry && entry.title) || guidKey;
      delete manifest.gameCache[guidKey];
      removedCount++;
      removedTitles.push(title);

      // Unlink thumbnail file
      const artFile = path.join(customLibDir, `${guidKey}.png`);
      if (fs.existsSync(artFile)) {
        try { fs.unlinkSync(artFile); } catch (e) {}
      }
    }
  }

  // Also clean any legacy files matching target keys in CustomLibraryManagement
  for (const appId of targetAppIds) {
    const legacyArt = path.join(customLibDir, `steam_${appId}.png`);
    if (fs.existsSync(legacyArt)) {
      try { fs.unlinkSync(legacyArt); } catch (e) {}
    }
  }

  // Step 3: Write back updated primary manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  // Step 4: Clean matching entries in any secondary / provider manifests
  for (const extraPath of extraManifestPaths) {
    if (fs.existsSync(extraPath)) {
      try {
        const extraManifest = readCustomManifest(extraPath);
        let extraModified = false;
        if (extraManifest && extraManifest.gameCache) {
          for (const [k, v] of Object.entries(extraManifest.gameCache)) {
            if (isMatch(k, v)) {
              delete extraManifest.gameCache[k];
              extraModified = true;
            }
          }
        }
        if (extraModified) {
          fs.writeFileSync(extraPath, JSON.stringify(extraManifest, null, 2), 'utf8');
        }
      } catch (err) {
        console.warn(`[Injector] Warning cleaning extra manifest at ${extraPath}:`, err.message);
      }
    }
  }

  // Step 5: Clean provider thumbnails and shortcuts
  const steamProvDir = path.join(localStateDir, 'ThirdPartyLibraries', 'steam');
  const externalShortcutDir = path.join(localStateDir, 'ExternalAppShortcut');

  for (const appId of targetAppIds) {
    const filesToPurge = [
      path.join(steamProvDir, `steam_${appId}.png`),
      path.join(steamProvDir, `${appId}.png`),
      path.join(externalShortcutDir, `steam_${appId}.json`),
      path.join(externalShortcutDir, `steam_${appId}.manifest`),
      path.join(externalShortcutDir, `steam_${appId}.png`)
    ];
    for (const f of filesToPurge) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
  }

  for (const guid of targetGuids) {
    const filesToPurge = [
      path.join(steamProvDir, `${guid}.png`),
      path.join(externalShortcutDir, `${guid}.json`),
      path.join(externalShortcutDir, `${guid}.manifest`),
      path.join(externalShortcutDir, `${guid}.png`)
    ];
    for (const f of filesToPurge) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
  }

  onProgress({ stage: 'done', message: `Successfully uninjected ${removedCount} titles from Xbox App.` });

  return {
    success: true,
    removedCount,
    removedTitles,
    backupInfo
  };
}

module.exports = {
  getTimestamp,
  appIdToGuid,
  isValidGuid,
  createSafetyBackups,
  listBackups,
  restoreBackup,
  repairXboxDatabase,
  cleanLegacyRogueFiles,
  injectSteamGames,
  uninjectSteamGames
};
