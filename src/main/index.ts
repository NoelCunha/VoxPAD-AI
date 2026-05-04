import { app, BrowserWindow, ipcMain, session, systemPreferences } from 'electron'
import path from 'path'
import { setupIpcHandlers } from './ipc-handlers'

// Enable speech recognition in Chromium
app.commandLine.appendSwitch('enable-speech-dispatcher')
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI')

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    title: 'VoxPad AI',
    icon: path.join(__dirname, '../../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: true,
    backgroundColor: '#ffffff',
  })

  // Grant microphone permission automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(true)
    }
  })

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') {
      return true
    }
    return true
  })

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Request microphone access on Windows
async function requestMicrophoneAccess() {
  if (process.platform === 'win32') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone')
      if (status !== 'granted') {
        await systemPreferences.askForMediaAccess('microphone')
      }
    } catch {
      // askForMediaAccess may not be available on older Windows versions
    }
  }
}

app.whenReady().then(async () => {
  await requestMicrophoneAccess()
  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
