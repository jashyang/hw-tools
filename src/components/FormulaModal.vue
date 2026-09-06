<script setup>
defineProps({
  steps: { type: Array, required: true },
  title: { type: String, default: '公式推导' },
})

const emit = defineEmits(['close'])
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <span>{{ title }}</span>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div v-for="(step, idx) in steps" :key="idx" class="step-block">
          <h4>{{ step.title }}</h4>
          <pre class="step-lines">{{ step.lines.join('\n') }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.modal-content {
  background: rgba(15, 21, 31, 0.95);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid var(--cyan-dim);
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 0 40px rgba(0, 255, 159, 0.1);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 14px;
  color: var(--neon);
}
.modal-close {
  background: transparent;
  border: none;
  color: var(--dim);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.modal-close:hover {
  color: var(--red);
  background: rgba(194, 91, 91, 0.12);
}
.modal-body {
  padding: 20px;
}
.step-block {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px dashed var(--border);
}
.step-block:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.step-block h4 {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--cyan);
  margin: 0 0 12px 0;
  letter-spacing: 0.5px;
}
.step-lines {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text);
  white-space: pre-wrap;
  margin: 0;
  padding: 0;
}
</style>
