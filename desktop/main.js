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

  // Native getDisplayMedia handler for Electron 16+
  if (typeof session.defaultSession.setDisplayMediaRequestHandler === 'function') {
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        if (sources.length > 0) {
          callback({ video: sources[0] });
        } else {
          callback({});
        }
      }).catch((err) => {
        console.error('[DISPLAY CAPTURE] Error getting sources:', err);
        callback({});
      });
    });
  }

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
let SetCursorPos = null;
let mouse_event = null;
let keybd_event = null;
let GetSystemMetrics = null;

try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  SetWindowDisplayAffinity = user32.func('bool SetWindowDisplayAffinity(uint64 hWnd, uint32 dwAffinity)');
  SetCursorPos = user32.func('bool SetCursorPos(int x, int y)');
  mouse_event = user32.func('void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uint64 dwExtraInfo)');
  keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uint64 dwExtraInfo)');
  GetSystemMetrics = user32.func('int GetSystemMetrics(int nIndex)');
  console.log('[WIN32] Loaded SetWindowDisplayAffinity & Remote Control APIs via koffi FFI');
} catch (e) {
  console.warn('[WIN32] Could not load koffi FFI:', e.message);
}

function getVirtualKeyCode(key) {
  if (!key) return 0;
  if (key.length === 1) {
    const code = key.toUpperCase().charCodeAt(0);
    if ((code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5A)) {
      return code;
    }
  }
  const keyMap = {
    'Enter': 0x0D,
    'Backspace': 0x08,
    'Tab': 0x09,
    'Escape': 0x1B,
    'Space': 0x20,
    ' ': 0x20,
    'ArrowLeft': 0x25,
    'ArrowUp': 0x26,
    'ArrowRight': 0x27,
    'ArrowDown': 0x28,
    'Delete': 0x2E,
    'Shift': 0x10,
    'Control': 0x11,
    'Alt': 0x12,
  };
  return keyMap[key] || 0;
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
    skipTaskbar: true,
    type: 'toolbar',
    title: "CareerCopilot Interview Assistant",
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

  // Windows can sometimes re-add the taskbar icon when the window is shown.
  // Reapply the setting explicitly after creation and on show.
  mainWindow.setSkipTaskbar(true);

  // Exclude overlay from screen shares and recordings (SetWindowDisplayAffinity)
  mainWindow.setContentProtection(true);
  applyWin32ContentProtection(mainWindow);

  const startUrl = isDev
    ? 'http://localhost:5173/assistant'
    : `http://127.0.0.1:${localPort}/assistant`;

  mainWindow.loadURL(startUrl);

  if (isDev && process.env.DEV_TOOLS === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.setSkipTaskbar(true);
    mainWindow.show();
    mainWindow.setSkipTaskbar(true);
    applyWin32ContentProtection(mainWindow);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSkipTaskbar(true);
        applyWin32ContentProtection(mainWindow);
      }
    }, 500);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSkipTaskbar(true);
        applyWin32ContentProtection(mainWindow);
      }
    }, 1500);

    // Continuously re-enforce screen protection and skipTaskbar every 1 second
    setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSkipTaskbar(true);
        applyWin32ContentProtection(mainWindow);
      }
    }, 1000);
  });

  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSkipTaskbar(true);
      applyWin32ContentProtection(mainWindow);
    }
  });
  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSkipTaskbar(true);
    }
  });


  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[WINDOW] Page finished loading');
    // Inject permission grant helper into the page context
    mainWindow.webContents.executeJavaScript(`
      // Monkey-patch getUserMedia to always succeed in Electron
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log('[CareerCopilot] getUserMedia available');
      } else {
        console.warn('[CareerCopilot] getUserMedia NOT available - mic will not work');
      }
      console.log('[CareerCopilot] SpeechRecognition:', !!(window.SpeechRecognition || window.webkitSpeechRecognition));
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
      tray.setToolTip('CareerCopilot Interview Assistant Active');
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
        types: ['screen','window'],
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

  // ─── Execute remote mouse / keyboard control from viewer ──────
  ipcMain.handle('execute-remote-input', (event, input) => {
    if (process.platform !== 'win32' || !SetCursorPos || !mouse_event) return;

    try {
      const screenW = GetSystemMetrics ? GetSystemMetrics(0) : 1920;
      const screenH = GetSystemMetrics ? GetSystemMetrics(1) : 1080;

      if (typeof input.xRatio === 'number' && typeof input.yRatio === 'number') {
        const targetX = Math.round(input.xRatio * screenW);
        const targetY = Math.round(input.yRatio * screenH);
        SetCursorPos(targetX, targetY);
      }

      if (input.type === 'mousedown' || input.type === 'mouseup' || input.type === 'click') {
        let downFlag = 0x0002; // MOUSEEVENTF_LEFTDOWN
        let upFlag = 0x0004;   // MOUSEEVENTF_LEFTUP
        if (input.button === 'right' || input.button === 2) {
          downFlag = 0x0008; // MOUSEEVENTF_RIGHTDOWN
          upFlag = 0x0010;   // MOUSEEVENTF_RIGHTUP
        }

        if (input.type === 'mousedown') {
          mouse_event(downFlag, 0, 0, 0, 0);
        } else if (input.type === 'mouseup') {
          mouse_event(upFlag, 0, 0, 0, 0);
        } else if (input.type === 'click') {
          mouse_event(downFlag, 0, 0, 0, 0);
          mouse_event(upFlag, 0, 0, 0, 0);
        }
      } else if (input.type === 'wheel') {
        const delta = input.deltaY < 0 ? 120 : -120;
        mouse_event(0x0800, 0, 0, delta, 0); // MOUSEEVENTF_WHEEL
      } else if (input.type === 'keydown' || input.type === 'keyup') {
        const vk = getVirtualKeyCode(input.key);
        if (vk) {
          const flag = input.type === 'keyup' ? 0x0002 : 0x0000;
          keybd_event(vk, 0, flag, 0);
        }
      }
    } catch (err) {
      console.error('[WIN32:REMOTE-INPUT] Execution error:', err);
    }
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
