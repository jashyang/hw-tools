// ── 反激变压器设计计算引擎（纯 JS，可 node 直测）──
// 从 FlybackCalc.vue 抽出的核心数学逻辑，行为与原先保持一致。
// 不做商用级增强（窗口填充/Aw、Vds 选型联动、损耗估算、精确 Lcrit 等留待后续）。

import { cores } from './data/cores.js'
import { materials } from './data/materials.js'
import { awgTable } from './data/awg.js'
import { partsData } from './data/parts.js'

// ── 电感工程单位格式（H → 工程后缀）──
function trim(n) {
  if (!isFinite(n)) return '∞'
  return parseFloat(n.toPrecision(5)).toString()
}
function fmtInductor(h) {
  const abs = Math.abs(h)
  if (abs >= 1) return trim(h) + 'H'
  if (abs >= 1e-3) return trim(h * 1e3) + 'mH'
  if (abs >= 1e-6) return trim(h * 1e6) + 'µH'
  return trim(h * 1e9) + 'nH'
}

// ── 标准电感值展平（E12+E24 按数量级排列）──
// 修复：label 按 raw 的实际量级取工程单位（原先 mag<0/>=0 都硬标 mH，导致 µH 量级显示错误）
const STD_BASE = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
const STDLIB = []
for (const mag of [-3, -2, -1, 0, 1, 2, 3]) {
  const mult = Math.pow(10, mag)
  for (const v of STD_BASE) {
    const raw = v * mult
    STDLIB.push({ raw, label: fmtInductor(raw) })
  }
}

function getPart(type) { return partsData[type] || null }
function findMaterial(mat) { return materials[mat] || materials.PC40 }
function findClosestStd(value) {
  if (value <= 0 || !isFinite(value)) return null
  let best = STDLIB[0], bestD = Math.abs(Math.log(value / STDLIB[0].raw))
  for (const s of STDLIB) { const d = Math.abs(Math.log(value / s.raw)); if (d < bestD) { best = s; bestD = d } }
  return best
}

function recommendCore(pOut) {
  const P = pOut
  for (const c of cores) if (c.maxPower >= P * 1.2) return c
  return cores[cores.length - 1]
}

// 线径工具
function suggestAWG(currentA) {
  for (const a of awgTable) { if (a.currentA >= currentA * 1.3) return a }
  return awgTable[awgTable.length - 1]
}
function findWireByArea(targetArea) {
  for (let i = awgTable.length - 1; i >= 0; i--) {
    if (awgTable[i].areaMm2 <= targetArea) return awgTable[i]
  }
  return awgTable[0]
}
function parallelStrands(areaNeeded, singleArea) {
  if (singleArea >= areaNeeded * 0.8) return [{ awg: findWireByArea(singleArea).awg, count: 1 }]
  let count = Math.min(Math.ceil(areaNeeded / singleArea), 8) // 最多8股
  return [{ ...findWireByArea(singleArea * count), count }]
}

