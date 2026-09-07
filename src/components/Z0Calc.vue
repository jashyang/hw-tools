<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { computeImpedance, MIL } from '../core/impedance.js'
import { erOptions, hOptions, tOptions, zTargetPresets } from '../core/data/impedance-layers.js'
import { useCopy } from '../composables/useCopy.js'

// ── 子模式（走线类型）──
const model = ref('sms')   // sms=单端微带 sl=单端带状线 diff=差分微带
// ── 方向：calc=正算(有W输入) solve=反解(有目标阻抗输入，无W输入) ──
const direction = ref('solve')

// ── 输入（默认全空）──
const unit = ref('mil')    // mil | mm
const erText = ref('')     // Er 原始输入（combobox）
const hText = ref('')      // H（单端微带：到参考面）
const bText = ref('')      // b（带状线：两平面总间距）
const tText = ref('')      // T 铜厚
const sText = ref('')      // S 间距（差分）
const wText = ref('')      // W1（正算用）
const zText = ref('')      // 目标阻抗（反解用）

// ── 单位换算：输入字符串 → 内部 mm ──
function toMM(str) {
  if (str == null) return null
  const v = parseFloat(String(str).trim())
  if (!isFinite(v) || v <= 0) return null
  return unit.value === 'mm' ? v : v * MIL
}

// ── combobox 下拉面板开关 ──
const openField = ref('')  // 当前打开下拉的字段：er|h|b|t；''=关闭
const cbRoot = ref(null)
function toggleField(f) { openField.value = openField.value === f ? '' : f }
function closeCb() { openField.value = '' }
function onDocClick(e) { if (cbRoot.value && !cbRoot.value.contains(e.target)) closeCb() }
function onKey(e) { if (e.key === 'Escape') closeCb() }
onMounted(() => { document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKey) })
onUnmounted(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) })

// 选下拉项 → 写入文本（value 为 mil 或数值）
function pick(field, opt) {
  const v = opt.value
  if (field === 'er') erText.value = String(v)
  else if (field === 'h') hText.value = String(v)
  else if (field === 'b') bText.value = String(v)
  else if (field === 't') tText.value = String(v)
  closeCb()
}

// 当前字段的下拉选项（mil 语义 value）
const fieldOptions = computed(() => {
  if (openField.value === 'er') return erOptions
  if (openField.value === 'h') return hOptions
  if (openField.value === 'b') return hOptions
  if (openField.value === 't') return tOptions
  return []
})

// ── 常用目标阻抗快捷（可选填 zText 时提示）──
const defTarget = computed(() => model.value === 'diff' ? 100 : 50)

// ── 校验与计算 ──
const result = ref(null)
const error = ref('')
function compute() {
  error.value = ''; result.value = null
  const erVal = parseFloat(String(erText.value).trim())
  if (!isFinite(erVal) || erVal <= 0) { error.value = '请填写介电常数 Er'; return }
  const T = toMM(tText.value)
  if (T == null) { error.value = '请填写铜厚 T'; return }

  const inp = { model: model.value, er: erVal, T, direction: direction.value }
  if (model.value === 'sl') {
    const b = toMM(bText.value ?? hText.value)
    if (b == null) { error.value = '请填写两平面间距 b（或介质厚度）'; return }
    inp.b = b
  } else {
    const h = toMM(hText.value)
    if (h == null) { error.value = '请填写介质厚度 H'; return }
    inp.H = h
    if (model.value === 'diff') {
      const s = toMM(sText.value)
      if (s == null) { error.value = '请填写间距 S（差分）'; return }
      inp.S = s
    }
  }
  if (direction.value === 'calc') {
    const w = toMM(wText.value)
    if (w == null) { error.value = '请填写线宽 W1（正算用）'; return }
    inp.W1 = w
  } else {
    const z = parseFloat(String(zText.value).trim())
    if (!isFinite(z) || z <= 0) { error.value = '请填写目标阻抗'; return }
    inp.targetZ = z
  }

  const res = computeImpedance(inp)
  if (res.error) { error.value = res.error; return }
  result.value = res
}

// 输入变化 → 清空结果
watch([model, direction, unit, erText, hText, bText, tText, sText, wText, zText], () => { result.value = null; error.value = '' })

// ── 显示格式化 ──
function disp(MM) { return unit.value === 'mm' ? MM : MM / MIL }
function fnum(x, n = 3) { return isFinite(x) ? Number(x).toFixed(n) : '—' }

// ── 复制（useCopy）──
const { copied, copy } = useCopy()
async function copyResult() {
  if (!result.value) return
  const r = result.value
  const modelName = { sms: '单端微带', sl: '单端带状线', diff: '差分微带' }[r.kind === 'diff' ? 'diff' : model.value]
  const lines = [
    `PCB 阻抗·${modelName}（${direction.value === 'calc' ? '正算' : '反解'}）`,
    `W1 = ${fnum(disp(r.W1), 3)} ${unit.value} · W2 = ${fnum(disp(r.W2), 3)} ${unit.value}`,
  ]
  if (r.kind === 'diff') lines.push(`Zdiff = ${fnum(r.Z)}Ω（单端 Z0=${fnum(r.z0)}Ω）`)
  else lines.push(`Z0 = ${fnum(r.Z)}Ω`)
  if (r.Ztarget) lines.push('目标阻抗已回代')
  copy(lines.join('\n'))
}
</script>

