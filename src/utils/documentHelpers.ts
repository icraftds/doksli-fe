import type { Doc, Folder } from '../stores/documents'

export interface NormalizedVersion {
  v: number
  size: number
  uploader: string
  note?: string | null
  checksum?: string
}

export interface AccessLevelBadge {
  label: string
  color: string
  dot: string
}

export function getCategoryName(doc: Doc): string {
  return doc.category?.name || doc.categoryName || (typeof doc.category === 'string' ? doc.category : '-')
}

export function getOwnerName(doc: Doc): string {
  return doc.owner?.name || doc.ownerName || (typeof doc.owner === 'string' ? doc.owner : '-')
}

export function getFolderName(folders: Folder[], folderId?: string): string {
  if (!folderId) return '-'
  const found = folders.find((f) => f.id === folderId)
  return found ? found.name : folderId
}

export function isDocTrashed(doc: Doc): boolean {
  return doc.status === 'trashed' || !!doc.deleted_at || !!doc.deletedAt
}

export function getCurrentVersion(doc: Doc): NormalizedVersion {
  if (doc.latest_version) {
    return {
      v: doc.latest_version.version_number,
      size: doc.latest_version.size_bytes,
      uploader: doc.latest_version.uploader?.name || 'Admin',
      note: doc.latest_version.note,
      checksum: doc.latest_version.checksum,
    }
  }
  if (!doc.versions || doc.versions.length === 0) {
    return { v: 1, size: doc.size || 0, uploader: 'Admin' }
  }
  const last = doc.versions[doc.versions.length - 1]
  return {
    v: last.version_number ?? (last as any).v ?? 1,
    size: last.size_bytes ?? (last as any).size ?? 0,
    uploader: last.uploader?.name ?? (last as any).uploader ?? 'Admin',
    note: last.note,
    checksum: last.checksum,
  }
}

export function getUserAccessLevel(canModify: boolean): AccessLevelBadge {
  if (canModify) {
    return { label: 'Kelola', color: '#f87171', dot: '#ef4444' }
  }
  return { label: 'Lihat', color: '#94a3b8', dot: '#64748b' }
}
