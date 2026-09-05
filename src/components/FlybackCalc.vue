<script setup>
import { reactive, ref, computed, watch } from 'vue'
import cores from '../core/data/cores.json'
import materials from '../core/data/materials.json'
import awgTable from '../core/data/awg.json'
import partsData from '../core/data/parts.json'
import stdValuesRaw from '../core/data/stdvalues.json'

// ── 标准电感值展平（E12+E24 按数量级排列）──
const STD_BASE = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
const STDLIB = []
for (const mag of [-3, -2, -1, 0, 1, 2, 3]) {
  const mult = Math.pow(10, mag)
  for (const v of STD_BASE) STDLIB.push({ raw: v * mult, label: `${v.toFixed(v >= 10 ? 0 : 1)}${mag < 0 ? 'mH' : ''}${mag === 0 ? 'µH' : mag > 0 ? 'mH' : ''}` })
}

// ── 输入状态 ──
const vinMin = ref('85')
const vinMax = ref('265')
const vo = ref('12')
const io = ref('2')
const fs = ref('65')
const eta = ref('87')
const vorTarget = ref('120')
const coreMaterial = ref('PC40')
const dBmax = ref(0.20)
const showSteps = ref(false)
const dBmaxDefault = computed(() => { const m = materials[coreMaterial.value]; return m ? m.deltaBDyn : 0.20 })
watch(coreMaterial, () => { dBmax.value = dBmaxDefault.value })
const diodeType = ref('schottky')
const preferredMode = ref('auto') // auto | ccm | dcm

// ── 计算结果 ──
const result = ref(null)
const error = ref('')
const copied = ref(false)

// ── 工具函数 ──
function getPart(type) { return partsData[type] || null }
function findMaterial(mat) { return materials[mat] || materials['PC40'] }
function findClosestStd(value) {
  if (value <= 0 || !isFinite(value)) return null
  let best = STDLIB[0], bestD = Math.abs(Math.log(value / STDLIB[0].raw))
  for (const s of STDLIB) { const d = Math.abs(Math.log(value / s.raw)); if (d < bestD) { best = s; bestD = d } }
  return best
}

// ── 磁芯自动推荐 ──
function recommendCore(pOut) {
  const P = pOut
  for (const c of cores) if (c.maxPower >= P * 1.2) return c
  return cores[cores.length - 1]
}

