<script setup>
import { ref, computed } from 'vue'
import PinLock from './components/PinLock.vue'
import CircuitBg from './components/CircuitBg.vue'
import SceneView from './views/SceneView.vue'
import { CATEGORIES, sceneById } from './core/scenes.js'

const UNLOCK_KEY = 'hw-tools-unlock-until'
const UNLOCK_TTL = 24 * 3600 * 1000 // 24 小时

const unlocked = ref(false)
const currentId = ref('ohm') // 默认选中第一个场景
const navOpen = ref(false) // 移动端侧栏展开

// 初始化：读取 localStorage 解锁时间戳
const saved = Number(localStorage.getItem(UNLOCK_KEY) || 0)
if (saved > Date.now()) unlocked.value = true

function onUnlock() {
  unlocked.value = true
  localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_TTL))
}

function selectScene(id) {
  currentId.value = id
  navOpen.value = false
}

const currentCatName = computed(() => {
  const cat = CATEGORIES.find((c) => c.items.includes(currentId.value))
  return cat ? cat.name : ''
})
</script>

<template>
  <PinLock v-if="!unlocked" @unlock="onUnlock" />

  <template v-else>
    <CircuitBg />
    <div class="layout">
    <!-- 移动端遮罩 -->
    <div v-if="navOpen" class="nav-mask" @click="navOpen = false"></div>

    <!-- 左侧分类导航 -->
    <aside class="sidebar" :class="{ open: navOpen }">
      <div class="side-logo" @click="currentId = 'ohm'">
        <span class="chip"></span>HW-TOOLS
      </div>
      <nav class="side-nav">
        <div v-for="cat in CATEGORIES" :key="cat.id" class="cat-group">
          <div class="cat-name">{{ cat.icon }} {{ cat.name }}</div>
          <button
            v-for="id in cat.items"
            :key="id"
            class="nav-item"
            :class="{ active: currentId === id }"
            @click="selectScene(id)"
          >
            {{ sceneById[id].name }}
          </button>
        </div>
      </nav>
      <div class="side-foot">HW-TOOLS v0.2 · CIRCUIT CALC</div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="main">
      <header class="term-bar">
        <button class="hamburger" @click="navOpen = !navOpen">☰</button>
        <span class="term-path">~/{{ currentCatName }}/{{ sceneById[currentId].name }}</span>
        <span class="term-status"><i class="dot"></i> AUTH OK</span>
      </header>
      <SceneView :key="currentId" :scene="sceneById[currentId]" />
    </main>
    </div>
  </template>
</template>
