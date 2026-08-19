<script setup>
import { ref, reactive, computed } from 'vue'
import CircuitView from '../components/CircuitView.vue'
import CircuitPalette from '../components/CircuitPalette.vue'
import RightPanel from '../components/RightPanel.vue'
import LedDisplay from '../components/LedDisplay.vue'
import { useCircuit } from '../composables/useCircuit.js'
import { allKnown } from '../core/simplify.js'
import { solveUnknownWithVin } from '../core/solve.js'
import { formatOhms, formatVolt, formatAmp } from '../core/parse.js'

// 初始示例：分压 + 并联混合
const root = reactive({
  type: 'group',
  id: 'root',
  mode: 'series',
  folded: false,
  children: [
    { type: 'res', id: 'r1', label: 'R1', raw: '1k', ohms: 1000, unknown: false },
    {
      type: 'group',
      id: 'g1',
      mode: 'parallel',
      folded: false,
      children: [
        { type: 'res', id: 'r2', label: 'R2', raw: '', ohms: null, unknown: true },
        { type: 'res', id: 'r3', label: 'R3', raw: '4.7k', ohms: 4700, unknown: false },
      ],
    },
    { type: 'res', id: 'r4', label: 'R4', raw: '10k', ohms: 10000, unknown: false },
  ],
})

const ops = useCircuit(root)

const vin = ref('5')
const markSeamId = ref(null)
const markVolt = ref('')
const constraint = ref(null)
const solving = ref(false)
const result = ref(null)
const error = ref('')
const resultDetail = ref(null)

const unknownList = computed(() => {
  const out = []
  ;(function walk(n) {
    if (n.type === 'res' && n.unknown) out.push(n.label || n.id)
    else if (n.type === 'group') n.children.forEach(walk)
  })(root)
  return out
})

function onMarkSeam(id) {
  markSeamId.value = id
  markVolt.value = constraint.value && constraint.value.seamId === id ? String(constraint.value.v) : ''
}

function confirmMark() {
  const v = parseFloat(markVolt.value)
  if (isNaN(v) || v < 0) return
  constraint.value = { seamId: markSeamId.value, v }
  markSeamId.value = null
}

function clearMark() {
  constraint.value = null
  markSeamId.value = null
}

function solve() {
  error.value = ''
  result.value = null
  resultDetail.value = null

  const vIn = parseFloat(vin.value)
  if (isNaN(vIn) || vIn <= 0) { error.value = '请输入有效输入电压 Vin'; return }
  if (unknownList.value.length === 0) { error.value = '请先标记一个未知电阻（点电阻 → 右侧面板「标未知」）'; return }
  if (unknownList.value.length > 1) { error.value = '只能有一个未知电阻，请取消其他标记'; return }
  if (!constraint.value) { error.value = '请点击导线上的 ● 节点，设置目标电压'; return }

  let unkId = null
  ;(function walk(n) {
    if (n.type === 'res' && n.unknown) unkId = n.id
    else if (n.type === 'group') n.children.forEach(walk)
  })(root)

  solving.value = true
  try {
    const r = solveUnknownWithVin(root, constraint.value.seamId, constraint.value.v, unkId, vIn)
    if (r.error) {
      error.value = r.error
    } else {
      result.value = r
      const rows = []
      ;(function walk(n) {
        if (n.type === 'res') {
          const e = r.elems.get(n.id)
          if (e) rows.push({ label: n.label || n.id, ohms: n.ohms, ...e })
        } else n.children.forEach(walk)
      })(root)
      resultDetail.value = rows
    }
  } catch (e) {
    error.value = '求解异常: ' + e.message
  } finally {
    solving.value = false
  }
}
</script>

