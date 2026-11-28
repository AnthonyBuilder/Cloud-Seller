const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, powerSaveBlocker, safeStorage, shell, Tray } = require('electron')
const {
  dayKey,
  nextNightlyRun,
  normalizeBackupTime,
  normalizeRetentionDays,
  shouldRunNightlyBackup,
  snapshotsToDelete,
} = require('./schedule.cjs')
const chokidar = require('chokidar')
const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const { Readable } = require('node:stream')

let buildConfig = {}
try {
  buildConfig = require('./app-config.json')
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error
}

const CALLBACK_PORT = 53682
const CALLBACK_PATH = '/callback'
const BACKUP_ROOT = 'Backups'
const IGNORED_SEGMENTS = new Set(['.git', 'node_modules', '.DS_Store'])

let mainWindow
let watcher
let queue = Promise.resolve()
let settings
let tokens
let dailyTimer
let manifest = {}
let tray
let isQuitting = false
let dailyBackupRunning = false

const userData = () => app.getPath('userData')
const settingsPath = () => path.join(userData(), 'settings.json')
const authPath = () => path.join(userData(), 'auth.json')
const manifestPath = () => path.join(userData(), 'backup-manifest.json')

function defaultSettings() {
  return {
    serverUrl: buildConfig.serverUrl || process.env.CLOUD_SELLER_SERVER_URL || 'http://localhost:3000',
    folders: [],
    backupOnChange: true,
    dailyBackup: true,
    backupTime: '02:00',
    retentionDays: 30,
    startAtLogin: true,
    deviceName: os.hostname(),
  }
}

function notify(message, type = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backup:status', { message, type })
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

async function writeJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 })
}

function validateServerUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Informe um endereço válido para o servidor Cloud Seller.')
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('O servidor precisa usar HTTPS (ou HTTP apenas em localhost).')
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('HTTP só é permitido para testes locais. Use HTTPS no servidor.')
  }
  return url.origin
}

async function getCognitoConfig() {
  const url = `${validateServerUrl(settings.serverUrl)}/api/desktop/config`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Não foi possível carregar a configuração do servidor.')
  const config = await response.json()
  if (!config.cognitoDomain || !config.cognitoClientId) {
    throw new Error('O servidor não retornou a configuração pública do Cognito.')
  }
  let redirect
  try {
    redirect = new URL(config.redirectUri)
  } catch {
    throw new Error('O servidor retornou um callback Cognito inválido.')
  }
  if (redirect.protocol !== 'http:'
    || !['localhost', '127.0.0.1'].includes(redirect.hostname)
    || redirect.port !== String(CALLBACK_PORT)
    || redirect.pathname !== CALLBACK_PATH
    || redirect.search
    || redirect.hash) {
    throw new Error(`O callback Cognito deve usar localhost ou 127.0.0.1 na porta ${CALLBACK_PORT}, caminho ${CALLBACK_PATH}.`)
  }
  return { ...config, redirectUri: redirect.href.replace(/\/$/, '') }
}

function makeRandom(size = 32) {
  return crypto.randomBytes(size).toString('base64url')
}

function waitForCallback(expectedState, redirectUri, timeoutMs = 5 * 60 * 1000) {
  const callbackAddress = new URL(redirectUri)
  let resolveReady
  let rejectReady
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  const callback = new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const callbackUrl = new URL(request.url, callbackAddress.origin)
      if (callbackUrl.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end()
        return
      }

      if (callbackUrl.searchParams.get('state') !== expectedState) {
        response.writeHead(400).end('Falha ao validar a sessão. Feche esta janela.')
        server.close()
        reject(new Error('O estado do login não confere.'))
        return
      }

      const oauthError = callbackUrl.searchParams.get('error')
      if (oauthError) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<h2>Login cancelado</h2>Você pode fechar esta janela.')
        server.close()
        reject(new Error('O login foi cancelado.'))
        return
      }

      const code = callbackUrl.searchParams.get('code')
      if (!code) {
        response.writeHead(400).end('Código de autorização ausente.')
        server.close()
        reject(new Error('O Cognito não retornou um código de autorização.'))
        return
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end('<!doctype html><meta charset="utf-8"><title>Cloud Seller</title><p>Login concluído. Você pode fechar esta janela e voltar ao Cloud Seller Backup.</p>')
      server.close()
      resolve(code)
    })

    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('O tempo para concluir o login expirou.'))
    }, timeoutMs)
    server.once('close', () => clearTimeout(timeout))
    server.once('error', error => {
      clearTimeout(timeout)
      rejectReady(error)
      reject(error.code === 'EADDRINUSE'
        ? new Error(`A porta ${CALLBACK_PORT} já está em uso. Feche o outro processo Cloud Seller Backup e tente novamente.`)
        : error)
    })
    server.once('listening', resolveReady)
    server.listen(CALLBACK_PORT, callbackAddress.hostname)
  })
  callback.ready = ready
  return callback
}

