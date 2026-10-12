const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const packageJson = require('../../package.json');
const { scanSteamLibraries } = require('./steamScanner');
const { inspectXboxApp, deduplicateSteamGames, getXboxLocalStatePath } = require('./xboxInspector');
const { checkXboxProcesses, closeXboxProcesses } = require('./processSafety');
const { injectSteamGames, listBackups, restoreBackup } = require('./injector');
const { createMockSteamLibrary } = require('./fixtureGenerator');

let mainWindow = null;

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../../build/icon.ico')
    : path.join(__dirname, '../renderer/assets/logo.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 540,
    title: `XboxSteamBridge v${packageJson.version}`,
    backgroundColor: '#0a0e17',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fullscreen-change', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fullscreen-change', false);
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Version
ipcMain.handle('get-app-version', () => {
  return packageJson.version;
});

// IPC Handler: Scan Steam & Deduplicate with Xbox
ipcMain.handle('scan-steam', async (_event, customPaths = []) => {
  try {
    const steamResult = scanSteamLibraries(customPaths);
    const xboxResult = inspectXboxApp();
    const deduplicatedGames = deduplicateSteamGames(steamResult.games, xboxResult);

    const missingFromXbox = deduplicatedGames.filter(g => !g.isDuplicate);
    const alreadySynced = deduplicatedGames.filter(g => g.isDuplicate);

    return {
      success: true,
      steamRoots: steamResult.steamRoots,
      libraries: steamResult.libraries,
      totalSteamGames: steamResult.games.length,
      xboxData: xboxResult,
      games: deduplicatedGames,
      missingCount: missingFromXbox.length,
      syncedCount: alreadySynced.length
    };
  } catch (error) {
    console.error('Scan error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC Handler: Inspect Xbox
ipcMain.handle('inspect-xbox', async () => {
  try {
    const data = inspectXboxApp();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Process Safety
ipcMain.handle('check-processes', async () => {
  return checkXboxProcesses();
});

ipcMain.handle('close-processes', async () => {
  return closeXboxProcesses();
});

// IPC Handler: Sync Games
ipcMain.handle('sync-games', async (_event, games) => {
  try {
    const result = injectSteamGames(games, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-progress', progress);
      }
    });
    return result;
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Backups
ipcMain.handle('get-backups', async () => {
  try {
    const localState = getXboxLocalStatePath();
    const backups = listBackups(localState);
    return { success: true, backups };
  } catch (error) {
    return { success: false, error: error.message, backups: [] };
  }
});

ipcMain.handle('restore-backup', async (_event, backupPath) => {
  try {
    const result = restoreBackup(backupPath);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Select Folder Dialog
ipcMain.handle('select-folder', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Steam or Library Directory'
  });
  if (res.canceled || res.filePaths.length === 0) {
    return null;
  }
  return res.filePaths[0];
});

// IPC Handler: Generate Demo / Mock Steam Library
ipcMain.handle('create-demo-library', async () => {
  try {
    const demoDir = path.join(os.tmpdir(), 'XboxSteamBridge_Demo_Library');
    const result = createMockSteamLibrary(demoDir);
    return { success: true, demoDir, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handler: Full Screen Experience (FSE)
ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('get-fullscreen-state', () => {
  if (!mainWindow) return false;
  return mainWindow.isFullScreen();
});
