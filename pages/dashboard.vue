<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'
import { FILE_CATEGORIES, FILE_CATEGORY_LABELS, getFileCategory, type FileCategory } from '~/utils/file-types'
import { clearStoredSession, isUnauthorizedError, isJwtExpired } from '~/utils/session'

useHead({ title: 'Meus arquivos - Cloud Seller' })

type DashboardCollection = 'all' | 'recent' | 'favorites'
type SortOption = 'modified-desc' | 'modified-asc' | 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc'
type UserSession = { name: string; email: string }
type StorageSummary = {
  subscription: {
    name: string
    storage: string
    quotaBytes: number
    status: 'active' | 'trial' | 'expired' | 'incomplete' | 'past_due' | 'canceled'
    trialEndsAt?: number
  } | null
  usedBytes: number
  usageByCategory: Record<FileCategory, { bytes: number; count: number }>
}
type CloudFile = {
  id: string
  name: string
  folder: string
  size: number
  modified: number
  mime: string
  blob?: Blob
}
type CloudFolder = {
  path: string
  name: string
  parent: string
}
type ManagementTarget = {
  kind: 'file' | 'folder'
  source: string
  name: string
  parentFolder: string
}

const DB_NAME = 'cloud-seller-files'
const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const route = useRoute()
const session = ref<UserSession | null>(null)
const files = ref<CloudFile[]>([])
const folders = ref<CloudFolder[]>([])
const currentFolder = ref('/')
const search = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploadMessage = ref('')
const isUploading = ref(false)
const isDraggingFiles = ref(false)
const showFolderModal = ref(false)
const newFolderName = ref('')
const awsMode = ref(true)
const storageSummary = ref<StorageSummary | null>(null)
const previewFileItem = ref<CloudFile | null>(null)
const previewUrl = ref('')
const previewContentType = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const currentCollection = ref<DashboardCollection>(
  route.query.view === 'recent' || route.query.view === 'favorites' ? route.query.view : 'all',
)
const viewMode = ref<'list' | 'grid'>('list')
const sortOption = ref<SortOption>('modified-desc')
const typeFilter = ref<FileCategory | 'all'>('all')
const showOrganizationControls = ref(false)
const favoriteFileIds = ref<string[]>([])
const selectedFileIds = ref<string[]>([])
const bulkActionRunning = ref(false)
const bulkProgress = ref('')
const managementTarget = ref<ManagementTarget | null>(null)
const managementMode = ref<'rename' | 'move'>('rename')
const managementName = ref('')
const destinationFolder = ref('/')
const managingItem = ref(false)
const readOnlyStorage = computed(() => storageSummary.value?.subscription?.status === 'expired')
let db: IDBDatabase | null = null
let trialExpiryTimer: number | undefined

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}` }
}

function favoriteStorageKey() {
  const identity = session.value?.email.trim().toLowerCase() || 'unknown'
  return `cloud-seller-favorites:${identity}`
}

function loadFavorites() {
  const stored = localStorage.getItem(favoriteStorageKey())
  if (!stored) {
    favoriteFileIds.value = []
    return
  }

  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every(id => typeof id === 'string')) {
      throw new Error('Invalid favorites data')
    }
    favoriteFileIds.value = parsed
  } catch (caught) {
    console.error('Could not read saved favorites', caught)
    favoriteFileIds.value = []
    uploadMessage.value = 'Não foi possível carregar os favoritos salvos neste navegador.'
  }
}

function isFavorite(file: CloudFile) {
  return favoriteFileIds.value.includes(file.id)
}

function saveFavorites(next: string[]) {
  try {
    localStorage.setItem(favoriteStorageKey(), JSON.stringify(next))
    favoriteFileIds.value = next
  } catch (caught) {
    uploadMessage.value = getAuthError(caught, 'Não foi possível salvar os favoritos neste navegador.').message
  }
}

function toggleFavorite(file: CloudFile) {
  const next = isFavorite(file)
    ? favoriteFileIds.value.filter(id => id !== file.id)
    : [...favoriteFileIds.value, file.id]
  saveFavorites(next)
}

function remapFavoritePrefix(oldPrefix: string, newPrefix: string) {
  const next = favoriteFileIds.value.map(id => id.startsWith(oldPrefix) ? `${newPrefix}${id.slice(oldPrefix.length)}` : id)
  saveFavorites(next)
}

function toggleFileSelection(file: CloudFile) {
  selectedFileIds.value = selectedFileIds.value.includes(file.id)
    ? selectedFileIds.value.filter(id => id !== file.id)
    : [...selectedFileIds.value, file.id]
}

function toggleAllVisibleFiles() {
  const visibleIds = new Set(currentFiles.value.map(file => file.id))
  selectedFileIds.value = allVisibleFilesSelected.value
    ? selectedFileIds.value.filter(id => !visibleIds.has(id))
    : [...new Set([...selectedFileIds.value, ...visibleIds])]
}

function clearSelection() {
  selectedFileIds.value = []
}

async function setDashboardCollection(collection: DashboardCollection) {
  currentCollection.value = collection
  currentFolder.value = '/'
  search.value = ''
  clearSelection()
  await navigateTo({
    path: '/dashboard',
    query: collection === 'all' ? {} : { view: collection },
  })
  try {
    await refreshStorage()
  } catch (caught) {
    uploadMessage.value = getAuthError(caught, 'Não foi possível carregar esta visualização.').message
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('folders')) {
        database.createObjectStore('folders', { keyPath: 'path' })
      }
      if (!database.objectStoreNames.contains('files')) {
        database.createObjectStore('files', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAll<T>(storeName: 'folders' | 'files'): Promise<T[]> {
  if (!db) return []
  return new Promise((resolve, reject) => {
    const request = db!.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function saveRecord(storeName: 'folders' | 'files', value: CloudFolder | CloudFile) {
  if (!db) return
  await new Promise<void>((resolve, reject) => {
    const request = db!.transaction(storeName, 'readwrite').objectStore(storeName).put(value)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function deleteRecord(storeName: 'folders' | 'files', key: string) {
  if (!db) return
  await new Promise<void>((resolve, reject) => {
    const request = db!.transaction(storeName, 'readwrite').objectStore(storeName).delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function refreshStorage() {
  if (awsMode.value) {
    const result = await $fetch<{
      folder: string
      folders: { name: string; path: string }[]
      files: { key: string; name: string; size: number; modified: string; folder?: string }[]
    }>('/api/files/list', {
      headers: authHeaders(),
      query: {
        folder: currentFolder.value,
        all: currentCollection.value === 'all' ? undefined : 'true',
      },
    })
    folders.value = result.folders.map(folder => ({
      path: folder.path,
      name: folder.name,
      parent: currentFolder.value,
    }))
    files.value = result.files.map(file => ({
      id: file.key,
      name: file.name,
      folder: file.folder || currentFolder.value,
      size: file.size,
      modified: file.modified ? new Date(file.modified).getTime() : Date.now(),
      mime: guessMime(file.name),
      blob: undefined,
    }))
    return
  }
  folders.value = await getAll<CloudFolder>('folders')
  files.value = await getAll<CloudFile>('files')
}

async function refreshSubscription() {
  const summary = await $fetch<StorageSummary>('/api/subscription', {
    headers: authHeaders(),
  })
  storageSummary.value = summary
  if (trialExpiryTimer !== undefined) window.clearTimeout(trialExpiryTimer)

  const trialEndsAt = summary.subscription?.status === 'trial'
    ? summary.subscription.trialEndsAt
    : undefined
  if (trialEndsAt) {
    trialExpiryTimer = window.setTimeout(() => {
      if (storageSummary.value?.subscription?.status === 'trial') {
        storageSummary.value.subscription.status = 'expired'
      }
    }, Math.max(trialEndsAt - Date.now(), 0) + 50)
  }
}

function guessMime(name: string) {
  const extension = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return `image/${extension === 'jpg' ? 'jpeg' : extension}`
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'csv') return 'text/csv'
  if (extension === 'txt') return 'text/plain'
  if (['xlsx', 'xls'].includes(extension || '')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function supportsPreview(file: CloudFile) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'csv'].includes(extension || '')
}

function normalizePath(path: string) {
  return path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}/`
}