async function persistTokens(nextTokens) {
  tokens = nextTokens
  if (!safeStorage.isEncryptionAvailable()) return
  const encrypted = safeStorage.encryptString(JSON.stringify(nextTokens))
  await fsp.writeFile(authPath(), encrypted, { mode: 0o600 })
}

async function loadTokens() {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const encrypted = await fsp.readFile(authPath())
    return JSON.parse(safeStorage.decryptString(encrypted))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function startLogin() {
  const config = await getCognitoConfig()
  const verifier = makeRandom(48)
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state = makeRandom(24)
  const callback = waitForCallback(state, config.redirectUri)
  callback.catch(() => {})
  await callback.ready
  const cognitoDomain = config.cognitoDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const authorizeUrl = new URL(`https://${cognitoDomain}/oauth2/authorize`)
  authorizeUrl.search = new URLSearchParams({
    client_id: config.cognitoClientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: config.redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }).toString()

  await shell.openExternal(authorizeUrl.toString())
  notify('Conclua o login na janela do navegador.', 'info')
  const code = await callback
  const response = await fetch(`https://${cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.cognitoClientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error('O Cognito não aceitou o código de login.')
  const result = await response.json()
  if (!result.id_token) throw new Error('O Cognito não retornou um token de identidade.')

  await persistTokens({
    idToken: result.id_token,
    refreshToken: result.refresh_token || '',
    expiresAt: Date.now() + (result.expires_in || 3600) * 1000,
  })

  notify('Conta conectada com segurança.', 'success')
  await startWatcher()
  return { connected: true, encryptedStorage: safeStorage.isEncryptionAvailable() }
}

async function currentIdToken() {
  if (!tokens) tokens = await loadTokens()
  if (!tokens?.idToken) throw new Error('Conecte sua conta antes de iniciar o backup.')
  if (tokens.expiresAt > Date.now() + 60_000) return tokens.idToken
  if (!tokens.refreshToken) {
    tokens = null
    throw new Error('Sua sessão expirou. Conecte sua conta novamente.')
  }

  const config = await getCognitoConfig()
  const cognitoDomain = config.cognitoDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const response = await fetch(`https://${cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.cognitoClientId,
      refresh_token: tokens.refreshToken,
    }),
  })
  if (!response.ok) {
    tokens = null
    throw new Error('Não foi possível renovar a sessão. Conecte sua conta novamente.')
  }

  const result = await response.json()
  await persistTokens({
    idToken: result.id_token || tokens.idToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + (result.expires_in || 3600) * 1000,
  })
  return tokens.idToken
}

async function apiRequest(route, options = {}) {
  const idToken = await currentIdToken()
  const response = await fetch(`${validateServerUrl(settings.serverUrl)}${route}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Servidor respondeu ${response.status}: ${detail.slice(0, 180)}`)
  }
  return response
}

function slug(value) {
  return value.normalize('NFC').replace(/[\\/]/g, '-').replace(/[^\p{L}\p{N}._ -]/gu, '-').trim() || 'computador'
}

function rootFolderName(root) {
  const name = slug(path.basename(root))
  const fingerprint = crypto.createHash('sha256')
    .update(path.resolve(root).toLowerCase())
    .digest('hex')
    .slice(0, 8)
  return `${name}-${fingerprint}`
}

function shouldIgnorePath(filePath) {
  return filePath.split(path.sep).some(segment => IGNORED_SEGMENTS.has(segment))
}

function queueTask(task) {
  queue = queue.then(task).catch(error => {
    notify(error.message || 'Falha ao executar backup.', 'error')
  })
  return queue
}

