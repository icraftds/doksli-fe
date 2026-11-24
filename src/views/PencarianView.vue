<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import api from '../services/api'
import { useDocumentsStore, type Doc } from '../stores/documents'
import { useAppConfirm } from '../composables/useAppConfirm'
import { useCategoryBadge } from '../composables/useCategoryBadge'
import DocumentDetailDrawer from '../components/dokumen/DocumentDetailDrawer.vue'
import {
  getCategoryName,
  getCurrentVersion,
  getFolderName as resolveFolderName,
  getOwnerName,
  isDocTrashed,
} from '../utils/documentHelpers'

const store = useDocumentsStore()
const { confirmDelete, confirmAction } = useAppConfirm()
const { getCategoryBadge } = useCategoryBadge()

// Filter states
const q = ref('')
const selectedCategory = ref<string>('')
const selectedFolder = ref<string>('')
const includeTrash = ref(false)

// Drawer state
const selectedDoc = ref<Doc | null>(null)
const isDrawerOpen = ref(false)

const categories = ref<string[]>(['Kontrak', 'Keuangan', 'SDM', 'Legal', 'Korespondensi'])

// Server-side search & pagination states
const searchResults = ref<Doc[]>([])
const totalRecords = ref(0)
const loading = ref(false)
const first = ref(0)
const rows = 10

async function executeSearch(page = 1) {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page,
      per_page: rows,
    }
    if (q.value.trim()) params.search = q.value.trim()
    if (selectedCategory.value) params.category_id = selectedCategory.value
    if (selectedFolder.value) params.folder_id = selectedFolder.value
    if (includeTrash.value) {
      params.include_trash = true
    } else {
      params.status = 'active'
    }

    await store.fetchDocuments(params)
    searchResults.value = store.documents
    totalRecords.value = store.meta?.total ?? searchResults.value.length
  } catch {
    searchResults.value = []
    totalRecords.value = 0
  } finally {
    loading.value = false
  }
}

function onPageChange(event: { page: number; first: number }) {
  first.value = event.first
  const targetPage = event.page + 1
  executeSearch(targetPage)
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(q, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    first.value = 0
    executeSearch(1)
  }, 300)
})

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
})

watch([selectedCategory, selectedFolder, includeTrash], () => {
  first.value = 0
  executeSearch(1)
})

onMounted(async () => {
  await Promise.allSettled([
    executeSearch(1),
    store.fetchFolders(),
    store.fetchCategories(),
  ])
  try {
    const res = await api.get('/v1/categories', { params: { all: true } })
    if (res.data?.data && Array.isArray(res.data.data)) {
      const fromApi = res.data.data.map((c: any) => c.name)
      categories.value = Array.from(new Set([...fromApi, ...categories.value]))
    }
  } catch {
    // fallback
  }
})

function getFolderName(folderId?: string): string {
  return resolveFolderName(store.folders, folderId)
}

function openDocDetail(doc: Doc) {
  selectedDoc.value = doc
  isDrawerOpen.value = true
}

function closeDrawer() {
  isDrawerOpen.value = false
}

function handleDownload(doc: Doc) {
  confirmAction({
    title: 'Unduh Dokumen',
    message: `Apakah Anda yakin ingin mengunduh dokumen "${doc.name}"?`,
    confirmLabel: 'Unduh',
    icon: 'download',
    acceptIcon: 'download',
    onAccept: async () => {
      await store.downloadDocument(doc.id)
    },
  })
}

function handleTrash(doc: Doc) {
  confirmDelete({
    title: 'Pindahkan ke Tempat Sampah',
    message: `Apakah Anda yakin ingin memindahkan "${doc.name}" ke tempat sampah?`,
    submessage: 'Dokumen dapat dipulihkan kapan saja dari tab Tempat Sampah.',
    confirmLabel: 'Pindahkan ke Sampah',
    onAccept: async () => {
      await store.trashDocument(doc.id)
      if (selectedDoc.value?.id === doc.id) closeDrawer()
      await executeSearch(Math.floor(first.value / rows) + 1)
    },
  })
}

