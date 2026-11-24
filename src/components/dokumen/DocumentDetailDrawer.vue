<script setup lang="ts">
import { computed } from 'vue'
import type { Doc } from '../../stores/documents'
import { useCategoryBadge } from '../../composables/useCategoryBadge'
import {
  getCategoryName,
  getCurrentVersion,
  getOwnerName,
  isDocTrashed,
} from '../../utils/documentHelpers'

const props = withDefaults(
  defineProps<{
    open: boolean
    doc: Doc | null
    folderName: string
    formatSize: (bytes?: number) => string
    canModify?: boolean
    showMoveAction?: boolean
    showVersionAction?: boolean
    showPurgeAction?: boolean
  }>(),
  {
    canModify: true,
    showMoveAction: false,
    showVersionAction: false,
    showPurgeAction: false,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'download', doc: Doc): void
  (e: 'move', doc: Doc): void
  (e: 'upload-version', doc: Doc): void
  (e: 'trash', doc: Doc): void
  (e: 'restore', doc: Doc): void
  (e: 'purge', doc: Doc): void
}>()

const { getCategoryBadge } = useCategoryBadge()

const categoryName = computed(() => (props.doc ? getCategoryName(props.doc) : '-'))
const badge = computed(() => getCategoryBadge(categoryName.value))
const trashed = computed(() => (props.doc ? isDocTrashed(props.doc) : false))
const versions = computed(() => {
  if (!props.doc) return []
  return props.doc.versions && props.doc.versions.length > 0
    ? props.doc.versions
    : [getCurrentVersion(props.doc)]
})
</script>

<template>
  <div class="scrim" :class="{ open }" @click="emit('close')"></div>
  <div class="drawer" :class="{ open }">
    <template v-if="doc">
      <div class="drawer-head">
        <div class="flex flex-col gap-1 pr-4 min-w-0">
          <h3 class="font-bold text-sm leading-snug">{{ doc.name }}</h3>
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="pill"
              :style="{
                background: badge.bg,
                color: badge.text,
                border: badge.border,
              }"
            >
              <span class="dot" :style="{ background: badge.dot }"></span>
              {{ categoryName }}
            </span>
            <span class="text-xs text-text-muted">Folder: {{ folderName }}</span>
          </div>
        </div>
        <button type="button" class="iconbtn shrink-0" title="Tutup" @click="emit('close')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="drawer-body">
        <div>
          <div class="section-title">Informasi Dokumen</div>
          <div class="field-grid">
            <div class="field">
              <span class="k">Ukuran File</span>
              <span class="v num">{{ formatSize(doc.size) }}</span>
            </div>
            <div class="field">
              <span class="k">Versi Aktif</span>
              <span class="v num">v{{ getCurrentVersion(doc).v }}</span>
            </div>
            <div class="field">
              <span class="k">Pemilik</span>
              <span class="v">{{ getOwnerName(doc) }}</span>
            </div>
            <div class="field">
              <span class="k">Tanggal</span>
              <span class="v num text-xs">{{ doc.date }}</span>
            </div>
          </div>
        </div>

        <div v-if="doc.tags && doc.tags.length">
          <div class="section-title">Tags</div>
          <div class="taglist">
            <span v-for="(tag, idx) in doc.tags" :key="typeof tag === 'string' ? idx : tag.id" class="tag">
              #{{ typeof tag === 'string' ? tag : tag.name }}
            </span>
          </div>
        </div>

        <div>
          <div class="section-title">Riwayat Versi ({{ versions.length }})</div>
          <div class="flex flex-col">
            <div
              v-for="(ver, idx) in versions"
              :key="idx"
              class="vrow"
              :class="{ current: idx === versions.length - 1 }"
            >
              <div class="vnum">v{{ (ver as any).version_number ?? (ver as any).v ?? 1 }}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-xs">{{ (ver as any).uploader?.name ?? (ver as any).uploader ?? 'Admin' }}</span>
                  <span class="num text-[11px] text-text-muted">{{ formatSize((ver as any).size_bytes ?? (ver as any).size) }}</span>
                  <span
                    v-if="idx === versions.length - 1"
                    class="text-[10px] bg-accent-soft text-accent px-1.5 py-0.5 rounded font-bold"
                  >
                    AKTIF
                  </span>
                </div>
                <div v-if="(ver as any).note" class="text-[11.5px] text-text-muted truncate">"{{ (ver as any).note }}"</div>
                <code v-if="(ver as any).checksum" class="text-[10px] text-muted block mt-0.5 font-mono">
                  SHA: {{ String((ver as any).checksum).substring(0, 16) }}…
                </code>
              </div>
            </div>
          </div>
        </div>

        <div class="btnrow pt-3 border-t border-border mt-auto flex flex-wrap gap-2">
          <button type="button" class="btn primary flex-1 justify-center" @click="emit('download', doc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Unduh File
          </button>

          <button
            v-if="showMoveAction && !trashed && canModify"
            type="button"
            class="btn ghost sm"
            @click="emit('move', doc)"
          >
            Pindah Folder
          </button>

          <button
            v-if="showVersionAction && !trashed"
            type="button"
            class="btn ghost sm"
            @click="emit('upload-version', doc)"
          >
            + Versi Baru
          </button>

          <button
            v-if="!trashed && canModify"
            type="button"
            class="btn danger sm"
            @click="emit('trash', doc)"
          >
            Pindahkan ke Sampah
          </button>

          <button
            v-else-if="trashed && canModify"
            type="button"
            class="btn success sm"
            @click="emit('restore', doc)"
          >
            Pulihkan
          </button>

          <button
            v-if="showPurgeAction && trashed && canModify"
            type="button"
            class="btn danger sm"
            @click="emit('purge', doc)"
          >
            Hapus Permanen
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
