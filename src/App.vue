<script setup>
import { ref, computed } from 'vue'
import PinLock from './components/PinLock.vue'
import EquivView from './views/EquivView.vue'
import SolveView from './views/SolveView.vue'

const UNLOCK_KEY = 'hw-tools-unlock-until'
const UNLOCK_TTL = 24 * 3600 * 1000 // 24 小时

const unlocked = ref(false)
const tab = ref('equiv')

// 初始化：读取 localStorage 解锁时间戳
const saved = Number(localStorage.getItem(UNLOCK_KEY) || 0)
if (saved > Date.now()) unlocked.value = true

function onUnlock() {
  unlocked.value = true
  localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_TTL))
}
</script>

<template>
  <PinLock v-if="!unlocked" @unlock="onUnlock" />
  <div v-else class="app-shell">
    <div class="topbar">
      <div class="logo"><span class="chip"></span>HW-TOOLS</div>
      <div class="tab-nav">
        <button class="tab" :class="{ active: tab === 'equiv' }" @click="tab = 'equiv'">等效电阻</button>
        <button class="tab" :class="{ active: tab === 'solve' }" @click="tab = 'solve'">电压反推</button>
      </div>
    </div>
    <transition name="fade" mode="out-in">
      <EquivView v-if="tab === 'equiv'" key="equiv" />
      <SolveView v-else key="solve" />
    </transition>
  </div>
</template>