function handleRestore(doc: Doc) {
  confirmAction({
    title: 'Pulihkan Dokumen',
    message: `Pulihkan "${doc.name}" ke dokumen aktif?`,
    confirmLabel: 'Pulihkan',
    onAccept: async () => {
      await store.restoreDocument(doc.id)
      if (selectedDoc.value?.id === doc.id) closeDrawer()
      await executeSearch(Math.floor(first.value / rows) + 1)
    },
  })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Search and Filter Form -->
    <div class="panel">
      <div class="panel-body flex flex-col gap-3">
        <div class="searchbar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="q"
            type="text"
            placeholder="Cari nama dokumen atau tag (#sewa, #gedung)..."
          />
          <button v-if="q" class="iconbtn sm" style="border:none; background:none" @click="q = ''">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="filters flex flex-wrap items-center gap-3">
          <Select 
            v-model="selectedCategory" 
            :options="['', ...categories]" 
            placeholder="Semua Kategori"
            class="w-full sm:w-auto sm:min-w-[170px]"
            size="small"
          >
            <template #value="slotProps">
              <span>{{ slotProps.value || 'Semua Kategori' }}</span>
            </template>
            <template #option="slotProps">
              <span>{{ slotProps.option || 'Semua Kategori' }}</span>
            </template>
          </Select>

          <Select 
            v-model="selectedFolder" 
            :options="[{ id: '', name: 'Semua Folder' }, ...store.folders]" 
            optionLabel="name"
            optionValue="id"
            placeholder="Semua Folder"
            class="w-full sm:w-auto sm:min-w-[180px]"
            size="small"
          />

          <!-- Checkbox Sertakan Tempat Sampah yang Jelas & Responsif -->
          <label class="flex items-center gap-2 cursor-pointer w-full sm:w-auto sm:ml-auto select-none p-1.5 px-3 rounded-lg border border-border bg-surface-2 hover:bg-surface-hover transition-colors">
            <input
              type="checkbox"
              v-model="includeTrash"
              class="w-4 h-4 cursor-pointer accent-blue-600 rounded"
            />
            <span
              class="text-xs font-semibold"
              :class="{ 'text-blue-400': includeTrash, 'text-muted': !includeTrash }"
            >
              Sertakan tempat sampah
            </span>
            <span v-if="includeTrash" class="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">
              AKTIF
            </span>
          </label>
        </div>
      </div>
    </div>

    <!-- Results Panel -->
    <div class="panel">
      <div class="panel-head flex items-center justify-between">
        <h2>{{ totalRecords }} hasil ditemukan</h2>
        <span v-if="includeTrash" class="text-xs text-muted">
          (Termasuk dokumen di tempat sampah)
        </span>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nama Dokumen</th>
              <th>Kategori</th>
              <th>Folder</th>
              <th>Versi</th>
              <th>Ukuran</th>
              <th>Pemilik</th>
              <th>Tanggal</th>
              <th style="text-align: right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" style="text-align: center; padding: 32px;" class="muted">
                <div class="flex flex-col items-center justify-center gap-2">
                  <ProgressSpinner style="width: 32px; height: 32px" strokeWidth="4" />
                  <span>Memuat data dokumen...</span>
                </div>
              </td>
            </tr>

            <tr v-else-if="searchResults.length === 0">
              <td colspan="8">
                <div class="empty">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.4" y2="15.4"/>
                  </svg>
                  <div>Tidak ada dokumen yang cocok dengan filter pencarian.</div>
                </div>
              </td>
            </tr>

            <tr
              v-else
              v-for="doc in searchResults"
              :key="doc.id"
              class="clickable"
              @click="openDocDetail(doc)"
            >
              <td>
                <div class="docname">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/>
                  </svg>
                  <span class="truncate" :title="doc.name">{{ doc.name }}</span>
                  <span
                    v-if="isDocTrashed(doc)"
                    class="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold ml-1.5 inline-block"
                  >
                    TEMPAT SAMPAH
                  </span>
                </div>
              </td>
              <td>
                <Tag
                  rounded
                  class="category-pill"
                  :style="{
                    background: getCategoryBadge(getCategoryName(doc)).bg,
                    color: getCategoryBadge(getCategoryName(doc)).text,
                    border: getCategoryBadge(getCategoryName(doc)).border,
                  }"
                >
                  <span
                    class="dot"
                    :style="{ background: getCategoryBadge(getCategoryName(doc)).dot }"
                  ></span>
                  {{ getCategoryName(doc) }}
                </Tag>
              </td>
              <td class="muted text-xs">{{ getFolderName(doc.folderId || doc.folder_id) }}</td>
              <td><span class="num">v{{ getCurrentVersion(doc)?.v || 1 }}</span></td>
              <td><span class="num">{{ store.fmtSize(doc.size) }}</span></td>
              <td class="muted text-xs font-semibold">{{ getOwnerName(doc) }}</td>
              <td><span class="num muted text-xs">{{ doc.date }}</span></td>
              <td style="text-align: right" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="iconbtn info"
                    title="Unduh dokumen"
                    @click="handleDownload(doc)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                  <button
                    class="iconbtn"
                    title="Detail dokumen"
                    @click="openDocDetail(doc)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Numeric Pagination (PrimeVue) -->
      <div class="border-t border-[var(--border)] p-2 flex justify-center">
        <Paginator
          v-model:first="first"
          :rows="rows"
          :totalRecords="totalRecords"
          :alwaysShow="true"
          @page="onPageChange"
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        />
      </div>
    </div>

    <!-- Shared Document Detail Drawer -->
    <DocumentDetailDrawer
      :open="isDrawerOpen"
      :doc="selectedDoc"
      :folder-name="getFolderName(selectedDoc?.folderId || selectedDoc?.folder_id)"
      :format-size="store.fmtSize"
      @close="closeDrawer"
      @download="handleDownload"
      @trash="handleTrash"
      @restore="handleRestore"
    />
  </div>
</template>