async function uploadBackupFile(filePath, root, snapshot = 'current') {
  if (shouldIgnorePath(filePath)) return
  let stat
  try {
    stat = await fsp.stat(filePath)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  if (!stat.isFile()) return

  const key = path.resolve(filePath)
  const date = dayKey()
  const previous = manifest[key] || {}
  const device = slug(settings.deviceName)
  if (snapshot === 'current'
    && previous.device === device
    && previous.currentMtimeMs === stat.mtimeMs
    && previous.currentSize === stat.size) return
  // A cópia diária guarda só a versão dos arquivos que mudaram desde a última vez (histórico
  // incremental); o que não mudou já está em Current. Assim o espaço usado não cresce todo dia.
  if (snapshot === 'daily'
    && previous.device === device
    && previous.dailyMtimeMs === stat.mtimeMs
    && previous.dailySize === stat.size) return

  const relativePath = path.relative(root, filePath)
  const relativeDir = path.dirname(relativePath) === '.' ? '' : `/${path.dirname(relativePath).split(path.sep).map(slug).join('/')}`
  const snapshotPath = snapshot === 'daily' ? `Daily/${date}` : 'Current'
  const folder = `/${BACKUP_ROOT}/${device}/${snapshotPath}/${rootFolderName(root)}${relativeDir}/`
  const result = await apiRequest('/api/files/upload', {
    method: 'POST',
    body: JSON.stringify({
      folder,
      name: path.basename(filePath),
      mime: 'application/octet-stream',
    }),
  }).then(response => response.json())

  const request = require('node:https')
  await new Promise((resolve, reject) => {
    const target = new URL(result.url)
    const outgoing = request.request(target, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
      },
    }, response => {
      response.resume()
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`S3 recusou o arquivo "${path.basename(filePath)}" (${response.statusCode}).`))
      } else {
        resolve()
      }
    })
    outgoing.once('error', reject)
    fs.createReadStream(filePath).once('error', reject).pipe(outgoing)
  })

  manifest[key] = snapshot === 'daily'
    ? { ...previous, device, dailyMtimeMs: stat.mtimeMs, dailySize: stat.size, dailyDate: date }
    : { ...previous, device, currentMtimeMs: stat.mtimeMs, currentSize: stat.size }
  await writeJson(manifestPath(), manifest)
  notify(`Backup atualizado: ${path.basename(filePath)}`, 'success')
}

async function walkFiles(directory, callback) {
  let entries
  try {
    entries = await fsp.readdir(directory, { withFileTypes: true })
  } catch (error) {
    notify(`Não foi possível ler ${directory}: ${error.message}`, 'error')
    return
  }

  for (const entry of entries) {
    if (IGNORED_SEGMENTS.has(entry.name)) continue
    const child = path.join(directory, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) await walkFiles(child, callback)
    else if (entry.isFile()) await callback(child)
  }
}

async function pruneOldSnapshots() {
  const base = `/${BACKUP_ROOT}/${slug(settings.deviceName)}/Daily/`
  let folders
  try {
    const response = await apiRequest(`/api/files/list?folder=${encodeURIComponent(base)}`)
    folders = (await response.json()).folders || []
  } catch (error) {
    notify(`Não foi possível limpar o histórico antigo: ${error.message}`, 'error')
    return
  }

  const expired = snapshotsToDelete(folders.map(folder => folder.name), dayKey(), settings.retentionDays)
  for (const name of expired) {
    await apiRequest('/api/files/folder', {
      method: 'DELETE',
      body: JSON.stringify({ path: `${base}${name}/`, permanent: true }),
    })
  }
  if (expired.length) notify(`Histórico com mais de ${normalizeRetentionDays(settings.retentionDays)} dias removido (${expired.length} dia(s)).`)
}

// nightly=true: backup completo da noite (arquivos novos/alterados + versões diárias + limpeza do histórico).
// nightly=false: só envia o que mudou para a cópia atual (usado ao abrir o app).
async function runFullBackup({ nightly = true } = {}) {
  if (!settings.folders.length) {
    notify('Adicione ao menos uma pasta para fazer backup.', 'error')
    return
  }
  // Impede o computador de suspender no meio do backup.
  const blocker = powerSaveBlocker.start('prevent-app-suspension')
  try {
    notify(nightly ? 'Backup noturno em andamento…' : 'Verificando alterações…')
    const withDaily = nightly && settings.dailyBackup
    for (const root of settings.folders) {
      await walkFiles(root, async (filePath) => {
        await uploadBackupFile(filePath, root, 'current')
        if (withDaily) await uploadBackupFile(filePath, root, 'daily')
      })
    }
    if (nightly) {
      settings.lastDailyBackup = dayKey()
      settings.lastBackupAt = new Date().toISOString()
      await writeJson(settingsPath(), settings)
      if (settings.dailyBackup) await pruneOldSnapshots()
    }
    notify('Backup concluído.', 'success')
  } finally {
    powerSaveBlocker.stop(blocker)
  }
}

