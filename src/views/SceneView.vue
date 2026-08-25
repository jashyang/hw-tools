<script setup>
import CalcForm from '../components/CalcForm.vue'
import ResistorCalc from '../components/ResistorCalc.vue'

defineProps({
  scene: { type: Object, required: true },
})
</script>

<template>
  <div class="scene-view">
    <div class="scene-head">
      <span class="scene-icon">{{ scene.icon }}</span>
      <span class="scene-name">{{ scene.name }}</span>
      <span class="scene-desc">{{ scene.desc }}</span>
    </div>
    <div class="formula-bar"><span class="prompt">$</span> {{ scene.formula }}</div>
    <div class="panel calc-panel">
      <div class="section-title">输入参数</div>
      <!-- 自定义组件（如电阻计算）优先，其余走通用表单 -->
      <ResistorCalc v-if="scene.component === 'resistor'" />
      <CalcForm v-else :scene="scene" />
    </div>
  </div>
</template>

<style scoped>
.scene-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  background: var(--bg-deep);
  border: 1px solid var(--cyan-dim);
  border-radius: 8px;
  padding: 9px 14px;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.formula-bar .prompt {
  color: var(--neon);
  font-weight: 700;
}
.calc-panel { display: flex; flex-direction: column; gap: 10px; }
</style>
