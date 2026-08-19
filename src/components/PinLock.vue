<script setup>
import { ref, reactive, onMounted } from 'vue'

const emit = defineEmits(['unlock'])

const bootLines = [
  'HW-TOOLS BOOT v0.1.0',
  'PCB INIT ............. OK',
  'NEURAL CORE .......... OK',
  'POWER RAIL ........... 5.0V',
  'ENCRYPTION ........... READY',
  'AUTH REQUIRED',
]
const shown = reactive([])
const phase = ref('boot') // boot → input → unlock → fail
const pin = ref('')
const errMsg = ref('')
const lockedUntil = ref(0)
const failCount = ref(0)
const MAX_FAIL = 5
const LOCK_SEC = 30

const PIN_HASH = typeof __PIN_HASH__ !== 'undefined' ? __PIN_HASH__ : ''

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verify() {
  if (lockedUntil.value > Date.now()) return
  if (pin.value.length < 6) return
  const h = await sha256Hex(pin.value)
  if (h === PIN_HASH) {
    phase.value = 'unlock'
    setTimeout(() => emit('unlock'), 900)
  } else {
    failCount.value++
    errMsg.value = `AUTH FAILED (${failCount.value}/${MAX_FAIL})`
    pin.value = ''
    if (failCount.value >= MAX_FAIL) {
      lockedUntil.value = Date.now() + LOCK_SEC * 1000
      failCount.value = 0
      errMsg.value = `LOCKED ${LOCK_SEC}s`
    }
  }
}

function onInput() {
  if (lockedUntil.value > Date.now()) return
  pin.value = pin.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 16)
}

onMounted(async () => {
  // 无配置 PIN（开发模式）→ 直接放行
  if (!PIN_HASH) {
    errMsg.value = 'NO PIN CONFIG — BYPASS'
    setTimeout(() => emit('unlock'), 800)
    return
  }
  // 逐行显示自检日志
  for (let i = 0; i < bootLines.length; i++) {
    shown.push(bootLines[i])
    await new Promise((r) => setTimeout(r, 140))
  }
  phase.value = 'input'
})

const lockLeft = () => Math.max(0, Math.ceil((lockedUntil.value - Date.now()) / 1000))
</script>

<template>
  <div class="pinlock">
    <div class="scanline"></div>
    <div class="pin-panel" :class="{ 'power-on': phase === 'unlock' }">
      <div class="boot-log">
        <div v-for="(line, i) in shown" :key="i" class="boot-line">
          <span class="ok" v-if="line.includes('OK')">✓</span>
          <span v-else class="arr">▸</span>
          {{ line }}
        </div>
        <div v-if="phase === 'input' || phase === 'unlock'" class="boot-line">
          <span class="arr">▸</span> ENTER PIN: <span class="caret">█</span>
        </div>
      </div>

      <transition name="fade">
        <div v-if="phase === 'input' || phase === 'unlock'" class="pin-input-area">
          <input
            v-model="pin"
            type="password"
            class="pin-field"
            :class="{ invalid: errMsg }"
            :disabled="phase === 'unlock' || lockedUntil > Date.now()"
            maxlength="16"
            placeholder="••••••"
            autofocus
            @input="onInput"
            @keyup.enter="verify"
          />
          <button class="btn pin-go" :disabled="pin.length < 6" @click="verify">AUTH</button>
          <div v-if="errMsg" class="pin-err" :class="{ 'amber': errMsg.startsWith('LOCKED') }">
            ⚠ {{ errMsg }}
          </div>
          <div v-if="lockedUntil > Date.now()" class="pin-lock-timer">
            UNLOCK IN {{ lockLeft() }}s
          </div>
        </div>
      </transition>

      <div v-if="phase === 'unlock'" class="poweron">
        <div class="led big">POWER ON</div>
        <div class="led cyan sub">ACCESS GRANTED</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pinlock {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}
.scanline {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 80px;
  background: linear-gradient(180deg, transparent, rgba(0, 255, 159, 0.05), transparent);
  animation: scanline 5s linear infinite;
  pointer-events: none;
}
.pin-panel {
  width: 100%;
  max-width: 380px;
  background: linear-gradient(180deg, var(--panel-2), var(--panel));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 22px 20px;
  position: relative;
}
.pin-panel::before {
  content: '';
  position: absolute;
  top: -3px; left: -3px; right: -3px; bottom: -3px;
  border-radius: 14px;
  border: 1px solid transparent;
  pointer-events: none;
}
.pin-panel.power-on { animation: poweron 0.9s ease-out; border-color: var(--neon); box-shadow: 0 0 30px rgba(0,255,159,0.2); }
.boot-log {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--dim);
  line-height: 1.9;
  min-height: 150px;
}
.boot-line .ok { color: var(--neon); }
.boot-line .arr { color: var(--cyan); margin-right: 4px; }
.caret { color: var(--neon); animation: typing-caret 0.8s infinite; }
.pin-input-area { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
.pin-field {
  font-size: 26px !important;
  letter-spacing: 12px;
  text-align: center;
  padding: 10px !important;
}
.pin-go { width: 100%; padding: 9px; font-size: 13px; letter-spacing: 3px; }
.pin-err { font-family: var(--mono); font-size: 12px; color: var(--red); text-align: center; }
.pin-err.amber { color: var(--amber); }
.pin-lock-timer { font-family: var(--mono); font-size: 12px; color: var(--amber); text-align: center; }
.poweron { text-align: center; padding: 26px 0 10px; }
.poweron .sub { font-size: 13px; margin-top: 8px; letter-spacing: 3px; }
</style>
