const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Screen capture events (from Ctrl+Enter shortcut or button) ──
  onScreenCapture: (callback) =>
    ipcRenderer.on('screen-captured', (event, base64Image) => callback(base64Image)),

  // ── Navigation events (from Ctrl+[ / Ctrl+] shortcuts) ──────────
  onNavigatePrev: (callback) => ipcRenderer.on('navigate-prev', () => callback()),
  onNavigateNext: (callback) => ipcRenderer.on('navigate-next', () => callback()),

  // ── Window controls ─────────────────────────────────────────────
  hideOverlayWindow: () => ipcRenderer.invoke('hide-overlay'),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),

  // ── Screen capture trigger (from camera button) ──────────────────
  triggerScreenCapture: () => ipcRenderer.send('trigger-screen-capture'),

  // ── Get desktop/window sources for system audio (loopback) ──────
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),

  // ── History sync ─────────────────────────────────────────────────
  syncHistoryState: (state) => ipcRenderer.invoke('sync-history-state', state),

  // ── Diagnostics: check if Electron granted media permissions ─────
  checkMediaPermissions: () => ipcRenderer.invoke('check-media-permissions'),

  // ── Utility: remove a specific IPC listener ─────────────────────
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),
});