// ── 核心计算 ──
// input: { vinMin, vinMax, vo, io, fs(kHz), eta(%), vorTarget, coreMaterial, dBmax, diodeType, preferredMode('auto'|'ccm'|'dcm') }
// 返回：原先 FlybackCalc.compute() 构造的 result 对象
export function computeFlyback(inp) {
  const VinMin = parseFloat(inp.vinMin), VinMax = parseFloat(inp.vinMax)
  const Vo = parseFloat(inp.vo), Io = parseFloat(inp.io)
  const Fs = parseFloat(inp.fs) * 1e3          // kHz→Hz
  const Eta = parseFloat(inp.eta) / 100         // %→小数
  const DdB = parseFloat(inp.dBmax)
  const VorT = parseFloat(inp.vorTarget)
  const diode = getPart(inp.diodeType)

  if (!diode || isNaN(VinMin) || isNaN(VinMax) || isNaN(Vo) || isNaN(Io) || isNaN(Fs) || isNaN(Eta) || isNaN(DdB) || isNaN(VorT)) {
    return { input: inp, error: '请填写所有字段，检查格式是否正确' }
  }
  const Vf = diode.Vf
  const Pout = Vo * Io
  const VdcMin = VinMin * Math.sqrt(2)          // 最低直流母线电压
  const VsecTotal = Vo + Vf
  // ── 控制占空比 < 50%：最大占空比上限，VOR 联动钳位 ──
  const DmaxCap = 0.48                          // 目标最大占空比（留裕量,<50%）
  const VorCap = DmaxCap * VdcMin / (1 - DmaxCap)
  const VorEff = Math.min(VorT, VorCap)
  const n = VorEff / VsecTotal
  const Dmax = VorEff / (VdcMin + VorEff)
  const Ppri = Pout / Eta

  const mat = findMaterial(inp.coreMaterial)
  let recommendedCore = recommendCore(Pout)
  const Ae = recommendedCore.Ae / 1e6           // mm²→m²
  const Le = recommendedCore.Le

  const NpMin = (VdcMin * Dmax) / (DdB * Ae * Fs)
  const Km = 1.5
  const NpReal = Math.ceil(NpMin * Km)
  const NsReal = Math.round(NpReal / n)
  const nActual = NpReal / NsReal
  const VorActual = VsecTotal * nActual
  const DmaxActual = VorActual / (VdcMin + VorActual)
  const Lcrit = (nActual * nActual * Vo * Vo * (1 - DmaxActual) * (1 - DmaxActual)) / (2 * Pout * Fs)

  // ── CCM ──
  const rCCM = 0.35
  const LpCCM = 1.5 * Lcrit
  const ILavgPriCCM = Pout / (Eta * VdcMin * DmaxActual)
  const IpkCCM = ILavgPriCCM * (1 + rCCM / 2)
  const IrmsCCM = IpkCCM * Math.sqrt(DmaxActual * (1 + rCCM * rCCM / 3))
  const IspkSecCCM = IpkCCM * nActual
  const ILavgSecCCM = Io / (1 - DmaxActual)

  // ── DCM ──
  const LpDCM = (VdcMin * VdcMin * DmaxActual * DmaxActual) / (2 * Ppri * Fs)
  const IpkDCM = Math.sqrt(2 * Ppri / (LpDCM * Fs))
  const IrmsDCM = IpkDCM * Math.sqrt(DmaxActual / 3)
  const IspkSecDCM = IpkDCM * nActual

  // ── 模式决策：按功率档位 ──
  const prefer = inp.preferredMode
  const modeRcmd = Pout < 15 ? 'dcm' : 'ccm'
  const designMode = prefer === 'auto' ? modeRcmd : prefer
  const isCCM = designMode === 'ccm'
  const Lp = isCCM ? LpCCM : LpDCM
  const IpK = isCCM ? IpkCCM : IpkDCM
  const IrmS = isCCM ? IrmsCCM : IrmsDCM
  const IsPk = isCCM ? IspkSecCCM : IspkSecDCM

  // 气隙（跟随选定模式的 Lp）
  const mu0 = 4 * Math.PI * 1e-7
  const lgMm = (mu0 * NpReal * NpReal * Ae) / Lp * 1000

  const priAWG = suggestAWG(IrmS * 1.1)
  const secAWG = suggestAWG(IsPk * 0.5)
  const priStrands = parallelStrands(IrmS * 1.1 / 4, priAWG.areaMm2)
  const secStrands = parallelStrands(IsPk * 0.5 / 4, secAWG.areaMm2)

  // 安全校验
  const warnings = []
  if (VorT > VorCap) warnings.push(`⚠ 占空比控制(<50%)：目标 VOR ${VorT}V 会令占空比超 ${(DmaxCap * 100).toFixed(0)}%，已自动降为 ${VorEff.toFixed(0)}V（Dmax≈${(Dmax * 100).toFixed(1)}%）`)
  if (NpReal < NpMin) warnings.push('⚠ 警告：初级匝数不足，可能磁芯饱和！请增加匝数或换大磁芯')
  if (Pout > recommendedCore.maxPower) warnings.push(`⚠ 提示：功率 ${Pout.toFixed(1)}W 超过 ${recommendedCore.model} 的 ${recommendedCore.maxPower}W 推荐上限，建议换大一号磁芯`)
  if (Pout < 15 && designMode === 'ccm') warnings.push('💡 提示：小功率(<15W) 通常优先 DCM，控制更简单、无 RHP 零点')
  if (Pout > 20 && designMode === 'dcm') warnings.push('💡 提示：较大功率(>20W) 用 DCM 峰值/有效值电流偏高，建议 CCM')

  let conclusion = ''
  if (prefer === 'auto') {
    conclusion = isCCM
      ? `推荐 CCM —— ${Pout.toFixed(1)}W 属中功率(15~65W)，峰值电流低、发热小`
      : `推荐 DCM —— ${Pout.toFixed(1)}W 属小功率(<15W)，控制简单、无右半平面零点`
  } else {
    conclusion = isCCM
      ? `已选 CCM —— 峰值低、发热小；需 RCD 钳位，控制建议留 RHP 零点补偿`
      : `已选 DCM —— 控制简单、动态快；峰值电流高、EMI 偏大`
  }

  const std = (v) => findClosestStd(v)?.label ?? `${(v * 1000).toFixed(1)}mH`

  return {
    input: { VinMin, VinMax, Vo, Io, Eta: parseFloat(inp.eta), coreMaterial: inp.coreMaterial, dBmax: DdB, vorTarget: VorT },
    derived: {
      VdcMin, VsecTotal, n, nActual, Dmax, DmaxActual, Ppri, Pout,
      coreModel: recommendedCore.model, materialName: `${inp.coreMaterial}(${mat.manufacturer})`,
      Ae: recommendedCore.Ae, AeLe: recommendedCore.AeLe, Ve: recommendedCore.Ve,
      Le: recommendedCore.Le,
      Lcrit, LcritLabel: std(Lcrit), mode: designMode,
    },
    winding: {
      NpMin: Math.floor(NpMin), Np: NpReal, Ns: NsReal, nActual,
      VorActual,
      lg: lgMm.toFixed(2),
      warnings,
    },
    ccm: {
      Lp: LpCCM, LpLabel: std(LpCCM),
      Ipk: IpkCCM, Irms: IrmsCCM, secAvg: ILavgSecCCM, secPeak: IspkSecCCM,
    },
    dcm: {
      Lp: LpDCM, LpLabel: std(LpDCM),
      Ipk: IpkDCM, Irms: IrmsDCM, secPeak: IspkSecDCM,
    },
    design: {
      mode: designMode, Lp, LpLabel: std(Lp), lg: lgMm.toFixed(2), Ipk: IpK, Irms: IrmS, IsPk,
      priAWG: `AWG ${priAWG.awg}`, secAWG: `AWG ${secAWG.awg}`, priStrands, secStrands,
    },
    conclusion,
  }
}
