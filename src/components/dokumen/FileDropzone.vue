<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  modelValue: File | null
  label: string
  emptyText: string
  hintText?: string
  accept?: string
  formatSize: (bytes?: number) => string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', file: File | null): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function triggerPicker() {
  inputRef.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.files?.[0] ?? null)
}

function clearFile() {
  emit('update:modelValue', null)
  if (inputRef.value) inputRef.value.value = ''
}
</script>

<template>
  <div class="formlabel">
    <span>{{ label }} <span class="text-red-500">*</span></span>
    <input
      ref="inputRef"
      type="file"
      :accept="accept ?? '.pdf,.docx,.xlsx,.doc,.xls,.png,.jpg,.jpeg'"
      class="hidden"
      @change="onFileChange"
    />

    <div v-if="!modelValue" class="dropzone-box" @click="triggerPicker">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="text-accent mb-1">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <div class="text-xs font-semibold text-text">{{ emptyText }}</div>
      <div class="text-[11px] text-muted">{{ hintText ?? 'PDF, DOCX, XLSX, JPG, PNG (Maks 25MB)' }}</div>
    </div>

    <div v-else class="file-selected-box">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="file-icon-badge">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-xs font-semibold truncate text-text" :title="modelValue.name">
            {{ modelValue.name }}
          </div>
          <div class="text-[11px] text-muted">
            {{ formatSize(modelValue.size) }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button type="button" class="btn ghost sm text-xs" @click="triggerPicker">
          Ganti
        </button>
        <button type="button" class="iconbtn sm hover:text-red-400" title="Hapus file" @click="clearFile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dropzone-box {
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  padding: 20px 16px;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  text-align: center;
}

.dropzone-box:hover {
  border-color: var(--accent);
  background: var(--surface);
}

.file-selected-box {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.file-icon-badge {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  background: var(--accent-soft, rgba(99, 102, 241, 0.12));
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
