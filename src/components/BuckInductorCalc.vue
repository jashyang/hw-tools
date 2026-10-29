<script setup>
import { ref, computed, watch } from 'vue'
import { computeBuckInductor, DEFAULT_DERATE } from '../core/buck-inductor.js'
import { useCopy } from '../composables/useCopy.js'

// ── 输入电压口径：默认 Vin（自动按 ×110% 推 Vin_max）；也可直接给 Vin_max ──
const vinMode = ref('vin')   // vin | max

// ── 输入（默认全空）──
const vinText = ref('')
const vinMaxText = ref('')
const voutText = ref('')
const ioutText = ref('')
const fswText = ref('')                 // kHz
const kText = ref('40')                 // 纹波系数 %（默认 40%，合理 20~40%）
const derateText = ref(String(DEFAULT_DERATE * 100))  // 感值总降额 %（默认 30%）
const lText = ref('')                   // 实际感值 µH（选填）

const error = ref('')
const result = ref(null)

function num(str) {
  if (str == null) return null
  const v = parseFloat(String(str).trim())
  return isFinite(v) && v > 0 ? v : null
}

function compute() {
  error.value = ''; result.value = null
  if (vinMode.value === 'vin' && num(vinText.value) == null) { error.value = '请填写输入电压 Vin'; return }
  if (vinMode.value === 'max' && num(vinMaxText.value) == null) { error.value = '请填写最大输入电压 Vin_max'; return }
  const vout = num(voutText.value)
  if (vout == null) { error.value = '请填写输出电压 Vout'; return }
  const iout = num(ioutText.value)
  if (iout == null) { error.value = '请填写输出电流 Iout'; return }
  const fswK = num(fswText.value)
  if (fswK == null) { error.value = '请填写开关频率 fsw（kHz）'; return }
  const kPct = num(kText.value)
  if (kPct == null) { error.value = '请填写纹波系数 K_IND（%，20~40）'; return }
  const dr = parseFloat(String(derateText.value).trim())
  if (!isFinite(dr) || dr < 0 || dr > 50) { error.value = '感值裕量填 0~50（%）'; return }

  const res = computeBuckInductor({
    vin: vinMode.value === 'vin' ? num(vinText.value) : null,
    vinMax: vinMode.value === 'max' ? num(vinMaxText.value) : null,
    vout,
    iout,
    fsw: fswK * 1000,
    kInd: kPct / 100,
    derate: dr / 100,
    lUH: num(lText.value),
  })
  if (res.error) { error.value = res.error; return }
  result.value = res
}

watch([vinMode, vinText, vinMaxText, voutText, ioutText, fswText, kText, derateText, lText], () => {
  result.value = null; error.value = ''
})

function f(x, n = 2) { return isFinite(x) ? Number(x).toFixed(n) : '—' }
const vinLabel = computed(() => (result.value && result.value.vinAssumed ? 'Vin × 110%' : 'Vin_max'))

// ── 复制 ──
const { copied, copy } = useCopy()
async function copyResult() {
  const r = result.value
  if (!r) return
  const lines = [
    'Buck 输出电感计算',
    `输入：${vinLabel.value} ${f(r.vinMax)}V · Vout ${f(r.vout)}V · Iout ${f(r.iout)}A · fsw ${f(r.fsw / 1000, 0)}kHz · K_IND ${f(r.kInd * 100, 0)}% · 感值裕量 ${f(r.derate * 100, 0)}%`,
    `L_MIN = ${f(r.lminUH)}µH → 选档门槛 ${f(r.lneedUH)}µH → 推荐 ${f(r.lselUH)}µH（最坏 ${f(r.lworstUH)}µH）`,
    `纹波：名义 ΔI ${f(r.dIL, 3)}A / ${f(r.ripplePct * 100, 1)}%，最坏 ΔI ${f(r.dILWorst, 3)}A / ${f(r.rippleWorstPct * 100, 1)}%`,
    `I_pk = ${f(r.ipk)}A · I_rms = ${f(r.irms)}A`,
    `Isat ≥ ${f(r.isatNeed)}A（建议 ${r.isatRec}A 档）· DCR ≤ ${f(r.dcrMaxOhm * 1000, 1)}mΩ`,
  ]
  copy(lines.join('\n'))
}
</script>

