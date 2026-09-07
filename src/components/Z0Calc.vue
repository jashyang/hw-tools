<script setup>
import { ref, computed, watch } from 'vue'
import { computeImpedance, MIL } from '../core/impedance.js'
import { useCopy } from '../composables/useCopy.js'

// ── 子模式（走线类型）──
const model = ref('sms')   // sms=单端微带 diff=差分微带 sl=单端带状线
// ── 方向：solve=反解线宽(默认) calc=算阻抗 ──
const direction = ref('solve')

// ── 输入（默认全空，纯文本框）──
const unit = ref('mil')    // mil | mm
const erText = ref('')     // Er
const hText = ref('')      // H（单端微带/差分：到参考面）
const bText = ref('')      // b（带状线：两平面总间距）
const tText = ref('')      // T 铜厚
const sText = ref('')      // S 间距（差分，默认 8）
const wText = ref('')      // W1（正算用）
const zText = ref('50')    // 目标阻抗（反解用）：单端默认 50 / 差分默认 100

// ── 单位换算：输入字符串 → 内部 mm ──
function toMM(str) {
  if (str == null) return null
  const v = parseFloat(String(str).trim())
  if (!isFinite(v) || v <= 0) return null
  return unit.value === 'mm' ? v : v * MIL
}

// ── 常用目标阻抗默认值（反解提示用）──
const defTarget = computed(() => model.value === 'diff' ? 100 : 50)
// 切换走线类型：差分→目标100（间距默认8）；单端/带状线→目标50
watch(model, (m) => {
  if (m === 'diff') {
    if (!sText.value) sText.value = '8'
    zText.value = '100'
  } else {
    zText.value = '50'
  }
})

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
    const b = toMM(bText.value || hText.value)
    if (b == null) { error.value = '请填写两平面间距 b'; return }
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
    `线宽计算·${modelName}（${direction.value === 'calc' ? '算阻抗' : '反解线宽'}）`,
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
      <button class="mode-btn" :class="{ on: model === 'diff' }" @click="model = 'diff'">差分微带</button>
      <button class="mode-btn" :class="{ on: model === 'sl' }" @click="model = 'sl'">单端带状线</button>
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
      <!-- Er -->
      <div class="field">
        <label class="field-label"><span class="fname">介电常数 Er</span></label>
        <input v-model="erText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 4.2" autocomplete="off" spellcheck="false" />
      </div>

      <!-- H 或 b：单端微带/差分用 H，带状线用 b -->
      <div class="field" v-if="model !== 'sl'">
        <label class="field-label"><span class="fname">介质厚度 H</span><span class="funit">{{ unit }}</span></label>
        <input v-model="hText" type="text" inputmode="decimal" class="field-input sm" placeholder="到参考面厚度 / 4.2" autocomplete="off" spellcheck="false" />
      </div>
      <div class="field" v-if="model === 'sl'">
        <label class="field-label"><span class="fname">两平面间距 b</span><span class="funit">{{ unit }}</span></label>
        <input v-model="bText" type="text" inputmode="decimal" class="field-input sm" placeholder="总间距 / 24" autocomplete="off" spellcheck="false" />
      </div>

      <!-- T 铜厚 -->
      <div class="field">
        <label class="field-label"><span class="fname">铜厚 T</span><span class="funit">{{ unit }}</span></label>
        <input v-model="tText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 2.2 / 1.25" autocomplete="off" spellcheck="false" />
      </div>

      <!-- S 间距（差分） -->
      <div class="field" v-if="model === 'diff'">
        <label class="field-label"><span class="fname">间距 S</span><span class="funit">{{ unit }}</span></label>
        <input v-model="sText" type="text" inputmode="decimal" class="field-input sm" placeholder="差分线距 / 8" autocomplete="off" spellcheck="false" />
      </div>

      <!-- 正算：W1 输入 -->
      <div class="field" v-if="direction === 'calc'">
        <label class="field-label"><span class="fname">线宽 W1</span><span class="funit">{{ unit }}</span></label>
        <input v-model="wText" type="text" inputmode="decimal" class="field-input sm" placeholder="底部线宽 / 6" autocomplete="off" spellcheck="false" />
      </div>

      <!-- 反解：目标阻抗 -->
      <div class="field" v-if="direction === 'solve'">
        <label class="field-label"><span class="fname">目标阻抗 Z</span><span class="funit">Ω</span></label>
        <input v-model="zText" type="text" inputmode="decimal" class="field-input sm" :placeholder="`如 ${defTarget}（${model==='diff'?'差分':'单端'}）`" autocomplete="off" spellcheck="false" />
      </div>
    </div>
    <div class="hint" v-if="direction === 'solve'">反解：输入目标阻抗 + 叠层 → 算出线宽 W1（W2 = W1 − 1mil）。切「算阻抗」需填线宽。</div>

    <!-- 结果 -->
    <div v-if="error" class="result-error">⚠ {{ error }}</div>
    <div v-if="result" class="result-panel z0-result">
      <!-- 主结果（大号绿粗，按方向切换）：反解=We，算阻抗=Z -->
      <div class="z0-main">
        <div class="z0-main-value led" v-if="direction === 'solve'">{{ fnum(disp(result.We), 3) }} <small>{{ unit }}</small></div>
        <div class="z0-main-value led" v-else>{{ fnum(result.Z) }} <small>Ω</small></div>
        <div class="z0-main-label">{{ direction === 'solve' ? '等效宽 We = (W1+W2)/2' : (result.kind === 'diff' ? '差分阻抗 Zdiff' : '特性阻抗 Z0') }}</div>
      </div>

      <!-- 次级结果（分开显示） -->
      <div class="z0-sub">
        <div class="result-row"><span class="result-label">W1（底部宽）</span><span class="result-value">{{ fnum(disp(result.W1), 3) }} {{ unit }}</span></div>
        <div class="result-row"><span class="result-label">W2（顶部宽）</span><span class="result-value">{{ fnum(disp(result.W2), 3) }} {{ unit }}</span></div>
        <div v-if="result.kind === 'diff'">
          <div class="result-row"><span class="result-label">单端微带 Z0</span><span class="result-value">{{ fnum(result.z0) }} Ω</span></div>
          <div class="result-row"><span class="result-label">奇模 Zodd</span><span class="result-value">{{ fnum(result.zodd) }} Ω</span></div>
          <div class="result-row"><span class="result-label">偶模 Zeven</span><span class="result-value">{{ fnum(result.zeven) }} Ω</span></div>
          <div class="result-row"><span class="result-label">共模 Zcom</span><span class="result-value">{{ fnum(result.zcom) }} Ω</span></div>
          <div class="result-row"><span class="result-label">Zdiff = 2 × Zodd</span><span class="result-value">{{ fnum(result.Z, 2) }} Ω</span></div>
        </div>
        <div v-if="direction === 'solve'" class="result-row"><span class="result-label">目标阻抗</span><span class="result-value">{{ fnum(result.Ztarget) }} Ω</span></div>
      </div>
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
.dir-btn { font-family: var(--mono); font-size: 11px; color: var(--dim); background: transparent; border: 1px solid transparent; border-radius: 4px; padding: 5px 12px; cursor: pointer; transition: all 0.15s; }
.dir-btn.on { color: var(--cyan); border-color: var(--cyan-dim); background: rgba(79,138,168,0.12); }
.unit-toggle { font-family: var(--mono); font-size: 11px; color: var(--cyan); cursor: pointer; opacity: 0.85; }
.compute-row .compute-btn { margin-left: auto; }

