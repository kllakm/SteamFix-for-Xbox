const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  scanSteam: (customPaths) => ipcRenderer.invoke('scan-steam', customPaths),
  inspectXbox: () => ipcRenderer.invoke('inspect-xbox'),
  checkProcesses: () => ipcRenderer.invoke('check-processes'),
  closeProcesses: () => ipcRenderer.invoke('close-processes'),
  syncGames: (games) => ipcRenderer.invoke('sync-games', games),
  uninjectGames: (appIds) => ipcRenderer.invoke('uninject-games', appIds),
  uninjectGame: (appId, title) => ipcRenderer.invoke('uninject-games', [typeof appId === 'object' ? appId : { appId, title }]),
  getBackups: () => ipcRenderer.invoke('get-backups'),
  createBackup: () => ipcRenderer.invoke('create-backup'),
  restoreBackup: (backupPath) => ipcRenderer.invoke('restore-backup', backupPath),
  repairXboxDatabase: () => ipcRenderer.invoke('repair-xbox-database'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createDemoLibrary: () => ipcRenderer.invoke('create-demo-library'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getFullscreenState: () => ipcRenderer.invoke('get-fullscreen-state'),
  onFullscreenChange: (callback) => {
    const handler = (_event, isFullScreen) => callback(isFullScreen);
    ipcRenderer.on('fullscreen-change', handler);
    return () => ipcRenderer.removeListener('fullscreen-change', handler);
  },
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync-progress', handler);
    return () => ipcRenderer.removeListener('sync-progress', handler);
  }
});
