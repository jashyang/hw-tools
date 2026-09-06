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
