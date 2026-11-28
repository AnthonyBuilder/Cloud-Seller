const $ = selector => document.querySelector(selector)

const elements = {
  serverUrl: $('#server-url'),
  deviceName: $('#device-name'),
  folderList: $('#folder-list'),
  folderEmpty: $('#folder-empty'),
  accountStatus: $('#account-status'),
  statusMessage: $('#status-message'),
  statusDot: $('#status-dot'),
  notice: $('#notice'),
  backupOnChange: $('#backup-on-change'),
  backupDaily: $('#backup-daily'),
  backupNow: $('#backup-now-button'),
  backupProgress: $('#backup-progress'),
  backupList: $('#backup-list'),
  backupEmpty: $('#backup-empty'),
  restoreButton: $('#restore-button'),
  refreshBackups: $('#refresh-backups-button'),
}

let appState
let backups = []

function showNotice(message, type = 'info') {
  elements.notice.textContent = message
  elements.notice.className = `notice ${type}`
  elements.notice.classList.remove('hidden')
}

function setConnected(connected, encryptedStorage = true) {
  elements.accountStatus.textContent = connected ? 'Conta conectada' : 'Conta desconectada'
  elements.statusMessage.textContent = connected
    ? (encryptedStorage ? 'Pronto para proteger seus arquivos.' : 'Conectado. A sessão será encerrada ao fechar o aplicativo.')
    : 'Conecte sua conta para começar.'
  elements.statusDot.classList.toggle('connected', connected)
  $('#login-button').classList.toggle('hidden', connected)
  $('#logout-button').classList.toggle('hidden', !connected)
  elements.backupNow.disabled = !connected || !appState?.settings.folders.length
  elements.refreshBackups.disabled = !connected
  renderFolders()
}

function renderFolders() {
  elements.folderList.replaceChildren()
  const folders = appState?.settings.folders || []
  elements.folderEmpty.classList.toggle('hidden', folders.length > 0)
  elements.backupNow.disabled = !appState?.connected || folders.length === 0

  for (const folder of folders) {
    const item = document.createElement('li')
    item.className = 'folder-item'
    const path = document.createElement('span')
    path.textContent = folder
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'text-button'
    remove.textContent = 'Remover'
    remove.setAttribute('aria-label', `Remover ${folder}`)
    remove.addEventListener('click', async () => {
      try {
        appState.settings.folders = await window.backupApi.removeFolder(folder)
        renderFolders()
      } catch (error) {
        showNotice(error.message, 'error')
      }
    })
    item.append(path, remove)
    elements.folderList.append(item)
  }
}

function renderBackups() {
  elements.backupList.replaceChildren()
  elements.backupEmpty.classList.toggle('hidden', backups.length > 0)
  elements.backupEmpty.textContent = backups.length ? '' : 'Nenhum backup encontrado para este computador.'

  for (const backup of backups) {
    const item = document.createElement('li')
    item.className = 'backup-item'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = backup.key
    checkbox.setAttribute('aria-label', `Selecionar ${backup.name}`)
    checkbox.addEventListener('change', updateRestoreButton)
    const details = document.createElement('span')
    const name = document.createElement('strong')
    name.textContent = backup.name
    const path = document.createElement('small')
    const parts = backup.key.split('/Backups/')[1]?.split('/') || []
    path.textContent = `${parts.slice(1).join('/')} · ${new Date(backup.modified).toLocaleString('pt-BR')}`
    details.append(name, path)
    item.append(checkbox, details)
    elements.backupList.append(item)
  }
  updateRestoreButton()
}

function updateRestoreButton() {
  const selected = elements.backupList.querySelectorAll('input:checked').length
  elements.restoreButton.disabled = selected === 0
  elements.restoreButton.textContent = selected
    ? `Restaurar selecionados (${selected})`
    : 'Restaurar selecionados'
}

