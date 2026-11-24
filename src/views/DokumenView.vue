<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import api from '../services/api'
import { useDocumentsStore, type Doc, type Folder } from '../stores/documents'
import { useAuthStore } from '../stores/auth'
import { useCategoryBadge } from '../composables/useCategoryBadge'
import { useAppConfirm } from '../composables/useAppConfirm'
import { useToast } from '../composables/useToast'
import { extractApiError } from '../utils/apiError'
import {
  getCategoryName,
  getFolderName as resolveFolderName,
  getOwnerName,
  getUserAccessLevel,
} from '../utils/documentHelpers'
import DocumentDetailDrawer from '../components/dokumen/DocumentDetailDrawer.vue'
import FileDropzone from '../components/dokumen/FileDropzone.vue'
import Icon from '../components/Icon.vue'

const store = useDocumentsStore()
const authStore = useAuthStore()
const { getCategoryBadge } = useCategoryBadge()
const { confirmDelete, confirmAction } = useAppConfirm()
const { toastMessage, toastVisible, showToast } = useToast()

// ─── Folder Navigation & Tab State ───
const folderBreadcrumbs = ref<Folder[]>([])
const currentFolder = computed<Folder | null>(() => {
  return folderBreadcrumbs.value.length > 0
    ? folderBreadcrumbs.value[folderBreadcrumbs.value.length - 1]
    : null
})

const activeTab = ref<'aktif' | 'trash'>('aktif')
const selectedDoc = ref<Doc | null>(null)
const isDrawerOpen = ref(false)

// ─── Add Folder State ───
const isAddFolderModalOpen = ref(false)
const folderForm = ref({
  name: '',
  unit_id: '',
})
const folderSubmitting = ref(false)

// ─── Upload Document State ───
const isUploadModalOpen = ref(false)
const newDoc = ref({
  name: '',
  category_id: '',
  tags: '',
  note: 'Unggahan awal',
})
const uploadFile = ref<File | null>(null)
const submitting = ref(false)

// ─── Move Document State ───
const isMoveModalOpen = ref(false)
const docToMove = ref<Doc | null>(null)
const moveTargetFolderId = ref<string>('')
const moveSubmitting = ref(false)

// ─── Version Upload State ───
const isVersionModalOpen = ref(false)
const versionFile = ref<File | null>(null)
const versionNote = ref('')

// ─── Computed Permissions & Role ───
const userRole = computed(() => (authStore.userRole || 'Admin').toLowerCase())
const canAddFolder = computed(() => authStore.canManageFolder || authStore.isAdmin || userRole.value === 'pengelola')

const canModify = (doc: Doc) => {
  if (authStore.isAdmin || userRole.value === 'pengelola') return true
  return doc.owner_id === authStore.user?.id
}

const rows = 10

// Folders pagination state (View 1)
const foldersList = ref<Folder[]>([])
const folderFirst = ref(0)
const folderTotalRecords = ref(0)
const loadingFolders = ref(false)

async function fetchFoldersPaginated(page = 1) {
  loadingFolders.value = true
  try {
    const params: Record<string, any> = {
      paginate: true,
      page,
      per_page: rows,
    }

    const res = await api.get('/v1/folders', { params })
    foldersList.value = (res.data?.data ?? []).map((f: any) => ({
      ...f,
      unitId: f.unit_id ?? f.unitId,
    }))
    folderTotalRecords.value = res.data?.meta?.total ?? foldersList.value.length
  } catch {
    foldersList.value = store.folders.slice(folderFirst.value, folderFirst.value + rows)
    folderTotalRecords.value = store.folders.length
  } finally {
    loadingFolders.value = false
  }
}

function onFolderPageChange(e: { page: number; first: number }) {
  folderFirst.value = e.first
  const targetPage = e.page + 1
  fetchFoldersPaginated(targetPage)
}

