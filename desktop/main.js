const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut, desktopCapturer, screen } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;
let tray;

async function captureActiveScreenBase64() {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1280, height: 800 }
  });

  if (sources.length > 0) {
    // Return primary screen capture
    return sources[0].thumbnail.toPNG().toString('base64');
  }
  throw new Error("No active screen captures found.");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 600,
    minWidth: 320,
    minHeight: 500,
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
    : `file://${path.join(__dirname, '../client/dist/index.html')}`; // Fallback index loads landing or route

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App Ready Event
app.whenReady().then(() => {
  createWindow();

  // 1. Toggles Assistant Visibility (Ctrl + \)
  globalShortcut.register('CommandOrControl+\\', () => {
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
      
      // Make sure the window is visible to show loaders
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

  // Register local IPC handlers
  ipcMain.handle('hide-overlay', () => {
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.handle('sync-history-state', (event, state) => {
    // Synchronize current history details for tray info
    console.log('[IPC] Synced history index:', state.currentIndex);
  });

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
});

app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
