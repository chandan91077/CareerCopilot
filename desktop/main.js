const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut, desktopCapturer, session, screen, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;
let tray;
let localPort;
let localServer;
let isQuitting = false;
let isManuallyHidden = false;

// ─── Persistent Lifecycle & Heartbeat Logging ───────────────────────
const lifecycleLogDir = app.getPath('userData');
const lifecycleLogPrimary = path.join(lifecycleLogDir, 'careercopilot-lifecycle.log');
const lifecycleLogLocal = path.join(__dirname, 'careercopilot-lifecycle.log');

function writeLifecycleLog(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

  // Standard output
  console.log(logLine.trim());

  // Safe file writes to both userData and local folder
  [lifecycleLogPrimary, lifecycleLogLocal].forEach((targetPath) => {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(targetPath, logLine, 'utf8');

      // Auto-prune if file exceeds 3MB to prevent unbounded disk usage
      if (fs.statSync(targetPath).size > 3 * 1024 * 1024) {
        const raw = fs.readFileSync(targetPath, 'utf8');
        const lines = raw.split('\n');
        fs.writeFileSync(targetPath, lines.slice(-2000).join('\n'), 'utf8');
      }
    } catch (_) {}
  });
}

writeLifecycleLog('INFO', '=== CareerCopilot Desktop Process Initialized ===', {
  pid: process.pid,
  platform: process.platform,
  version: app.getVersion(),
  isPackaged: app.isPackaged
});

// ─── Single Instance Lock ──────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  writeLifecycleLog('WARN', '[APP] Another instance is already running. Quitting duplicate instance.', { pid: process.pid });
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    writeLifecycleLog('INFO', '[APP] Second instance detected. Restoring and focusing primary overlay.', { commandLine });
    if (mainWindow && !mainWindow.isDestroyed()) {
      isManuallyHidden = false;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      if (typeof reassertAlwaysOnTopAndWorkspace === 'function') {
        reassertAlwaysOnTopAndWorkspace(mainWindow, 'second-instance');
      }
      mainWindow.focus();
    }
  });
}

// ─── Persistent Auth Session File in userData ──────────────────────
const authStorageFile = path.join(app.getPath('userData'), 'auth-session.json');