// Documents pagination state (View 2)
const docFirst = ref(0)
const docTotalRecords = ref(0)

async function fetchFolderDocs(page = 1) {
  store.documents.length = 0;
  const params: Record<string, any> = {
    page,
    per_page: rows,
    status: activeTab.value === 'trash' ? 'trashed' : 'active',
  }
  if (currentFolder.value?.id) {
    params.folder_id = currentFolder.value.id
  }
  await store.fetchDocuments(params)
  docTotalRecords.value = store.meta?.total ?? store.documents.length
}

function onDocPageChange(e: { page: number; first: number }) {
  docFirst.value = e.first
  const targetPage = e.page + 1
  fetchFolderDocs(targetPage)
}

// Refresh when currentFolder or activeTab changes
watch([currentFolder, activeTab], () => {
  docFirst.value = 0
  folderFirst.value = 0
  if (currentFolder.value) {
    fetchFolderDocs(1)
  } else {
    fetchFoldersPaginated(1)
  }
})

function getFolderDocCount(folder: any, tab: 'aktif' | 'trash' = 'aktif'): number {
  if (tab === 'trash') {
    if (typeof folder.trashed_documents_count === 'number') {
      return folder.trashed_documents_count
    }
    return store.trashedDocs.filter(d => (d.folder_id || d.folderId) === folder.id).length
  }
  if (typeof folder.documents_count === 'number') {
    return folder.documents_count
  }
  return store.activeDocs.filter(d => (d.folder_id || d.folderId) === folder.id).length
}

// ─── Lifecycle ───
onMounted(async () => {
  await Promise.allSettled([
    fetchFoldersPaginated(1),
    store.fetchFolders({ all: true }),
    store.fetchCategories(),
    store.fetchUnits(),
  ])
})

// ─── Folder Navigation Actions ───
function openFolder(folder: Folder) {
  folderBreadcrumbs.value.push(folder)
  docFirst.value = 0
  folderFirst.value = 0
}

function navigateToBreadcrumb(index: number) {
  if (index === -1) {
    folderBreadcrumbs.value = []
  } else {
    folderBreadcrumbs.value = folderBreadcrumbs.value.slice(0, index + 1)
  }
  docFirst.value = 0
  folderFirst.value = 0
}

function closeFolder() {
  if (folderBreadcrumbs.value.length > 0) {
    folderBreadcrumbs.value.pop()
  }
  docFirst.value = 0
  folderFirst.value = 0
}

function openAddFolderModal() {
  const defaultUnit = authStore.isAdmin
    ? (store.units[0]?.id || '')
    : (authStore.user?.unit_id || '')

  folderForm.value = {
    name: '',
    unit_id: defaultUnit,
  }
  isAddFolderModalOpen.value = true
}

function submitAddFolder() {
  const folderName = folderForm.value.name.trim()
  if (!folderName) return showToast('Nama folder wajib diisi')
  if (authStore.isAdmin && !folderForm.value.unit_id) {
    return showToast('Pilih unit untuk folder ini')
  }

  confirmAction({
    title: 'Buat Folder Baru',
    message: `Apakah Anda yakin ingin membuat folder "${folderName}"?`,
    confirmLabel: 'Buat Folder',
    icon: 'folder',
    onAccept: async () => {
      folderSubmitting.value = true
      try {
        const payload: { name: string; unit_id?: string } = { name: folderName }
        if (folderForm.value.unit_id) {
          payload.unit_id = folderForm.value.unit_id
        }

        await store.createFolder(payload)
        isAddFolderModalOpen.value = false
        showToast(`Folder "${payload.name}" berhasil dibuat`)
        await fetchFoldersPaginated(1)
        await store.fetchFolders({ all: true })
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal membuat folder'))
      } finally {
        folderSubmitting.value = false
      }
    },
  })
}

