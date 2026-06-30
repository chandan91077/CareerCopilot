const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Overlay Hotkey Listeners
  onScreenCapture: (callback) => ipcRenderer.on('screen-captured', (event, base64Image) => callback(base64Image)),
  onNavigatePrev: (callback) => ipcRenderer.on('navigate-prev', () => callback()),
  onNavigateNext: (callback) => ipcRenderer.on('navigate-next', () => callback()),

  // Helper Controls
  hideOverlayWindow: () => ipcRenderer.invoke('hide-overlay'),
  syncHistoryState: (state) => ipcRenderer.invoke('sync-history-state', state),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity)
});