const currentFolders = computed(() => {
  if (currentCollection.value !== 'all') return []
  const term = search.value.trim().toLowerCase()
  return folders.value
    .filter(folder => folder.parent === currentFolder.value)
    .filter(folder => !term || folder.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const currentFiles = computed(() => {
  const term = search.value.trim().toLowerCase()
  const recentAfter = Date.now() - RECENT_WINDOW_MS
  return files.value
    .filter(file => currentCollection.value !== 'all' || file.folder === currentFolder.value)
    .filter(file => !term || file.name.toLowerCase().includes(term))
    .filter(file => typeFilter.value === 'all' || getFileCategory(file.name) === typeFilter.value)
    .filter(file => currentCollection.value !== 'recent' || file.modified >= recentAfter)
    .filter(file => currentCollection.value !== 'favorites' || favoriteFileIds.value.includes(file.id))
    .sort((a, b) => {
      const [sortKey, sortDirection] = sortOption.value.split('-')
      const comparison = sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : sortKey === 'size'
          ? a.size - b.size
          : a.modified - b.modified
      return sortDirection === 'asc' ? comparison : -comparison
    })
})

const itemCount = computed(() => currentFolders.value.length + currentFiles.value.length)
const selectedFiles = computed(() => currentFiles.value.filter(file => selectedFileIds.value.includes(file.id)))
const allVisibleFilesSelected = computed(() =>
  currentFiles.value.length > 0 && currentFiles.value.every(file => selectedFileIds.value.includes(file.id)),
)
const categoryUsage = computed(() => FILE_CATEGORIES
  .map(category => ({
    category,
    label: FILE_CATEGORY_LABELS[category],
    ...(storageSummary.value?.usageByCategory[category] || { bytes: 0, count: 0 }),
  }))
  .filter(category => category.count > 0)
  .sort((a, b) => b.bytes - a.bytes))
const totalFileCount = computed(() => categoryUsage.value.reduce((sum, item) => sum + item.count, 0))
const destinationFolders = computed(() => {
  const options = new Map<string, string>([['/', 'Meu armazenamento']])
  if (currentFolder.value !== '/') {
    options.set(currentFolder.value, currentFolder.value.split('/').filter(Boolean).join(' / '))
  }
  for (const folder of folders.value) {
    options.set(folder.path, folder.path.split('/').filter(Boolean).join(' / '))
  }
  const target = managementTarget.value
  if (target?.parentFolder) {
    options.set(target.parentFolder, target.parentFolder === '/'
      ? 'Meu armazenamento'
      : target.parentFolder.split('/').filter(Boolean).join(' / '))
  }
  return Array.from(options, ([path, name]) => ({ path, name }))
    .filter(folder => target?.kind !== 'folder' || (folder.path !== target.source && !folder.path.startsWith(target.source)))
})
const storagePercent = computed(() => {
  const summary = storageSummary.value
  const quota = summary?.subscription?.quotaBytes || 0
  return summary && quota ? Math.min(100, (summary.usedBytes / quota) * 100) : 0
})
const uploadBlocked = computed(() => {
  const summary = storageSummary.value
  return !summary?.subscription
    || (summary.subscription.status !== 'active' && summary.subscription.status !== 'trial')
    || summary.usedBytes >= summary.subscription.quotaBytes
})
const subscriptionNeedsPlan = computed(() => {
  const status = storageSummary.value?.subscription?.status
  return !status || (status !== 'active' && status !== 'trial')
})

const breadcrumbs = computed(() => {
  if (currentFolder.value === '/') return [{ name: 'Meu armazenamento', path: '/' }]
  const parts = currentFolder.value.split('/').filter(Boolean)
  const result = [{ name: 'Meu armazenamento', path: '/' }]
  let path = '/'
  for (const part of parts) {
    path += `${part}/`
    result.push({ name: part, path })
  }
  return result
})

watch(() => route.query.view, (view) => {
  const collection: DashboardCollection = view === 'recent' || view === 'favorites' ? view : 'all'
  if (collection === currentCollection.value) return
  currentCollection.value = collection
  currentFolder.value = '/'
  search.value = ''
  clearSelection()
  void refreshStorage().catch((caught) => {
    uploadMessage.value = getAuthError(caught, 'Não foi possível carregar esta visualização.').message
  })
})

watch([search, typeFilter, sortOption], clearSelection)

onMounted(async () => {
  const stored = localStorage.getItem('cloud-seller-session')
  const idToken = localStorage.getItem('cloud-seller-id-token')
  if (!stored || !idToken || isJwtExpired(idToken)) {
    clearStoredSession()
    await navigateTo('/login?reauth=1')
    return
  }
  session.value = JSON.parse(stored) as UserSession
  loadFavorites()

  try {
    await refreshSubscription()
    if (!storageSummary.value?.subscription) {
      await navigateTo('/subscription')
      return
    }
    await refreshStorage()
  } catch (caught) {
    if (isUnauthorizedError(caught)) {
      clearStoredSession()
      await navigateTo('/login?reauth=1')
      return
    }
    uploadMessage.value = 'Não foi possível carregar o armazenamento da AWS.'
  }
})

function logout() {
  clearStoredSession()
  navigateTo('/login')
}

async function openFolder(folder: CloudFolder) {
  currentFolder.value = normalizePath(folder.path)
  search.value = ''
  clearSelection()
  try {
    await refreshStorage()
  } catch (caught) {
    uploadMessage.value = getAuthError(caught, 'Não foi possível abrir esta pasta.').message
  }
}

async function goToBreadcrumb(path: string) {
  currentFolder.value = normalizePath(path)
  search.value = ''
  clearSelection()
  try {
    await refreshStorage()
  } catch (caught) {
    uploadMessage.value = getAuthError(caught, 'Não foi possível carregar esta pasta.').message
  }
}

async function createFolder() {
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    return
  }
  showFolderModal.value = true
  newFolderName.value = ''
  await nextTick()
  document.querySelector<HTMLInputElement>('#folder-name')?.focus()
}

async function confirmCreateFolder() {
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    return
  }
  const name = newFolderName.value.trim()
  if (!name) {
    uploadMessage.value = 'Digite um nome para a pasta.'
    return
  }

  const cleanName = name.replace(/[\\/]/g, '-')
  if (awsMode.value) {
    try {
      await $fetch('/api/files/folder', {
        method: 'POST',
        headers: authHeaders(),
        body: { folder: currentFolder.value, name: cleanName },
      })
      showFolderModal.value = false
      await refreshStorage()
      uploadMessage.value = `Pasta "${cleanName}" criada.`
    } catch (error) {
      uploadMessage.value = 'Não foi possível criar a pasta na AWS.'
    }
    return
  }

  if (!db) return
  const path = `${currentFolder.value === '/' ? '/' : currentFolder.value}${cleanName}/`
  const normalized = normalizePath(path)

  if (folders.value.some(folder => folder.path === normalized)) {
    uploadMessage.value = 'Já existe uma pasta com esse nome.'
    showFolderModal.value = false
    return
  }

  await saveRecord('folders', {
    path: normalized,
    name: cleanName,
    parent: currentFolder.value,
  })
  await refreshStorage()
  showFolderModal.value = false
  uploadMessage.value = `Pasta "${cleanName}" criada.`
}

function handleDragEnter(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) isDraggingFiles.value = true
}

