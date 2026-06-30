const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut, desktopCapturer } = require('electron');
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

// Local static files server to support React Router HTML5 BrowserRouter
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 250,
    minWidth: 500,
    minHeight: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    title: "CareerCopilot Assistant Overlay",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  // Load React router
  const startUrl = isDev 
    ? 'http://localhost:5173/assistant' 
    : `http://127.0.0.1:${localPort}/assistant`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerShortcuts() {
  // 1. Toggles Assistant Visibility (Ctrl + /)
  globalShortcut.register('CommandOrControl+/', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // 2. Capture and Analyze Screen (Ctrl + Enter)
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
    }
  });

  // 3. Navigation Controls (Ctrl + [ and Ctrl + ])
  globalShortcut.register('CommandOrControl+[', () => {
    if (mainWindow) mainWindow.webContents.send('navigate-prev');
  });

  globalShortcut.register('CommandOrControl+]', () => {
    if (mainWindow) mainWindow.webContents.send('navigate-next');
  });

  // 4. Move Window Coordinates using Ctrl + Arrow keys
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

app.whenReady().then(() => {
  const initApp = () => {
    createWindow();
    registerShortcuts();
    
    // Create System Tray
    try {
      const iconPath = path.join(__dirname, 'assets', 'icon.ico');
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Assistant', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
        { label: 'Quit', click: () => app.quit() }
      ]);
      tray.setToolTip('CareerCopilot Assistant Active');
      tray.setContextMenu(contextMenu);
    } catch (err) {
      console.log("No tray icon setup. Skipping.");
    }
  };

  if (isDev) {
    initApp();
  } else {
    startLocalServer(() => {
      initApp();
    });
  }

  // Auto-allow media and audio permission checks
  const { session } = require('electron');
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'audio' || permission === 'media') return true;
    return false;
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'audio' || permission === 'media') callback(true);
    else callback(false);
  });

  // Register local IPC handlers
  ipcMain.on('trigger-screen-capture', async () => {
    try {
      const base64Image = await captureActiveScreenBase64();
      if (mainWindow) mainWindow.webContents.send('screen-captured', base64Image);
    } catch (err) {
      console.error("Screen capture IPC trigger failed:", err);
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
