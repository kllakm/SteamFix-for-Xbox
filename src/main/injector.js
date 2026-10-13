const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
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
      // Fallback to https request
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
        <stop offset="0%" stop-color="#0f1923"/>
        <stop offset="100%" stop-color="#05080d"/>
      </linearGradient>
      <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00E575"/>
        <stop offset="100%" stop-color="#1A9FFF"/>
      </linearGradient>
    </defs>
    <rect width="460" height="215" fill="url(#bg)"/>
    <rect x="0" y="210" width="460" height="5" fill="url(#acc)"/>
    <circle cx="230" cy="85" r="32" fill="#00E575" opacity="0.15"/>
    <path d="M220 75 L240 75 L240 95 L220 95 Z" fill="#00E575" opacity="0.8"/>
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
    },
    {
      source: path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest'),
      name: `ThirdParty_CustomLibraryManagement.manifest.${timestamp}.bak`
    },
    {
      source: path.join(localStateDir, 'ThirdPartyLibraries', 'steam', 'steam.manifest'),
      name: `Steam_ThirdParty.manifest.${timestamp}.bak`
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
  const filename = path.basename(backupFilePath);

  let targetPath;
  if (filename.startsWith('ThirdParty_')) {
    targetPath = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  } else if (filename.startsWith('Steam_')) {
    targetPath = path.join(localStateDir, 'ThirdPartyLibraries', 'steam', 'steam.manifest');
  } else {
    targetPath = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  }

  ensureDirSync(path.dirname(targetPath));
  fs.copyFileSync(backupFilePath, targetPath);

  return {
    restoredFrom: backupFilePath,
    restoredTo: targetPath,
    success: true
  };
}

/**
 * Inject Steam games into Xbox App database and manifest files
 */