<template>
  <div class="workspace">
    <aside class="side-left">
      <CircuitPalette :node="root" :ops="ops" />

      <div class="panel ctrl-box">
        <div class="section-title">电源 / 约束</div>
        <div class="ctrl-row">
          <label>VIN</label>
          <input v-model="vin" type="text" class="ctrl-input" placeholder="如 5" />
          <span class="unit">V</span>
        </div>
        <div class="ctrl-hint">
          ① 点电阻 → 右侧「标未知」<br />
          ② 点导线 ● 设目标电压<br />
          ③ SOLVE
        </div>
        <div class="constraint" v-if="constraint">
          <span class="led cyan">{{ constraint.seamId }} = {{ constraint.v }}V</span>
          <button class="btn sm danger" @click="clearMark">×</button>
        </div>
        <button class="btn solve-btn" :disabled="solving" @click="solve">
          {{ solving ? 'SOLVING…' : '▶ SOLVE' }}
        </button>
        <div v-if="error" class="error-box">⚠ {{ error }}</div>
      </div>
    </aside>

    <main class="canvas-mid">
      <CircuitView :node="root" :ops="ops" :seam-mode="true" @mark-seam="onMarkSeam" />
    </main>

    <aside class="side-right">
      <RightPanel :ops="ops" :seam-mode="true">
        <div v-if="result" class="result-stack">
          <LedDisplay label="R? 未知电阻" :value="formatOhms(result.ohms)" tone="green" />
          <div class="verify-box">
            <span class="led cyan">✓ VERIFIED</span>
            <span class="verify-text">{{ constraint.seamId }} 实际 {{ formatVolt(result.voltage) }}（偏差 {{ formatVolt(Math.abs(result.errorV)) }}）</span>
          </div>
          <div class="detail-table panel" v-if="resultDetail">
            <div class="section-title">元件电流 / 功耗</div>
            <div class="drow head"><span>元件</span><span>阻值</span><span>电流</span><span>功耗</span></div>
            <div v-for="row in resultDetail" :key="row.label" class="drow">
              <span class="led cyan">{{ row.label }}</span>
              <span>{{ formatOhms(row.ohms) }}</span>
              <span>{{ formatAmp(row.i) }}</span>
              <span :class="{ 'hot': row.p > 0.25 }">{{ (row.p * 1000).toPrecision(3) }} mW</span>
            </div>
          </div>
        </div>
      </RightPanel>

      <transition name="fade">
        <div v-if="markSeamId" class="panel mark-panel">
          <div class="section-title">节点电压 · {{ markSeamId }}</div>
          <div class="mark-row">
            <input v-model="markVolt" type="text" placeholder="目标电压，如 2" />
            <span class="unit">V</span>
            <button class="btn" @click="confirmMark">确认</button>
            <button class="btn danger sm" @click="clearMark">清除</button>
          </div>
        </div>
      </transition>
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
.side-left {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.canvas-mid { flex: 1; min-width: 0; }
.side-right {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ctrl-box { display: flex; flex-direction: column; gap: 10px; }
.ctrl-row { display: flex; align-items: center; gap: 8px; }
.ctrl-row label { flex-shrink: 0; }
.ctrl-input { max-width: 90px; }
.unit { font-family: var(--mono); color: var(--dim); font-size: 12px; }
.ctrl-hint {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--dim);
  line-height: 1.8;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 6px 8px;
}
.constraint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid var(--cyan-dim);
  border-radius: 6px;
  background: rgba(0, 229, 255, 0.04);
}
.solve-btn { width: 100%; padding: 9px; font-size: 13px; letter-spacing: 3px; }
.error-box {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--red);
  border: 1px solid rgba(255, 59, 48, 0.4);
  background: rgba(255, 59, 48, 0.05);
  border-radius: 6px;
  padding: 6px 8px;
}
.result-stack { display: flex; flex-direction: column; gap: 10px; }
.verify-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--mono);
  font-size: 11px;
  padding: 8px 12px;
  border: 1px solid var(--neon-dim);
  border-radius: 6px;
  background: rgba(0, 255, 159, 0.04);
  animation: pulse-glow 2s infinite;
}
.verify-text { color: var(--text); }
.detail-table { display: flex; flex-direction: column; gap: 2px; }
.drow {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr;
  gap: 6px;
  font-family: var(--mono);
  font-size: 10px;
  padding: 3px 4px;
  border-bottom: 1px dashed var(--border);
}
.drow.head { color: var(--dim); font-size: 9px; letter-spacing: 1px; }
.drow .hot { color: var(--amber); }
.mark-panel { border-color: var(--cyan-dim); }
.mark-row { display: flex; align-items: center; gap: 8px; }
.mark-row input { max-width: 130px; }

@media (max-width: 900px) {
  .workspace { flex-direction: column; height: auto; }
  .side-left { width: 100%; }
  .canvas-mid { min-height: 420px; }
  .side-right { width: 100%; }
}
</style>