function handleDragLeave(event: DragEvent) {
  const zone = event.currentTarget
  const target = event.relatedTarget
  if (zone instanceof HTMLElement && target instanceof Node && zone.contains(target)) return
  isDraggingFiles.value = false
}

async function handleFileDrop(event: DragEvent) {
  isDraggingFiles.value = false
  const droppedFiles = Array.from(event.dataTransfer?.files || [])
  if (!droppedFiles.length) return
  if (uploadBlocked.value) {
    uploadMessage.value = 'Ative um plano com pagamento aprovado para enviar arquivos.'
    return
  }
  await uploadFiles(droppedFiles)
}

function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement
  void uploadFiles(Array.from(input.files || []), input)
}

async function uploadFiles(selectedFiles: File[], input?: HTMLInputElement) {
  if (!selectedFiles.length || isUploading.value) {
    if (input) input.value = ''
    return
  }
  if (uploadBlocked.value) {
    uploadMessage.value = 'Ative um plano com pagamento aprovado para enviar arquivos.'
    if (input) input.value = ''
    return
  }

  isUploading.value = true
  uploadMessage.value = `Enviando ${selectedFiles.length} arquivo(s)...`
  try {
    if (awsMode.value) {
      let added = 0
      const failures: string[] = []
      for (const file of selectedFiles) {
        let key = ''
        try {
          const result = await $fetch<{ url: string; key: string }>('/api/files/upload', {
            method: 'POST',
            headers: authHeaders(),
            body: { folder: currentFolder.value, name: file.name, mime: file.type, size: file.size },
          })
          key = result.key
          const controller = new AbortController()
          let heartbeatError = ''
          let heartbeatInFlight = false
          const heartbeatTimer = window.setInterval(async () => {
            if (heartbeatInFlight) return
            heartbeatInFlight = true
            try {
              await $fetch('/api/files/upload/heartbeat', {
                method: 'POST',
                headers: authHeaders(),
                body: { key },
              })
            } catch (caught) {
              heartbeatError = getAuthError(caught, 'A reserva do envio expirou.').message
              controller.abort()
            } finally {
              heartbeatInFlight = false
            }
          }, 60_000)
          let upload: Response
          try {
            upload = await fetch(result.url, {
              method: 'PUT',
              headers: { 'Content-Type': file.type || 'application/octet-stream' },
              body: file,
              signal: controller.signal,
            })
          } catch (caught) {
            if (heartbeatError) throw new Error(heartbeatError)
            throw caught
          } finally {
            window.clearInterval(heartbeatTimer)
          }
          if (heartbeatError) throw new Error(heartbeatError)
          if (!upload.ok) throw new Error('Upload rejected')
          await $fetch('/api/files/upload/finalize', {
            method: 'POST',
            headers: authHeaders(),
            body: { key, uploaded: true },
          })
          added++
        } catch (caught) {
          const detail = getAuthError(caught, 'Não foi possível concluir o envio.').message
          uploadMessage.value = `Falha ao enviar "${file.name}": ${detail}`
          failures.push(`"${file.name}": ${detail}`)
          if (key) {
            try {
              await $fetch('/api/files/upload/finalize', {
                method: 'POST',
                headers: authHeaders(),
                body: { key, uploaded: false },
              })
            } catch (finalizeError) {
              console.error('Could not release the failed upload reservation', finalizeError)
            }
          }
        }
      }
      await refreshStorage()
      await refreshSubscription()
      if (added) {
        uploadMessage.value = `${added} arquivo(s) enviado(s) para a AWS.${failures.length ? ` Falhas: ${failures.join('; ')}.` : ''}`
      }
      return
    }

    if (!db) {
      uploadMessage.value = 'O armazenamento local não está disponível.'
      return
    }

    let added = 0
    for (const file of selectedFiles) {
      await saveRecord('files', {
        id: crypto.randomUUID(),
        name: file.name,
        folder: currentFolder.value,
        size: file.size,
        modified: file.lastModified || Date.now(),
        mime: file.type || 'application/octet-stream',
        blob: file,
      })
      added++
    }
    await refreshStorage()
    uploadMessage.value = `${added} arquivo(s) enviado(s) para esta pasta.`
  } catch (caught) {
    uploadMessage.value = getAuthError(caught, 'Não foi possível atualizar o armazenamento.').message
  } finally {
    if (input) input.value = ''
    isUploading.value = false
  }
}