// ─── Upload Document Actions (Only inside folder, no folder field!) ───
function openUploadModal() {
  if (!currentFolder.value) {
    return showToast('Silakan buka folder terlebih dahulu sebelum mengunggah dokumen.')
  }
  newDoc.value = {
    name: '',
    category_id: store.categories[0]?.id || '',
    tags: '',
    note: 'Unggahan awal',
  }
  uploadFile.value = null
  isUploadModalOpen.value = true
}

function submitUploadDoc() {
  if (!currentFolder.value?.id) {
    return showToast('Folder tujuan tidak ditemukan.')
  }
  const docName = newDoc.value.name.trim()
  if (!docName) return showToast('Nama dokumen wajib diisi')
  if (!newDoc.value.category_id) return showToast('Pilih kategori terlebih dahulu')

  const targetFolderId = currentFolder.value.id
  const targetFolderName = currentFolder.value.name

  confirmAction({
    title: 'Unggah Dokumen Baru',
    message: `Apakah Anda yakin ingin mengunggah "${docName}" ke folder "${targetFolderName}"?`,
    confirmLabel: 'Unggah Dokumen',
    icon: 'upload',
    onAccept: async () => {
      submitting.value = true
      try {
        await store.uploadDocument({
          name: docName,
          folder_id: targetFolderId,
          category_id: newDoc.value.category_id,
          tags: newDoc.value.tags,
          file: uploadFile.value,
          note: newDoc.value.note,
        })
        isUploadModalOpen.value = false
        showToast(`Dokumen "${docName}" berhasil diunggah`)
        await fetchFolderDocs(1)
        await fetchFoldersPaginated(1)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal mengunggah dokumen'))
      } finally {
        submitting.value = false
      }
    },
  })
}

// ─── Move Document Actions ───
function openMoveModal(doc: Doc) {
  docToMove.value = doc
  moveTargetFolderId.value = ''
  isMoveModalOpen.value = true
}

const moveFoldersList = computed(() => {
  return store.folders
})

function submitMoveDocument() {
  if (!docToMove.value || !moveTargetFolderId.value) return
  const doc = docToMove.value
  const targetFolderId = moveTargetFolderId.value
  const targetFolderName = getFolderName(targetFolderId)

  confirmAction({
    title: 'Pindahkan Dokumen',
    message: `Apakah Anda yakin ingin memindahkan "${doc.name}" ke folder "${targetFolderName}"?`,
    confirmLabel: 'Pindahkan',
    icon: 'folder',
    onAccept: async () => {
      moveSubmitting.value = true
      try {
        await store.moveDocument(doc.id, targetFolderId)
        isMoveModalOpen.value = false
        showToast(`Dokumen "${doc.name}" berhasil dipindahkan`)
        if (selectedDoc.value?.id === doc.id) {
          const full = await store.fetchDocument(doc.id)
          if (full) selectedDoc.value = full
        }
        await fetchFolderDocs(1)
        await fetchFoldersPaginated(1)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal memindahkan dokumen'))
      } finally {
        moveSubmitting.value = false
      }
    },
  })
}

// ─── Document Detail, Download & Trash Actions ───
async function openDocDetail(doc: Doc) {
  const full = await store.fetchDocument(doc.id)
  selectedDoc.value = full || doc
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
      try {
        await store.downloadDocument(doc.id)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal mengunduh dokumen'))
      }
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
      try {
        await store.trashDocument(doc.id)
        showToast(`"${doc.name}" dipindahkan ke tempat sampah`)
        if (selectedDoc.value?.id === doc.id) closeDrawer()
        await fetchFolderDocs(1)
        await fetchFoldersPaginated(1)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal memindahkan ke tempat sampah'))
      }
    },
  })
}

