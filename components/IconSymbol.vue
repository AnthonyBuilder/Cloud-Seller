<script setup lang="ts">
type IconName =
  | 'cloud-upload'
  | 'cloud-check'
  | 'photo'
  | 'arrow-right'
  | 'arrow-down'
  | 'laptop'
  | 'shield'
  | 'hard-drive'
  | 'folder'
  | 'grid'
  | 'clock'
  | 'share'
  | 'search'
  | 'document'
  | 'pdf'
  | 'spreadsheet'
  | 'upload'
  | 'download'
  | 'trash'
  | 'plus'
  | 'close'
  | 'check'
  | 'user'

defineProps<{ name: IconName }>()
</script>

<template>
  <svg
    class="icon-symbol"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'cloud-upload' || name === 'cloud-check'">
      <path d="M6.8 19H18a4.25 4.25 0 0 0 .4-8.48A6.4 6.4 0 0 0 6 8.6 5.2 5.2 0 0 0 6.8 19Z" />
      <path v-if="name === 'cloud-upload'" d="M12 16v-7m0 0-3 3m3-3 3 3" />
      <path v-else d="m9.5 14 1.8 1.8 3.7-4" />
    </template>
    <template v-else-if="name === 'photo'">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <path d="m4 17 5-4 3 2 3-3 5 5" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'arrow-down'">
      <path d="M12 4v15m-6-6 6 6 6-6" />
    </template>
    <template v-else-if="name === 'laptop'">
      <rect x="4" y="4" width="16" height="12" rx="1.5" />
      <path d="M2 20h20l-2-4H4l-2 4Z" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
      <path d="m9 12 2 2 4-4" />
    </template>
    <template v-else-if="name === 'hard-drive'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 14h18m-4 2h.01M7 16h.01" />
    </template>
    <template v-else-if="name === 'folder'">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'share'">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4m-6.8 9 6.8 4" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4 4" />
    </template>
    <template v-else-if="name === 'document' || name === 'pdf' || name === 'spreadsheet'">
      <path d="M6 3.5h8l4.5 4.5v12A1.5 1.5 0 0 1 17 21.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M14 4v5h5" />
      <template v-if="name === 'spreadsheet'">
        <path d="M7.5 12h9m-9 3h9m-6-3v6m3-6v6" />
      </template>
      <template v-else>
        <path d="M8 13h8m-8 3h8" />
        <text
          v-if="name === 'pdf'"
          x="7"
          y="19.5"
          fill="currentColor"
          stroke="none"
          font-size="4"
          font-weight="800"
        >PDF</text>
      </template>
    </template>
    <template v-else-if="name === 'upload'">
      <path d="M12 16V4m-5 5 5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </template>
    <template v-else-if="name === 'download'">
      <path d="M12 4v12m-5-5 5 5 5-5M4 17v3h16v-3" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14m-7-7h14" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4L19 6" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </template>
  </svg>
</template>
