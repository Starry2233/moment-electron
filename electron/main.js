const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow = null
let backendProcess = null
let backendPort = null

const isDev = !app.isPackaged

// ── Python Backend Management ──

function findBackendPath() {
  if (isDev) {
    // Development: use python directly
    return {
      command: process.platform === 'win32' ? 'python' : 'python3',
      args: ['-u', path.join(__dirname, '..', 'backend', 'main.py')],
    }
  } else {
    // Production: use compiled exe
    const exeName = process.platform === 'win32' ? 'main.exe' : 'main'
    return {
      command: path.join(process.resourcesPath, 'backend', exeName),
      args: [],
    }
  }
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const { command, args } = findBackendPath()
    console.log(`[Electron] Starting backend: ${command} ${args.join(' ')}`)

    backendProcess = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    let started = false
    let buffer = ''

    backendProcess.stdout.on('data', (data) => {
      buffer += data.toString()
      // Try to parse the ready message
      const lines = buffer.split('\n')
      for (const line of lines) {
        try {
          const msg = JSON.parse(line.trim())
          if (msg.type === 'ready' && msg.port && !started) {
            started = true
            backendPort = msg.port
            console.log(`[Electron] Backend ready on port ${backendPort}`)
            resolve(backendPort)
          }
        } catch {
          // Not JSON, just log
          if (line.trim()) console.log(`[Backend] ${line.trim()}`)
        }
      }
      // Keep only the last incomplete line in buffer
      const lastNewline = buffer.lastIndexOf('\n')
      if (lastNewline >= 0) {
        buffer = buffer.slice(lastNewline + 1)
      }
    })

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend:err] ${data.toString().trim()}`)
    })

    backendProcess.on('error', (err) => {
      console.error('[Electron] Failed to start backend:', err)
      if (!started) reject(err)
    })

    backendProcess.on('exit', (code) => {
      console.log(`[Electron] Backend exited with code ${code}`)
      backendProcess = null
      if (!started) reject(new Error(`Backend exited with code ${code}`))
    })

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!started) reject(new Error('Backend start timeout'))
    }, 15000)
  })
}

function stopBackend() {
  if (!backendProcess) return
  console.log('[Electron] Stopping backend')
  const pid = backendProcess.pid
  try {
    if (process.platform === 'win32') {
      // Force kill the entire process tree on Windows
      spawn('taskkill', ['/f', '/t', '/pid', String(pid)], { stdio: 'ignore' })
    } else {
      backendProcess.kill('SIGTERM')
    }
  } catch (e) {
    console.error('[Electron] Error killing backend:', e)
  }
  backendProcess = null
}

// ── HTTP Helper to talk to backend ──

function backendRequest(endpoint) {
  return new Promise((resolve, reject) => {
    if (!backendPort) {
      reject(new Error('Backend not started'))
      return
    }
    const url = `http://127.0.0.1:${backendPort}${endpoint}`
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve(data)
        }
      })
    }).on('error', reject)
  })
}

// ── Window ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 780,
    minWidth: 380,
    minHeight: 600,
    title: '好友圈',
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
    backgroundColor: '#F5F5F5',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  })

  if (isDev) {
    // Try Vite dev server first, fallback to built files
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── IPC Handlers ──

ipcMain.handle('get-backend-port', () => backendPort)

ipcMain.handle('backend-request', async (_event, endpoint) => {
  try {
    return await backendRequest(endpoint)
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('backend-post', async (_event, { endpoint, body }) => {
  return new Promise((resolve) => {
    if (!backendPort) {
      resolve({ error: 'Backend not started' })
      return
    }
    const postData = body ? JSON.stringify(body) : ''
    const options = {
      hostname: '127.0.0.1',
      port: backendPort,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', (err) => resolve({ error: err.message }))
    req.write(postData)
    req.end()
  })
})

// ── App Lifecycle ──

app.whenReady().then(async () => {
  try {
    await startBackend()
  } catch (err) {
    console.error('[Electron] Backend startup failed:', err.message)
    // Continue anyway, the frontend will show error state
  }
  createWindow()
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

app.on('before-quit', () => {
  stopBackend()
})

app.on('will-quit', () => {
  stopBackend()
})