<template>
  <div class="buck-calc">
    <!-- 输入电压口径（轻量单选，默认 Vin） -->
    <div class="radio-row">
      <label :class="{ on: vinMode === 'vin' }">
        <input type="radio" value="vin" v-model="vinMode" /> Vin（自动取 ×110%）
      </label>
      <label :class="{ on: vinMode === 'max' }">
        <input type="radio" value="max" v-model="vinMode" /> 直接给 Vin_max
      </label>
    </div>

    <div class="input-grid">
      <div class="field" v-if="vinMode === 'vin'">
        <label class="field-label"><span class="fname">输入电压 Vin</span><span class="funit">V（×1.1）</span></label>
        <input v-model="vinText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 24 → 26.4" autocomplete="off" spellcheck="false" />
      </div>
      <div class="field" v-else>
        <label class="field-label"><span class="fname">最大输入电压 Vin_max</span><span class="funit">V</span></label>
        <input v-model="vinMaxText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 26.4" autocomplete="off" spellcheck="false" />
      </div>

      <div class="field">
        <label class="field-label"><span class="fname">输出电压 Vout</span><span class="funit">V</span></label>
        <input v-model="voutText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 5" autocomplete="off" spellcheck="false" />
      </div>

      <div class="field">
        <label class="field-label"><span class="fname">输出电流 Iout</span><span class="funit">A</span></label>
        <input v-model="ioutText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 2" autocomplete="off" spellcheck="false" />
      </div>

      <div class="field">
        <label class="field-label"><span class="fname">开关频率 fsw</span><span class="funit">kHz</span></label>
        <input v-model="fswText" type="text" inputmode="decimal" class="field-input sm" placeholder="如 500" autocomplete="off" spellcheck="false" />
      </div>

      <div class="field">
        <label class="field-label"><span class="fname">纹波系数 K_IND</span><span class="funit">%（20~40）</span></label>
        <input v-model="kText" type="text" inputmode="decimal" class="field-input sm" placeholder="默认 40" autocomplete="off" spellcheck="false" />
      </div>

      <div class="field">
        <label class="field-label"><span class="fname">感值裕量</span><span class="funit">%（默认 30）</span></label>
        <input v-model="derateText" type="text" inputmode="decimal" class="field-input sm" placeholder="公差 20% + 偏置 10%" autocomplete="off" spellcheck="false" />
      </div>

      <div class="field">
        <label class="field-label"><span class="fname">实际感值 L（选填）</span><span class="funit">µH</span></label>
        <input v-model="lText" type="text" inputmode="decimal" class="field-input sm" placeholder="留空=自动选标准档" autocomplete="off" spellcheck="false" />
      </div>
    </div>

    <div class="compute-row">
      <span class="row-hint">按最高输入电压算最坏纹波；感值裕量 = 标称公差 + 满载软饱和降额</span>
      <button class="btn cyan compute-btn" @click="compute">⚡ 计算</button>
    </div>

    <div class="hint">感值裕量 30% ≈ 感值公差 ±20% 与满载偏置降额 ~10% 的乘性叠加（1−0.8×0.9≈28%，圆整 30%）；中间窗口的纹波按最坏感值给出。</div>

    <!-- 错误 -->
    <div v-if="error" class="result-error">⚠ {{ error }}</div>

    <!-- 结果 -->
    <div v-if="result" class="result-panel buck-result">
      <div class="buck-main">
        <div class="buck-main-value led">{{ f(result.lselUH) }} <small>µH</small></div>
        <div class="buck-main-label">
          {{ result.manual ? '手填感值（验算）' : '推荐感值' }} · L_MIN {{ f(result.lminUH) }}µH → 门槛 {{ f(result.lneedUH) }}µH（含 {{ f(result.derate * 100, 0) }}% 降额）
        </div>
      </div>

      <div class="buck-sub">
        <div class="result-row"><span class="result-label">L_MIN</span><span class="result-value">{{ f(result.lminUH) }} µH</span><span class="result-note inline">K_IND {{ f(result.kInd * 100, 0) }}% 标称口径</span></div>
        <div class="result-row"><span class="result-label">选档门槛</span><span class="result-value">{{ f(result.lneedUH) }} µH</span><span class="result-note inline">L_MIN ÷ (1 − {{ f(result.derate * 100, 0) }}%)</span></div>
        <div class="result-row"><span class="result-label">最坏感值</span><span class="result-value">{{ f(result.lworstUH) }} µH</span><span class="result-note inline">标称 × (1 − {{ f(result.derate * 100, 0) }}%)</span></div>
        <div class="result-row"><span class="result-label">纹波 ΔI_L</span><span class="result-value">{{ f(result.dIL, 3) }} A</span><span class="result-note inline">名义 {{ f(result.ripplePct * 100, 1) }}%</span></div>
        <div class="result-row"><span class="result-label">最坏纹波</span><span class="result-value">{{ f(result.dILWorst, 3) }} A</span><span class="result-note inline">{{ f(result.rippleWorstPct * 100, 1) }}% Iout</span></div>
        <div class="result-row"><span class="result-label">峰值电流 I_pk</span><span class="result-value">{{ f(result.ipk) }} A</span><span class="result-note inline">按最坏感值</span></div>
        <div class="result-row"><span class="result-label">RMS 电流 I_rms</span><span class="result-value">{{ f(result.irms) }} A</span></div>
        <div class="result-row"><span class="result-label">饱和电流 Isat</span><span class="result-value">≥ {{ f(result.isatNeed) }} A</span><span class="result-note inline">建议 {{ result.isatRec }}A 档（{{ result.isatMargin }}× 裕量）</span></div>
        <div class="result-row"><span class="result-label">DCR 上限</span><span class="result-value">{{ f(result.dcrMaxOhm * 1000, 1) }} mΩ</span><span class="result-note inline">铜损 ≤ 1% Pout</span></div>
        <div class="result-row"><span class="result-label">占空比 D</span><span class="result-value">{{ f(result.duty * 100, 1) }} %</span><span class="result-note inline">@{{ f(result.vinMax) }}V</span></div>
        <div class="result-row"><span class="result-label">工作点</span><span class="result-value">{{ result.ilow > 0 ? 'CCM' : 'DCM（谷值≤0）' }}</span><span class="result-note inline">谷值 {{ f(result.ilow) }} A</span></div>
        <div class="result-row"><span class="result-label">不加裕量档</span><span class="result-value">{{ f(result.lselNomUH) }} µH</span><span class="result-note inline">最坏纹波 {{ f(result.rippleNomTierWorstPct * 100, 0) }}%，仅体积受限时参考</span></div>
      </div>

      <!-- 告警 -->
      <div v-if="result.warnings.length" class="warn-list">
        <div v-for="(w, i) in result.warnings" :key="i" class="warn-item">⚠ {{ w }}</div>
      </div>

      <!-- 选型建议 -->
      <div class="advice">
        <div class="advice-title">选型建议</div>
        <div v-for="(s, i) in result.suggestions" :key="i" class="advice-row">
          <span class="advice-k">{{ s.title }}</span>
          <span class="advice-v">{{ s.text }}</span>
        </div>
      </div>

      <button class="btn cyan copy-btn" @click="copyResult">{{ copied ? '✓ 已复制' : '⧉ 复制结果' }}</button>
    </div>
  </div>
