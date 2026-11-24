export interface ApiErrorOptions {
  forbiddenFallback?: string
  unauthorizedFallback?: string
}

export function extractApiError(err: unknown, fallback: string, options: ApiErrorOptions = {}): string {
  const response = (err as any)?.response
  const status = response?.status
  const serverMessage = response?.data?.message

  if (status === 401) {
    return options.unauthorizedFallback ?? 'Sesi login telah berakhir (Unauthenticated). Silakan login kembali.'
  }

  if (status === 403) {
    return serverMessage || options.forbiddenFallback || 'Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.'
  }

  if (status === 422 && response?.data?.errors) {
    const firstKey = Object.keys(response.data.errors)[0]
    const firstError = firstKey ? response.data.errors[firstKey]?.[0] : null
    if (firstError) return firstError
  }

  return serverMessage || fallback
}
