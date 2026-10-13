const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const packageJson = require('../../package.json');
const { scanSteamLibraries } = require('./steamScanner');
const { inspectXboxApp, deduplicateSteamGames, getXboxLocalStatePath } = require('./xboxInspector');
const { checkXboxProcesses, closeXboxProcesses } = require('./processSafety');
const { injectSteamGames, uninjectSteamGames, listBackups, restoreBackup } = require('./injector');
const { createMockSteamLibrary } = require('./fixtureGenerator');

// Configure Chromium command line switches for universal gamepad support
app.commandLine.appendSwitch('disable-usb-blocklist');
app.commandLine.appendSwitch('enable-gamepad-button-axis-events');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('enable-features', 'GamepadButtonAxisEvents,GamepadMultitouch');

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
    fullScreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
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
  const { session } = require('electron');
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionCheckHandler(() => true);
    session.defaultSession.setDevicePermissionHandler(() => true);
  }

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
    const result = await injectSteamGames(games, (progress) => {
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

// IPC Handler: Uninject Games
ipcMain.handle('uninject-games', async (_event, appIds) => {
  try {
    const result = uninjectSteamGames(appIds, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-progress', progress);
      }
    });
    return result;
  } catch (error) {
    console.error('Uninject error:', error);
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
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const isFull = mainWindow.isFullScreen();
  const next = !isFull;
  mainWindow.setFullScreen(next);
  if (next) {
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenuBarVisibility(false);
  }
  return next;
});

ipcMain.handle('get-fullscreen-state', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  return mainWindow.isFullScreen();
});
