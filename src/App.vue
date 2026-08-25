<script setup>
import { ref } from 'vue'
import PinLock from './components/PinLock.vue'
import SceneView from './views/SceneView.vue'
import { scenes } from './core/scenes.js'

const UNLOCK_KEY = 'hw-tools-unlock-until'
const UNLOCK_TTL = 24 * 3600 * 1000 // 24 小时

const unlocked = ref(false)
const currentScene = ref(null)

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
    <!-- 场景页 -->
    <SceneView
      v-if="currentScene"
      :key="currentScene.id"
      :scene="currentScene"
      @back="currentScene = null"
    />

    <!-- 首页：场景卡片 -->
    <template v-else>
      <div class="topbar">
        <div class="logo"><span class="chip"></span>HW-TOOLS</div>
        <div class="tag">CIRCUIT CALC</div>
      </div>
      <div class="section-title">选择场景</div>
      <div class="scene-grid">
        <button
          v-for="s in scenes"
          :key="s.id"
          class="scene-card"
          @click="currentScene = s"
        >
          <span class="card-icon">{{ s.icon }}</span>
          <span class="card-name">{{ s.name }}</span>
          <span class="card-desc">{{ s.desc }}</span>
        </button>
      </div>
    </template>
  </div>
</template>
