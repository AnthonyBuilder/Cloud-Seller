<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'
import { clearStoredSession, isJwtExpired, isUnauthorizedError } from '~/utils/session'

useHead({ title: 'Lixeira - Cloud Seller' })

type TrashItem = {
  key: string
  name: string
  path: string
  size: number
  deletedAt: string
  expiresAt: string
}

const items = ref<TrashItem[]>([])
const retentionDays = ref(30)
const totalBytes = ref(0)
const selected = ref<string[]>([])
const loading = ref(true)
const working = ref(false)
const error = ref('')
const notice = ref('')

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}` }
}

function handleError(caught: unknown, fallback: string) {
  if (isUnauthorizedError(caught)) {
    clearStoredSession()
    void navigateTo('/login?reauth=1')
    return
  }
  error.value = getAuthError(caught, fallback).message
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1)
  return `${(bytes / 1000 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function daysLeft(value: string) {
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
  return days <= 0 ? 'hoje' : days === 1 ? '1 dia' : `${days} dias`
}

const allSelected = computed(() => items.value.length > 0 && selected.value.length === items.value.length)

function toggleAll() {
  selected.value = allSelected.value ? [] : items.value.map(item => item.key)
}

async function load() {
  loading.value = true
  try {
    const result = await $fetch<{ retentionDays: number; totalBytes: number; items: TrashItem[] }>('/api/trash/list', {
      headers: authHeaders(),
    })
    items.value = result.items
    retentionDays.value = result.retentionDays
    totalBytes.value = result.totalBytes
    selected.value = selected.value.filter(key => result.items.some(item => item.key === key))
  } catch (caught) {
    handleError(caught, 'Não foi possível carregar a lixeira.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const idToken = localStorage.getItem('cloud-seller-id-token')
  if (!idToken || isJwtExpired(idToken)) {
    clearStoredSession()
    await navigateTo('/login?reauth=1')
    return
  }
  await load()
})

async function run(route: 'restore' | 'remove', body: { keys?: string[]; all?: boolean }, message: (count: number) => string) {
  error.value = ''
  notice.value = ''
  working.value = true
  try {
    const result = await $fetch<{ restored?: number; removed?: number }>(`/api/trash/${route}`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    })
    notice.value = message(result.restored ?? result.removed ?? 0)
    await load()
  } catch (caught) {
    handleError(caught, 'Não foi possível concluir a ação.')
  } finally {
    working.value = false
  }
}

function restoreSelected() {
  if (!selected.value.length) return
  void run('restore', { keys: selected.value }, count => `${count} arquivo(s) restaurado(s) para o local de origem.`)
}

function removeSelected() {
  if (!selected.value.length) return
  if (!window.confirm(`Excluir definitivamente ${selected.value.length} arquivo(s)? Esta ação não pode ser desfeita.`)) return
  void run('remove', { keys: selected.value }, count => `${count} arquivo(s) excluído(s) definitivamente.`)
}

function restoreAll() {
  void run('restore', { all: true }, count => `${count} arquivo(s) restaurado(s) para o local de origem.`)
}

function emptyTrash() {
  if (!window.confirm('Esvaziar a lixeira? Todos os arquivos serão excluídos definitivamente e não poderão ser recuperados.')) return
  void run('remove', { all: true }, count => `Lixeira esvaziada (${count} arquivo(s)).`)
}
</script>

<template>
  <main class="trash-page page-wrap">
    <NuxtLink class="brand" to="/dashboard" aria-label="Cloud Seller, meus arquivos">
      <span class="brand-mark" aria-hidden="true"><IconSymbol name="cloud-upload" /></span>
      <span>cloud seller<span class="brand-dot">.</span></span>
    </NuxtLink>

    <header class="trash-header">
      <div>
        <span class="eyebrow">LIXEIRA</span>
        <h1>Arquivos excluídos</h1>
        <p>
          Os itens ficam aqui por {{ retentionDays }} dias e depois são apagados definitivamente.
          Enquanto estiverem na lixeira, ocupam espaço do seu plano ({{ formatSize(totalBytes) }}).
        </p>
      </div>
      <NuxtLink class="button button-outline button-small" to="/dashboard">Voltar aos arquivos</NuxtLink>
    </header>

    <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="subscription-loading">Carregando a lixeira...</p>

    <template v-else>
      <p v-if="!items.length" class="trash-empty">A lixeira está vazia.</p>

      <template v-else>
        <div class="trash-actions">
          <button class="button button-primary button-small" type="button" :disabled="working || !selected.length" @click="restoreSelected">Restaurar selecionados</button>
          <button class="button button-outline button-small" type="button" :disabled="working || !selected.length" @click="removeSelected">Excluir definitivamente</button>
          <button class="button button-outline button-small" type="button" :disabled="working" @click="restoreAll">Restaurar tudo</button>
          <button class="button button-outline button-small" type="button" :disabled="working" @click="emptyTrash">Esvaziar lixeira</button>
        </div>

        <div class="trash-table-wrap">
          <table class="trash-table">
            <thead>
              <tr>
                <th scope="col"><input type="checkbox" :checked="allSelected" aria-label="Selecionar todos" @change="toggleAll" /></th>
                <th scope="col">Arquivo</th>
                <th scope="col">Local de origem</th>
                <th scope="col">Tamanho</th>
                <th scope="col">Excluído em</th>
                <th scope="col">Apaga em</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.key">
                <td><input v-model="selected" type="checkbox" :value="item.key" :aria-label="`Selecionar ${item.name}`" /></td>
                <td class="trash-name">{{ item.name }}</td>
                <td class="trash-path">{{ item.path }}</td>
                <td>{{ formatSize(item.size) }}</td>
                <td>{{ formatDate(item.deletedAt) }}</td>
                <td>{{ daysLeft(item.expiresAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </main>
</template>