// ── 核心计算引擎 ──
function compute() {
  error.value = ''
  // 解析输入
  const VinMin = parseFloat(vinMin.value), VinMax = parseFloat(vinMax.value)
  const Vo = parseFloat(vo.value), Io = parseFloat(io.value)
  const Fs = parseFloat(fs.value) / 1e3      // kHz→Hz
  const Eta = parseFloat(eta.value) / 100     // %→小数
  const DdB = parseFloat(dBmax.value)
  const VorT = parseFloat(vorTarget.value)
  const diode = getPart(diodeType.value)
  
  if (!diode || isNaN(VinMin) || isNaN(VinMax) || isNaN(Vo) || isNaN(Io) || isNaN(Fs) || isNaN(Eta) || isNaN(DdB) || isNaN(VorT)) {
    error.value = '请填写所有字段，检查格式是否正确'; result.value = null; return
  }
  const Vf = diode.Vf
  const Pout = Vo * Io
  const VdcMin = VinMin * Math.sqrt(2)  // 最低直流母线电压
  const VsecTotal = Vo + Vf
  const n = VorT / VsecTotal                 // 匝比
  const Dmax = VorT / (VdcMin + VorT)         // 最大占空比
  const Ppri = Pout / Eta                    // 初级输入功率

  // 材料特性
  const mat = findMaterial(coreMaterial.value)
  // 自动选磁芯：按Pout*1.2留裕量
  let recommendedCore = recommendCore(Pout)
  const Ae = recommendedCore.Ae / 1e6        // mm²→m²
  const Le = recommendedCore.Le              // mm

  // 最小初级匝数（法拉第定律，防饱和）
  const NpMin = (VdcMin * Dmax) / (DdB * Ae * Fs)
  // 工程裕量系数 K_m = 1.5~1.8
  const Km = 1.5
  const NpReal = Math.ceil(NpMin * Km)
  // 次级匝数（取整）
  const NsReal = Math.round(NpReal / n)
  // 实际匝比
  const nActual = NpReal / NsReal
  // 实际反射电压
  const VorActual = VsecTotal * nActual
  const DmaxActual = VorActual / (VdcMin + VorActual)
  // 临界电感
  const Lcrit = (nActual * nActual * Vo * Vo * (1 - DmaxActual)) / (2 * Pout * Fs)
  // CCM模式取Lp = 1.5 * Lcrit
  const LpCCM = 1.5 * Lcrit
  // 纹波电流比 r = ΔIL / ILavg (CCM中典型取r≈0.3~0.4)
  const rCCM = 0.35
  const ILavgPri = Pout / (Eta * VdcMin * DmaxActual)
  const deltaICCMLp = rCCM * ILavgPri
  const IpkCCM = ILavgPri + deltaICCMLp / 2
  const IspkCCM = IpkCCM * nActual
  const IrmsCCM = IpkCCM * Math.sqrt(DmaxActual * (1 + rCCM * rCCM / 3))
  const ILavgSecCCM = Io / (1 - DmaxActual)
  const IspkSecCCM = 2 * ILavgSecCCM / (1 - rCCM) // 近似峰值
  // 气隙
  const mu0 = 4 * Math.PI * 1e-7
  const lgCCM = (mu0 * NpReal * NpReal * Ae) / LpCCM - Le / 1e3 // m → mm调整注意单位
  // 更准确的气隙公式: lg = μ0 * Np² * Ae / Lp （单位: m）
  const lgCCMMm = (mu0 * NpReal * NpReal * Ae) / LpCCM * 1000 // mm

  // ── DCM 方案 ──
  const LpDCM = (VccMin * VccMin * DmaxActual * DmaxActual) / (2 * Ppri * Fs)
  const deltaIDCMLp = (VorActual + Vo + Vf) * (1 - DmaxActual) * (LpDCM * Fs) / LpDCM // 这个不对...
  // DCM: Ipri_pk = √(2 * Ppri * Fs * Lp) / (Vin_min_DC * D)  或
  const IpkDCM = Math.sqrt(2 * Ppri * Fs * LpDCM) / VccMin
  const ILavgPriDCM = Ppri / (VccMin * DmaxActual)
  const IspkDCM = IpkDCM * nActual
  // DCM次级峰值
  const IspkSecDCM = IpkDCM * nActual * DmaxActual / (1 - DmaxActual)

  // 标准电感最接近值
  const stdCCM = findClosestStd(LpCCM)
  const stdDCM = findClosestStd(LpDCM)

  // 导线选型建议
  function suggestAWG(currentA) {
    for (const a of awgTable) { if (a.currentA >= currentA * 1.3) return a }
    return awgTable[awgTable.length - 1]
  }
  const priAWG = suggestAWG(IrmsCCM * 1.1)
  const secAWG = suggestAWG(IspkSecCCM * 0.5) // 次级有效值更低
  // 考虑绕线窗口填充率，如果线太粗需要多股并绕
  function parallelStrands(areaNeeded, singleArea) {
    if (singleArea >= areaNeeded * 0.8) return [{ awg: findWireByArea(singleArea).awg, count: 1 }]
    let count = Math.ceil(areaNeeded / singleArea)
    count = Math.min(count, 8) // 最多8股
    return [{ ...findWireByArea(singleArea * count), count }]
  }
  function findWireByArea(targetArea) {
    for (let i = awgTable.length - 1; i >= 0; i--) {
      if (awgTable[i].areaMm2 <= targetArea) return awgTable[i]
    }
    return awgTable[0]
  }
  const priStrands = parallelStrands(IrmsCCM * 1.1 / 4, priAWG.areaMm2)
  const secStrands = parallelStrands(IspkSecCCM * 0.5 / 4, secAWG.areaMm2)

  // 安全校验
  const warnings = []
  if (NpReal < NpMin) warnings.push('⚠ 警告：初级匝数不足，可能磁芯饱和！请增加匝数或换大磁芯')
  if (Pout > recommendedCore.maxPower) warnings.push(`⚠ 提示：功率 ${Pout.toFixed(1)}W 超过 ${recommendedCore.model} 的 ${recommendedCore.maxPower}W 推荐上限，建议换大一号磁芯`)

  // CCM/DCM 对比结论
  const prefer = preferredMode.value
  let conclusion = ''
  if (prefer !== 'auto') {
    conclusion = prefer === 'ccm' ? '✅ 锁定 CCM' : '✅ 锁定 DCM'
  } else {
    conclusion = IpkCCM < IpkDCM * 0.6 ? '✅ 锁定 CCM：峰值电流低、热耗小，优于DCM' : '✅ 锁定 DCM：参数适合断续模式'
  }

  // ── 保存中间结果（用于步骤弹窗）──
  stepData.value = {
    vf, Pout, VdcMin, VsecTotal, n, Dmax, Ppri, Ae, Le,
    NpMinRaw: NpMin, Km, NpReal, NsReal, nActual, VorActual, DmaxActual,
    Lcrit, LpCCM, rCCM, ILavgPri, deltaICCMLp, IpkCCM, IspkCCM, IrmsCCM,
    mu0, lg: lgCCMMm, LpDCM, VccMin: VdcMin, IpkDCM, IspkSecDCM,
  }

  result.value = {
    input: { VinMin, VinMax, Vo, Io, Fs: parseFloat(fs.value), Eta: parseFloat(eta.value), coreMaterial, dBmax: DdB, vorTarget: VorT },
    derived: {
      VdcMin, VsecTotal, n, nActual, Dmax, DmaxActual, Ppri, Pout,
      coreModel: recommendedCore.model, materialName: `${coreMaterial.value}(${mat.manufacturer})`,
      Ae: recommendedCore.Ae, AeLe: recommendedCore.AeLe, Ve: recommendedCore.Ve,
    },
    winding: {
      NpMin: Math.floor(NpMin), Np: NpReal, Ns: NsReal, nActual,
      VorActual,
      lgCCM: lgCCMMm.toFixed(2),
      warnings,
    },
    ccm: {
      Lp: LpCCM, LpLabel: findClosestStd(LpCCM)?.label ?? `${(LpCCM * 1000).toFixed(1)}mH`,
      Ipk: IpkCCM, IsPk: IspkCCM, Irms: IrmsCCM,
      r: rCCM,
      secAvg: ILavgSecCCM, secPeak: IspkSecCCM,
    },
    dcm: {
      Lp: LpDCM, LpLabel: findClosestStd(LpDCM)?.label ?? `${(LpDCM * 1000).toFixed(1)}mH`,
      Ipk: IpkDCM, IsPk: IspkDCM,
    },
    wire: { priAWG: `AWG ${priAWG.awg}`, secAWG: `AWG ${secAWG.awg}`, priStrands, secStrands },
    stdInductor: { ccm: stdCCM?.label, dcm: stdDCM?.label },
    conclusion,
  }
}

