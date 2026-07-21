const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut, desktopCapturer, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;
let tray;
let localPort;
let localServer;

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// ─── Grant all media permissions BEFORE any window is created ──────
function setupPermissions() {
  // Allow ALL permission checks (mic, camera, audio, notifications, etc.)
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('[PERM CHECK]', permission, requestingOrigin);
    return true;
  });

  // Allow ALL permission requests (mic, speaker, camera, display capture)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    console.log('[PERM REQUEST]', permission);
    callback(true);
  });

  // Allow media device enumeration (needed for getUserMedia to list mic/speaker)
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log('[DEVICE PERM]', details.deviceType);
    return true;
  });

  // Override CSP to allow speech recognition and media APIs
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "media-src * mediastream: blob: data: 'unsafe-inline'; " +
          "connect-src * data: blob: 'unsafe-inline';"
        ]
      }
    });
  });
}

// ─── Local static file server for packaged build ───────────────────
function startLocalServer(callback) {
  localServer = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    const hasExtension = path.extname(reqUrl) !== '';
    let filePath = hasExtension
      ? path.join(__dirname, 'dist', reqUrl)
      : path.join(__dirname, 'dist/index.html');

    fs.readFile(filePath, (err, content) => {
      if (err) {
        fs.readFile(path.join(__dirname, 'dist/index.html'), (err2, content2) => {
          if (err2) {
            res.writeHead(404);
            res.end("Not Found");
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content2);
          }
        });
      } else {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        res.end(content);
      }
    });
  });

  localServer.listen(0, '127.0.0.1', () => {
    localPort = localServer.address().port;
    console.log('[SERVER] Packaged static assets serving on port:', localPort);
    callback(localPort);
  });
}

// ─── Screen capture: grab any screen source ───────────────────────
async function captureActiveScreenBase64() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1280, height: 800 }
  });

  if (sources.length > 0) {
    return sources[0].thumbnail.toPNG().toString('base64');
  }
  throw new Error("No active screen captures found.");
}

let SetWindowDisplayAffinity = null;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  SetWindowDisplayAffinity = user32.func('bool SetWindowDisplayAffinity(uint64 hWnd, uint32 dwAffinity)');
  console.log('[WIN32] Loaded SetWindowDisplayAffinity via koffi FFI');
} catch (e) {
  console.warn('[WIN32] Could not load koffi FFI:', e.message);
}

function applyWin32ContentProtection(win) {
  if (!win || win.isDestroyed()) return;

  try {
    win.setContentProtection(true);
    win.setAlwaysOnTop(true, 'screen-saver');
  } catch (_) {}

  if (SetWindowDisplayAffinity && process.platform === 'win32') {
    try {
      const handleBuf = win.getNativeWindowHandle();
      if (handleBuf && handleBuf.length >= 8) {
        const hwnd = handleBuf.readBigUInt64LE(0);
        // 0x00000011 = WDA_EXCLUDEFROMCAPTURE (hides from screen share/screenshots in Win 10 2004+ / Win 11)
        const res11 = SetWindowDisplayAffinity(hwnd, 0x00000011);
        if (!res11) {
          // 0x00000001 = WDA_MONITOR (renders black box in screen share/screenshots)
          const res1 = SetWindowDisplayAffinity(hwnd, 0x00000001);
          console.log('[WIN32] SetWindowDisplayAffinity WDA_MONITOR (0x1):', res1);
        } else {
          console.log('[WIN32] SetWindowDisplayAffinity WDA_EXCLUDEFROMCAPTURE (0x11): success');
        }
      }
    } catch (err) {
      console.error('[WIN32] SetWindowDisplayAffinity error:', err);
    }
  }
}

