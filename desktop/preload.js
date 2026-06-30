const { contextBridge, ipcRenderer } = require('electron');

// Secure context bridge bindings
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body })
});
