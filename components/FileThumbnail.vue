<script lang="ts">
const thumbnailCache = new Map<string, { url: string; expiresAt: number }>()
</script>

<script setup lang="ts">
const props = defineProps<{
  fileKey: string
  name: string
  blob?: Blob
}>()

const root = ref<HTMLElement | null>(null)
const thumbnailUrl = ref('')
const failed = ref(false)
let observer: IntersectionObserver | undefined
let cancelled = false
let localObjectUrl = ''

async function loadThumbnail() {
  if (props.blob) {
    localObjectUrl = URL.createObjectURL(props.blob)
    thumbnailUrl.value = localObjectUrl
    return
  }

  const cached = thumbnailCache.get(props.fileKey)
  if (cached && cached.expiresAt > Date.now()) {
    thumbnailUrl.value = cached.url
    return
  }

  const token = localStorage.getItem('cloud-seller-id-token')
  if (!token) {
    failed.value = true
    return
  }

  try {
    const result = await $fetch<{ url: string }>('/api/files/download', {
      headers: { Authorization: `Bearer ${token}` },
      query: { key: props.fileKey, preview: 'true' },
    })
    if (cancelled) return
    thumbnailUrl.value = result.url
    thumbnailCache.set(props.fileKey, { url: result.url, expiresAt: Date.now() + 240_000 })
  } catch (error) {
    console.error(`Could not load thumbnail for "${props.name}"`, error)
    if (!cancelled) failed.value = true
  }
}

function observeThumbnail() {
  if (!root.value) return
  if (!('IntersectionObserver' in window)) {
    void loadThumbnail()
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return
    observer?.disconnect()
    void loadThumbnail()
  }, { rootMargin: '160px' })
  observer.observe(root.value)
}

function handleImageError() {
  failed.value = true
  thumbnailCache.delete(props.fileKey)
  console.error(`Could not display thumbnail for "${props.name}"`)
}

onMounted(observeThumbnail)
onBeforeUnmount(() => {
  cancelled = true
  observer?.disconnect()
  if (localObjectUrl) URL.revokeObjectURL(localObjectUrl)
})
</script>

<template>
  <span ref="root" class="file-thumbnail" aria-hidden="true">
    <img
      v-if="thumbnailUrl && !failed"
      :src="thumbnailUrl"
      :alt="''"
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="handleImageError"
    />
    <IconSymbol v-else name="photo" />
  </span>
</template>
