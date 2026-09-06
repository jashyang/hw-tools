// ── 通用复制 composable：三处重复的 copyResult 逻辑收敛于此 ──
import { ref } from 'vue'

export function useCopy() {
  const copied = ref(false)
  let timer = null

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* 忽略 */ }
      ta.remove()
    }
    copied.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1500)
  }

  return { copied, copy }
}
