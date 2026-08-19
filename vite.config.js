import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createHash } from 'node:crypto'
import fs from 'node:fs'

// 构建时从 .env 读取 VITE_PIN → 计算 SHA-256 哈希注入 bundle（bundle 内不出现明文）
function loadPinHash() {
  let pin = process.env.VITE_PIN || ''
  try {
    const env = fs.readFileSync('.env', 'utf8')
    const m = env.match(/^VITE_PIN\s*=\s*(.+)$/m)
    if (m) pin = m[1].trim()
  } catch { /* .env 不存在则只用环境变量 */ }
  if (!pin) return ''
  return createHash('sha256').update(String(pin)).digest('hex')
}

export default defineConfig({
  plugins: [vue()],
  define: {
    __PIN_HASH__: JSON.stringify(loadPinHash()),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
