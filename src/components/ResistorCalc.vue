<script setup>
import { ref, reactive, computed } from 'vue'
import { parseResistor, formatOhms, formatVolt } from '../core/parse.js'
import { rowEquiv, networkEquiv, dividerRx } from '../core/network.js'

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
const vout = ref('')

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
const voutVal = computed(() => parseVolt(vout.value))
const vccInvalid = computed(() => vcc.value.trim() !== '' && vccVal.value === null)
const voutInvalid = computed(() => vout.value.trim() !== '' && voutVal.value === null)

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
  if (!validRows.value.length) return { error: '请先填写上臂电阻网络' }
  if (validRows.value.some((r) => r.invalid)) return { error: '有电阻值格式不对，示例：1k / 2.2k / 470' }
  if (vccInvalid.value || voutInvalid.value) return { error: '电压格式不对，示例：12 / 5V' }
  if (vcc.value.trim() === '' || vout.value.trim() === '') return { error: '请填写电源电压和目标电压' }
  const rNet = networkEquiv(validRows.value)
  const rx = dividerRx(rNet, vccVal.value, voutVal.value)
  if (rx === null) return { error: '无解：目标电压需大于 0 且小于电源电压' }
  return {
    results: [
      { label: 'Rx 电阻', value: formatOhms(rx), note: '分压下臂，Vout 点 → Rx → GND' },
      { label: '上臂等效 R_net', value: formatOhms(rNet) },
      { label: '分压比', value: `${((voutVal.value / vccVal.value) * 100).toFixed(1)}%` },
    ],
  }
})

// ── 行操作 ──
function addRow() { rows.push(newRow()) }
function removeRow(i) { if (rows.length > 1) rows.splice(i, 1) }
function addResistor(row) { row.resistors.push('') }
function removeResistor(row, j) { if (row.resistors.length > 1) row.resistors.splice(j, 1) }

// ── 复制 ──
const copied = ref(false)
async function copyResult() {
  if (!result.value || result.value.error) return
  const lines = result.value.results.map((r) => `${r.label}: ${r.value}${r.note ? '（' + r.note + '）' : ''}`)
  const text = `电阻计算（${mode.value === 'equiv' ? '等效电阻' : '分压电阻'}）\n${lines.join('\n')}`
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
        <label class="field-label"><span class="fname">目标电压 Vout</span><span class="funit">V</span></label>
        <input v-model="vout" type="text" inputmode="decimal" class="field-input" :class="{ invalid: voutInvalid }" placeholder="如 5" autocomplete="off" spellcheck="false" />
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
              :class="{ invalid: parsedRows[i].invalid[j] }"
              placeholder="如 10k"
              autocomplete="off"
              spellcheck="false"
            />
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
  min-width: 110px;
  max-width: 200px;
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
