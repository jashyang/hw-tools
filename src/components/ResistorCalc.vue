<script setup>
import { ref, reactive, computed } from 'vue'
import { parseResistor, formatOhms, formatVolt, formatAmp } from '../core/parse.js'
import { rowEquiv, networkEquiv, solveUnknownResistor } from '../core/network.js'

// ── 模式：等效电阻 / 分压电阻 ──
const mode = ref('equiv')

// ── 多行网络（每行：串/并 + 多个电阻） ──
let rowSeq = 0
function newRow() {
  return { id: ++rowSeq, mode: 'series', resistors: ['', ''] }
}
const rows = reactive([newRow()])

// ── 分压模式输入 ──
const vcc = ref('')
const v = ref('')
// 电压条件位置：row = 某行两端压降；node = 某节点对地（节点 i 在第 i 行之后，节点 0=Vcc 顶端）
const refType = ref('row')
const refIndex = ref(0)
// 待求电阻：{row, res} 指向 rows[row].resistors[res]；null = 未指定
const target = ref(null)

// ── 解析 ──
const parsedRows = computed(() =>
  rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    invalid: row.resistors.map((r) => r.trim() !== '' && parseResistor(r) === null),
    values: row.resistors.map((r) => parseResistor(r)),
  }))
)

// 有效行：至少一个有效电阻；行小计
const validRows = computed(() => {
  const out = []
  for (const row of parsedRows.value) {
    const resistors = row.values.filter((v) => v != null)
    if (!resistors.length) continue
    out.push({ id: row.id, mode: row.mode, resistors, invalid: row.invalid.some(Boolean) })
  }
  return out
})

// 行小计：直接接收原始行（resistors 为字符串数组），内部解析
const rowTotal = (row) => {
  const resistors = row.resistors.map((r) => parseResistor(r)).filter((v) => v != null)
  if (!resistors.length) return null
  const eq = rowEquiv(row.mode, resistors)
  return isFinite(eq) ? eq : null
}

// ── 结果 ──
const vccVal = computed(() => parseVolt(vcc.value))
const vVal = computed(() => parseVolt(v.value))
const vccInvalid = computed(() => vcc.value.trim() !== '' && vccVal.value === null)
const vInvalid = computed(() => v.value.trim() !== '' && vVal.value === null)

// 电压条件位置是否合法
const refValid = computed(() => {
  const n = rows.length
  if (refType.value === 'row') return refIndex.value >= 0 && refIndex.value < n
  return refIndex.value >= 1 && refIndex.value < n // node: 1..N-1（0=Vcc、N=GND 无意义）
})

// 当前电压条件文本（结果显示用）
const refLabel = computed(() => {
  if (refType.value === 'row') return `第 ${refIndex.value + 1} 行两端压降`
  return `节点 ${refIndex.value} 对地`
})

const result = computed(() => {
  if (mode.value === 'equiv') {
    if (!validRows.value.length) return null
    if (validRows.value.some((r) => r.invalid)) return { error: '有电阻值格式不对，示例：1k / 2.2k / 470' }
    const total = networkEquiv(validRows.value)
    if (!isFinite(total)) return { error: '计算失败，检查电阻值' }
    return {
      results: [
        { label: '等效电阻', value: formatOhms(total), note: `${validRows.value.length} 行网络，行间串联（各行等效值相加）` },
      ],
    }
  }
  // divider 模式
  if (!validRows.value.length) return { error: '请先填写电阻网络' }
  if (validRows.value.some((r) => r.invalid)) return { error: '有电阻值格式不对，示例：1k / 2.2k / 470' }
  if (vccInvalid.value || vInvalid.value) return { error: '电压格式不对，示例：12 / 5V' }
  if (vcc.value.trim() === '' || v.value.trim() === '') return { error: '请填写电源电压 Vcc 和给定电压 V' }
  if (!target.value) return { error: '请点一个电阻的「算」，把它设为待求 Rx' }
  if (!refValid.value) return { error: '电压条件位置无效' }

  // 构造求解输入：target 指向的电阻值为 null（未知），其余按输入解析
  const netRows = rows.map((row, i) => ({
    mode: row.mode,
    values: row.resistors.map((r, j) => {
      if (target.value && target.value.row === i && target.value.res === j) return null
      return parseResistor(r)
    }),
  }))
  // 校验：除 target 外无其他非法/缺失
  for (let i = 0; i < netRows.length; i++) {
    for (let j = 0; j < netRows[i].values.length; j++) {
      const val = netRows[i].values[j]
      if (val === null) continue // target
      if (val == null || !isFinite(val) || val <= 0) {
        const isTarget = target.value && target.value.row === i && target.value.res === j
        if (!isTarget) return { error: `第 ${i + 1} 行第 ${j + 1} 个电阻：请填写数值（示例 10k），或点「算」设为待求` }
      }
    }
  }
  const sol = solveUnknownResistor(netRows, vccVal.value, vVal.value, {
    type: refType.value,
    index: refIndex.value,
  })
  if (!sol) return { error: '无解：检查电压条件与电阻网络是否一致（V 需在 0~Vcc 之间且条件可达）' }
  const ratio = vVal.value / vccVal.value
  const current = vccVal.value / sol.rTotal
  return {
    results: [
      { label: '待求电阻 Rx', value: formatOhms(sol.rx), note: `「算」标记位置：第 ${target.value.row + 1} 行第 ${target.value.res + 1} 个` },
      { label: '总等效电阻', value: formatOhms(sol.rTotal) },
      { label: '回路电流', value: formatAmp(current) },
      { label: '电压条件', value: formatVolt(vVal.value), note: `${refLabel.value} = ${formatVolt(vVal.value)}（Vcc ${formatVolt(vccVal.value)} 的 ${(ratio * 100).toFixed(1)}%）` },
    ],
  }
})