function handleRestore(doc: Doc) {
  confirmAction({
    title: 'Pulihkan Dokumen',
    message: `Pulihkan "${doc.name}" ke daftar dokumen aktif?`,
    confirmLabel: 'Pulihkan',
    onAccept: async () => {
      try {
        await store.restoreDocument(doc.id)
        showToast(`"${doc.name}" berhasil dipulihkan`)
        if (selectedDoc.value?.id === doc.id) closeDrawer()
        await fetchFolderDocs(1)
        await fetchFoldersPaginated(1)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal memulihkan dokumen'))
      }
    },
  })
}

function handlePurge(doc: Doc) {
  confirmDelete({
    title: 'Hapus Dokumen Secara Permanen',
    message: `Hapus permanen "${doc.name}"?`,
    submessage: 'Tindakan ini tidak dapat dibatalkan. File dan seluruh riwayat versi akan terhapus.',
    confirmLabel: 'Hapus Permanen',
    onAccept: async () => {
      try {
        await store.deleteDocument(doc.id)
        showToast(`"${doc.name}" dihapus permanen`)
        if (selectedDoc.value?.id === doc.id) closeDrawer()
        await fetchFolderDocs(1)
        await fetchFoldersPaginated(1)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal menghapus permanen'))
      }
    },
  })
}

// ─── Version Upload ───
function openVersionModal(doc: Doc) {
  selectedDoc.value = doc
  versionFile.value = null
  versionNote.value = ''
  isVersionModalOpen.value = true
}

function submitUploadVersion() {
  if (!versionFile.value) return showToast('Pilih file terlebih dahulu')
  if (!selectedDoc.value) return
  const doc = selectedDoc.value
  const file = versionFile.value

  confirmAction({
    title: 'Unggah Versi Baru',
    message: `Apakah Anda yakin ingin mengunggah versi baru untuk "${doc.name}"?`,
    submessage: `File: ${file.name} (${store.fmtSize(file.size)})`,
    confirmLabel: 'Upload Versi',
    icon: 'upload',
    onAccept: async () => {
      submitting.value = true
      try {
        await store.uploadVersion(doc.id, file, versionNote.value)
        isVersionModalOpen.value = false
        showToast('Versi baru dokumen berhasil diunggah')
        const full = await store.fetchDocument(doc.id)
        if (full) selectedDoc.value = full
        await fetchFolderDocs(Math.floor(docFirst.value / rows) + 1)
      } catch (e: unknown) {
        showToast(extractApiError(e, 'Gagal upload versi'))
      } finally {
        submitting.value = false
      }
    },
  })
}

// ─── Helper Functions ───
function getFolderName(folderId?: string): string {
  return resolveFolderName(store.folders, folderId)
}

function getUserLevel(doc: Doc) {
  return getUserAccessLevel(canModify(doc))
}
</script>