function downloadFile(file: CloudFile) {
  if (awsMode.value) {
    void (async () => {
      try {
        const result = await $fetch<{ url: string }>('/api/files/download', {
          headers: authHeaders(),
          query: { key: file.id },
        })
        window.location.assign(result.url)
      } catch {
        uploadMessage.value = 'Não foi possível baixar o arquivo.'
      }
    })()
    return
  }

  if (!file.blob) return
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function triggerDownload(file: CloudFile, url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function downloadSelectedFiles() {
  const targets = [...selectedFiles.value]
  if (!targets.length || bulkActionRunning.value) return

  bulkActionRunning.value = true
  const failures: string[] = []
  let downloaded = 0
  try {
    for (let index = 0; index < targets.length; index++) {
      const file = targets[index]
      bulkProgress.value = `Preparando ${index + 1} de ${targets.length}`
      try {
        if (awsMode.value) {
          const result = await $fetch<{ url: string }>('/api/files/download', {
            headers: authHeaders(),
            query: { key: file.id },
          })
          triggerDownload(file, result.url)
        } else if (file.blob) {
          const url = URL.createObjectURL(file.blob)
          triggerDownload(file, url)
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        } else {
          throw new Error('Conteúdo local indisponível')
        }
        downloaded++
        await new Promise(resolve => window.setTimeout(resolve, 350))
      } catch (caught) {
        failures.push(`${file.name}: ${getAuthError(caught, 'falha no download').message}`)
      }
    }
    uploadMessage.value = failures.length
      ? `${downloaded} de ${targets.length} arquivos preparados. Falhas: ${failures.join('; ')}`
      : `${downloaded} arquivo(s) enviado(s) para download.`
  } finally {
    bulkActionRunning.value = false
    bulkProgress.value = ''
  }
}

async function deleteSelectedFiles() {
  const targets = [...selectedFiles.value]
  if (!targets.length || bulkActionRunning.value) return
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    return
  }
  if (!window.confirm(`Mover ${targets.length} arquivo(s) selecionado(s) para a lixeira? Você poderá restaurar em até 30 dias.`)) return

  bulkActionRunning.value = true
  const deletedIds = new Set<string>()
  const failures: string[] = []
  try {
    for (const file of targets) {
      try {
        if (awsMode.value) {
          await $fetch('/api/files/delete', {
            method: 'DELETE',
            headers: authHeaders(),
            body: { key: file.id },
          })
        } else {
          await deleteRecord('files', file.id)
        }
        deletedIds.add(file.id)
      } catch (caught) {
        failures.push(`${file.name}: ${getAuthError(caught, 'falha ao excluir').message}`)
      }
    }

    if (deletedIds.size) {
      selectedFileIds.value = selectedFileIds.value.filter(id => !deletedIds.has(id))
      try {
        await refreshStorage()
        await refreshSubscription()
      } catch (caught) {
        failures.push(`Atualização da lista: ${getAuthError(caught, 'falha ao atualizar').message}`)
      }
    }

    uploadMessage.value = failures.length
      ? `${deletedIds.size} arquivo(s) movido(s) para a lixeira. Falhas: ${failures.join('; ')}`
      : `${deletedIds.size} arquivo(s) movido(s) para a lixeira.`
  } finally {
    bulkActionRunning.value = false
  }
}

async function previewFile(file: CloudFile) {
  closePreview()
  previewFileItem.value = file
  previewLoading.value = true
  previewError.value = ''
  try {
    if (awsMode.value) {
      const result = await $fetch<{ url: string; contentType: string }>('/api/files/download', {
        headers: authHeaders(),
        query: { key: file.id, preview: 'true' },
      })
      previewUrl.value = result.url
      previewContentType.value = result.contentType
    } else if (file.blob) {
      previewUrl.value = URL.createObjectURL(file.blob)
      previewContentType.value = file.mime
    } else {
      throw new Error('O conteúdo deste arquivo não está disponível para visualização.')
    }
  } catch (caught) {
    previewError.value = getAuthError(caught, 'Não foi possível visualizar este arquivo.').message
  } finally {
    previewLoading.value = false
  }
}

function closePreview() {
  if (previewUrl.value.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
  previewFileItem.value = null
  previewUrl.value = ''
  previewContentType.value = ''
  previewLoading.value = false
  previewError.value = ''
}

async function deleteFile(file: CloudFile) {
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    return
  }
  if (!window.confirm(`Mover "${file.name}" para a lixeira? Você poderá restaurar em até 30 dias.`)) return
  if (awsMode.value) {
    await $fetch('/api/files/delete', {
      method: 'DELETE',
      headers: authHeaders(),
      body: { key: file.id },
    })
    await refreshStorage()
    uploadMessage.value = `Arquivo "${file.name}" excluído.`
    return
  }
  await deleteRecord('files', file.id)
  await refreshStorage()
  uploadMessage.value = `Arquivo "${file.name}" excluído.`
}

async function deleteFolder(folder: CloudFolder) {
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    return
  }
  if (!window.confirm(`Mover a pasta "${folder.name}" e todo o conteúdo nela para a lixeira? Você poderá restaurar em até 30 dias.`)) return
  if (awsMode.value) {
    await $fetch('/api/files/folder', {
      method: 'DELETE',
      headers: authHeaders(),
      body: { path: folder.path },
    })
    await refreshStorage()
    uploadMessage.value = `Pasta "${folder.name}" excluída.`
    return
  }

  const descendantFolders = folders.value.filter(item =>
    item.path.startsWith(folder.path)
  )
  const descendantFiles = files.value.filter(item =>
    item.folder === folder.path || item.folder.startsWith(folder.path)
  )

  for (const descendant of descendantFolders) await deleteRecord('folders', descendant.path)
  for (const descendant of descendantFiles) await deleteRecord('files', descendant.id)
  await refreshStorage()
  uploadMessage.value = `Pasta "${folder.name}" excluída.`
}

