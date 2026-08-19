<script setup>
// LED 数码管读数：value 已格式化字符串
defineProps({
  label: { type: String, default: '' },
  value: { type: String, default: '—' },
  tone: { type: String, default: 'green' }, // green | cyan | amber | dim
  big: { type: Boolean, default: true },
})
</script>

<template>
  <div class="led-display">
    <div class="led-label">{{ label }}</div>
    <div class="led" :class="[tone, { big }]">{{ value }}</div>
  </div>
</template>

<style scoped>
.led-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-align: center;
}
.led-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--dim);
}
</style>
