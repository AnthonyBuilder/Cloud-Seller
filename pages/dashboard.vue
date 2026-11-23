<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'

useHead({ title: 'Meus arquivos - Cloud Seller' })

type UserSession = { name: string; email: string }
type StorageSummary = {
  subscription: {
    name: string
    storage: string
    quotaBytes: number
    status: 'trial' | 'active' | 'expired'
    trialEndsAt: number
  } | null
  usedBytes: number
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

const DB_NAME = 'cloud-seller-files'
const session = ref<UserSession | null>(null)
const files = ref<CloudFile[]>([])
const folders = ref<CloudFolder[]>([])
const currentFolder = ref('/')
const search = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploadMessage = ref('')
const showFolderModal = ref(false)
const newFolderName = ref('')
const awsMode = ref(true)
const storageSummary = ref<StorageSummary | null>(null)
let db: IDBDatabase | null = null

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}` }
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
    const result = await $fetch<{ folder: string; folders: { name: string; path: string }[]; files: { key: string; name: string; size: number; modified: string }[] }>('/api/files/list', {
      headers: authHeaders(),
      query: { folder: currentFolder.value },
    })
    folders.value = result.folders.map(folder => ({
      path: folder.path,
      name: folder.name,
      parent: currentFolder.value,
    }))
    files.value = result.files.map(file => ({
      id: file.key,
      name: file.name,
      folder: currentFolder.value,
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
  storageSummary.value = await $fetch<StorageSummary>('/api/subscription', {
    headers: authHeaders(),
  })
}

function guessMime(name: string) {
  const extension = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return `image/${extension === 'jpg' ? 'jpeg' : extension}`
  if (extension === 'pdf') return 'application/pdf'
  if (['csv', 'txt'].includes(extension || '')) return 'text/plain'
  if (['xlsx', 'xls'].includes(extension || '')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function normalizePath(path: string) {
  return path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}/`
}