async function startWatcher() {
  if (watcher) await watcher.close()
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
  if (!settings.folders.length || !tokens?.idToken) return

  watcher = chokidar.watch(settings.folders, {
    ignoreInitial: true,
    followSymlinks: false,
    awaitWriteFinish: { stabilityThreshold: 1200, pollInterval: 150 },
    ignored: filePath => shouldIgnorePath(filePath),
  })
  watcher.on('add', filePath => {
    if (settings.backupOnChange) {
      const root = settings.folders.find(folder => filePath === folder || filePath.startsWith(`${folder}${path.sep}`))
      if (root) queueTask(() => uploadBackupFile(filePath, root, 'current'))
    }
  })
  watcher.on('change', filePath => {
    if (settings.backupOnChange) {
      const root = settings.folders.find(folder => filePath === folder || filePath.startsWith(`${folder}${path.sep}`))
      if (root) queueTask(() => uploadBackupFile(filePath, root, 'current'))
    }
  })
  watcher.on('error', error => notify(`Erro ao observar pastas: ${error.message}`, 'error'))

  if (settings.dailyBackup) {
    dailyTimer = setInterval(() => {
      if (
        !dailyBackupRunning
        && settings.dailyBackup
        && shouldRunNightlyBackup({
          lastDailyBackup: settings.lastDailyBackup,
          backupTime: settings.backupTime,
        })
      ) {
        dailyBackupRunning = true
        queueTask(async () => {
          try {
            await runFullBackup({ nightly: true })
          } finally {
            dailyBackupRunning = false
          }
        })
      }
    }, 60_000)
  }
  void queueTask(() => runFullBackup({ nightly: false }))
}

async function listBackups() {
  const output = []
  const pending = [`/${BACKUP_ROOT}/`]
  while (pending.length) {
    const folder = pending.pop()
    const response = await apiRequest(`/api/files/list?folder=${encodeURIComponent(folder)}`)
    const result = await response.json()
    for (const child of result.folders) pending.push(child.path)
    for (const file of result.files) output.push(file)
  }
  return output
    .filter(file => file.key.includes(`/${BACKUP_ROOT}/`))
    .sort((a, b) => b.modified.localeCompare(a.modified))
}

async function restoreFiles(keys) {
  const destination = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha onde restaurar os arquivos',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (destination.canceled || !destination.filePaths[0]) return { restored: 0 }

  const restoreRoot = path.resolve(destination.filePaths[0])
  const targets = [...new Set(keys)].map(key => {
      if (!key.includes(`/${BACKUP_ROOT}/`)) throw new Error('O arquivo selecionado não pertence a um backup Cloud Seller.')
      const suffix = key.split(`/${BACKUP_ROOT}/`)[1]
      const parts = suffix.split('/')
      if (!parts.length || parts.some(part => !part || part === '..' || part === '.' || path.isAbsolute(part) || /[<>:"|?*\\]/.test(part))) {
        throw new Error('Caminho de restauração inválido.')
      }

      const target = path.resolve(restoreRoot, ...parts)
      const relativeTarget = path.relative(restoreRoot, target)
      if (!relativeTarget || relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
        throw new Error('Caminho de restauração fora da pasta de destino.')
      }
      return { key, target }
  })

  for (const { target } of targets) {
      try {
        await fsp.access(target)
        throw new Error(`O arquivo ${path.basename(target)} já existe no destino. Escolha uma pasta vazia para evitar sobrescrever dados.`)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
  }

  let restored = 0
  for (const { key, target } of targets) {
    const response = await apiRequest(`/api/files/download?key=${encodeURIComponent(key)}`)
    const { url } = await response.json()
    const download = await fetch(url)
    if (!download.ok || !download.body) throw new Error(`Não foi possível baixar ${path.basename(target)}.`)
    await fsp.mkdir(path.dirname(target), { recursive: true })
      await pipeline(Readable.fromWeb(download.body), fs.createWriteStream(target, { flags: 'wx' }))
    restored++
    notify(`Restaurado: ${path.basename(target)}`, 'success')
  }
  return { restored }
}

async function getState() {
  if (!settings) settings = { ...defaultSettings(), ...await readJson(settingsPath(), {}) }
  if (!manifest || !Object.keys(manifest).length) manifest = await readJson(manifestPath(), {})
  if (!tokens) tokens = await loadTokens()
  const nextNightly = settings.dailyBackup && settings.folders.length
    ? nextNightlyRun({ lastDailyBackup: settings.lastDailyBackup, backupTime: settings.backupTime }).toISOString()
    : null
  return {
    settings,
    nextNightlyBackup: nextNightly,
    connected: Boolean(tokens?.idToken),
    encryptedStorage: safeStorage.isEncryptionAvailable(),
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 720,
    minHeight: 620,
    backgroundColor: '#f3f6fa',
    title: 'Cloud Seller Backup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', event => event.preventDefault())
  mainWindow.on('close', event => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      notify('O backup continua ativo em segundo plano.')
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Cloud Seller Backup')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Cloud Seller Backup', click: () => mainWindow?.show() },
    { label: 'Fazer backup agora', click: () => queueTask(runFullBackup) },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]))
  tray.on('click', () => mainWindow?.show())
}