<template>
  <div class="z0-calc">
    <!-- 走线类型单选 -->
    <div class="mode-seg">
      <button class="mode-btn" :class="{ on: model === 'sms' }" @click="model = 'sms'">单端微带</button>
      <button class="mode-btn" :class="{ on: model === 'sl' }" @click="model = 'sl'">单端带状线</button>
      <button class="mode-btn" :class="{ on: model === 'diff' }" @click="model = 'diff'">差分微带</button>
    </div>

    <!-- 标题行 + 计算按钮 -->
    <div class="section-title compute-row">
      <span class="dir-seg">
        <button class="dir-btn" :class="{ on: direction === 'solve' }" @click="direction = 'solve'">反解线宽</button>
        <button class="dir-btn" :class="{ on: direction === 'calc' }" @click="direction = 'calc'">算阻抗</button>
      </span>
      <span class="unit-toggle" @click="unit = unit === 'mil' ? 'mm' : 'mil'">{{ unit }} ⇄</span>
      <button class="btn cyan compute-btn" @click="compute">⚡ 计算</button>
    </div>

    <!-- 输入表单 -->
    <div class="input-grid">
      <!-- Er 下拉+自定义 -->
      <div class="field">
        <label class="field-label"><span class="fname">介电常数 Er</span></label>
        <div class="combobox">
          <input v-model="erText" type="text" inputmode="decimal" class="field-input sm" placeholder="选或输入 / 4.2" @focus="openField='er'" />
          <span class="cb-arrow" :class="{ open: openField === 'er' }" @click="toggleField('er')">▾</span>
          <Transition name="cb-pop">
            <div v-if="openField === 'er'" class="cb-pop">
              <button v-for="opt in erOptions" :key="opt.value + opt.label" type="button" class="cb-opt" @mousedown.prevent="pick('er', opt)">
                <span class="cb-opt-label">{{ opt.label }}</span><span class="cb-opt-note">{{ opt.note }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- H 或 b：单端微带/差分用 H，带状线用 b -->
      <div class="field" v-if="model !== 'sl'">
        <label class="field-label"><span class="fname">介质厚度 H</span><span class="funit">{{ unit }}</span></label>
        <div class="combobox">
          <input v-model="hText" type="text" inputmode="decimal" class="field-input sm" placeholder="到参考面厚度 / 4.66" @focus="openField='h'" />
          <span class="cb-arrow" :class="{ open: openField === 'h' }" @click="toggleField('h')">▾</span>
          <Transition name="cb-pop">
            <div v-if="openField === 'h'" class="cb-pop">
              <button v-for="opt in hOptions" :key="opt.value + opt.label" type="button" class="cb-opt" @mousedown.prevent="pick('h', opt)">
                <span class="cb-opt-label">{{ opt.label }}</span><span class="cb-opt-note">{{ opt.note }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
      <div class="field" v-if="model === 'sl'">
        <label class="field-label"><span class="fname">两平面间距 b</span><span class="funit">{{ unit }}</span></label>
        <div class="combobox">
          <input v-model="bText" type="text" inputmode="decimal" class="field-input sm" placeholder="总间距 / 24" @focus="openField='b'" />
          <span class="cb-arrow" :class="{ open: openField === 'b' }" @click="toggleField('b')">▾</span>
          <Transition name="cb-pop">
            <div v-if="openField === 'b'" class="cb-pop">
              <button v-for="opt in hOptions" :key="opt.value + opt.label" type="button" class="cb-opt" @mousedown.prevent="pick('b', opt)">
                <span class="cb-opt-label">{{ opt.label }}</span><span class="cb-opt-note">{{ opt.note }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- T 铜厚 -->
      <div class="field">
        <label class="field-label"><span class="fname">铜厚 T</span><span class="funit">{{ unit }}</span></label>
        <div class="combobox">
          <input v-model="tText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 1.25 / 2.2" @focus="openField='t'" />
          <span class="cb-arrow" :class="{ open: openField === 't' }" @click="toggleField('t')">▾</span>
          <Transition name="cb-pop">
            <div v-if="openField === 't'" class="cb-pop">
              <button v-for="opt in tOptions" :key="opt.value + opt.label" type="button" class="cb-opt" @mousedown.prevent="pick('t', opt)">
                <span class="cb-opt-label">{{ opt.label }}</span><span class="cb-opt-note">{{ opt.note }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- S 间距（差分） -->
      <div class="field" v-if="model === 'diff'">
        <label class="field-label"><span class="fname">间距 S</span><span class="funit">{{ unit }}</span></label>
        <input v-model="sText" type="text" inputmode="decimal" class="field-input sm" placeholder="差分线距 / 8" />
      </div>

      <!-- 正算：W1 输入 -->
      <div class="field" v-if="direction === 'calc'">
        <label class="field-label"><span class="fname">线宽 W1</span><span class="funit">{{ unit }}</span></label>
        <input v-model="wText" type="text" inputmode="decimal" class="field-input sm" placeholder="底部线宽 / 6" />
      </div>

      <!-- 反解：目标阻抗 -->
      <div class="field" v-if="direction === 'solve'">
        <label class="field-label"><span class="fname">目标阻抗 Z</span><span class="funit">Ω</span></label>
        <input v-model="zText" type="text" inputmode="decimal" class="field-input sm" :placeholder="`如 ${defTarget}（${model==='diff'?'差分':'单端'}）`" />
      </div>
    </div>
    <div class="hint" v-if="direction === 'solve'">反解：输入目标阻抗 + 叠层 → 算出线宽 W1（W2 = W1 − 1mil）。正算需填线宽。</div>

    <!-- 结果 -->
    <div v-if="error" class="result-error">⚠ {{ error }}</div>
    <div v-if="result" class="result-panel">
      <div class="result-row"><span class="result-label">W1（底部宽）</span><span class="result-value led">{{ fnum(disp(result.W1), 3) }} {{ unit }}</span></div>
      <div class="result-row"><span class="result-label">W2（顶部宽）</span><span class="result-value led">{{ fnum(disp(result.W2), 3) }} {{ unit }}</span></div>
      <div class="result-row"><span class="result-label">等效宽 We</span><span class="result-value led">{{ fnum(disp(result.We), 3) }} {{ unit }}</span></div>
      <div v-if="result.kind === 'diff'" class="result-row"><span class="result-label">差分阻抗 Zdiff</span><span class="result-value led">{{ fnum(result.Z) }} Ω</span></div>
      <div v-else class="result-row"><span class="result-label">特性阻抗 Z0</span><span class="result-value led">{{ fnum(result.Z) }} Ω</span></div>
      <div v-if="result.kind === 'diff'" class="result-row"><span class="result-label">单端微带 Z0 / 奇模</span><span class="result-value">{{ fnum(result.z0) }} / {{ fnum(result.zodd) }} Ω</span></div>
      <button class="btn cyan copy-btn" @click="copyResult">{{ copied ? '✓ 已复制' : '⧉ 复制结果' }}</button>
    </div>
  </div>
</template>

<style scoped>
.z0-calc { display: flex; flex-direction: column; gap: 14px; }

.mode-seg { display: flex; gap: 6px; padding: 4px; background: rgba(6,9,15,0.45); border: 1px solid var(--border); border-radius: 8px; }
.mode-btn { flex: 1; font-family: var(--mono); font-size: 13px; letter-spacing: 1px; color: var(--dim); background: transparent; border: 1px solid transparent; border-radius: 6px; padding: 8px 0; cursor: pointer; transition: all 0.18s; }
.mode-btn.on { color: var(--neon); border-color: var(--neon-dim); background: rgba(88,166,143,0.1); box-shadow: var(--glow-green); }

.compute-row { display: flex; align-items: center; gap: 10px; }
.dir-seg { display: flex; gap: 4px; background: rgba(6,9,15,0.45); border: 1px solid var(--border); border-radius: 6px; padding: 2px; }
.dir-btn { font-family: var(--mono); font-size: 12px; color: var(--dim); background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 5px 12px; cursor: pointer; transition: all 0.15s; }
.dir-btn.on { color: var(--cyan); border-color: var(--cyan-dim); background: rgba(79,138,168,0.12); }
.unit-toggle { font-family: var(--mono); font-size: 12px; color: var(--cyan); cursor: pointer; opacity: 0.85; }
.compute-row .compute-btn { margin-left: auto; }

.input-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { display: flex; align-items: baseline; gap: 8px; }
.fname { font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: 1px; }
.funit { font-family: var(--mono); font-size: 10px; color: var(--cyan); opacity: 0.8; }
.field-input { font-size: 18px !important; padding: 10px 12px !important; }

/* combobox：输入框 + 下拉 */
.combobox { position: relative; }
.cb-arrow { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--dim); font-size: 12px; cursor: pointer; pointer-events: auto; transition: transform 0.18s; }
.cb-arrow.open { transform: translateY(-50%) rotate(180deg); }
.cb-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 50; max-height: 240px; overflow-y: auto; background: rgba(16,20,27,0.92); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.5); padding: 4px; display: flex; flex-direction: column; }
.cb-opt { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: transparent; border: none; border-radius: 5px; padding: 7px 9px; font-family: var(--mono); font-size: 13px; color: var(--text); cursor: pointer; transition: background 0.12s; }
.cb-opt:hover { background: rgba(88,166,143,0.12); color: var(--neon); }
.cb-opt-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb-opt-note { color: var(--dim); font-size: 11px; flex-shrink: 0; }

.cb-pop-enter-active, .cb-pop-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.cb-pop-enter-from, .cb-pop-leave-to { opacity: 0; transform: translateY(-6px); }

.hint { font-size: 11px; color: var(--dim); line-height: 1.6; }
</style>