function renderNextBackup() {
  const note = $('#next-backup')
  if (!appState.nextNightlyBackup) {
    note.textContent = ''
    return
  }
  const when = new Date(appState.nextNightlyBackup)
  const last = appState.settings.lastBackupAt
    ? ` Último backup completo: ${new Date(appState.settings.lastBackupAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
    : ''
  note.textContent = `Próximo backup noturno: ${when <= new Date() ? 'assim que possível' : when.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.${last} O computador precisa estar ligado e com este app aberto (ele fica na bandeja).`
}

async function loadState() {
  try {
    appState = await window.backupApi.getState()
    elements.serverUrl.value = appState.settings.serverUrl
    elements.deviceName.value = appState.settings.deviceName
    elements.backupOnChange.checked = appState.settings.backupOnChange
    elements.backupDaily.checked = appState.settings.dailyBackup
    $('#start-at-login').checked = appState.settings.startAtLogin
    $('#backup-time').value = appState.settings.backupTime || '02:00'
    $('#retention-days').value = appState.settings.retentionDays || 30
    renderNextBackup()
    setConnected(appState.connected, appState.encryptedStorage)
  } catch (error) {
    showNotice(error.message, 'error')
  }
}

window.backupApi.onStatus(status => {
  elements.backupProgress.textContent = status.message
  if (status.type === 'error') showNotice(status.message, 'error')
  if (status.type === 'success') showNotice(status.message, 'success')
})

$('#login-button').addEventListener('click', async () => {
  $('#login-button').disabled = true
  try {
    const result = await window.backupApi.login()
    appState.connected = result.connected
    setConnected(result.connected, result.encryptedStorage)
  } catch (error) {
    showNotice(error.message, 'error')
  } finally {
    $('#login-button').disabled = false
  }
})

$('#logout-button').addEventListener('click', async () => {
  try {
    await window.backupApi.logout()
    appState.connected = false
    setConnected(false)
    backups = []
    renderBackups()
  } catch (error) {
    showNotice(error.message, 'error')
  }
})

$('#add-folder-button').addEventListener('click', async () => {
  try {
    appState.settings.folders = await window.backupApi.selectFolders()
    renderFolders()
  } catch (error) {
    showNotice(error.message, 'error')
  }
})

$('#save-button').addEventListener('click', async () => {
  try {
    appState.settings = await window.backupApi.saveSettings({
      serverUrl: elements.serverUrl.value.trim(),
      deviceName: elements.deviceName.value.trim(),
      backupOnChange: elements.backupOnChange.checked,
      dailyBackup: elements.backupDaily.checked,
      startAtLogin: $('#start-at-login').checked,
      backupTime: $('#backup-time').value,
      retentionDays: Number($('#retention-days').value),
    })
    await loadState()
    showNotice('Configurações salvas.', 'success')
  } catch (error) {
    showNotice(error.message, 'error')
  }
})

elements.backupNow.addEventListener('click', async () => {
  elements.backupNow.disabled = true
  try {
    await window.backupApi.runNow()
  } catch (error) {
    showNotice(error.message, 'error')
  } finally {
    elements.backupNow.disabled = false
  }
})

elements.refreshBackups.addEventListener('click', async () => {
  elements.refreshBackups.disabled = true
  elements.backupEmpty.textContent = 'Buscando backups…'
  elements.backupEmpty.classList.remove('hidden')
  try {
    backups = await window.backupApi.listBackups()
    renderBackups()
  } catch (error) {
    showNotice(error.message, 'error')
    elements.backupEmpty.textContent = 'Não foi possível carregar os backups.'
  } finally {
    elements.refreshBackups.disabled = false
  }
})

elements.restoreButton.addEventListener('click', async () => {
  const keys = [...elements.backupList.querySelectorAll('input:checked')].map(input => input.value)
  if (!keys.length) return
  elements.restoreButton.disabled = true
  try {
    const result = await window.backupApi.restore(keys)
    if (result.restored) showNotice(`${result.restored} arquivo(s) restaurado(s).`, 'success')
  } catch (error) {
    showNotice(error.message, 'error')
  } finally {
    updateRestoreButton()
  }
})

$('#dashboard-button').addEventListener('click', () => window.backupApi.openDashboard())

loadState()