async function injectSteamGames(gamesToInject, onProgress = () => {}) {
  const localStateDir = getXboxLocalStatePath();
  ensureDirSync(localStateDir);

  // Step 1: Create Safety Backups
  onProgress({ stage: 'backup', message: 'Creating timestamped safety backups of Xbox App state...' });
  const backupInfo = createSafetyBackups(localStateDir);

  // Manifest Paths
  const manifestPath1 = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const manifestPath2 = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const steamManifestPath = path.join(localStateDir, 'ThirdPartyLibraries', 'steam', 'steam.manifest');
  const externalShortcutDir = path.join(localStateDir, 'ExternalAppShortcut');

  ensureDirSync(path.dirname(manifestPath1));
  ensureDirSync(path.dirname(manifestPath2));
  ensureDirSync(path.dirname(steamManifestPath));
  ensureDirSync(externalShortcutDir);

  // Step 2: Read existing manifests
  onProgress({ stage: 'read', message: 'Reading existing Xbox App manifests...' });
  const manifest1 = readCustomManifest(manifestPath1);
  const manifest2 = readCustomManifest(manifestPath2);
  const steamManifest = readCustomManifest(steamManifestPath);

  let injectedCount = 0;
  const injectedTitles = [];

  // Step 3: Inject each game into gameCache across all locations
  onProgress({ stage: 'inject', message: `Injecting ${gamesToInject.length} Steam games into Xbox database...` });

  for (let i = 0; i < gamesToInject.length; i++) {
    const game = gamesToInject[i];
    const appId = String(game.appid);
    const key = `steam_${appId}`;

    // Prepare local artwork destination files
    const customArtPath = path.join(localStateDir, 'CustomLibraryManagement', `${key}.png`);
    const thirdPartyArtPath = path.join(localStateDir, 'ThirdPartyLibraries', 'steam', `${key}.png`);
    const shortcutArtPath = path.join(externalShortcutDir, `${key}.png`);

    // Download / prepare artwork locally
    onProgress({
      stage: 'artwork',
      index: i + 1,
      total: gamesToInject.length,
      title: game.name,
      message: `Downloading artwork for ${game.name}...`
    });

    const localArtPath = await saveGameArtwork(appId, game.name, [customArtPath, thirdPartyArtPath, shortcutArtPath]);

    const targetExe = game.primaryExecutable || (game.installLocation ? path.join(game.installLocation, `${game.name}.exe`) : '');
    const exeName = game.primaryExecutable ? path.basename(game.primaryExecutable) : `${game.name}.exe`;
    const nowIso = new Date().toISOString();
    const nowTimestamp = Date.now().toString();

    // Manifest Entry (CustomLibraryManagement schema)
    const newEntry = {
      id: key,
      title: game.name,
      provider: 'steam',
      source: 'Steam',
      storefront: 'Steam',
      launchUri: `steam://run/${appId}`,
      executableName: exeName,
      installLocation: game.installLocation || '',
      imagePath: customArtPath,
      targetImagePath: thirdPartyArtPath,
      addedDate: nowTimestamp,
      lastUpdated: nowIso
    };

    manifest1.gameCache[key] = newEntry;
    manifest2.gameCache[key] = newEntry;

    // Steam Provider Manifest Entry
    steamManifest.gameCache[key] = {
      id: appId,
      title: game.name,
      provider: 'steam',
      installLocation: game.installLocation || '',
      executableName: exeName,
      imagePath: thirdPartyArtPath,
      launchUri: `steam://run/${appId}`,
      addedDate: nowTimestamp
    };

    // ExternalAppShortcut Entry (Guarantees modern Xbox Game Pass library card pickup)
    const shortcutFilePath = path.join(externalShortcutDir, `${key}.json`);
    const shortcutData = {
      id: key,
      title: game.name,
      targetPath: targetExe,
      installPath: game.installLocation || '',
      executablePath: targetExe,
      iconPath: shortcutArtPath,
      imagePath: shortcutArtPath,
      launchUri: `steam://run/${appId}`,
      provider: 'steam',
      source: 'Steam',
      createdDate: nowTimestamp
    };

    try {
      fs.writeFileSync(shortcutFilePath, JSON.stringify(shortcutData, null, 2), 'utf8');
    } catch (sErr) {
      console.warn(`[Injector] Warning writing shortcut for ${game.name}:`, sErr.message);
    }

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

  // Step 4: Write manifests cleanly with formatted JSON
  onProgress({ stage: 'commit', message: 'Writing updated manifest files and committing changes...' });

  fs.writeFileSync(manifestPath1, JSON.stringify(manifest1, null, 2), 'utf8');
  fs.writeFileSync(manifestPath2, JSON.stringify(manifest2, null, 2), 'utf8');
  fs.writeFileSync(steamManifestPath, JSON.stringify(steamManifest, null, 2), 'utf8');

  onProgress({ stage: 'done', message: `Successfully synchronized ${injectedCount} titles into Xbox App!` });

  return {
    success: true,
    injectedCount,
    injectedTitles,
    backupInfo,
    manifestPath1,
    manifestPath2,
    steamManifestPath
  };
}

/**
 * Remove an injected game or list of games from the Xbox App library (Uninject)
 */
function uninjectSteamGames(appIdsOrKeys, onProgress = () => {}) {
  const localStateDir = getXboxLocalStatePath();
  const keysToUninject = Array.isArray(appIdsOrKeys) ? appIdsOrKeys : [appIdsOrKeys];

  // Normalize all keys
  const targetKeys = new Set();
  const targetAppIds = new Set();

  for (const item of keysToUninject) {
    if (!item) continue;
    const str = String(item).trim();
    if (str.startsWith('steam_')) {
      targetKeys.add(str);
      targetAppIds.add(str.replace(/^steam_/, ''));
    } else {
      targetKeys.add(`steam_${str}`);
      targetAppIds.add(str);
    }
  }

  // Step 1: Safety Backup
  onProgress({ stage: 'backup', message: 'Creating safety backup before uninjecting games...' });
  const backupInfo = createSafetyBackups(localStateDir);

  const manifestPath1 = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const manifestPath2 = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const steamManifestPath = path.join(localStateDir, 'ThirdPartyLibraries', 'steam', 'steam.manifest');
  const externalShortcutDir = path.join(localStateDir, 'ExternalAppShortcut');

  const manifest1 = readCustomManifest(manifestPath1);
  const manifest2 = readCustomManifest(manifestPath2);
  const steamManifest = readCustomManifest(steamManifestPath);

  let removedCount = 0;
  const removedTitles = [];

  // Step 2: Remove from manifests and delete associated shortcut & artwork files
  for (const appId of targetAppIds) {
    const key = `steam_${appId}`;

    let title = '';
    if (manifest1.gameCache[key]) {
      title = manifest1.gameCache[key].title;
      delete manifest1.gameCache[key];
    }
    if (manifest2.gameCache[key]) {
      if (!title) title = manifest2.gameCache[key].title;
      delete manifest2.gameCache[key];
    }
    if (steamManifest.gameCache[key]) {
      if (!title) title = steamManifest.gameCache[key].title;
      delete steamManifest.gameCache[key];
    }
    if (steamManifest.gameCache[appId]) {
      if (!title) title = steamManifest.gameCache[appId].title;
      delete steamManifest.gameCache[appId];
    }

    // Remove ExternalAppShortcut file
    const shortcutJson = path.join(externalShortcutDir, `${key}.json`);
    const shortcutManifest = path.join(externalShortcutDir, `${key}.manifest`);
    if (fs.existsSync(shortcutJson)) {
      try { fs.unlinkSync(shortcutJson); } catch (e) {}
    }
    if (fs.existsSync(shortcutManifest)) {
      try { fs.unlinkSync(shortcutManifest); } catch (e) {}
    }

    // Remove local thumbnail files
    const artFiles = [
      path.join(localStateDir, 'CustomLibraryManagement', `${key}.png`),
      path.join(localStateDir, 'ThirdPartyLibraries', 'steam', `${key}.png`),
      path.join(localStateDir, 'ThirdPartyLibraries', 'steam', `${appId}.png`),
      path.join(externalShortcutDir, `${key}.png`)
    ];

    for (const af of artFiles) {
      if (fs.existsSync(af)) {
        try { fs.unlinkSync(af); } catch (e) {}
      }
    }

    removedCount++;
    removedTitles.push(title || key);
  }

  // Step 3: Write back updated manifests
  fs.writeFileSync(manifestPath1, JSON.stringify(manifest1, null, 2), 'utf8');
  fs.writeFileSync(manifestPath2, JSON.stringify(manifest2, null, 2), 'utf8');
  fs.writeFileSync(steamManifestPath, JSON.stringify(steamManifest, null, 2), 'utf8');

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
  createSafetyBackups,
  listBackups,
  restoreBackup,
  injectSteamGames,
  uninjectSteamGames
};
