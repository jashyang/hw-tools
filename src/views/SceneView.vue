<script setup>
import { ref, computed } from 'vue'
import CalcForm from '../components/CalcForm.vue'
import ResistorCalc from '../components/ResistorCalc.vue'
import FlybackCalc from '../components/FlybackCalc.vue'
import FormulaModal from '../components/FormulaModal.vue'

const props = defineProps({
  scene: { type: Object, required: true },
})

const isFlyback = computed(() => props.scene.id === 'flyback')
const formulaText = computed(() => isFlyback.value ? '公式说明' : (props.scene.formula || ''))

// ── 通用公式弹窗（非 flyback 场景） ──
const showModal = ref(false)

async function openModal() {
  if (isFlyback.value) {
    document.dispatchEvent(new CustomEvent('hwtools:open-formula'))
    return
  }
  if (!props.scene.derivation) return
  showModal.value = true
}
</script>

<template>
  <div class="scene-view">
    <div class="scene-head">
      <span class="scene-icon">{{ scene.icon }}</span>
      <span class="scene-name">{{ scene.name }}</span>
      <span class="scene-desc">{{ scene.desc }}</span>
    </div>
    <div class="formula-bar" @click="openModal" :title="isFlyback ? '点击查看公式说明' : (scene.derivation ? '点击查看公式推导' : '')">
      <span class="prompt">?</span> {{ formulaText }}
    </div>
    <div class="panel calc-panel">
      <div v-if="scene.component !== 'flyback'" class="section-title">输入参数</div>
      <!-- 自定义组件优先 -->
      <ResistorCalc v-if="scene.component === 'resistor'" />
      <FlybackCalc v-else-if="scene.component === 'flyback'" />
      <CalcForm v-else :scene="scene" />
    </div>
    <!-- 通用公式弹窗（非 flyback 场景有 derivation 时显示） -->
    <Transition name="fade">
      <FormulaModal
        v-if="!isFlyback && showModal && scene.derivation"
        :steps="scene.derivation"
        :title="`${scene.name} · 公式推导`"
        @close="showModal = false"
      />
    </Transition>
  </div>
</template>

<style scoped>
.scene-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}
.scene-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.scene-icon { font-size: 20px; }
.scene-name {
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 700;
  color: var(--neon);
  letter-spacing: 1px;
  text-shadow: var(--glow-green);
}
.scene-desc {
  font-size: 12px;
  color: var(--dim);
}
.formula-bar {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--cyan);
  background: rgba(6, 9, 15, 0.5);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid var(--cyan-dim);
  border-radius: 8px;
  padding: 9px 14px;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
}
.formula-bar[title] {
  cursor: pointer;
}
.formula-bar .prompt {
  color: var(--neon);
  font-weight: 700;
}
.calc-panel { display: flex; flex-direction: column; gap: 10px; flex: 1; }

/* 公式弹窗淡入淡出动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