function startManagement(target: CloudFile, kind: 'file', mode: 'rename' | 'move'): void
function startManagement(target: CloudFolder, kind: 'folder', mode: 'rename' | 'move'): void
function startManagement(target: CloudFile | CloudFolder, kind: ManagementTarget['kind'], mode: 'rename' | 'move') {
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    return
  }
  const isFile = 'id' in target
  managementTarget.value = {
    kind,
    source: isFile ? target.id : target.path,
    name: target.name,
    parentFolder: isFile ? target.folder : target.parent,
  }
  managementMode.value = mode
  managementName.value = target.name
  destinationFolder.value = isFile ? target.folder : target.parent
}

function closeManagement() {
  managementTarget.value = null
  managingItem.value = false
}

async function saveManagement() {
  const target = managementTarget.value
  if (!target || managingItem.value) return
  if (readOnlyStorage.value) {
    uploadMessage.value = 'O período gratuito terminou; o armazenamento está somente para leitura.'
    closeManagement()
    return
  }

  const newName = managementName.value.trim().replace(/[\\/]/g, '-')
  if (!newName || newName === '.' || newName === '..') {
    uploadMessage.value = 'Informe um nome válido para o item.'
    return
  }

  const destination = normalizePath(destinationFolder.value)
  if (newName === target.name && destination === target.parentFolder) {
    closeManagement()
    return
  }
  if (target.kind === 'folder' && (destination === target.source || destination.startsWith(target.source))) {
    uploadMessage.value = 'Uma pasta não pode ser movida para dentro dela mesma.'
    return
  }

  managingItem.value = true
  try {
    if (awsMode.value) {
      const result = await $fetch<{ key?: string; sourcePrefix?: string; destinationPrefix?: string }>('/api/files/relocate', {
        method: 'POST',
        headers: authHeaders(),
        body: {
          kind: target.kind,
          source: target.source,
          destinationFolder: destination,
          newName,
        },
      })
      if (target.kind === 'file' && result.key) {
        remapFavoritePrefix(target.source, result.key)
      } else if (result.sourcePrefix && result.destinationPrefix) {
        remapFavoritePrefix(result.sourcePrefix, result.destinationPrefix)
      }
    } else if (target.kind === 'file') {
      const file = files.value.find(item => item.id === target.source)
      if (!file) throw new Error('O arquivo não está mais disponível.')
      const collision = files.value.some(item =>
        item.id !== file.id && item.folder === destination && item.name === newName,
      )
      if (collision) throw new Error('Já existe um arquivo com esse nome no destino.')
      await saveRecord('files', { ...file, name: newName, folder: destination })
    } else {
      const sourcePath = normalizePath(target.source)
      const destinationPath = normalizePath(`${destination === '/' ? '' : destination}${newName}`)
      if (folders.value.some(folder => folder.path === destinationPath && folder.path !== sourcePath)) {
        throw new Error('Já existe uma pasta com esse nome no destino.')
      }
      const affectedFolders = folders.value.filter(folder =>
        folder.path === sourcePath || folder.path.startsWith(sourcePath),
      )
      const affectedFiles = files.value.filter(file =>
        file.folder === sourcePath || file.folder.startsWith(sourcePath),
      )
      for (const folder of affectedFolders) {
        const path = `${destinationPath}${folder.path.slice(sourcePath.length)}`
        const parent = path.slice(0, path.lastIndexOf('/', path.length - 2) + 1) || '/'
        await deleteRecord('folders', folder.path)
        await saveRecord('folders', { ...folder, path, parent })
      }
      for (const file of affectedFiles) {
        await saveRecord('files', {
          ...file,
          folder: `${destinationPath}${file.folder.slice(sourcePath.length)}`,
        })
      }
    }

    await refreshStorage()
    clearSelection()
    uploadMessage.value = `${target.kind === 'file' ? 'Arquivo' : 'Pasta'} "${target.name}" atualizado(a).`
    closeManagement()
  } catch (caught) {
    uploadMessage.value = getAuthError(caught, 'Não foi possível mover ou renomear o item.').message
  } finally {
    managingItem.value = false
  }
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp)
}

function formatTrialEnd(timestamp?: number) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

onBeforeUnmount(() => {
  if (trialExpiryTimer !== undefined) window.clearTimeout(trialExpiryTimer)
})

function fileCategory(file: CloudFile): FileCategory {
  return getFileCategory(file.name)
}

function fileIconName(file: CloudFile): 'photo' | 'pdf' | 'spreadsheet' | 'document' | 'video' | 'audio' | 'archive' {
  const category = fileCategory(file)
  if (category === 'image') return 'photo'
  if (category === 'video' || category === 'audio' || category === 'archive') return category
  if (category === 'pdf' || category === 'spreadsheet') return category
  return 'document'
}

function categoryIconName(category: FileCategory): 'photo' | 'pdf' | 'spreadsheet' | 'document' | 'video' | 'audio' | 'archive' {
  if (category === 'image') return 'photo'
  if (category === 'video' || category === 'audio' || category === 'archive') return category
  if (category === 'pdf' || category === 'spreadsheet') return category
  return 'document'
}
</script>

