const fs = require('fs');
const path = require('path');
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
function injectSteamGames(gamesToInject, onProgress = () => {}) {
  const localStateDir = getXboxLocalStatePath();
  ensureDirSync(localStateDir);

  // Step 1: Create Safety Backups
  onProgress({ stage: 'backup', message: 'Creating timestamped safety backups of Xbox App state...' });
  const backupInfo = createSafetyBackups(localStateDir);

  const manifestPath1 = path.join(localStateDir, 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');
  const manifestPath2 = path.join(localStateDir, 'ThirdPartyLibraries', 'CustomLibraryManagement', 'CustomLibraryManagement.manifest');

  ensureDirSync(path.dirname(manifestPath1));
  ensureDirSync(path.dirname(manifestPath2));

  // Step 2: Read existing manifests
  onProgress({ stage: 'read', message: 'Reading existing Xbox App custom manifests...' });
  const manifest1 = readCustomManifest(manifestPath1);
  const manifest2 = readCustomManifest(manifestPath2);

  let injectedCount = 0;
  const injectedTitles = [];

  // Step 3: Inject each game into gameCache
  onProgress({ stage: 'inject', message: `Injecting ${gamesToInject.length} Steam games into Xbox database...` });

  for (let i = 0; i < gamesToInject.length; i++) {
    const game = gamesToInject[i];
    const key = `steam_${game.appid}`;

    const newEntry = {
      id: key,
      title: game.name,
      storefront: 'Steam',
      source: 'Steam',
      launchUri: `steam://run/${game.appid}`,
      executableName: game.primaryExecutable ? path.basename(game.primaryExecutable) : `${game.name}.exe`,
      installLocation: game.installLocation || '',
      imagePath: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      bannerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      gridArtUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900_2x.jpg`,
      heroArtUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_hero.jpg`,
      dateAdded: new Date().toISOString()
    };

    manifest1.gameCache[key] = newEntry;
    manifest2.gameCache[key] = newEntry;

    injectedCount++;
    injectedTitles.push(game.name);

    onProgress({
      stage: 'item',
      index: i + 1,
      total: gamesToInject.length,
      title: game.name,
      message: `Injected: ${game.name} (AppID: ${game.appid})`
    });
  }

  // Step 4: Write manifests cleanly with formatted JSON
  onProgress({ stage: 'commit', message: 'Writing updated manifest files and committing changes...' });

  fs.writeFileSync(manifestPath1, JSON.stringify(manifest1, null, 2), 'utf8');
  fs.writeFileSync(manifestPath2, JSON.stringify(manifest2, null, 2), 'utf8');

  onProgress({ stage: 'done', message: `Successfully synchronized ${injectedCount} titles into Xbox App!` });

  return {
    success: true,
    injectedCount,
    injectedTitles,
    backupInfo,
    manifestPath1,
    manifestPath2
  };
}

module.exports = {
  getTimestamp,
  createSafetyBackups,
  listBackups,
  restoreBackup,
  injectSteamGames
};