</template>

<style scoped>
.buck-calc { display: flex; flex-direction: column; gap: 14px; }

/* 输入电压口径：轻量单选（不用大分段控件） */
.radio-row { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
.radio-row label {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.5px;
  color: var(--dim); cursor: pointer; transition: color 0.15s;
}
.radio-row label.on { color: var(--neon); }
.radio-row input[type='radio'] {
  appearance: none; -webkit-appearance: none;
  width: 12px; height: 12px; margin: 0;
  border: 1px solid var(--border); border-radius: 50%;
  background: rgba(6,9,15,0.6); cursor: pointer; transition: all 0.15s;
}
.radio-row input[type='radio']:checked {
  border-color: var(--neon);
  background: var(--neon);
  box-shadow: var(--glow-green);
}

.compute-row { display: flex; align-items: center; gap: 10px; }
.row-hint { flex: 1; font-size: 11px; color: var(--dim); }
.compute-row .compute-btn { margin-left: auto; }

.input-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { display: flex; align-items: baseline; gap: 8px; }
.fname { font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: 1px; }
.funit { font-family: var(--mono); font-size: 10px; color: var(--cyan); opacity: 0.8; }
.field-input.sm { font-size: 16px !important; padding: 8px 10px !important; line-height: 21px; }

.hint { font-size: 11px; color: var(--dim); line-height: 1.6; }

.buck-result { display: flex; flex-direction: column; gap: 14px; }
.buck-main { display: flex; flex-direction: column; gap: 2px; padding: 4px 2px; }
.buck-main-value { font-size: 40px; font-weight: 700; line-height: 1.1; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
.buck-main-value small { font-size: 18px; font-weight: 400; opacity: 0.7; margin-left: 4px; }
.buck-main-label { font-family: var(--mono); font-size: 12px; color: var(--dim); letter-spacing: 1px; }

.buck-sub { display: flex; flex-direction: column; gap: 0; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; }
.buck-sub .result-row { padding: 5px 0; }
.buck-sub .result-value { font-size: 14px; font-weight: 400; color: var(--text); }
.buck-sub .result-label { font-size: 12px; min-width: 110px; }
.result-note.inline { width: auto; }

.warn-list { display: flex; flex-direction: column; gap: 4px; border-left: 2px solid var(--amber); padding-left: 10px; }
.warn-item { font-size: 12px; color: var(--amber); line-height: 1.6; }

.advice { border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.advice-title { font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: var(--neon); text-transform: uppercase; }
.advice-row { display: flex; gap: 10px; align-items: baseline; }
.advice-k { font-family: var(--mono); font-size: 11px; color: var(--cyan); min-width: 76px; flex-shrink: 0; }
.advice-v { font-size: 12px; color: var(--text); line-height: 1.65; opacity: 0.92; }
</style>
