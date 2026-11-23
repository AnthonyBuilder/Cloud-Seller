const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('backupApi', {
  getState: () => ipcRenderer.invoke('backup:get-state'),
  login: () => ipcRenderer.invoke('backup:login'),
  logout: () => ipcRenderer.invoke('backup:logout'),
  selectFolders: () => ipcRenderer.invoke('backup:select-folders'),
  removeFolder: folder => ipcRenderer.invoke('backup:remove-folder', folder),
  saveSettings: settings => ipcRenderer.invoke('backup:save-settings', settings),
  runNow: () => ipcRenderer.invoke('backup:run-now'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restore: keys => ipcRenderer.invoke('backup:restore', keys),
  openDashboard: () => ipcRenderer.invoke('backup:open-dashboard'),
  onStatus: callback => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('backup:status', listener)
    return () => ipcRenderer.removeListener('backup:status', listener)
  },
})
