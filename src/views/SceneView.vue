<script setup>
import CalcForm from '../components/CalcForm.vue'

defineProps({
  scene: { type: Object, required: true },
})
defineEmits(['back'])
</script>

<template>
  <div class="scene-view">
    <div class="topbar">
      <button class="btn back-btn" @click="$emit('back')">‹ 返回</button>
      <div class="scene-title">
        <span class="scene-icon">{{ scene.icon }}</span>
        <span class="scene-name">{{ scene.name }}</span>
      </div>
    </div>
    <div class="formula-bar">{{ scene.formula }}</div>
    <div class="panel calc-panel">
      <div class="section-title">输入参数</div>
      <CalcForm :scene="scene" />
    </div>
  </div>
</template>

<style scoped>
.scene-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.back-btn { font-size: 13px; padding: 7px 12px; }
.scene-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--neon);
  letter-spacing: 1px;
}
.scene-icon { font-size: 18px; }
.formula-bar {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--cyan);
  background: rgba(0, 229, 255, 0.05);
  border: 1px solid var(--cyan-dim);
  border-radius: 8px;
  padding: 8px 12px;
  letter-spacing: 0.5px;
  text-align: center;
}
.calc-panel { display: flex; flex-direction: column; gap: 10px; }
</style>