// ── 行操作 ──
function addRow() { rows.push(newRow()) }
function removeRow(i) {
  if (rows.length <= 1) return
  rows.splice(i, 1)
  if (target.value && target.value.row === i) target.value = null
  else if (target.value && target.value.row > i) target.value = { ...target.value, row: target.value.row - 1 }
  // 修正 refIndex 越界
  if (refType.value === 'row' && refIndex.value >= rows.length) refIndex.value = rows.length - 1
  if (refType.value === 'node' && refIndex.value >= rows.length) refIndex.value = rows.length - 1
}
function addResistor(row) { row.resistors.push('') }
function removeResistor(row, j) {
  if (row.resistors.length <= 1) return
  row.resistors.splice(j, 1)
  if (target.value && target.value.row === rows.indexOf(row) && target.value.res === j) target.value = null
}

// 把某电阻设为待求（再次点击取消）
function setTarget(row, j) {
  if (target.value && target.value.row === row && target.value.res === j) {
    target.value = null
    return
  }
  target.value = { row, res: j }
  rows[row].resistors[j] = '' // 清空输入，?Ω 占位
}

// 该电阻是否为待求
function isTarget(row, j) {
  return !!target.value && target.value.row === row && target.value.res === j
}

// ── 复制 ──
const copied = ref(false)
async function copyResult() {
  if (!result.value || result.value.error) return
  const lines = result.value.results.map((r) => `${r.label}: ${r.value}${r.note ? '（' + r.note + '）' : ''}`)
  const text = `电阻计算（${mode.value === 'equiv' ? '等效电阻' : '分压反推'}）\n${lines.join('\n')}`
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* 忽略 */ }
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="resistor-calc">
    <!-- 模式单选 -->
    <div class="mode-seg">
      <button class="mode-btn" :class="{ on: mode === 'equiv' }" @click="mode = 'equiv'">等效电阻</button>
      <button class="mode-btn" :class="{ on: mode === 'divider' }" @click="mode = 'divider'">分压电阻</button>
    </div>

    <!-- 分压模式：电压输入 -->
    <div v-if="mode === 'divider'" class="divider-inputs">
      <div class="field">
        <label class="field-label"><span class="fname">电源电压 Vcc</span><span class="funit">V</span></label>
        <input v-model="vcc" type="text" inputmode="decimal" class="field-input" :class="{ invalid: vccInvalid }" placeholder="如 12" autocomplete="off" spellcheck="false" />
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">给定电压 V</span><span class="funit">V</span></label>
        <input v-model="v" type="text" inputmode="decimal" class="field-input" :class="{ invalid: vInvalid }" placeholder="如 5" autocomplete="off" spellcheck="false" />
      </div>
      <!-- 电压条件位置 -->
      <div class="field ref-field">
        <label class="field-label"><span class="fname">电压位置</span></label>
        <div class="ref-row">
          <div class="seg">
            <button class="seg-btn" :class="{ on: refType === 'row' }" @click="refType = 'row'">行两端</button>
            <button class="seg-btn" :class="{ on: refType === 'node' }" @click="refType = 'node'; refIndex = 1">节点对地</button>
          </div>
          <select v-model.number="refIndex" class="ref-select" :class="{ invalid: !refValid }">
            <template v-if="refType === 'row'">
              <option v-for="i in rows.length" :key="i" :value="i - 1">第 {{ i }} 行</option>
            </template>
            <template v-else>
              <option v-for="i in rows.length - 1" :key="i" :value="i">节点 {{ i }}</option>
            </template>
          </select>
        </div>
        <div class="ref-hint">行两端 = 该行压降；节点 i 对地 = 第 i 行之后到 GND 的电压</div>
      </div>
    </div>

    <!-- 多行网络 -->
    <div class="network">
      <div class="section-title">电阻网络（行内合并 → 行间串联）</div>
      <div v-for="(row, i) in rows" :key="row.id" class="net-row">
        <div class="row-head">
          <div class="seg">
            <button class="seg-btn" :class="{ on: row.mode === 'series' }" @click="row.mode = 'series'">串联</button>
            <button class="seg-btn" :class="{ on: row.mode === 'parallel' }" @click="row.mode = 'parallel'">并联</button>
          </div>
          <span class="row-tag">第 {{ i + 1 }} 行</span>
          <span class="row-total" :class="{ ok: rowTotal(row) != null }">
            {{ rowTotal(row) != null ? '= ' + formatOhms(rowTotal(row)) : '' }}
          </span>
          <button class="btn danger sm row-del" :disabled="rows.length <= 1" @click="removeRow(i)">✕</button>
        </div>
        <div class="row-resistors">
          <div v-for="(r, j) in row.resistors" :key="j" class="r-input">
            <input
              v-model="row.resistors[j]"
              type="text"
              inputmode="decimal"
              class="field-input"
              :class="{ invalid: parsedRows[i].invalid[j], target: isTarget(i, j) }"
              :placeholder="isTarget(i, j) ? '?Ω' : '如 10k'"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              v-if="mode === 'divider'"
              class="btn cyan sm r-calc"
              :class="{ on: isTarget(i, j) }"
              :title="isTarget(i, j) ? '取消待求' : '设为待求 Rx'"
              @click="setTarget(i, j)"
            >{{ isTarget(i, j) ? '✓' : '算' }}</button>
            <button v-if="row.resistors.length > 1" class="btn danger sm r-del" @click="removeResistor(row, j)">✕</button>
          </div>
          <button class="btn cyan sm r-add" @click="addResistor(row)">＋</button>
        </div>
      </div>
      <button class="btn cyan sm row-add" @click="addRow">＋ 添加一行</button>
    </div>

    <!-- 结果 -->
    <div v-if="result" class="result-panel">
      <div v-if="result.error" class="result-error">⚠ {{ result.error }}</div>
      <template v-else>
        <div v-for="(res, i) in result.results" :key="i" class="result-row">
          <span class="result-label">{{ res.label }}</span>
          <span class="result-value led">{{ res.value }}</span>
          <span v-if="res.note" class="result-note">{{ res.note }}</span>
        </div>
        <button class="btn cyan copy-btn" @click="copyResult">{{ copied ? '✓ 已复制' : '⧉ 复制结果' }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.resistor-calc {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 模式单选（分段控件） */
.mode-seg {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.mode-btn {
  flex: 1;
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 8px 0;
  cursor: pointer;
  transition: all 0.18s;
}
.mode-btn.on {
  color: var(--neon);
  border-color: var(--neon-dim);
  background: rgba(0, 255, 159, 0.1);
  box-shadow: var(--glow-green);
}

/* 电压输入 */
.divider-inputs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.divider-inputs .field { flex: 1; min-width: 140px; }

/* 多行网络 */
.network {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.net-row {
  background: rgba(15, 21, 31, 0.6);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: row-in 0.25s ease;
}
.row-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.seg {
  display: flex;
  gap: 3px;
  background: var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px;
}
.seg-btn {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.seg-btn.on {
  color: var(--cyan);
  border-color: var(--cyan-dim);
  background: rgba(0, 229, 255, 0.12);
  text-shadow: var(--glow-cyan);
}
.row-tag {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 1px;
}
.row-total {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--dim);
}
.row-total.ok {
  color: var(--neon);
  text-shadow: var(--glow-green);
}
.row-del { flex-shrink: 0; width: 28px; }

/* 电压条件位置 */
.ref-field { flex-basis: 100%; }
.ref-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.ref-select {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--cyan);
  background: var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  outline: none;
}
.ref-select.invalid { border-color: #ff5c5c; color: #ff5c5c; }
.ref-hint {
  font-size: 11px;
  color: var(--dim);
  margin-top: 4px;
  line-height: 1.5;
}

/* 待求电阻输入框 + 「算」按钮 */
.field-input.target {
  border-color: var(--neon);
  color: var(--neon);
  box-shadow: var(--glow-green);
}
.r-calc { flex-shrink: 0; min-width: 30px; padding: 2px 4px; }
.r-calc.on {
  background: rgba(0, 255, 159, 0.15);
  border-color: var(--neon);
  color: var(--neon);
  box-shadow: var(--glow-green);
}

.row-resistors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.r-input {
  display: flex;
  gap: 4px;
  align-items: center;
  flex: 1;
  min-width: 130px;
  max-width: 240px;
}
.r-input .field-input { flex: 1; }
.r-del { flex-shrink: 0; width: 26px; padding: 2px 0; }
.r-add { flex-shrink: 0; }
.row-add { align-self: flex-start; }

@keyframes row-in {
  from { opacity: 0; transform: translateY(-4px); border-color: var(--neon-dim); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
