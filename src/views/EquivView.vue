<script setup>
import { ref, reactive, computed } from 'vue'
import CircuitView from '../components/CircuitView.vue'
import LedDisplay from '../components/LedDisplay.vue'
import { equivR, simplify, allKnown } from '../core/simplify.js'
import { formatOhms } from '../core/parse.js'

// 初始示例：三电阻并联（主场景，垂直电路图）
const root = reactive({
  type: 'group',
  id: 'root',
  mode: 'parallel',
  folded: false,
  children: [
    { type: 'res', id: 'r1', label: 'R1', raw: '1k', ohms: 1000, unknown: false },
    { type: 'res', id: 'r2', label: 'R2', raw: '2.2k', ohms: 2200, unknown: false },
    { type: 'res', id: 'r3', label: 'R3', raw: '4.7k', ohms: 4700, unknown: false },
  ],
})

const result = computed(() => {
  if (!allKnown(root)) return null
  const steps = []
  const R = simplify(root, steps)
  return { R, steps }
})
</script>

<template>
  <div class="equiv-view">
    <div class="panel">
      <div class="section-title">场景 1 · 等效电阻</div>
      <div class="hint-line">点电阻改值 · 点组折叠/切换串并联 · 底部面板操作</div>
      <CircuitView :node="root" :seam-mode="false" />
    </div>

    <div class="result-area">
      <LedDisplay
        label="REQ 等效电阻"
        :value="result ? formatOhms(result.R) : '—'"
        :tone="result ? 'green' : 'amber'"
      />
      <div v-if="!result" class="hint led amber">⚠ 存在未填阻值或非法输入</div>
    </div>

    <div class="panel" v-if="result && result.steps.length">
      <div class="section-title">化简过程</div>
      <div class="steps">
        <div v-for="(s, i) in result.steps" :key="i" class="step-row">
          <span class="step-op">{{ s.mode === 'series' ? '⊕ 串' : '∥ 并' }}</span>
          <span class="step-text">{{ s.text }}</span>
          <span class="step-val led cyan">= {{ formatOhms(s.ohms) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equiv-view { display: flex; flex-direction: column; gap: 14px; }
.hint-line { font-family: var(--mono); font-size: 11px; color: var(--dim); margin-bottom: 8px; }
.result-area { display: flex; flex-direction: column; gap: 6px; }
.hint { font-size: 12px; text-align: center; font-family: var(--mono); }
.steps { display: flex; flex-direction: column; gap: 4px; }
.step-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--mono);
  font-size: 12px;
  padding: 5px 8px;
  border-bottom: 1px dashed var(--border);
}
.step-op { color: var(--dim); min-width: 40px; }
.step-text { color: var(--text); flex: 1; overflow-x: auto; white-space: nowrap; }
.step-val { font-size: 12px; }
</style>
