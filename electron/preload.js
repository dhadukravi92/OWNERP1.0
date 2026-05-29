const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (args) => ipcRenderer.invoke('db-query', args),
  accountingQuery: (args) => ipcRenderer.invoke('accounting-query', args),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDatabaseInfo: () => ipcRenderer.invoke('get-database-info'),
  getAccountingDatabaseInfo: () => ipcRenderer.invoke('get-accounting-database-info'),
  getHrConnectStatus: () => ipcRenderer.invoke('get-hr-connect-status'),
  changeDatabaseLocation: () => ipcRenderer.invoke('change-database-location'),
  changeAccountingDatabaseLocation: () => ipcRenderer.invoke('change-accounting-database-location'),
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  backupAccountingDatabase: () => ipcRenderer.invoke('backup-accounting-database'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  refreshUpdateConfig: () => ipcRenderer.invoke('refresh-update-config'),
  checkForAppUpdates: () => ipcRenderer.invoke('check-for-app-updates'),
  downloadAppUpdate: () => ipcRenderer.invoke('download-app-update'),
  installAppUpdate: () => ipcRenderer.invoke('install-app-update'),
  onAppUpdateStatus: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('app-update-status', listener);
    return () => ipcRenderer.removeListener('app-update-status', listener);
  },
  getGoogleDriveStatus: () => ipcRenderer.invoke('get-google-drive-status'),
  saveGoogleDriveConfig: (args) => ipcRenderer.invoke('save-google-drive-config', args),
  connectGoogleDrive: () => ipcRenderer.invoke('connect-google-drive'),
  disconnectGoogleDrive: () => ipcRenderer.invoke('disconnect-google-drive'),
  refreshAutoBackup: () => ipcRenderer.invoke('refresh-auto-backup'),
  runCloudBackup: () => ipcRenderer.invoke('run-cloud-backup'),
  restoreDatabaseBackup: () => ipcRenderer.invoke('restore-database-backup'),
  exportExcel: (args) => ipcRenderer.invoke('export-excel', args),
  discoverCatalogBrands: (args) => ipcRenderer.invoke('discover-catalog-brands', args),
  sendDocumentEmail: (args) => ipcRenderer.invoke('send-document-email', args),
  setWindowTitle: (title) => ipcRenderer.invoke('set-window-title', title),
  isElectron: true
});
