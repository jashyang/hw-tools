<script setup>
import CalcForm from '../components/CalcForm.vue'
import ResistorCalc from '../components/ResistorCalc.vue'
import FlybackCalc from '../components/FlybackCalc.vue'
import { computed } from 'vue'

const props = defineProps({
  scene: { type: Object, required: true },
})

const isFlyback = computed(() => props.scene.id === 'flyback')
const formulaText = computed(() => isFlyback.value ? '公式说明' : (props.scene.formula || ''))

function onFormulaBar() {
  if (isFlyback.value) {
    document.dispatchEvent(new CustomEvent('hwtools:open-formula'))
  }
}
</script>

<template>
  <div class="scene-view">
    <div class="scene-head">
      <span class="scene-icon">{{ scene.icon }}</span>
      <span class="scene-name">{{ scene.name }}</span>
      <span class="scene-desc">{{ scene.desc }}</span>
    </div>
    <div class="formula-bar" @click="onFormulaBar" :title="isFlyback ? '点击查看公式说明' : ''"><span class="prompt">?</span> {{ formulaText }}</div>
    <div class="panel calc-panel">
      <div v-if="scene.component !== 'flyback'" class="section-title">输入参数</div>
      <!-- 自定义组件优先 -->
      <ResistorCalc v-if="scene.component === 'resistor'" />
      <FlybackCalc v-else-if="scene.component === 'flyback'" />
      <CalcForm v-else :scene="scene" />
    </div>
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
</style>