function getStoredAuthData() {
  try {
    if (fs.existsSync(authStorageFile)) {
      const data = fs.readFileSync(authStorageFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[AUTH STORAGE] Error reading auth data:', err.message);
  }
  return null;
}

function setStoredAuthData(authData) {
  try {
    const dir = path.dirname(authStorageFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(authStorageFile, JSON.stringify(authData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[AUTH STORAGE] Error writing auth data:', err.message);
    return false;
  }
}

function clearStoredAuthData() {
  try {
    if (fs.existsSync(authStorageFile)) {
      fs.unlinkSync(authStorageFile);
    }
    return true;
  } catch (err) {
    console.error('[AUTH STORAGE] Error clearing auth data:', err.message);
    return false;
  }
}

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
      // Prioritize full screen sources so DWM desktop compositor captures all overlays & virtual windows
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        if (sources.length > 0) {
          callback({ video: sources[0] });
        } else {
          desktopCapturer.getSources({ types: ['screen', 'window'] }).then((allSources) => {
            callback({ video: allSources[0] || null });
          }).catch(() => callback({}));
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

// ─── Local static file server for packaged build (deterministic port) ─
const PREFERRED_LOCAL_PORT = 58291;

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

  const tryListen = (port) => {
    localServer.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[SERVER] Port ${port} in use, trying port ${port + 1}...`);
        tryListen(port + 1);
      } else {
        console.error('[SERVER] Server error:', err);
      }
    });

    localServer.listen(port, '127.0.0.1', () => {
      localPort = localServer.address().port;
      console.log('[SERVER] Packaged static assets serving on consistent port:', localPort);
      callback(localPort);
    });
  };

  tryListen(PREFERRED_LOCAL_PORT);
}

// ─── Screen capture: grab active screen with display scale ──────────
async function captureActiveScreenBase64() {
  let targetDisplay = screen ? screen.getPrimaryDisplay() : null;
  if (mainWindow && screen && !mainWindow.isDestroyed()) {
    try {
      const winBounds = mainWindow.getBounds();
      targetDisplay = screen.getDisplayNearestPoint({
        x: winBounds.x + Math.round(winBounds.width / 2),
        y: winBounds.y + Math.round(winBounds.height / 2)
      }) || targetDisplay;
    } catch (e) {
      // fallback to primary
    }
  }

  const bounds = targetDisplay ? targetDisplay.bounds : { width: 1920, height: 1080 };
  const scale = (targetDisplay && targetDisplay.scaleFactor) ? targetDisplay.scaleFactor : 1;
  const width = Math.round(bounds.width * scale);
  const height = Math.round(bounds.height * scale);

  let sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  });

  if (!sources || sources.length === 0) {
    sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width, height }
    });
  }

  if (sources && sources.length > 0) {
    let matchedSource = sources[0];
    if (targetDisplay && sources.length > 1) {
      const found = sources.find(s => {
        if (s.display_id && String(s.display_id) === String(targetDisplay.id)) return true;
        const parts = s.id.split(':');
        return parts.length >= 2 && String(parts[1]) === String(targetDisplay.id);
      });
      if (found) matchedSource = found;
    }
    const pngBuffer = matchedSource.thumbnail.toPNG();
    try {
      const debugPath = path.join(app.getPath('temp'), 'last-capture-debug.png');
      fs.writeFileSync(debugPath, pngBuffer);
      const timestampedPath = path.join(app.getPath('temp'), `capture-debug-${Date.now()}.png`);
      fs.writeFileSync(timestampedPath, pngBuffer);
      console.log('[CAPTURE DEBUG] Saved fresh screen capture (' + pngBuffer.length + ' bytes) for display ' + (targetDisplay?.id || 'primary') + ' to:', debugPath, 'and', timestampedPath);
    } catch (e) {
      console.warn('[CAPTURE DEBUG] Could not write debug image file:', e.message);
    }
    return pngBuffer.toString('base64');
  }
  throw new Error("No active screen captures found.");
}

let SetWindowDisplayAffinity = null;
let SetWindowPos = null;
let SetCursorPos = null;
let mouse_event = null;
let keybd_event = null;
let GetSystemMetrics = null;

try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  SetWindowDisplayAffinity = user32.func('bool SetWindowDisplayAffinity(uint64 hWnd, uint32 dwAffinity)');
  SetWindowPos = user32.func('bool SetWindowPos(uint64 hWnd, int64 hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)');
  SetCursorPos = user32.func('bool SetCursorPos(int x, int y)');
  mouse_event = user32.func('void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uint64 dwExtraInfo)');
  keybd_event = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uint64 dwExtraInfo)');
  GetSystemMetrics = user32.func('int GetSystemMetrics(int nIndex)');
  writeLifecycleLog('INFO', '[WIN32] Loaded SetWindowPos, SetWindowDisplayAffinity & Remote Control APIs via koffi FFI');
} catch (e) {
  writeLifecycleLog('WARN', '[WIN32] Could not load koffi FFI:', { error: e.message });
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
          SetWindowDisplayAffinity(hwnd, 0x00000001);
        }
      }
    } catch (err) {
      writeLifecycleLog('ERROR', '[WIN32] SetWindowDisplayAffinity error:', { error: err.message });
    }
  }
}

// ─── Re-assert Always-on-Top and Virtual Desktop Pinning ────────────
function reassertAlwaysOnTopAndWorkspace(win, reason = 'unknown') {
  // Never reassert or show a window that is destroyed or deliberately hidden
  if (isManuallyHidden || !win || win.isDestroyed() || !win.isVisible()) return;

  try {
    // 1. Electron level: Set to 'screen-saver' (highest Z-order level) with relative level 1
    win.setAlwaysOnTop(true, 'screen-saver', 1);

    // 2. Windows Virtual Desktops: Pin across ALL workspaces so switching between Desktop 1 and Desktop 2 preserves the overlay
    if (typeof win.setVisibleOnAllWorkspaces === 'function') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    // 3. Keep skipTaskbar enforced (stays tool-style overlay)
    win.setSkipTaskbar(true);

    // 4. Native Win32 SetWindowPos HWND_TOPMOST reinforcement:
    // HWND_TOPMOST = -1
    // SWP_NOSIZE (0x0001) | SWP_NOMOVE (0x0002) | SWP_NOACTIVATE (0x0010) = 0x0013
    // Crucial: Do NOT use SWP_SHOWWINDOW (0x0040) as it forces visibility and causes flicker on toggle
    if (SetWindowPos && process.platform === 'win32') {
      const handleBuf = win.getNativeWindowHandle();
      if (handleBuf && handleBuf.length >= 8) {
        const hwnd = handleBuf.readBigUInt64LE(0);
        SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0013);
      }
    }

    // 5. Exclude from screen share captures
    applyWin32ContentProtection(win);
  } catch (err) {
    writeLifecycleLog('WARN', `reassertAlwaysOnTopAndWorkspace failed (${reason})`, { error: err.message });
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

  // Pin across virtual desktops immediately upon instantiation
  if (typeof mainWindow.setVisibleOnAllWorkspaces === 'function') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setSkipTaskbar(true);
  applyWin32ContentProtection(mainWindow);

  const startUrl = isDev
    ? 'http://localhost:5173/assistant'
    : `http://127.0.0.1:${localPort}/assistant`;

  writeLifecycleLog('INFO', '[WINDOW] Loading URL:', { startUrl, isDev });
  mainWindow.loadURL(startUrl);

  if (isDev && process.env.DEV_TOOLS === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    writeLifecycleLog('INFO', '[WINDOW] ready-to-show fired');
    mainWindow.show();
    reassertAlwaysOnTopAndWorkspace(mainWindow, 'ready-to-show');

    // Sequential reinforcements during initial display phase
    setTimeout(() => reassertAlwaysOnTopAndWorkspace(mainWindow, 'startup-500ms'), 500);
    setTimeout(() => reassertAlwaysOnTopAndWorkspace(mainWindow, 'startup-1500ms'), 1500);

    // Heartbeat timer every 2500ms:
    // 1. Logs liveness & state to careercopilot-lifecycle.log
    // 2. Re-asserts topmost and virtual workspace (ONLY if not manually hidden)
    setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
        writeLifecycleLog('HEARTBEAT', `PID: ${process.pid} | Mem: ${memMb}MB | Visible: ${mainWindow.isVisible()} | ManuallyHidden: ${isManuallyHidden} | Minimized: ${mainWindow.isMinimized()} | Focused: ${mainWindow.isFocused()} | Bounds: ${JSON.stringify(mainWindow.getBounds())}`);
        if (!isManuallyHidden && mainWindow.isVisible()) {
          reassertAlwaysOnTopAndWorkspace(mainWindow, 'heartbeat-interval');
        }
      }
    }, 2500);
  });

  // ── Window Focus & Blur Listeners ──────────────────────────
  mainWindow.on('blur', () => {
    if (isManuallyHidden || !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
    writeLifecycleLog('INFO', '[WINDOW] blur: another app took focus. Re-asserting topmost and workspace.');
    // Reclaim top position immediately without stealing focus from the newly active window
    reassertAlwaysOnTopAndWorkspace(mainWindow, 'window-blur');
  });

  mainWindow.on('focus', () => {
    if (isManuallyHidden) {
      // Overlay was manually hidden via Ctrl+/; suppress any accidental focus-induced reveal
      writeLifecycleLog('INFO', '[WINDOW] focus event received while isManuallyHidden=true. Enforcing hidden state.');
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      return;
    }
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
    writeLifecycleLog('INFO', '[WINDOW] focus event received');
    reassertAlwaysOnTopAndWorkspace(mainWindow, 'window-focus');
  });

  mainWindow.on('show', () => {
    if (isManuallyHidden) {
      writeLifecycleLog('WARN', '[WINDOW] show event intercepted while isManuallyHidden=true. Forcing immediate hide.');
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      return;
    }
    writeLifecycleLog('INFO', '[WINDOW] show event received');
    reassertAlwaysOnTopAndWorkspace(mainWindow, 'window-show');
  });

  mainWindow.on('hide', () => {
    writeLifecycleLog('INFO', `[WINDOW] hide event received (isManuallyHidden=${isManuallyHidden})`);
  });

  mainWindow.on('minimize', () => {
    writeLifecycleLog('WARN', '[WINDOW] minimize event received');
  });

  mainWindow.on('restore', () => {
    if (isManuallyHidden) {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      return;
    }
    writeLifecycleLog('INFO', '[WINDOW] restore event received');
    reassertAlwaysOnTopAndWorkspace(mainWindow, 'window-restore');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    writeLifecycleLog('INFO', '[WINDOW] Page finished loading');
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
    writeLifecycleLog('INFO', '[MEDIA] Audio playback started');
  });

  mainWindow.on('close', (event) => {
    const stack = new Error().stack;
    writeLifecycleLog('WARN', '[WINDOW] close event received', {
      isQuitting,
      isManuallyHidden,
      callStack: stack
    });

    if (!isQuitting) {
      event.preventDefault();
      writeLifecycleLog('INFO', '[CLOSE-GUARD] Intercepted close signal while isQuitting=false. Preventing close.');
      if (!isManuallyHidden) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        reassertAlwaysOnTopAndWorkspace(mainWindow, 'close-prevented');
      }
    } else {
      writeLifecycleLog('INFO', '[WINDOW] Close event permitted as isQuitting=true');
    }
  });

  mainWindow.on('closed', () => {
    writeLifecycleLog('INFO', '[WINDOW] closed event triggered');
    mainWindow = null;
  });
}

// ─── Global keyboard shortcuts ────────────────────────────────────
let lastToggleShortcutTime = 0;

function registerShortcuts() {
  // 1. Toggle overlay visibility (Ctrl + /)
  globalShortcut.unregister('CommandOrControl+/');
  globalShortcut.register('CommandOrControl+/', () => {
    const now = Date.now();
    if (now - lastToggleShortcutTime < 300) return; // Prevent double-trigger / key repeat
    lastToggleShortcutTime = now;

    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (isManuallyHidden || !mainWindow.isVisible()) {
      isManuallyHidden = false;
      writeLifecycleLog('INFO', '[SHORTCUT] Ctrl+/ toggled: Unhiding overlay (isManuallyHidden=false).');
      mainWindow.show();
      mainWindow.focus();
      reassertAlwaysOnTopAndWorkspace(mainWindow, 'manual-unhide');
    } else {
      isManuallyHidden = true;
      writeLifecycleLog('INFO', '[SHORTCUT] Ctrl+/ toggled: Manually hiding overlay (isManuallyHidden=true).');
      mainWindow.hide();
    }
  });

  // 2. Capture screen and send to overlay (Ctrl + Enter)
  globalShortcut.register('CommandOrControl+Enter', async () => {
    if (!mainWindow) return;
    try {
      const base64Image = await captureActiveScreenBase64();
      mainWindow.webContents.send('screen-captured', base64Image);
      if (!isManuallyHidden && !mainWindow.isVisible()) {
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
        {
          label: 'Show Assistant',
          click: () => {
            isManuallyHidden = false;
            writeLifecycleLog('INFO', '[TRAY] Show Assistant clicked: Clearing isManuallyHidden and showing overlay.');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
              reassertAlwaysOnTopAndWorkspace(mainWindow, 'tray-show');
            } else {
              createWindow();
            }
          }
        },
        {
          label: 'Quit CareerCopilot',
          click: () => {
            const choice = dialog.showMessageBoxSync(mainWindow || null, {
              type: 'question',
              buttons: ['Cancel', 'Quit CareerCopilot'],
              defaultId: 0,
              cancelId: 0,
              title: 'CareerCopilot',
              message: 'Are you sure you want to quit CareerCopilot?',
              detail: 'The interview assistant will stop running.'
            });
            if (choice === 1) {
              isQuitting = true;
              app.quit();
            }
          }
        }
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      isManuallyHidden = true;
      writeLifecycleLog('INFO', '[IPC] hide-overlay invoked: Manually hiding overlay (isManuallyHidden=true).');
      mainWindow.hide();
    }
  });

  ipcMain.handle('set-opacity', (event, opacity) => {
    if (mainWindow && !isManuallyHidden) {
      mainWindow.setOpacity(parseFloat(opacity));
    }
  });

  ipcMain.handle('sync-history-state', (event, state) => {
    console.log('[IPC] Synced history index:', state.currentIndex);
  });

  // ─── Get available media sources for system audio / screen capture ────
  ipcMain.handle('get-screen-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }
      });
      const displays = screen ? screen.getAllDisplays() : [];
      const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;

      // Prioritize full screen sources so DWM desktop compositor captures all overlays & virtual windows
      sources.sort((a, b) => {
        const aIsScreen = a.id.startsWith('screen:');
        const bIsScreen = b.id.startsWith('screen:');
        if (aIsScreen && !bIsScreen) return -1;
        if (!aIsScreen && bIsScreen) return 1;
        return 0;
      });

      return sources.map(s => {
        let matchedDisplay = primaryDisplay;
        if (s.id.startsWith('screen:')) {
          const parts = s.id.split(':');
          if (parts.length >= 2) {
            const disp = displays.find(d => String(d.id) === parts[1]);
            if (disp) matchedDisplay = disp;
          }
        }
        const bounds = matchedDisplay ? matchedDisplay.bounds : { width: 1920, height: 1080 };
        const scale = (matchedDisplay && matchedDisplay.scaleFactor) ? matchedDisplay.scaleFactor : 1;

        return {
          id: s.id,
          name: s.name,
          width: bounds.width,
          height: bounds.height,
          scaleFactor: scale,
          physicalWidth: Math.round(bounds.width * scale),
          physicalHeight: Math.round(bounds.height * scale),
        };
      });
    } catch (err) {
      console.error('[IPC] get-screen-sources failed:', err);
      return [];
    }
  });

  // ─── Query dynamic screen resolution and DPI scale factor ────────────
  ipcMain.handle('get-screen-resolution', (event, sourceId) => {
    try {
      const displays = screen ? screen.getAllDisplays() : [];
      const primary = screen ? screen.getPrimaryDisplay() : null;
      let matchedDisplay = primary;

      if (sourceId && typeof sourceId === 'string') {
        const parts = sourceId.split(':');
        if (parts.length >= 2) {
          const displayIdStr = parts[1];
          const found = displays.find(d => String(d.id) === displayIdStr);
          if (found) matchedDisplay = found;
        }
      }

      const bounds = matchedDisplay ? matchedDisplay.bounds : { width: 1920, height: 1080 };
      const scale = (matchedDisplay && matchedDisplay.scaleFactor) ? matchedDisplay.scaleFactor : 1;
      const physicalWidth = Math.round(bounds.width * scale);
      const physicalHeight = Math.round(bounds.height * scale);

      return {
        width: bounds.width,
        height: bounds.height,
        scaleFactor: scale,
        physicalWidth,
        physicalHeight,
      };
    } catch (err) {
      console.error('[IPC] get-screen-resolution failed:', err);
      return {
        width: 1920,
        height: 1080,
        scaleFactor: 1,
        physicalWidth: 1920,
        physicalHeight: 1080,
      };
    }
  });

  // ─── Persistent Auth Session Handlers ────────────────────────
  ipcMain.handle('get-stored-auth', () => {
    return getStoredAuthData();
  });

  ipcMain.handle('set-stored-auth', (event, authData) => {
    return setStoredAuthData(authData);
  });

  ipcMain.handle('clear-stored-auth', () => {
    return clearStoredAuthData();
  });

  // ─── Mic/speaker diagnostic ping ─────────────────────────────
  ipcMain.handle('check-media-permissions', async () => {
    return { granted: true, message: 'Permissions granted at Electron level' };
  });

  // ─── Execute remote mouse / keyboard control from viewer ──────
  ipcMain.handle('execute-remote-input', (event, input) => {
    if (process.platform !== 'win32' || !SetCursorPos || !mouse_event) return;

    try {
      const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;
      const defaultW = primaryDisplay ? Math.round(primaryDisplay.bounds.width * (primaryDisplay.scaleFactor || 1)) : 1920;
      const defaultH = primaryDisplay ? Math.round(primaryDisplay.bounds.height * (primaryDisplay.scaleFactor || 1)) : 1080;
      const screenW = GetSystemMetrics ? GetSystemMetrics(0) : defaultW;
      const screenH = GetSystemMetrics ? GetSystemMetrics(1) : defaultH;

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

app.on('before-quit', (event) => {
  writeLifecycleLog('INFO', `[APP] before-quit event triggered. isQuitting=${isQuitting}`);
  if (!isQuitting) {
    event.preventDefault();
    writeLifecycleLog('WARN', '[APP] Prevented unconfirmed before-quit event. Use tray or explicit quit.');
  }
});

app.on('will-quit', () => {
  writeLifecycleLog('INFO', '[APP] will-quit event triggered. Cleaning up shortcuts and server.');
  globalShortcut.unregisterAll();
  if (localServer) {
    localServer.close();
  }
});

app.on('window-all-closed', () => {
  writeLifecycleLog('INFO', `[APP] window-all-closed event triggered. isQuitting=${isQuitting}`);
  if (isQuitting && process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── Crash & Process Lifecycle Diagnostics ──────────────────────────
app.on('render-process-gone', (event, webContents, details) => {
  writeLifecycleLog('FATAL', '[PROCESS] Renderer process gone (crash/killed)', {
    reason: details.reason,
    exitCode: details.exitCode
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    writeLifecycleLog('INFO', '[PROCESS] Auto-recovering overlay after renderer crash...');
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const startUrl = isDev
          ? 'http://localhost:5173/assistant'
          : `http://127.0.0.1:${localPort}/assistant`;
        mainWindow.loadURL(startUrl);
      }
    }, 1000);
  }
});

app.on('child-process-gone', (event, details) => {
  writeLifecycleLog('WARN', '[PROCESS] Child process gone', {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    serviceName: details.serviceName,
    name: details.name
  });
});

process.on('uncaughtException', (err) => {
  writeLifecycleLog('FATAL', '[PROCESS] Uncaught Exception in main process', {
    message: err.message,
    stack: err.stack
  });
});

process.on('unhandledRejection', (reason) => {
  writeLifecycleLog('ERROR', '[PROCESS] Unhandled Rejection in main process', {
    reason: reason instanceof Error ? reason.stack : String(reason)
  });
});

