<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { parseResistor, formatOhms, formatVolt, formatAmp, parseVolt } from '../core/parse.js'
import { rowEquiv, networkEquiv, solveVoltagePoints } from '../core/network.js'

// ── 模式：等效电阻 / 分压电阻 ──
const mode = ref('equiv')

// 切到分压模式：自动保证至少 2 行（分压最小结构 = 上臂+下臂，电压点在中间）
watch(mode, (m) => {
  if (m === 'divider' && rows.length < 2) rows.push(newRow())
})

// ── 多行网络（每行：串/并 + 多个电阻） ──
let rowSeq = 0
function newRow() {
  return { id: ++rowSeq, mode: 'series', resistors: ['', ''] }
}
const rows = reactive([newRow()])

// ── 分压模式输入 ──
const vcc = ref('') // 可选：填了作为顶部电压点（节点0）；不填则用 ≥2 个电压点反推
// 电压点：{ [index]: 电压字符串 }，index=节点位置（第 index 行之后，1..N-1；0=Vcc 顶端不可设）
const pointVals = reactive({ 1: '' })
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
const vccInvalid = computed(() => vcc.value.trim() !== '' && vccVal.value === null)

// 电压点解析与校验（pointVals: {index: 电压字符串}）
const pointEntries = computed(() =>
  Object.entries(pointVals).map(([index, v]) => ({
    index: Number(index),
    v: parseVolt(v),
    raw: v,
    invalid: v.trim() !== '' && parseVolt(v) === null,
    empty: v.trim() === '',
  }))
)
// 有效电压点（填了电压的）
const validPoints = computed(() => pointEntries.value.filter((p) => !p.empty && !p.invalid))
// 电压点位置是否合法（节点 1..N-1）
const indexValid = (idx) => idx >= 1 && idx < rows.length

// 电压点是否足够：Vcc 填了 → ≥1 个；没填 → ≥2 个
const pointsEnough = computed(() => {
  if (vcc.value.trim() !== '') return validPoints.value.length >= 1
  return validPoints.value.length >= 2
})

// 电压点位置是否都已指定且合法
const pointsIndexOk = computed(() => {
  for (const p of pointEntries.value) {
    if (p.empty) continue
    if (!indexValid(p.index)) return false
  }
  return true
})

// 某节点是否已设电压点
const isPoint = (idx) => Object.prototype.hasOwnProperty.call(pointVals, idx)
// 切换某节点为电压点（再次点击清除）
function togglePoint(idx) {
  if (isPoint(idx)) {
    delete pointVals[idx]
  } else {
    pointVals[idx] = ''
  }
}

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
  if (vccInvalid.value) return { error: 'Vcc 格式不对，示例：12 / 5V' }
  if (pointEntries.value.some((p) => p.invalid)) return { error: '电压点电压格式不对，示例：5 / 3.3V' }
  if (!target.value) return { error: '请点一个电阻的「算」，把它设为待求 Rx' }
  if (!pointsIndexOk.value) return { error: '电压点位置无效' }
  if (!pointsEnough.value) {
    return vcc.value.trim() !== ''
      ? { error: '请至少设置 1 个电压点（点电阻行之间的 ●）' }
      : { error: '未填 Vcc 时请至少设置 2 个电压点（点电阻行之间的 ●）' }
  }

  // 构造求解输入：target 指向的电阻值为 null（未知），空输入忽略，其余按输入解析
  const netRows = rows.map((row, i) => {
    const values = []
    row.resistors.forEach((r, j) => {
      if (isTarget(i, j)) { values.push(null); return }
      if (r.trim() === '') return // 空输入忽略（未填的电阻槽位）
      const v = parseResistor(r)
      values.push(v == null ? NaN : v) // 格式错误标记 NaN
    })
    return { mode: row.mode, values }
  })
  // 校验：target 已由上方保证唯一 null；其他 NaN=格式错误
  for (let i = 0; i < netRows.length; i++) {
    for (let j = 0; j < netRows[i].values.length; j++) {
      const val = netRows[i].values[j]
      if (val === null) continue // target
      if (!isFinite(val) || val <= 0) {
        return { error: `第 ${i + 1} 行第 ${j + 1} 个电阻：格式不对（示例 10k），或点「算」设为待求` }
      }
    }
  }
  const sol = solveVoltagePoints(
    netRows,
    vcc.value.trim() !== '' ? vccVal.value : null,
    validPoints.value.map((p) => ({ index: p.index, v: p.v }))
  )
  if (!sol) return { error: '无解：电压点电压与电阻网络不一致（电压需沿链递减且条件可达）' }
  const current = (sol.vcc != null && sol.vcc > 0) ? sol.vcc / sol.rTotal : null
  const results = [
    { label: '待求电阻 Rx', value: formatOhms(sol.rx), note: `「算」标记位置：第 ${target.value.row + 1} 行第 ${target.value.res + 1} 个` },
    { label: '总等效电阻', value: formatOhms(sol.rTotal) },
  ]
  if (sol.vcc != null && sol.vcc > 0) {
    results.push({ label: '电源电压 Vcc', value: formatVolt(sol.vcc), note: vcc.value.trim() !== '' ? '' : '反推值' })
  }
  if (current != null && isFinite(current)) {
    results.push({ label: '回路电流', value: formatAmp(current) })
  }
  // 各电压点回代验证（用求解器算出的节点电压）
  for (const p of validPoints.value) {
    const nd = (sol.nodes || []).find((n) => n.index === p.index)
    results.push({ label: `电压点(第${p.index}行后)`, value: formatVolt(p.v), note: nd ? `回代 ${formatVolt(nd.v)}` : '' })
  }
  return { results }
})

