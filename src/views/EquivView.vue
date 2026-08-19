<script setup>
import { reactive, computed } from 'vue'
import CircuitView from '../components/CircuitView.vue'
import CircuitPalette from '../components/CircuitPalette.vue'
import RightPanel from '../components/RightPanel.vue'
import LedDisplay from '../components/LedDisplay.vue'
import { useCircuit } from '../composables/useCircuit.js'
import { equivR, simplify, allKnown } from '../core/simplify.js'
import { formatOhms } from '../core/parse.js'

// 初始示例：三电阻并联
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

const ops = useCircuit(root)

const result = computed(() => {
  if (!allKnown(root)) return null
  const steps = []
  const R = simplify(root, steps)
  return { R, steps }
})
</script>

<template>
  <div class="workspace">
    <aside class="side-left">
      <CircuitPalette :node="root" :ops="ops" />
    </aside>

    <main class="canvas-mid">
      <CircuitView :node="root" :ops="ops" :seam-mode="false" />
    </main>

    <aside class="side-right">
      <RightPanel :ops="ops" :seam-mode="false">
        <LedDisplay label="REQ 等效电阻" :value="result ? formatOhms(result.R) : '—'" :tone="result ? 'green' : 'amber'" />
        <div v-if="!result" class="hint led amber">⚠ 存在未填阻值或非法输入</div>
        <div v-if="result && result.steps.length" class="steps panel">
          <div class="section-title">化简过程</div>
          <div v-for="(s, i) in result.steps" :key="i" class="step-row">
            <span class="step-op">{{ s.mode === 'series' ? '⊕串' : '∥并' }}</span>
            <span class="step-text">{{ s.text }}</span>
            <span class="step-val led cyan">= {{ formatOhms(s.ohms) }}</span>
          </div>
        </div>
      </RightPanel>
    </aside>
  </div>
</template>

<style scoped>
.workspace {
  display: flex;
  gap: 12px;
  height: calc(100vh - 64px);
  align-items: stretch;
}
.side-left { width: 170px; flex-shrink: 0; overflow-y: auto; }
.canvas-mid { flex: 1; min-width: 0; }
.side-right {
  width: 270px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hint { font-size: 12px; text-align: center; font-family: var(--mono); }
.steps { display: flex; flex-direction: column; gap: 4px; }
.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  padding: 4px 6px;
  border-bottom: 1px dashed var(--border);
}
.step-op { color: var(--dim); min-width: 36px; flex-shrink: 0; }
.step-text { color: var(--text); flex: 1; overflow-x: auto; white-space: nowrap; }
.step-val { font-size: 11px; flex-shrink: 0; }

@media (max-width: 900px) {
  .workspace { flex-direction: column; height: auto; }
  .side-left { width: 100%; display: flex; gap: 8px; }
  .canvas-mid { min-height: 420px; }
  .side-right { width: 100%; }
}
</style>
