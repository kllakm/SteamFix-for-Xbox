const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { getXboxLocalStatePath, readCustomManifest } = require('./xboxInspector');

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

/**
 * Generate a 16:9 minimalist fallback SVG buffer
 */
function generateFallbackArtwork(title) {
  const cleanTitle = (title || 'Steam Game').replace(/[<>&'"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215" viewBox="0 0 460 215">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d1419"/>
        <stop offset="100%" stop-color="#05080d"/>
      </linearGradient>
      <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00E575"/>
        <stop offset="100%" stop-color="#00A2FF"/>
      </linearGradient>
    </defs>
    <rect width="460" height="215" fill="url(#bg)"/>
    <rect x="0" y="210" width="460" height="5" fill="url(#acc)"/>
    <circle cx="230" cy="85" r="32" fill="#00A2FF" opacity="0.18"/>
    <path d="M220 75 L240 75 L240 95 L220 95 Z" fill="#00A2FF" opacity="0.85"/>
    <text x="230" y="145" font-family="Segoe UI, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle">${cleanTitle}</text>
    <text x="230" y="172" font-family="Segoe UI, sans-serif" font-size="12" fill="#64748B" text-anchor="middle">STEAM TITLE</text>
  </svg>`;
  return Buffer.from(svg, 'utf8');
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
    buffer = generateFallbackArtwork(title);
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
 * Restore a backup file
 */
function restoreBackup(backupFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist: ${backupFilePath}`);
  }

  const localStateDir = getXboxLocalStatePath();
  const targetPath = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');

  ensureDirSync(path.dirname(targetPath));
  fs.copyFileSync(backupFilePath, targetPath);

  return {
    restoredFrom: backupFilePath,
    restoredTo: targetPath,
    success: true
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
    if (isValidGuid(k)) {
      sanitizedCache[k] = v;
    } else if (k.startsWith('steam_') && v && v.launchUri) {
      // Re-key legacy entry to proper deterministic GUID
      const m = v.launchUri.match(/steam:\/\/run\/(\d+)/);
      if (m) {
        const correctGuid = appIdToGuid(m[1]);
        sanitizedCache[correctGuid] = {
          ...v,
          id: correctGuid
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

    const exeName = game.primaryExecutable ? path.basename(game.primaryExecutable) : `${game.name}.exe`;
    const installLoc = game.installLocation || '';
    const nowMs = Date.now();

    // Standard Xbox CustomLibraryManagement schema with native GUID key
    manifest.gameCache[guid] = {
      id: guid,
      title: game.name,
      executableName: exeName,
      installLocation: installLoc,
      executableCommandArgs: '',
      imagePath: artPath,
      addedDate: nowMs,
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
  const keysToUninject = Array.isArray(appIdsOrKeys) ? appIdsOrKeys : [appIdsOrKeys];

  // Step 1: Safety Backup
  onProgress({ stage: 'backup', message: 'Creating safety backup before uninjecting games...' });
  const backupInfo = createSafetyBackups(localStateDir);

  const customLibDir = path.join(localStateDir, 'CustomLibraryManagement');
  const manifestPath = path.join(customLibDir, 'CustomLibraryManagement.manifest');
  const manifest = readCustomManifest(manifestPath);

  // Normalize targets into a set of AppIDs and GUIDs
  const targetGuids = new Set();
  const targetAppIds = new Set();
  const targetTitles = new Set();

  for (const item of keysToUninject) {
    if (!item) continue;
    const str = String(item).trim();
    if (isValidGuid(str)) {
      targetGuids.add(str.toLowerCase());
    } else {
      const cleanId = str.replace(/^steam_/, '');
      targetAppIds.add(cleanId);
      targetGuids.add(appIdToGuid(cleanId));
      targetTitles.add(str.toLowerCase());
    }
  }

  let removedCount = 0;
  const removedTitles = [];

  // Step 2: Remove matching entries from manifest.gameCache
  for (const [guidKey, entry] of Object.entries(manifest.gameCache || {})) {
    let shouldRemove = false;

    if (targetGuids.has(guidKey.toLowerCase())) {
      shouldRemove = true;
    } else if (entry && entry.id && targetGuids.has(String(entry.id).toLowerCase())) {
      shouldRemove = true;
    } else if (entry && entry.launchUri) {
      const m = entry.launchUri.match(/steam:\/\/run\/(\d+)/);
      if (m && targetAppIds.has(m[1])) {
        shouldRemove = true;
      }
    } else if (entry && entry.title && targetTitles.has(entry.title.toLowerCase())) {
      shouldRemove = true;
    }

    if (shouldRemove) {
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

  // Also clean any legacy files matching target keys
  for (const appId of targetAppIds) {
    const legacyArt = path.join(customLibDir, `steam_${appId}.png`);
    if (fs.existsSync(legacyArt)) {
      try { fs.unlinkSync(legacyArt); } catch (e) {}
    }
  }

  // Step 3: Write back updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

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
  injectSteamGames,
  uninjectSteamGames
};
