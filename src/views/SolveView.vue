<script setup>
import { ref, reactive, computed } from 'vue'
import ResistorTree from '../components/ResistorTree.vue'
import LedDisplay from '../components/LedDisplay.vue'
import { hasUnknown, allKnown } from '../core/simplify.js'
import { solveUnknownWithVin, collectSeams } from '../core/solve.js'
import { parseResistor, formatOhms, formatVolt, formatAmp } from '../core/parse.js'

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

const vin = ref('5')
const markSeamId = ref(null) // 正在标记的缝
const markVolt = ref('')
const constraint = ref(null) // { seamId, v } 求解约束
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
  if (unknownList.value.length === 0) { error.value = '请先标记一个未知电阻（点电阻上的「未知」按钮）'; return }
  if (unknownList.value.length > 1) { error.value = '只能有一个未知电阻，请取消其他标记'; return }
  if (!constraint.value) { error.value = '请点击电路连线上的 ● 焊盘，设置目标节点电压'; return }
  if (allKnown(root)) { error.value = '未知电阻未标记为「未知」但已有阻值？请检查'; return }

  // 定位未知电阻 id
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
      // 细节表
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
  <div class="solve-view">
    <div class="panel">
      <div class="section-title">场景 2 · 给定节点电压反推电阻</div>

      <div class="vin-row">
        <label>VIN 输入电压</label>
        <input v-model="vin" type="text" class="vin-input" placeholder="如 5 / 12 / 3.3" />
        <span class="unit">V</span>
      </div>

      <div class="guide">
        <div class="guide-line">① 把要求解的电阻点成 <span class="tag amber">未知</span></div>
        <div class="guide-line">② 点击连线上的 <span class="tag green">●</span> 焊盘，输入该点目标电压</div>
        <div class="guide-line">③ 点击 <span class="tag cyan">SOLVE</span> 反推阻值</div>
      </div>

      <ResistorTree :node="root" :seam-mode="true" @mark-seam="onMarkSeam" />
    </div>

    <!-- 缝标记面板 -->
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

    <!-- 约束与求解 -->
    <div class="action-row">
      <div class="constraint" v-if="constraint">
        <span class="led cyan">约束: {{ constraint.seamId }} = {{ constraint.v }}V</span>
        <button class="btn sm danger" @click="clearMark">×</button>
      </div>
      <button class="btn solve-btn" :disabled="solving" @click="solve">
        {{ solving ? 'SOLVING…' : '▶ SOLVE' }}
      </button>
    </div>

    <div v-if="error" class="error-box">⚠ {{ error }}</div>

    <!-- 结果 -->
    <div v-if="result" class="result-area">
      <LedDisplay
        label="R? 未知电阻"
        :value="formatOhms(result.ohms)"
        tone="green"
      />
      <div class="verify-box">
        <span class="led cyan">✓ VERIFIED</span>
        <span class="verify-text">
          {{ constraint.seamId }} 实际 {{ formatVolt(result.voltage) }}
          （偏差 {{ formatVolt(Math.abs(result.errorV)) }}）
        </span>
      </div>

      <div class="panel" v-if="resultDetail">
        <div class="section-title">元件电流 / 功耗</div>
        <div class="detail-table">
          <div class="drow head">
            <span>元件</span><span>阻值</span><span>端电压</span><span>电流</span><span>功耗</span>
          </div>
          <div v-for="row in resultDetail" :key="row.label" class="drow">
            <span class="led cyan">{{ row.label }}</span>
            <span>{{ formatOhms(row.ohms) }}</span>
            <span>{{ formatVolt(row.v) }}</span>
            <span>{{ formatAmp(row.i) }}</span>
            <span :class="{ 'hot': row.p > 0.25 }">{{ (row.p * 1000).toPrecision(3) }} mW</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.solve-view { display: flex; flex-direction: column; gap: 14px; }
.vin-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.vin-input { max-width: 140px; }
.unit { font-family: var(--mono); color: var(--dim); font-size: 13px; }
.guide {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--dim);
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  line-height: 1.9;
}
.tag { padding: 0 4px; border-radius: 3px; }
.tag.amber { color: var(--amber); background: var(--amber-dim); }
.tag.green { color: var(--neon); background: var(--neon-dim); }
.tag.cyan { color: var(--cyan); background: var(--cyan-dim); }
.mark-panel { border-color: var(--cyan-dim); }
.mark-row { display: flex; align-items: center; gap: 8px; }
.mark-row input { max-width: 160px; }
.action-row { display: flex; align-items: center; gap: 10px; }
.constraint {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px;
  padding: 6px 10px;
  border: 1px solid var(--cyan-dim);
  border-radius: 6px;
  background: rgba(0,229,255,0.04);
}
.solve-btn { flex: 1; padding: 10px; font-size: 14px; letter-spacing: 4px; }
.error-box {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--red);
  border: 1px solid rgba(255,59,48,0.4);
  background: rgba(255,59,48,0.05);
  border-radius: 6px;
  padding: 8px 10px;
}
.result-area { display: flex; flex-direction: column; gap: 10px; }
.verify-box {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--mono);
  font-size: 12px;
  padding: 8px 12px;
  border: 1px solid var(--neon-dim);
  border-radius: 6px;
  background: rgba(0,255,159,0.04);
  animation: pulse-glow 2s infinite;
}
.verify-text { color: var(--text); }
.detail-table { display: flex; flex-direction: column; gap: 2px; }
.drow {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr;
  gap: 6px;
  font-family: var(--mono);
  font-size: 11px;
  padding: 4px 6px;
  border-bottom: 1px dashed var(--border);
}
.drow.head { color: var(--dim); font-size: 10px; letter-spacing: 1px; }
.drow .hot { color: var(--amber); }
</style>