.input-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { display: flex; align-items: baseline; gap: 8px; }
.fname { font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: 1px; }
.funit { font-family: var(--mono); font-size: 10px; color: var(--cyan); opacity: 0.8; }
/* 输入框统一用 sm(16px)，与变压器/FlybackCalc 一致；placeholder 随之 16px */
.field-input.sm { font-size: 16px !important; padding: 8px 10px !important; line-height: 21px; }

.hint { font-size: 11px; color: var(--dim); line-height: 1.6; }

/* 主结果（大号绿粗）：反解=We，算阻抗=Z */
.z0-result { display: flex; flex-direction: column; gap: 14px; }
.z0-main { display: flex; flex-direction: column; gap: 2px; padding: 4px 2px; }
.z0-main-value {
  font-size: 40px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}
.z0-main-value small { font-size: 18px; font-weight: 400; opacity: 0.7; margin-left: 4px; }
.z0-main-label { font-family: var(--mono); font-size: 12px; color: var(--dim); letter-spacing: 1px; }
/* 次级结果区：与主结果分开，非核心不加粗，跟随普通文字字号 */
.z0-sub {
  display: flex; flex-direction: column; gap: 0;
  border-top: 1px dashed rgba(255,255,255,0.1);
  padding-top: 10px;
}
.z0-sub .result-row { padding: 5px 0; }
.z0-sub .result-value {
  font-size: 14px;
  font-weight: 400;
  color: var(--text);
}
.z0-sub .result-label { font-size: 12px; }
</style>