<template>
  <main class="dashboard-page">
    <aside class="dashboard-sidebar">
      <a class="brand" href="/" aria-label="Cloud Seller, início">
        <span class="brand-mark"><IconSymbol name="cloud-upload" /></span>
        <span>cloud seller<span class="brand-dot">.</span></span>
      </a>

      <nav class="dashboard-nav" aria-label="Área do usuário">
        <NuxtLink to="/dashboard" :class="{ active: currentCollection === 'all' }"><IconSymbol name="grid" /> Meus arquivos</NuxtLink>
        <NuxtLink to="/dashboard?view=recent" :class="{ active: currentCollection === 'recent' }"><IconSymbol name="clock" /> Recentes</NuxtLink>
        <NuxtLink to="/dashboard?view=favorites" :class="{ active: currentCollection === 'favorites' }"><IconSymbol name="star" /> Favoritos</NuxtLink>
        <NuxtLink to="/trash"><IconSymbol name="trash" /> Lixeira</NuxtLink>
        <NuxtLink to="/backup"><IconSymbol name="cloud-upload" /> App de backup</NuxtLink>
        <NuxtLink to="/conta"><IconSymbol name="user" /> Minha conta</NuxtLink>
      </nav>

      <div class="storage-summary">
        <span>Armazenamento</span>
        <strong>{{ formatSize(storageSummary?.usedBytes || 0) }} <small>de {{ storageSummary?.subscription?.storage || '—' }}</small></strong>
        <div class="storage-bar"><span :style="{ width: `${storagePercent}%` }" /></div>
        <small v-if="storageSummary?.subscription?.status === 'active'">Plano ativo</small>
        <small v-else-if="storageSummary?.subscription?.status === 'trial'">
          Teste grátis até {{ formatTrialEnd(storageSummary.subscription.trialEndsAt) }}
        </small>
        <small v-else-if="storageSummary?.subscription?.status === 'expired'">Acesso somente para leitura</small>
        <small v-else-if="storageSummary?.subscription">Pagamento pendente ou inacessível</small>
        <NuxtLink class="storage-billing-link" to="/subscription">Plano e pagamento</NuxtLink>
      </div>

      <button class="logout-button" type="button" @click="logout">Sair da conta</button>
    </aside>

    <section class="dashboard-main">
      <header class="dashboard-header">
        <div class="dashboard-heading-copy">
          <p>Olá, {{ session?.name || 'usuário' }}</p>
          <div class="dashboard-title-row">
            <h1>{{ currentCollection === 'recent' ? 'Recentes' : currentCollection === 'favorites' ? 'Favoritos' : 'Meus arquivos' }}</h1>
            <span class="dashboard-item-count">{{ itemCount }} {{ itemCount === 1 ? 'item' : 'itens' }}</span>
          </div>
          <p class="dashboard-subtitle">Encontre e organize seus arquivos em um só lugar.</p>
        </div>
        <div class="dashboard-header-tools">
          <ThemeToggle />
          <div class="user-avatar">{{ session?.name?.charAt(0).toUpperCase() || 'U' }}</div>
        </div>
      </header>

      <div
        v-if="storageSummary?.subscription?.status === 'trial'"
        class="subscription-alert subscription-trial-alert"
      >
        Teste gratuito até {{ formatTrialEnd(storageSummary.subscription.trialEndsAt) }}. Sem cobrança automática; após o período, os arquivos ficam disponíveis para leitura e download.
        <NuxtLink to="/subscription">Ver planos pagos</NuxtLink>
      </div>
      <div
        v-else-if="subscriptionNeedsPlan"
        class="subscription-alert"
      >
        {{ storageSummary?.subscription?.status === 'expired'
          ? 'Seu período gratuito terminou. Você ainda pode visualizar e baixar os arquivos; escolha um plano para enviar novos.'
          : 'Ative um plano para enviar novos arquivos.' }}
        <NuxtLink to="/subscription">Escolher plano</NuxtLink>
      </div>
      <div
        v-else-if="storageSummary && storageSummary.subscription && storageSummary.usedBytes >= storageSummary.subscription.quotaBytes"
        class="subscription-alert"
      >
        Você atingiu o limite do plano. Exclua arquivos para liberar espaço antes de enviar outros.
      </div>

      <div class="dashboard-toolbar">
        <label class="file-search">
          <IconSymbol name="search" />
          <input v-model="search" type="search" placeholder="Buscar arquivos" />
        </label>
        <div class="dashboard-actions">
          <button class="folder-button" type="button" @click="createFolder"><IconSymbol name="plus" /> Nova pasta</button>
          <button
            class="upload-button"
            type="button"
            :disabled="uploadBlocked || isUploading"
            :title="uploadBlocked ? 'Seu plano não permite novos envios neste momento.' : undefined"
            @click="fileInput?.click()"
          >
            <IconSymbol name="upload" /> {{ isUploading ? 'Enviando...' : 'Enviar arquivos' }}
          </button>
          <input ref="fileInput" class="hidden-file-input" type="file" multiple @change="handleFileSelection" />
        </div>
      </div>

      <section v-if="categoryUsage.length" class="category-usage" aria-label="Uso por tipo de arquivo">
        <article v-for="item in categoryUsage" :key="item.category" class="category-usage-card">
          <span class="category-usage-icon" :class="`type-${item.category}`">
            <IconSymbol :name="categoryIconName(item.category)" />
          </span>
          <span class="category-usage-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.count }} arquivo(s)</small>
          </span>
          <strong class="category-usage-size">{{ formatSize(item.bytes) }}</strong>
        </article>
        <span class="category-usage-total">{{ totalFileCount }} arquivos armazenados</span>
      </section>

      <div class="file-options-toolbar">
        <button
          class="organization-toggle"
          type="button"
          aria-controls="organization-controls"
          :aria-expanded="showOrganizationControls"
          @click="showOrganizationControls = !showOrganizationControls"
        >
          <IconSymbol name="filter" />
          <span>Organizar</span>
          <span v-if="typeFilter !== 'all'" class="organization-active-filter">
            {{ FILE_CATEGORY_LABELS[typeFilter] }}
          </span>
        </button>
        <div
          id="organization-controls"
          class="organization-controls"
          :class="{ 'is-open': showOrganizationControls }"
        >
          <label class="file-select-control">
            <IconSymbol name="filter" />
            <span>Tipo</span>
            <select v-model="typeFilter" aria-label="Filtrar por tipo de arquivo" @change="showOrganizationControls = false">
              <option value="all">Todos</option>
              <option v-for="category in FILE_CATEGORIES" :key="category" :value="category">
                {{ FILE_CATEGORY_LABELS[category] }}
              </option>
            </select>
          </label>
          <label class="file-select-control sort-control">
            <span>Ordenar</span>
            <select v-model="sortOption" aria-label="Ordenar arquivos" @change="showOrganizationControls = false">
              <option value="modified-desc">Mais recentes</option>
              <option value="modified-asc">Mais antigos</option>
              <option value="name-asc">Nome A–Z</option>
              <option value="name-desc">Nome Z–A</option>
              <option value="size-desc">Maior tamanho</option>
              <option value="size-asc">Menor tamanho</option>
            </select>
          </label>
        </div>
        <button
          v-if="currentFiles.length"
          class="bulk-select-toggle"
          type="button"
          :aria-pressed="allVisibleFilesSelected"
          @click="toggleAllVisibleFiles"
        >
          <IconSymbol :name="allVisibleFilesSelected ? 'close' : 'check'" />
          {{ allVisibleFilesSelected ? 'Desmarcar' : 'Selecionar tudo' }}
        </button>
        <div class="view-mode-control" role="group" aria-label="Modo de visualização">
          <button
            type="button"
            :class="{ active: viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            aria-label="Visualização em lista"
            @click="viewMode = 'list'"
          >
            <IconSymbol name="list" />
          </button>
          <button
            type="button"
            :class="{ active: viewMode === 'grid' }"
            :aria-pressed="viewMode === 'grid'"
            aria-label="Visualização em grade"
            @click="viewMode = 'grid'"
          >
            <IconSymbol name="grid" />
          </button>
        </div>
      </div>

      <div v-if="selectedFiles.length" class="bulk-toolbar">
        <span v-if="selectedFiles.length" class="selected-count">{{ selectedFiles.length }} selecionado(s)</span>
        <div v-if="selectedFiles.length" class="bulk-actions">
          <button type="button" class="bulk-button" :disabled="bulkActionRunning" @click="downloadSelectedFiles">
            <IconSymbol name="download" /> Baixar selecionados
          </button>
          <button
            type="button"
            class="bulk-button bulk-delete-button"
            :disabled="bulkActionRunning || readOnlyStorage"
            @click="deleteSelectedFiles"
          >
            <IconSymbol name="trash" /> Excluir
          </button>
          <button type="button" class="bulk-clear-button" @click="clearSelection">Limpar seleção</button>
        </div>
        <span v-if="bulkProgress" class="bulk-progress" aria-live="polite">{{ bulkProgress }}</span>
      </div>

      <nav class="breadcrumbs" aria-label="Caminho da pasta">
        <button
          v-for="(crumb, index) in breadcrumbs"
          :key="crumb.path"
          type="button"
          :disabled="index === breadcrumbs.length - 1"
          @click="goToBreadcrumb(crumb.path)"
        >
          {{ crumb.name }}
        </button>
      </nav>

      <p v-if="uploadMessage" class="upload-message">{{ uploadMessage }}</p>
      <p class="drop-hint">
        <template v-if="currentCollection === 'recent'">Arquivos modificados nos últimos 30 dias. </template>
        <template v-else-if="currentCollection === 'favorites'">Favoritos salvos neste navegador. </template>
        Arraste e solte arquivos aqui ou use “Enviar arquivos”.
      </p>

      <div
        class="files-drop-zone"
        :class="{ 'is-dragging': isDraggingFiles }"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleFileDrop"
      >
        <div v-if="isDraggingFiles" class="drop-overlay" aria-live="polite">
          Solte os arquivos para enviá-los a esta pasta
        </div>
        <div class="files-panel" :class="{ 'files-panel-grid': viewMode === 'grid' }">
          <div v-if="viewMode === 'list'" class="files-heading">
            <span>Nome</span>
            <span>Tamanho</span>
            <span>Modificado</span>
            <span />
          </div>

          <article
            v-for="folder in currentFolders"
            :key="folder.path"
            class="file-row folder-row"
            :class="{ 'grid-item': viewMode === 'grid' }"
          >
            <button class="folder-name" type="button" @click="openFolder(folder)">
              <span class="folder-icon"><IconSymbol name="folder" /></span>
              <strong>{{ folder.name }}</strong>
            </button>
            <span class="file-size">Pasta</span>
            <span class="file-modified">—</span>
            <div class="file-actions">
              <button
                class="icon-action-button"
                type="button"
                :disabled="readOnlyStorage"
                :aria-label="`Mover pasta ${folder.name}`"
                title="Mover pasta"
                @click="startManagement(folder, 'folder', 'move')"
              >
                <IconSymbol name="move" />
              </button>
              <button
                class="icon-action-button"
                type="button"
                :disabled="readOnlyStorage"
                :aria-label="`Renomear pasta ${folder.name}`"
                title="Renomear pasta"
                @click="startManagement(folder, 'folder', 'rename')"
              >
                <IconSymbol name="edit" />
              </button>
              <button
                class="icon-action-button delete-button"
                type="button"
                :disabled="readOnlyStorage"
                :aria-label="`Excluir pasta ${folder.name}`"
                title="Mover pasta para a lixeira"
                @click="deleteFolder(folder)"
              >
                <IconSymbol name="trash" />
              </button>
            </div>
          </article>

          <article
            v-for="file in currentFiles"
            :key="file.id"
            class="file-row"
            :class="{ 'grid-item': viewMode === 'grid', 'is-selected': selectedFileIds.includes(file.id) }"
          >
            <div class="file-name">
              <input
                v-model="selectedFileIds"
                class="file-select-checkbox"
                type="checkbox"
                :value="file.id"
                :aria-label="`Selecionar ${file.name}`"
              />
              <span class="file-type" :class="`type-${fileCategory(file)}`">
                <button
                  v-if="fileCategory(file) === 'image' && supportsPreview(file)"
                  class="file-thumbnail-button"
                  type="button"
                  :aria-label="`Visualizar ${file.name}`"
                  @click="previewFile(file)"
                >
                  <FileThumbnail :file-key="file.id" :name="file.name" :blob="file.blob" />
                </button>
                <span v-else-if="fileCategory(file) === 'image'" class="file-image-fallback">
                  <IconSymbol name="photo" />
                </span>
                <IconSymbol v-else :name="fileIconName(file)" />
              </span>
              <span class="file-name-copy">
                <strong>{{ file.name }}</strong>
                <small v-if="isFavorite(file)" class="favorite-label"><IconSymbol name="star" /> Favorito</small>
              </span>
            </div>
            <span class="file-size">{{ formatSize(file.size) }}</span>
            <span class="file-modified">{{ formatDate(file.modified) }}</span>
            <div class="file-actions">
              <button
                v-if="supportsPreview(file)"
                class="icon-action-button preview-button"
                type="button"
                :aria-label="`Visualizar ${file.name}`"
                title="Visualizar"
                @click="previewFile(file)"
              >
                <IconSymbol name="eye" />
              </button>
              <button
                class="icon-action-button favorite-button"
                :class="{ 'is-favorite': isFavorite(file) }"
                type="button"
                :aria-pressed="isFavorite(file)"
                :aria-label="isFavorite(file) ? `Remover ${file.name} dos favoritos` : `Adicionar ${file.name} aos favoritos`"
                :title="isFavorite(file) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'"
                @click="toggleFavorite(file)"
              >
                <IconSymbol name="star" />
              </button>
              <button
                class="icon-action-button"
                type="button"
                :disabled="readOnlyStorage"
                :aria-label="`Mover ${file.name}`"
                title="Mover"
                @click="startManagement(file, 'file', 'move')"
              >
                <IconSymbol name="move" />
              </button>
              <button
                class="icon-action-button"
                type="button"
                :disabled="readOnlyStorage"
                :aria-label="`Renomear ${file.name}`"
                title="Renomear"
                @click="startManagement(file, 'file', 'rename')"
              >
                <IconSymbol name="edit" />
              </button>
              <button class="icon-action-button download-button" type="button" :aria-label="`Baixar ${file.name}`" title="Baixar" @click="downloadFile(file)"><IconSymbol name="download" /></button>
              <button class="icon-action-button delete-button" type="button" :disabled="readOnlyStorage" :aria-label="`Excluir ${file.name}`" title="Excluir" @click="deleteFile(file)"><IconSymbol name="trash" /></button>
            </div>
          </article>

          <div v-if="itemCount === 0" class="empty-files">
            <span class="empty-files-icon"><IconSymbol name="folder" /></span>
            <strong>
              {{ search
                ? 'Nenhum item encontrado'
                : currentCollection === 'favorites'
                  ? 'Nenhum favorito ainda'
                  : currentCollection === 'recent'
                    ? 'Nenhum arquivo recente'
                    : 'Esta pasta está vazia' }}
            </strong>
            <p>
              {{ search
                ? 'Tente buscar por outro nome.'
                : currentCollection === 'favorites'
                  ? 'Use a estrela ao lado de um arquivo para guardá-lo aqui.'
                  : currentCollection === 'recent'
                    ? 'Arquivos modificados nos últimos 30 dias aparecerão aqui.'
                    : 'Arraste arquivos para cá ou use o botão “Enviar arquivos”.' }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <div v-if="showFolderModal" class="folder-modal-backdrop" role="presentation" @click.self="showFolderModal = false">
      <form class="folder-modal" @submit.prevent="confirmCreateFolder">
        <span class="eyebrow">NOVA PASTA</span>
        <h2>Escolha um nome</h2>
        <input id="folder-name" v-model="newFolderName" type="text" placeholder="Ex: Fotos" maxlength="80" />
        <div class="folder-modal-actions">
          <button type="button" class="folder-button" @click="showFolderModal = false">Cancelar</button>
          <button type="submit" class="upload-button">Criar pasta</button>
        </div>
      </form>
    </div>

    <div v-if="managementTarget" class="folder-modal-backdrop" role="presentation" @click.self="closeManagement">
      <form class="folder-modal management-modal" @submit.prevent="saveManagement">
        <span class="eyebrow">{{ managementMode === 'move' ? 'MOVER ITEM' : 'RENOMEAR ITEM' }}</span>
        <h2>{{ managementMode === 'move' ? 'Organize seus arquivos' : 'Escolha um novo nome' }}</h2>
        <label class="modal-field">
          <span>Nome</span>
          <input v-model="managementName" type="text" maxlength="160" required />
        </label>
        <label v-if="managementMode === 'move'" class="modal-field">
          <span>Mover para</span>
          <select v-model="destinationFolder">
            <option v-for="folder in destinationFolders" :key="folder.path" :value="folder.path">
              {{ folder.name }}
            </option>
          </select>
        </label>
        <div class="folder-modal-actions">
          <button type="button" class="folder-button" :disabled="managingItem" @click="closeManagement">Cancelar</button>
          <button type="submit" class="upload-button" :disabled="managingItem">
            <IconSymbol :name="managementMode === 'move' ? 'move' : 'check'" />
            {{ managingItem ? 'Salvando...' : managementMode === 'move' ? 'Mover item' : 'Salvar nome' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="previewFileItem" class="preview-modal-backdrop" role="presentation" @click.self="closePreview">
      <section
        class="preview-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="`Visualização de ${previewFileItem.name}`"
      >
        <header class="preview-modal-header">
          <h2>{{ previewFileItem.name }}</h2>
          <button class="preview-close-button" type="button" aria-label="Fechar visualização" @click="closePreview">
            Fechar
          </button>
        </header>
        <div class="preview-content">
          <p v-if="previewLoading" class="preview-status">Carregando visualização...</p>
          <p v-else-if="previewError" class="preview-status preview-error">{{ previewError }}</p>
          <img
            v-else-if="previewContentType.startsWith('image/')"
            class="preview-image"
            :src="previewUrl"
            :alt="previewFileItem.name"
            referrerpolicy="no-referrer"
          />
          <iframe
            v-else-if="previewContentType === 'application/pdf'"
            class="preview-frame"
            :src="previewUrl"
            :title="`Visualização de ${previewFileItem.name}`"
            referrerpolicy="no-referrer"
          />
          <iframe
            v-else
            class="preview-frame preview-text-frame"
            :src="previewUrl"
            :title="`Visualização de ${previewFileItem.name}`"
            referrerpolicy="no-referrer"
            sandbox=""
          />
        </div>
      </section>
    </div>
  </main>
</template>
