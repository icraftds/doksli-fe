import { onUnmounted, ref } from 'vue'

export function useToast(durationMs = 3000) {
  const message = ref('')
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function showToast(msg: string) {
    message.value = msg
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
      timer = null
    }, durationMs)
  }

  function hideToast() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    visible.value = false
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return {
    toastMessage: message,
    toastVisible: visible,
    showToast,
    hideToast,
  }
}
