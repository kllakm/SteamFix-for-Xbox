const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  scanSteam: (customPaths) => ipcRenderer.invoke('scan-steam', customPaths),
  inspectXbox: () => ipcRenderer.invoke('inspect-xbox'),
  checkProcesses: () => ipcRenderer.invoke('check-processes'),
  closeProcesses: () => ipcRenderer.invoke('close-processes'),
  syncGames: (games) => ipcRenderer.invoke('sync-games', games),
  getBackups: () => ipcRenderer.invoke('get-backups'),
  restoreBackup: (backupPath) => ipcRenderer.invoke('restore-backup', backupPath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createDemoLibrary: () => ipcRenderer.invoke('create-demo-library'),
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync-progress', handler);
    return () => ipcRenderer.removeListener('sync-progress', handler);
  }
});