app.whenReady().then(async () => {
  settings = { ...defaultSettings(), ...await readJson(settingsPath(), {}) }
  manifest = await readJson(manifestPath(), {})
  tokens = await loadTokens()
  app.setLoginItemSettings({ openAtLogin: settings.startAtLogin })
  createWindow()
  createTray()
  if (tokens?.idToken) await startWatcher()
})

app.on('before-quit', () => {
  isQuitting = true
  if (dailyTimer) clearInterval(dailyTimer)
  if (watcher) void watcher.close()
})
app.on('activate', () => {
  if (mainWindow) mainWindow.show()
  else createWindow()
})

ipcMain.handle('backup:get-state', getState)
ipcMain.handle('backup:login', startLogin)
ipcMain.handle('backup:logout', async () => {
  tokens = null
  if (watcher) {
    await watcher.close()
    watcher = null
  }
  if (dailyTimer) clearInterval(dailyTimer)
  await fsp.rm(authPath(), { force: true })
  return { connected: false }
})
ipcMain.handle('backup:select-folders', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecione as pastas para backup',
    properties: ['openDirectory', 'multiSelections'],
  })
  if (result.canceled) return settings.folders
  settings.folders = [...new Set([...settings.folders, ...result.filePaths.map(path.resolve)])]
  await writeJson(settingsPath(), settings)
  await startWatcher()
  return settings.folders
})
ipcMain.handle('backup:remove-folder', async (_event, folder) => {
  settings.folders = settings.folders.filter(item => item !== folder)
  await writeJson(settingsPath(), settings)
  await startWatcher()
  return settings.folders
})
ipcMain.handle('backup:save-settings', async (_event, next) => {
  settings.serverUrl = validateServerUrl(next.serverUrl)
  settings.deviceName = slug(next.deviceName)
  settings.backupOnChange = Boolean(next.backupOnChange)
  settings.dailyBackup = Boolean(next.dailyBackup)
  settings.backupTime = normalizeBackupTime(next.backupTime)
  settings.retentionDays = normalizeRetentionDays(next.retentionDays)
  settings.startAtLogin = Boolean(next.startAtLogin)
  if (!settings.backupOnChange && !settings.dailyBackup) {
    throw new Error('Ative pelo menos um modo de backup.')
  }
  await writeJson(settingsPath(), settings)
  app.setLoginItemSettings({ openAtLogin: settings.startAtLogin })
  await startWatcher()
  return settings
})
ipcMain.handle('backup:run-now', () => queueTask(() => runFullBackup({ nightly: true })))
ipcMain.handle('backup:list', listBackups)
ipcMain.handle('backup:restore', (_event, keys) => restoreFiles(keys))
ipcMain.handle('backup:open-dashboard', async () => {
  await shell.openExternal(validateServerUrl(settings.serverUrl))
})