async function copyResult() {
  if (!result.value) return
  const r = result.value
  const lines = [
    `反激变压器设计定案`,
    `输出: ${r.input.Vo}V/${r.input.Io}A (${r.derived.Pout.toFixed(1)}W)`,
    `磁芯: ${r.derived.coreModel} ${r.derived.materialName}`,
    `Np=${r.winding.Np} Turn / Ns=${r.winding.Ns} Turn (TR=${r.winding.nActual.toFixed(1)})`,
    `VOR=${r.winding.VorActual.toFixed(1)}V / Dmax=${(r.derived.DmaxActual * 100).toFixed(1)}%`,
    `Lp=${r.ccm.LpLabel} (CCM模式)`,
    `Ipk=${r.ccm.Ipk.toFixed(2)}A / Ispk=${r.ccm.IsPk.toFixed(2)}A`,
    `气隙≈${r.winding.lgCCM}mm`,
    ...r.winding.warnings,
  ]
  const text = lines.join('\n')
  try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const prevInputKey = ref('')
// ── 中间结果（用于步骤显示）──
const stepData = ref(null)

function calcKey() {
  return `${vinMin.value}|${vinMax.value}|${vo.value}|${io.value}|${fs.value}|${eta.value}|${coreMaterial.value}|${dBmax.value}|${vorTarget.value}|${diodeType.value}`
}

function toggleSteps() {
  if (!result.value && !stepData.value) return
  showSteps.value = !showSteps.value
}

function getSteps() {
  const r = result.value
  if (!r || !stepData.value) return []
  const s = stepData.value
  const mat = materials[coreMaterial.value]
  return [
    { title: '① 基础参数', lines: [
      `Pout = Vo × Io = ${r.input.Vo} × ${r.input.Io} = ${r.derived.Pout.toFixed(1)} W`,
      `Ppri = Pout / η = ${r.derived.Pout.toFixed(1)} / ${(r.input.Eta).toFixed(0)}% = ${r.derived.Ppri.toFixed(3)} W`,
      `Vdc(min) = Vin(min) × √2 = ${r.input.VinMin} × 1.414 ≈ ${r.derived.VdcMin.toFixed(1)} V`,
    ]},
    { title: '② 匝比与占空比初算', lines: [
      `Vsec_total = Vo + Vf = ${r.input.Vo} + ${r.input.Vo > 0 ? s.vf : '?'} = ${r.derived.VsecTotal.toFixed(2)} V`,
      `n = VOR_target / Vsec = ${s.vorT} / ${r.derived.VsecTotal.toFixed(2)} ≈ ${s.n.toFixed(3)}`,
      `Dmax = VOR / (Vdc + VOR) = ${s.vorT} / (${r.derived.VdcMin.toFixed(1)} + ${s.vorT}) ≈ ${(s.Dmax * 100).toFixed(1)}%`,
    ]},
    { title: '③ 最小初级匝数（法拉第定律）', lines: [
      `Np_min = Vdc·Dmax / (ΔB·Ae·f)`,
      `        = ${r.derived.VdcMin.toFixed(1)} × ${(s.Dmax * 100).toFixed(1)}% / (${mat.deltaBDyn} × ${r.derived.Ae} × ${r.input.Fs}kHz)`,
      `        = ${(s.NpMinRaw < 100 ? s.NpMinRaw.toFixed(1) : Math.ceil(s.NpMinRaw)).toFixed(1)} Turn`,
      `工程裕量 K_m = 1.5 → Np_real = ceil(${s.NpMinRaw.toFixed(1)} × 1.5) = ${s.NpReal} T`,
    ]},
    { title: '④ 取整后重算（精确值）', lines: [
      `Ns = round(Np / n) = round(${s.NpReal} / ${s.n.toFixed(3)}) = ${s.NsReal} T`,
      `n_actual = ${s.NpReal} / ${s.NsReal} = ${s.nActual.toFixed(3)}`,
      `VOR_actual = Vsec × n_actual = ${r.derived.VsecTotal.toFixed(2)} × ${s.nActual.toFixed(3)} = ${s.VorActual.toFixed(1)} V`,
      `Dmax_actual = VOR' / (Vdc + VOR') = ${s.VorActual.toFixed(1)} / (${r.derived.VdcMin.toFixed(1)} + ${s.VorActual.toFixed(1)}) = ${(s.DmaxActual * 100).toFixed(1)}%`,
    ]},
    { title: '⑤ CCM 模式设计', lines: [
      `Lcrit = n²·Vo²·(1-D) / (2·Pout·f)`,
      `     = ${s.nActual.toFixed(3)}² × ${r.input.Vo}² × (1-${(s.DmaxActual * 100).toFixed(1)}%) / (2 × ${r.derived.Pout.toFixed(1)} × ${r.input.Fs}×10³)`,
      `     = ${s.Lcrit.toFixed(2)} mH`,
      `取 Lp = 1.5 × Lcrit = ${(s.LpCCM*1000).toFixed(2)} mH`,
      `Iavg_pri = Ppri / (η·Vdc·D) = ${s.IpkCCM.toFixed(3)} A`,
      `Ipk = Iavg + ΔI/2 = ${s.IpkCCM.toFixed(2)} A`,
      `Irms = Ipk × √(D·(1+r²/3)) = ${s.IrmsCCM.toFixed(2)} A`,
    ]},
    { title: '⑥ DCM 模式设计（对比用）', lines: [
      `Lp = Vin(min_DC)²·D² / (2·Ppri·f)`,
      `   = ${s.VccMin.toFixed(1)}² × ${(s.DmaxActual * 100).toFixed(1)}%² / (2 × ${r.derived.Ppri.toFixed(3)} × ${r.input.Fs}×10³)`,
      `   = ${s.LpDCM.toFixed(2)} mH`,
      `Ipk = √(2·Ppri·f·Lp) / Vin = ${s.IpkDCM.toFixed(2)} A`,
    ]},
    { title: '⑦ 气隙长度 & 线径', lines: [
      `lg = μ₀ · Np² · Ae / Lp (μ₀ = 4π×10⁻⁷ H/m)`,
      `   = 4π×10⁻⁷ × ${s.NpReal}² × ${r.derived.Ae}×10⁻⁶ / ${(s.LpCCM).toFixed(6)}`,
      `   ≈ ${s.lg.toFixed(2)} mm`,
      `初 AWG≈${r.wire.priStrands[0]?.count ? '多股并绕' : '单股'}, 次级 ${r.wire.secAWG}`,
    ]},
  ]
}
</script>

<template>
  <div class="flyback-calc">
    <!-- 输入表单 -->
    <div class="input-grid">
      <div class="field">
        <label class="field-label"><span class="fname">输入交流电压 AC（有效值范围）</span></label>
        <div class="inline-pair">
          <input v-model="vinMin" type="text" inputmode="decimal" class="field-input sm" placeholder="下限 (V)" />
          <span class="dash">~</span>
          <input v-model="vinMax" type="text" inputmode="decimal" class="field-input sm" placeholder="上限 (V)" />
        </div>
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">输出直流电压 / 电流（稳定负载值）</span></label>
        <div class="inline-pair">
          <input v-model="vo" type="text" inputmode="decimal" class="field-input sm" placeholder="Vo (V)" />
          <span class="slash">/</span>
          <input v-model="io" type="text" inputmode="decimal" class="field-input sm" placeholder="Io (A)" />
        </div>
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">开关频率 fs（kHz，越高→匝数越少、磁芯越小）</span></label>
        <input v-model="fs" type="text" inputmode="decimal" class="field-input sm" placeholder="如 65" />
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">预期效率 η（%）</span></label>
        <input v-model="eta" type="text" inputmode="decimal" class="field-input sm" placeholder="如 87" />
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">磁芯材质</span></label>
        <select v-model="coreMaterial" class="field-input sm">
          <option v-for="(m,k) in materials" :key="k" :value="k">{{ k }}（{{ m.manufacturer }}，ΔB默认 {{ m.deltaBDyn }}T）</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">ΔBmax 磁通密度摆幅 T（按材质自动取值）</span></label>
        <span class="db-readout">{{ dBmax.toFixed(2) }} T</span>
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">目标反射电压 VOR（V，反激二次侧钳位，通常 90–150V；直接影响占空比）</span></label>
        <input v-model="vorTarget" type="text" inputmode="decimal" class="field-input sm" placeholder="如 120" />
      </div>
      <div class="section-divider">─── 高级参数 ───</div>
      <div class="field">
        <label class="field-label"><span class="fname">输出整流管（仅用于 VOR 精确值，影响极小）</span></label>
        <select v-model="diodeType" class="field-input sm">
          <option v-for="(p,k) in partsData" :key="k" :value="k">{{ p.label }}</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">工作模式偏好</span></label>
        <div class="seg-group">
          <button :class="{ on: preferredMode==='auto' }" @click="preferredMode='auto'" class="seg-btn">自动</button>
          <button :class="{ on: preferredMode==='ccm' }" @click="preferredMode='ccm'" class="seg-btn">CCM</button>
          <button :class="{ on: preferredMode==='dcm' }" @click="preferredMode='dcm'" class="seg-btn">DCM</button>
        </div>
      </div>
    </div>

    <!-- 计算按钮 -->
    <button class="btn cyan compute-btn" @click="compute">⚡ 计算</button>

    <!-- 错误提示 -->
    <div v-if="error" class="result-error">⚠ {{ error }}</div>

    <!-- 结果区域 -->
    <div v-if="result">
      <!-- 计算步骤按钮 -->
      <button class="btn steps-toggle-btn" @click="toggleSteps">{{ showSteps ? '▲' : '📐' }} {{ showSteps ? '隐藏计算步骤' : '查看计算步骤' }}</button>

      <!-- 步骤弹窗 -->
      <Transition name="fade">
        <div v-if="showSteps && result && stepData" class="modal-overlay" @click.self="showSteps = false">
          <div class="modal-content">
            <div class="modal-header">
              <span>📐 计算推导步骤（代入实际数值）</span>
              <button class="modal-close" @click="showSteps = false">✕</button>
            </div>
            <div class="modal-body">
              <div v-for="(step, idx) in getSteps()" :key="idx" class="step-block">
                <h4>{{ step.title }}</h4>
                <pre class="step-lines">{{ step.lines.join('\n') }}</pre>
              </div>
            </div>
          </div>
        </div>
      </Transition>
      <!-- 警告信息 -->
      <div v-if="result.winding.warnings.length" class="warning-box">
        <div v-for="(w,i) in result.winding.warnings" :key="i" class="warn-item">{{ w }}</div>
      </div>

      <!-- 表一：CCM vs DCM 对比 -->
      <div class="table-section">
        <h3 class="table-title">📊 工作模式评估</h3>
        <table class="data-table compare">
          <thead>
            <tr>
              <th style="width:140px">对比维度</th>
              <th>CCM 方案</th>
              <th>DCM 方案</th>
              <th>结论</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="dim">初级峰值电流 Ipk</td>
              <td><b>{{ result.ccm.Ipk.toFixed(2) }} A</b></td>
              <td><b>{{ result.dcm.Ipk.toFixed(2) }} A</b></td>
              <td rowspan="3" class="conclusion-cell">{{ result.conclusion }}</td>
            </tr>
            <tr>
              <td class="dim">次级峰值电流 IsPk</td>
              <td><b>{{ result.ccm.IsPk.toFixed(2) }} A</b></td>
              <td><b>{{ result.dcm.IsPk.toFixed(2) }} A</b></td>
            </tr>
            <tr>
              <td class="dim">原边电感量 Lp</td>
              <td>{{ result.ccm.LpLabel }}</td>
              <td>{{ result.dcm.LpLabel }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 表二：核心设计定案 -->
      <div class="table-section">
        <h3 class="table-title">🔧 核心设计参数</h3>
        <table class="data-table specs">
          <tbody>
            <tr><td class="dim">输出功率</td><td>{{ result.derived.Pout.toFixed(1) }} W</td></tr>
            <tr><td class="dim">直流母线 Vin(min)→Vdc(min)</td><td>{{ result.input.VinMin }}VAC → {{ result.derived.VdcMin.toFixed(1) }} VDC</td></tr>
            <tr><td class="dim">磁芯型号</td><td>{{ result.derived.coreModel }} （Ae={{ result.derived.Ae }}mm², Le={{ result.derived.Le }}mm）</td></tr>
            <tr><td class="dim">材质等级</td><td>{{ result.derived.materialName }} （ΔBmax={{ dBmax }}T）</td></tr>
            <tr><td class="dim">初级匝数 Np</td><td><b>{{ result.winding.Np }} Turn</b> <span class="note">(理论最小≈{{ result.winding.NpMin }}Turn)</span></td></tr>
            <tr><td class="dim">次级匝数 Ns</td><td><b>{{ result.winding.Ns }} Turn</b></td></tr>
            <tr><td class="dim">实际匝比 TR</td><td>{{ result.winding.nActual.toFixed(1) }} : 1 （等效 {{ result.winding.Np }}:{{ result.winding.Ns }}）</td></tr>
            <tr><td class="dim">实际反射电压 VOR'</td><td>{{ result.winding.VorActual.toFixed(1) }} V</td></tr>
            <tr><td class="dim">占空比 Dmax</td><td>{{ (result.derived.DmaxActual * 100).toFixed(1) }} %</td></tr>
            <tr><td class="dim">气隙长度 lg</td><td>{{ result.winding.lgCCM }} mm</td></tr>
            <tr><td class="dim">初级线径建议</td><td>{{ result.wire.priAWG }}（多股并绕 ×{{ result.wire.priStrands[0]?.count || 1 }}）</td></tr>
            <tr><td class="dim">次级线径建议</td><td>{{ result.wire.secAWG }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 复制按钮 -->
      <button class="btn cyan copy-btn" @click="copyResult">{{ copied ? '✓ 已复制' : '⧉ 复制定案数据' }}</button>
    </div>
  </div>
</template>

<style scoped>
.flyback-calc { display: flex; flex-direction: column; gap: 14px; }

/* ── 输入网格 ── */
.input-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.inline-pair { display: flex; align-items: center; gap: 6px; }
.inline-pair .dash, .inline-pair .slash { color: var(--dim); font-size: 14px; }
.seg-group { display: flex; gap: 4px; background: rgba(6,9,15,0.45); border: 1px solid var(--border); border-radius: 6px; padding: 3px; }
.seg-btn { flex:1; font-size: 11px; color: var(--dim); background: transparent; border: none; border-radius: 4px; padding: 4px 8px; cursor:pointer; }
.seg-btn.on { color: var(--cyan); background: rgba(0,229,255,0.12); }
.sm { font-size: 16px !important; padding: 8px 10px !important; }

/* ── 错误/警告 ── */
.result-error { font-family: var(--mono); font-size: 12px; color: var(--red); padding: 8px; background: rgba(255,50,50,0.08); border-radius: 6px; }
.warning-box { font-family: var(--mono); font-size: 12px; color: #ffaa00; background: rgba(255,170,0,0.08); border-radius: 6px; padding: 8px 10px; }

/* ── 表格区 ── */
.table-section { margin-top: 8px; }
.table-title { font-size: 13px; color: var(--cyan); margin: 0 0 6px 0; letter-spacing: 1px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--mono); background: rgba(15,21,31,0.3); border-radius: 8px; overflow: hidden; }
.data-table th { text-align: left; padding: 8px 10px; background: rgba(6,9,15,0.6); color: var(--dim); font-weight: normal; font-size: 11px; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
.data-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
.data-table tr:last-child td { border-bottom: none; }
.dim { color: var(--dim); font-size: 11px; white-space: nowrap; }
.note { color: var(--dim); font-size: 11px; }
.conclusion-cell { writing-mode: vertical-rl; text-align: center; color: var(--neon); font-size: 12px; letter-spacing: 2px; }

.copy-btn { margin-top: 12px; }

/* ── dB 只读显示 ── */
.db-readout {
  font-family: var(--mono);
  font-size: 18px;
  color: var(--cyan);
  padding: 8px 0;
}

/* ── 高级参数分隔线 ── */
.section-divider {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--dim);
  font-size: 11px;
  letter-spacing: 4px;
  opacity: 0.5;
  margin: 6px 0;
}

/* ── 步骤按钮 ── */
.steps-toggle-btn {
  background: rgba(0,229,255,0.08);
  border: 1px solid var(--cyan-dim);
  font-size: 13px;
}

/* ── 弹窗 ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: #1a1f2e;
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  font-weight: bold;
  color: var(--neon);
}

.modal-close {
  background: none;
  border: none;
  color: var(--dim);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.modal-close:hover { color: var(--red); }

.modal-body {
  overflow-y: auto;
  padding: 16px 20px;
  flex: 1;
}

.step-block { margin-bottom: 18px; }
.step-block:last-child { margin-bottom: 0; }

.step-block h4 {
  color: var(--cyan);
  font-size: 13px;
  margin: 0 0 6px 0;
  letter-spacing: 0.5px;
}

.step-lines {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.6;
  color: #c8d0dc;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ── 过渡动画 ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media(max-width:700px) {
  .compare { font-size: 11px; }
  .compare td, .compare th { padding: 4px 6px; }
  .conclusion-cell { writing-mode: horizontal-tb; padding: 4px 0; }
  .specs td:first-child { width: 140px; }
}
</style>