// ── 行操作 ──
function addRow() { rows.push(newRow()) }
function removeRow(i) {
  if (rows.length <= 1) return
  rows.splice(i, 1)
  if (target.value && target.value.row === i) target.value = null
  else if (target.value && target.value.row > i) target.value = { ...target.value, row: target.value.row - 1 }
  // 电压点位置越界由模板 invalid 提示，不强制修正
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
        <label class="field-label"><span class="fname">电源电压 Vcc</span><span class="funit">V·可选</span></label>
        <input v-model="vcc" type="text" inputmode="decimal" class="field-input" :class="{ invalid: vccInvalid }" placeholder="可不填" autocomplete="off" spellcheck="false" />
      </div>
      <div class="field ref-field">
        <div class="ref-hint">电压点 = 点电阻行之间的 ● 设置（对地电压）。填了 Vcc 至少 1 个点，没填 Vcc 至少 2 个点</div>
      </div>
    </div>

    <!-- 多行网络 -->
    <div class="network">
      <div class="section-title">电阻网络（行内合并 → 行间串联）</div>
      <template v-for="(row, i) in rows" :key="row.id">
        <div class="net-row">
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
        <!-- 节点槽：每行之后一个电压点 ●（分压模式，除最后一行；最后是 GND） -->
        <div v-if="mode === 'divider'" class="node-slot" :class="{ gnd: i === rows.length - 1 }">
          <button
            v-if="i < rows.length - 1"
            class="node-btn"
            :class="{ on: isPoint(i + 1) }"
            :title="isPoint(i + 1) ? '取消电压点' : '在此设置电压点'"
            @click="togglePoint(i + 1)"
          >●</button>
          <span v-else class="node-dot">●</span>
          <span class="node-label">{{ i < rows.length - 1 ? `第 ${i + 1} 行之后` : 'GND' }}</span>
          <input
            v-if="i < rows.length - 1 && isPoint(i + 1)"
            v-model="pointVals[i + 1]"
            type="text"
            inputmode="decimal"
            class="field-input pt-v"
            :class="{ invalid: pointVals[i + 1] && pointVals[i + 1].trim() !== '' && parseVolt(pointVals[i + 1]) === null }"
            placeholder="对地电压，如 3.3"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </template>
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

/* 电压点节点槽 */
.ref-field { flex-basis: 100%; }
.ref-hint {
  font-size: 11px;
  color: var(--dim);
  margin-top: 4px;
  line-height: 1.5;
}
.node-slot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 2px;
}
.node-slot.gnd { padding-bottom: 10px; }
.node-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-deep);
  color: var(--dim);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.18s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.node-btn:hover {
  border-color: var(--cyan-dim);
  color: var(--cyan);
  box-shadow: var(--glow-cyan);
}
.node-btn.on {
  border-color: var(--neon);
  color: var(--neon);
  background: rgba(0, 255, 159, 0.12);
  box-shadow: var(--glow-green);
}
.node-dot {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dim);
  font-size: 14px;
  flex-shrink: 0;
}
.node-label {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--dim);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.node-slot .pt-v {
  flex: 1;
  min-width: 100px;
  max-width: 180px;
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