const currentFolders = computed(() => {
  const term = search.value.trim().toLowerCase()
  return folders.value
    .filter(folder => folder.parent === currentFolder.value)
    .filter(folder => !term || folder.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const currentFiles = computed(() => {
  const term = search.value.trim().toLowerCase()
  return files.value
    .filter(file => file.folder === currentFolder.value)
    .filter(file => !term || file.name.toLowerCase().includes(term))
    .sort((a, b) => b.modified - a.modified)
})

const itemCount = computed(() => currentFolders.value.length + currentFiles.value.length)
const storagePercent = computed(() => {
  const summary = storageSummary.value
  const quota = summary?.subscription?.quotaBytes || 0
  return summary && quota ? Math.min(100, (summary.usedBytes / quota) * 100) : 0
})
const uploadBlocked = computed(() => {
  const summary = storageSummary.value
  return !summary?.subscription
    || summary.subscription.status === 'expired'
    || summary.usedBytes >= summary.subscription.quotaBytes
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

onMounted(async () => {
  const stored = localStorage.getItem('cloud-seller-session')
  if (!stored || !localStorage.getItem('cloud-seller-id-token')) {
    navigateTo('/login')
    return
  }
  session.value = JSON.parse(stored) as UserSession

  try {
    await refreshSubscription()
    if (!storageSummary.value?.subscription) {
      await navigateTo('/subscription')
      return
    }
    await refreshStorage()
  } catch {
    uploadMessage.value = 'Não foi possível carregar o armazenamento da AWS.'
  }
})

function logout() {
  localStorage.removeItem('cloud-seller-session')
  localStorage.removeItem('cloud-seller-id-token')
  localStorage.removeItem('cloud-seller-access-token')
  navigateTo('/login')
}

function openFolder(folder: CloudFolder) {
  currentFolder.value = normalizePath(folder.path)
  search.value = ''
}

function goToBreadcrumb(path: string) {
  currentFolder.value = normalizePath(path)
  search.value = ''
}

async function createFolder() {
  showFolderModal.value = true
  newFolderName.value = ''
  await nextTick()
  document.querySelector<HTMLInputElement>('#folder-name')?.focus()
}

async function confirmCreateFolder() {
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

async function uploadFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  if (awsMode.value) {
    let added = 0
    const failures: string[] = []
    for (const file of Array.from(input.files)) {
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
    input.value = ''
    await refreshStorage()
    await refreshSubscription()
    if (added) {
      uploadMessage.value = `${added} arquivo(s) enviado(s) para a AWS.${failures.length ? ` Falhas: ${failures.join('; ')}.` : ''}`
    }
    return
  }

  if (!db) return

  let added = 0
  for (const file of Array.from(input.files)) {
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

  input.value = ''
  await refreshStorage()
  uploadMessage.value = `${added} arquivo(s) enviado(s) para esta pasta.`
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

async function deleteFile(file: CloudFile) {
  if (!window.confirm(`Excluir "${file.name}"?`)) return
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
  if (!window.confirm(`Excluir a pasta "${folder.name}" e todo o conteúdo nela?`)) return
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

function fileCategory(file: CloudFile): 'image' | 'pdf' | 'spreadsheet' | 'document' {
  if (file.mime.startsWith('image/')) return 'image'
  if (file.mime.includes('pdf')) return 'pdf'
  if (file.mime.includes('sheet') || file.mime.includes('excel')) return 'spreadsheet'
  return 'document'
}

function fileIconName(file: CloudFile): 'photo' | 'pdf' | 'spreadsheet' | 'document' {
  const category = fileCategory(file)
  return category === 'image' ? 'photo' : category
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
        <a class="active" href="/dashboard"><IconSymbol name="grid" /> Meus arquivos</a>
        <a href="/dashboard?view=recent"><IconSymbol name="clock" /> Recentes</a>
        <a href="/dashboard?view=shared"><IconSymbol name="share" /> Compartilhados</a>
      </nav>

      <div class="storage-summary">
        <span>Armazenamento</span>
        <strong>{{ formatSize(storageSummary?.usedBytes || 0) }} <small>de {{ storageSummary?.subscription?.storage || '—' }}</small></strong>
        <div class="storage-bar"><span :style="{ width: `${storagePercent}%` }" /></div>
        <small v-if="storageSummary?.subscription?.status === 'trial'">
          Teste até {{ new Intl.DateTimeFormat('pt-BR').format(storageSummary.subscription.trialEndsAt) }}
        </small>
        <small v-else-if="storageSummary?.subscription?.status === 'expired'">Teste expirado · uploads pausados</small>
      </div>

      <button class="logout-button" type="button" @click="logout">Sair da conta</button>
    </aside>

    <section class="dashboard-main">
      <header class="dashboard-header">
        <div>
          <p>Olá, {{ session?.name || 'usuário' }}</p>
          <h1>Meus arquivos</h1>
        </div>
        <div class="user-avatar">{{ session?.name?.charAt(0).toUpperCase() || 'U' }}</div>
      </header>

      <div v-if="storageSummary?.subscription?.status === 'expired'" class="subscription-alert">
        Seu teste terminou. Seus arquivos permanecem disponíveis, mas novos envios estão bloqueados.
        <NuxtLink to="/subscription">Ver opções de renovação</NuxtLink>
      </div>
      <div
        v-else-if="storageSummary?.subscription && storageSummary.usedBytes >= storageSummary.subscription.quotaBytes"
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
            :disabled="uploadBlocked"
            :title="uploadBlocked ? 'Seu plano não permite novos envios neste momento.' : undefined"
            @click="fileInput?.click()"
          >
            <IconSymbol name="upload" /> Enviar arquivos
          </button>
          <input ref="fileInput" class="hidden-file-input" type="file" multiple @change="uploadFiles" />
        </div>
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

      <div class="files-panel">
        <div class="files-heading">
          <span>Nome</span>
          <span>Tamanho</span>
          <span>Modificado</span>
          <span />
        </div>

        <article v-for="folder in currentFolders" :key="folder.path" class="file-row folder-row">
          <button class="folder-name" type="button" @click="openFolder(folder)">
            <span class="folder-icon"><IconSymbol name="folder" /></span>
            <strong>{{ folder.name }}</strong>
          </button>
          <span class="file-size">Pasta</span>
          <span class="file-modified">—</span>
          <button class="delete-button" type="button" :aria-label="`Excluir pasta ${folder.name}`" @click="deleteFolder(folder)">
            <IconSymbol name="trash" />
          </button>
        </article>

        <article v-for="file in currentFiles" :key="file.id" class="file-row">
          <div class="file-name">
              <span class="file-type" :class="`type-${fileCategory(file)}`">
                <IconSymbol :name="fileIconName(file)" />
              </span>
            <strong>{{ file.name }}</strong>
          </div>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <span class="file-modified">{{ formatDate(file.modified) }}</span>
          <div class="file-actions">
            <button class="download-button" type="button" :aria-label="`Baixar ${file.name}`" @click="downloadFile(file)"><IconSymbol name="download" /> <span>Baixar</span></button>
            <button class="delete-button" type="button" :aria-label="`Excluir ${file.name}`" @click="deleteFile(file)"><IconSymbol name="trash" /></button>
          </div>
        </article>

        <div v-if="itemCount === 0" class="empty-files">
          <strong>{{ search ? 'Nenhum item encontrado' : 'Esta pasta está vazia' }}</strong>
          <p>{{ search ? 'Tente buscar por outro nome.' : 'Crie uma pasta ou envie seus arquivos.' }}</p>
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
  </main>
</template>