<template>
  <div class="panel">
    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- PANEL HEAD: BREADCRUMBS & ACTION BUTTONS               -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="panel-head">
      <div class="crumbs flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          :class="{ current: !currentFolder }"
          @click="navigateToBreadcrumb(-1)"
        >
          Semua Folder
        </button>
        <template v-for="(folder, idx) in folderBreadcrumbs" :key="folder.id">
          <span class="text-muted">›</span>
          <button
            type="button"
            :class="{ current: idx === folderBreadcrumbs.length - 1, 'font-bold': idx === folderBreadcrumbs.length - 1 }"
            @click="navigateToBreadcrumb(idx)"
          >
            {{ folder.name }}
            <span v-if="idx === folderBreadcrumbs.length - 1 && folder.unit?.name" class="muted font-normal text-xs">
              (unit {{ folder.unit.name }})
            </span>
          </button>
        </template>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- Tambah Folder (hanya saat di Semua Folder root, untuk Admin/Pengelola) -->
        <button
          v-if="!currentFolder && canAddFolder"
          type="button"
          class="btn primary sm"
          @click="openAddFolderModal"
        >
          + Tambah Folder
        </button>

        <!-- Saat berada di dalam folder: Kembali & Unggah Dokumen -->
        <template v-if="currentFolder">
          <button
            type="button"
            class="btn ghost sm"
            @click="closeFolder"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Kembali
          </button>

          <!-- Unggah Dokumen HANYA muncul saat di dalam folder -->
          <button
            v-if="activeTab === 'aktif'"
            type="button"
            class="btn primary sm"
            @click="openUploadModal"
          >
            + Unggah Dokumen
          </button>
        </template>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- TABS BAR: AKTIF | TEMPAT SAMPAH                         -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="tabs px-4">
      <button
        type="button"
        class="tab"
        :class="{ active: activeTab === 'aktif' }"
        @click="activeTab = 'aktif'"
      >
        Aktif
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: activeTab === 'trash' }"
        @click="activeTab = 'trash'"
      >
        Tempat Sampah
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- VIEW 1: DAFTAR FOLDER DI ROOT (Saat currentFolder null) -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div v-if="!currentFolder" class="panel-body p-2">
      <div v-if="loadingFolders" class="empty">
        <div class="flex flex-col items-center justify-center gap-2 py-6">
          <ProgressSpinner style="width: 32px; height: 32px" strokeWidth="4" />
          <span>Memuat folder...</span>
        </div>
      </div>

      <div v-else-if="foldersList.length === 0" class="empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-40 mb-1">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>
        </svg>
        <div>
          {{ activeTab === 'aktif' ? 'Belum ada folder yang dibuat.' : 'Tidak ada folder di tempat sampah.' }}
        </div>
        <button v-if="canAddFolder && activeTab === 'aktif'" class="btn ghost sm mt-2" @click="openAddFolderModal">
          + Tambah Folder
        </button>
      </div>

      <!-- Clean list of folder rows -->
      <div v-else class="folder-grid">
        <div
          v-for="folder in foldersList"
          :key="folder.id"
          class="folder-row flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-colors cursor-pointer group"
          @click="openFolder(folder)"
        >
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="text-muted flex-shrink-0">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>
            </svg>
            <span class="text-sm font-medium truncate">{{ folder.name }}</span>
            <span v-if="folder.unit?.name" class="text-xs text-muted truncate"> — {{ folder.unit.name }}</span>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <span class="count text-xs text-muted">
              {{ getFolderDocCount(folder, activeTab) }}
              {{ activeTab === 'aktif' ? 'dokumen' : 'dokumen terhapus' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Numeric Pagination for Folders -->
      <div v-if="folderTotalRecords > rows" class="border-t border-[var(--border)] p-2 mt-2 flex justify-center">
        <Paginator
          v-model:first="folderFirst"
          :rows="rows"
          :totalRecords="folderTotalRecords"
          :alwaysShow="true"
          @page="onFolderPageChange"
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        />
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- VIEW 2: DI DALAM FOLDER (TABEL DOKUMEN)                -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div v-else>
      <!-- Document Table -->
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>NAMA</th>
              <th>KATEGORI</th>
              <th>PEMILIK</th>
              <th>TANGGAL</th>
              <th>UKURAN</th>
              <th>VERSI</th>
              <th>LEVEL ANDA</th>
              <th style="text-align: right"></th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading State saat fetch dokumen / pindah page -->
            <tr v-if="store.loading">
              <td colspan="8" style="text-align: center; padding: 32px;" class="muted">
                <div class="flex flex-col items-center justify-center gap-2">
                  <ProgressSpinner style="width: 32px; height: 32px" strokeWidth="4" />
                  <span>Memuat dokumen...</span>
                </div>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-else-if="store.documents.length === 0">
              <td colspan="8">
                <div class="empty py-8">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="opacity-40 mb-1">
                    <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/>
                  </svg>
                  <div>
                    {{ activeTab === 'aktif'
                      ? `Belum ada dokumen aktif di folder "${currentFolder.name}".`
                      : `Tempat sampah kosong untuk folder "${currentFolder.name}".`
                    }}
                  </div>
                  <button
                    v-if="activeTab === 'aktif'"
                    type="button"
                    class="btn primary sm mt-2"
                    @click="openUploadModal"
                  >
                    + Unggah Dokumen ke Folder Ini
                  </button>
                </div>
              </td>
            </tr>

            <!-- Document Rows -->
            <tr
              v-for="doc in store.documents"
              :key="doc.id"
              class="clickable"
              @click="openDocDetail(doc)"
            >
              <!-- NAMA -->
              <td>
                <div class="docname">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/>
                  </svg>
                  <span class="truncate" :title="doc.name">{{ doc.name }}</span>
                </div>
              </td>

              <!-- KATEGORI -->
              <td>
                <span
                  class="pill"
                  :style="{
                    background: getCategoryBadge(getCategoryName(doc)).bg,
                    color: getCategoryBadge(getCategoryName(doc)).text,
                    border: '1px solid ' + getCategoryBadge(getCategoryName(doc)).text + '33',
                  }"
                >
                  <span
                    class="dot"
                    :style="{ background: getCategoryBadge(getCategoryName(doc)).dot }"
                  ></span>
                  {{ getCategoryName(doc) }}
                </span>
              </td>

              <!-- PEMILIK -->
              <td class="muted text-xs">{{ getOwnerName(doc) }}</td>

              <!-- TANGGAL -->
              <td><span class="num muted text-xs">{{ doc.date }}</span></td>

              <!-- UKURAN -->
              <td><span class="num">{{ store.fmtSize(doc.latest_version?.size_bytes || doc.size) }}</span></td>

              <!-- VERSI -->
              <td><span class="num">v{{ doc.latest_version?.version_number || 1 }}</span></td>

              <!-- LEVEL ANDA -->
              <td>
                <span
                  class="pill"
                  :style="{
                    background: 'transparent',
                    color: getUserLevel(doc).color,
                    border: 'none',
                    padding: '0',
                  }"
                >
                  <span
                    class="dot"
                    :style="{ background: getUserLevel(doc).dot }"
                  ></span>
                  {{ getUserLevel(doc).label }}
                </span>
              </td>

              <!-- AKSI -->
              <td style="text-align: right" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <!-- Active Tab Actions -->
                  <template v-if="activeTab === 'aktif'">
                    <!-- Unduh Dokumen -->
                    <button
                      type="button"
                      class="iconbtn info"
                      title="Unduh dokumen"
                      @click="handleDownload(doc)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>

                    <!-- Pindahkan Folder -->
                    <button
                      v-if="canModify(doc)"
                      type="button"
                      class="iconbtn"
                      title="Pindahkan ke folder lain"
                      @click="openMoveModal(doc)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 3h6v6"></path>
                        <path d="M10 14L21 3"></path>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      </svg>
                    </button>

                    <!-- Pindahkan ke Tempat Sampah -->
                    <button
                      v-if="canModify(doc)"
                      type="button"
                      class="iconbtn danger"
                      title="Pindahkan ke tempat sampah"
                      @click="handleTrash(doc)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </template>

                  <!-- Trash Tab Actions -->
                  <template v-else>
                    <button
                      v-if="canModify(doc)"
                      type="button"
                      class="iconbtn success"
                      title="Pulihkan dokumen"
                      @click="handleRestore(doc)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                      </svg>
                    </button>
                    <button
                      v-if="canModify(doc)"
                      type="button"
                      class="iconbtn danger"
                      title="Hapus permanen"
                      @click="handlePurge(doc)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Numeric Pagination for Documents -->
      <div v-if="docTotalRecords > rows" class="border-t border-[var(--border)] p-2 flex justify-center">
        <Paginator
          v-model:first="docFirst"
          :rows="rows"
          :totalRecords="docTotalRecords"
          :alwaysShow="true"
          @page="onDocPageChange"
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        />
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- SHARED DOCUMENT DETAIL DRAWER                           -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <DocumentDetailDrawer
      :open="isDrawerOpen"
      :doc="selectedDoc"
      :folder-name="getFolderName(selectedDoc?.folderId || selectedDoc?.folder_id)"
      :format-size="store.fmtSize"
      :can-modify="selectedDoc ? canModify(selectedDoc) : false"
      show-move-action
      show-version-action
      show-purge-action
      @close="closeDrawer"
      @download="handleDownload"
      @move="openMoveModal"
      @upload-version="openVersionModal"
      @trash="handleTrash"
      @restore="handleRestore"
      @purge="handlePurge"
    />

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: PINDAHKAN DOKUMEN KE FOLDER LAIN                 -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <Dialog
      v-model:visible="isMoveModalOpen"
      header="Pindahkan Dokumen"
      modal
      :style="{ width: '460px' }"
    >
      <div class="flex flex-col gap-3 py-2">
        <div class="p-2.5 rounded bg-surface-2 border border-border text-xs flex flex-col gap-1">
          <div>
            Dokumen: <strong class="text-text">{{ docToMove?.name }}</strong>
          </div>
          <span class="text-muted">Folder saat ini: {{ getFolderName(docToMove?.folder_id || docToMove?.folderId) }}</span>
        </div>

        <div class="text-xs text-muted flex items-center justify-between">
          <span>Pilih folder tujuan:</span>
          <span v-if="moveTargetFolderId" class="text-accent font-bold">
            Terpilih: {{ getFolderName(moveTargetFolderId) }}
          </span>
        </div>

        <!-- List of Folders -->
        <div class="folder-grid max-h-[240px] overflow-y-auto p-1 border border-border rounded">
          <div
            v-for="f in moveFoldersList"
            :key="f.id"
            class="folder-row flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-colors cursor-pointer"
            :class="{ 'bg-accent-soft/30 border border-accent': moveTargetFolderId === f.id }"
            @click="moveTargetFolderId = f.id"
          >
            <div class="flex items-center gap-2 min-w-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted flex-shrink-0">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>
              </svg>
              <span class="text-xs font-semibold truncate">{{ f.name }}</span>
              <span v-if="f.unit?.name" class="text-[10px] text-muted">({{ f.unit.name }})</span>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="text-[11px] px-2 py-0.5 rounded font-bold"
                :class="moveTargetFolderId === f.id ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted'"
              >
                {{ moveTargetFolderId === f.id ? 'Terpilih' : 'Pilih' }}
              </span>
            </div>
          </div>

          <div v-if="moveFoldersList.length === 0" class="empty py-6 text-xs text-muted text-center">
            Belum ada folder tujuan.
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Batal" text size="small" @click="isMoveModalOpen = false" />
          <Button
            label="Pindahkan ke Sini"
            icon="pi pi-check"
            size="small"
            :loading="moveSubmitting"
            :disabled="!moveTargetFolderId || moveTargetFolderId === (docToMove?.folder_id || docToMove?.folderId)"
            @click="submitMoveDocument"
          />
        </div>
      </template>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: TAMBAH FOLDER BARU                               -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <Dialog
      v-model:visible="isAddFolderModalOpen"
      header="Buat Folder Baru"
      modal
      :style="{ width: '420px' }"
    >
      <div class="flex flex-col gap-3 py-2">
        <label class="formlabel">
          <span>Nama Folder <span class="text-red-500">*</span></span>
          <InputText
            v-model="folderForm.name"
            placeholder="Contoh: Dokumen Legal 2026"
            class="w-full"
            autofocus
          />
        </label>

        <label v-if="authStore.isAdmin" class="formlabel">
          <span>Unit Organisasi <span class="text-red-500">*</span></span>
          <Select
            v-model="folderForm.unit_id"
            :options="store.units"
            optionLabel="name"
            optionValue="id"
            placeholder="Pilih Unit"
            class="w-full"
          />
        </label>
        <div v-else class="text-xs text-muted">
          Folder otomatis ditautkan ke unit kerja akun Anda.
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Batal" text size="small" @click="isAddFolderModalOpen = false" />
          <Button
            label="Simpan Folder"
            icon="pi pi-check"
            size="small"
            :loading="folderSubmitting"
            @click="submitAddFolder"
          />
        </div>
      </template>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: UNGGAH DOKUMEN BARU (Hanya di dalam folder)      -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <Dialog
      v-model:visible="isUploadModalOpen"
      header="Unggah Dokumen Baru"
      modal
      :style="{ width: '480px' }"
    >
      <div class="flex flex-col gap-3 py-2">
        <!-- Target folder display (No dropdown!) -->
        <div class="p-2.5 rounded bg-surface-2 border border-border text-xs flex items-center justify-between flex-wrap gap-1.5">
          <span>Folder Tujuan: <strong class="text-accent">{{ currentFolder?.name }}</strong></span>
          <span v-if="currentFolder?.unit?.name" class="text-muted">Unit: {{ currentFolder.unit.name }}</span>
        </div>

        <label class="formlabel">
          <span>Nama Dokumen <span class="text-red-500">*</span></span>
          <InputText v-model="newDoc.name" placeholder="Contoh: Kontrak Sewa Gedung 2026" class="w-full" />
        </label>

        <label class="formlabel">
          <span>Kategori <span class="text-red-500">*</span></span>
          <Select
            v-model="newDoc.category_id"
            :options="store.categories"
            optionLabel="name"
            optionValue="id"
            placeholder="Pilih Kategori"
            class="w-full"
          />
        </label>

        <label class="formlabel">
          <span>Tags (pisahkan dengan koma)</span>
          <InputText v-model="newDoc.tags" placeholder="kontrak, sewa, gedung" class="w-full" />
        </label>

        <FileDropzone
          v-model="uploadFile"
          label="Pilih File Dokumen"
          empty-text="Klik untuk memilih file dokumen"
          :format-size="store.fmtSize"
        />

        <label class="formlabel">
          <span>Catatan Versi Awal</span>
          <Textarea v-model="newDoc.note" rows="2" placeholder="Catatan versi awal (opsional)..." class="w-full" />
        </label>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Batal" text size="small" @click="isUploadModalOpen = false" />
          <Button
            label="Unggah"
            icon="pi pi-upload"
            size="small"
            :loading="submitting"
            @click="submitUploadDoc"
          />
        </div>
      </template>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: UPLOAD VERSI BARU DOKUMEN                        -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <Dialog
      v-model:visible="isVersionModalOpen"
      header="Unggah Versi Baru"
      modal
      :style="{ width: '440px' }"
    >
      <div class="flex flex-col gap-3 py-2">
        <div class="p-2.5 rounded bg-surface-2 border border-border text-xs">
          Dokumen: <strong>{{ selectedDoc?.name }}</strong>
        </div>

        <FileDropzone
          v-model="versionFile"
          label="Pilih File Versi Baru"
          empty-text="Klik untuk memilih file versi baru"
          :format-size="store.fmtSize"
        />

        <label class="formlabel">
          <span>Catatan Perubahan</span>
          <Textarea
            v-model="versionNote"
            rows="2"
            placeholder="Contoh: Revisi pasal 4 mengenai masa sewa"
            class="w-full"
          />
        </label>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Batal" text size="small" @click="isVersionModalOpen = false" />
          <Button
            label="Upload Versi"
            icon="pi pi-check"
            size="small"
            :loading="submitting"
            @click="submitUploadVersion"
          />
        </div>
      </template>
    </Dialog>
    <!-- Toast Notification -->
    <div v-if="toastVisible" class="toasts">
      <div class="toast">
        <Icon name="check" :size="16" />
        <span>{{ toastMessage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  padding: 0;
}
</style>