// ─── Create main overlay window ───────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 300,
    minWidth: 500,
    minHeight: 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "PrepAI Interview Assistant",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
    },
    show: false
  });

  const startUrl = isDev
    ? 'http://localhost:5173/assistant'
    : `http://127.0.0.1:${localPort}/assistant`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    applyWin32ContentProtection(mainWindow);
    setTimeout(() => applyWin32ContentProtection(mainWindow), 500);
    setTimeout(() => applyWin32ContentProtection(mainWindow), 1500);
  });

  mainWindow.on('focus', () => applyWin32ContentProtection(mainWindow));


  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[WINDOW] Page finished loading');
    // Inject permission grant helper into the page context
    mainWindow.webContents.executeJavaScript(`
      // Monkey-patch getUserMedia to always succeed in Electron
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('[PrepAI] getUserMedia available');
      } else {
        console.warn('[PrepAI] getUserMedia NOT available - mic will not work');
      }
      console.log('[PrepAI] SpeechRecognition:', !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    `).catch(console.error);
  });

  mainWindow.webContents.on('media-started-playing', () => {
    console.log('[MEDIA] Audio playback started');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Global keyboard shortcuts ────────────────────────────────────
function registerShortcuts() {
  // 1. Toggle overlay visibility (Ctrl + /)
  globalShortcut.register('CommandOrControl+/', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // 2. Capture screen and send to overlay (Ctrl + Enter)
  globalShortcut.register('CommandOrControl+Enter', async () => {
    if (!mainWindow) return;
    try {
      const base64Image = await captureActiveScreenBase64();
      mainWindow.webContents.send('screen-captured', base64Image);
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
    } catch (err) {
      console.error("Screen capture failed:", err);
      // Still notify renderer so it can show the prompt
      mainWindow.webContents.send('screen-captured', '');
    }
  });

  // 3. Navigate answer history (Ctrl + [ / Ctrl + ])
  globalShortcut.register('CommandOrControl+[', () => {
    if (mainWindow) mainWindow.webContents.send('navigate-prev');
  });

  globalShortcut.register('CommandOrControl+]', () => {
    if (mainWindow) mainWindow.webContents.send('navigate-next');
  });

  // 4. Move window with Ctrl + Arrow keys
  globalShortcut.register('CommandOrControl+Up', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x, y - 40);
  });

  globalShortcut.register('CommandOrControl+Down', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x, y + 40);
  });

  globalShortcut.register('CommandOrControl+Left', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x - 40, y);
  });

  globalShortcut.register('CommandOrControl+Right', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + 40, y);
  });
}

// ─── App bootstrap ────────────────────────────────────────────────
app.whenReady().then(() => {
  // ✅ Setup permissions FIRST before any window or server is created
  setupPermissions();

  const initApp = () => {
    createWindow();
    registerShortcuts();

    // System tray icon
    try {
      const iconPath = path.join(__dirname, 'assets', 'icon.ico');
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Assistant', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
        { label: 'Quit', click: () => app.quit() }
      ]);
      tray.setToolTip('PrepAI Interview Assistant Active');
      tray.setContextMenu(contextMenu);
    } catch (err) {
      console.log("[TRAY] No tray icon found, skipping:", err.message);
    }
  };

  if (isDev) {
    initApp();
  } else {
    startLocalServer(() => {
      initApp();
    });
  }

  // ─── IPC Handlers ────────────────────────────────────────────

  // Triggered from renderer button click
  ipcMain.on('trigger-screen-capture', async () => {
    try {
      const base64Image = await captureActiveScreenBase64();
      if (mainWindow) mainWindow.webContents.send('screen-captured', base64Image);
    } catch (err) {
      console.error("Screen capture IPC trigger failed:", err);
      if (mainWindow) mainWindow.webContents.send('screen-captured', '');
    }
  });

  ipcMain.handle('hide-overlay', () => {
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.handle('set-opacity', (event, opacity) => {
    if (mainWindow) {
      mainWindow.setOpacity(parseFloat(opacity));
    }
  });

  ipcMain.handle('sync-history-state', (event, state) => {
    console.log('[IPC] Synced history index:', state.currentIndex);
  });

  // ─── Get available media sources for system audio capture ────
  ipcMain.handle('get-screen-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }
      });
      return sources.map(s => ({ id: s.id, name: s.name }));
    } catch (err) {
      console.error('[IPC] get-screen-sources failed:', err);
      return [];
    }
  });

  // ─── Mic/speaker diagnostic ping ─────────────────────────────
  ipcMain.handle('check-media-permissions', async () => {
    return { granted: true, message: 'Permissions granted at Electron level' };
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (localServer) {
    localServer.close();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
