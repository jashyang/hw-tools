// ── 反激变压器设计计算引擎（商用版，纯 JS 可 node 直测）──
// 在原始估算器基础上补齐：精确 Lcrit、次级 RMS、窗口填充、气隙可行性、
// ΔB 饱和降额、铜损/铁损/温升/效率估算、漏感+器件应力选型、磁芯迭代选择。
// 数据（磁芯 Ae/Le/Ve 标准值 / AWG / 材料）见 core/data/*.js。

import { cores } from './data/cores.js'
import { materials } from './data/materials.js'
import { awgTable } from './data/awg.js'
import { partsData } from './data/parts.js'

const MU0 = 4 * Math.PI * 1e-7
const RHO_CU = 1.72e-8        // Ω·m @20℃
const J = 4.5                  // 自然对流电流密度 A/mm²
const K_UTIL = 0.35            // 绕组窗口利用率（含绝缘/骨架/漆包）
const K_LEAK = 0.02            // 漏感系数（P-S-P 三明治 ~1.5-3%）
const K_SPIKE = 0.25           // 漏感尖峰系数（良好 RCD 钳位，相对 VOR）
const K_STEIN = { k: 300, a: 1.6, b: 2.1 } // 铁损 Steinmetz 归一化（100kHz/ΔB=0.2T → 300mW/cm³）

function trim(n) { return isFinite(n) ? parseFloat(n.toPrecision(5)).toString() : '∞' }
function fmtInductor(h) {
  const a = Math.abs(h)
  if (a >= 1) return trim(h) + 'H'
  if (a >= 1e-3) return trim(h * 1e3) + 'mH'
  if (a >= 1e-6) return trim(h * 1e6) + 'µH'
  return trim(h * 1e9) + 'nH'
}

// 标准电感值展平（E12+E24 按数量级），label 按实际量级
const STD_BASE = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
const STDLIB = []
for (const mag of [-3, -2, -1, 0, 1, 2, 3]) {
  const m = Math.pow(10, mag)
  for (const v of STD_BASE) STDLIB.push({ raw: v * m, label: fmtInductor(v * m) })
}
function findClosestStd(value) {
  if (value <= 0 || !isFinite(value)) return null
  let best = STDLIB[0], bd = Math.abs(Math.log(value / STDLIB[0].raw))
  for (const s of STDLIB) { const d = Math.abs(Math.log(value / s.raw)); if (d < bd) { best = s; bd = d } }
  return best
}
const stdLabel = (v) => findClosestStd(v)?.label ?? `${(v * 1000).toFixed(1)}mH`

function getPart(t) { return partsData[t] || null }
function findMaterial(m) { return materials[m] || materials.PC40 }
function recommendPowerSet(P) { return cores.filter((c) => c.maxPower >= P * 1.2) }

// 线径：按目标截面积挑最小够粗的线（裸铜）
function findWireForArea(targetArea) {
  let chosen = awgTable[awgTable.length - 1]
  for (const a of awgTable) { if (a.areaMm2 >= targetArea) { chosen = a; break } }
  return chosen
}
// 选线：多股策略（单股够→1股；不够→尽量并绕，单股截面积按 J 反推）
function pickWire(rmsA) {
  const target = rmsA / J
  const single = findWireForArea(target)
  if (single.areaMm2 >= target * 0.8) {
    return { awg: single.awg, strands: 1, perArea: single.areaMm2, diaMM: single.diaMM }
  }
  let strands = Math.min(Math.ceil(target / single.areaMm2), 8)
  const pack = findWireForArea(target / strands)
  return { awg: pack.awg, strands, perArea: pack.areaMm2, diaMM: pack.diaMM }
}
function wireArea(w) { return w.perArea * w.strands }

// 铁损估算（归一化 Steinmetz，mW/cm³）
function coreLossDensityB(fkHz, dBT) {
  const B = dBT / 2
  return K_STEIN.k * Math.pow(fkHz / 100, K_STEIN.a) * Math.pow(B / 0.1, K_STEIN.b) // mW/cm³
}

// 器件耐压推荐
function pickMosfet(vdsReq) {
  const opts = [100, 200, 500, 600, 650]
  for (const v of opts) if (v >= vdsReq) return `MOSFET ${v}V`
  return `>650V（改用更高耐压/其它拓扑）`
}
function pickDiode(vrReq) {
  if (vrReq <= 100) return '肖特基二极管（低 Vf）'
  if (vrReq <= 400) return '快恢复 FR/UF（UF4007/FR107 级）'
  return '高压快恢复 / 建议同步整流'
}

// ── 对单个磁芯试算完整设计；不合格返回 null ──
function tryDesign(inp, core, Pout, Ppri, VinMin, VinMax, Vo, Vf, VsecTotal, VorEff, n, Dmax, Eta, dBmax, Fs, mat) {
  const Ae = core.Ae / 1e6
  const NpMin = (VinMin * Dmax) / (dBmax * Ae * Fs)
  const Km = 1.5
  const NpReal = Math.ceil(NpMin * Km)
  const NsReal = Math.round(NpReal / n)
  const nA = NpReal / NsReal
  const VorA = VsecTotal * nA
  const DmaxA = VorA / (VinMin + VorA)
  // 精确临界电感：用 Vo'(Vo+Vf)
  const Lcrit = (nA * nA * VsecTotal * Vo * (1 - DmaxA) * (1 - DmaxA)) / (2 * Pout * Fs)

  const modeRcmd = Pout < 15 ? 'dcm' : 'ccm'
  const designMode = inp.preferredMode === 'auto' ? modeRcmd : inp.preferredMode
  const isCCM = designMode === 'ccm'
  const r = 0.35
  const LpCCM = 1.5 * Lcrit
  const ILavgCCM = Pout / (Eta * VinMin * DmaxA)
  const IpkCCM = ILavgCCM * (1 + r / 2)
  const IvalCCM = ILavgCCM * (1 - r / 2)
  const IrmsCCM = IpkCCM * Math.sqrt(DmaxA * (1 + r * r / 3))
  const LpDCM = (VinMin * VinMin * DmaxA * DmaxA) / (2 * Ppri * Fs)
  const IpkDCM = Math.sqrt(2 * Ppri / (LpDCM * Fs))
  const IrmsDCM = IpkDCM * Math.sqrt(DmaxA / 3)

  const Lp = isCCM ? LpCCM : LpDCM
  const Ipk = isCCM ? IpkCCM : IpkDCM
  const IpriRms = isCCM ? IrmsCCM : IrmsDCM
  const IspkSec = Ipk * nA
  // 次级 RMS
  const Dp = 1 - DmaxA
  let IsecRms
  if (isCCM) {
    const IvalSec = IvalCCM * nA
    IsecRms = Math.sqrt(Dp * (IspkSec * IspkSec + IspkSec * IvalSec + IvalSec * IvalSec) / 3)
  } else {
    IsecRms = IspkSec * Math.sqrt(Dp / 3)
  }

  // 气隙
  const lgMm = (MU0 * NpReal * NpReal * Ae) / Lp * 1000
  // ΔB 实际工作值（法拉第反推）
  const dBact = (VinMin * DmaxA) / (NpReal * Ae * Fs)
  // 材料饱和安全上限（100℃ 降额 ~0.75，再留裕量 0.9）
  const BsEff = (mat.BsT || 0.39) * 0.75
  const BsatOk = dBact <= BsEff
  // 选线（按 RMS）
  const priWire = pickWire(IpriRms * 1.05)
  const secWire = pickWire(IsecRms * 1.05)
  const Apri = wireArea(priWire)
  const Asec = wireArea(secWire)
  // 窗口填充
  const needArea = (NpReal * Apri + NsReal * Asec) / K_UTIL
  const fill = needArea / core.Aw
  const gapOk = lgMm <= core.maxGap
  if (!(fill <= 1 && gapOk && BsatOk && lgMm > 0)) return null

  // 铜损
  const MLT_m = core.MLT * 1e-3
  const Rpri = RHO_CU * MLT_m * NpReal / (Apri * 1e-6)
  const Rsec = RHO_CU * MLT_m * NsReal / (Asec * 1e-6)
  const Pcu = IpriRms * IpriRms * Rpri + IsecRms * IsecRms * Rsec
  // 铁损
  const fkHz = Fs / 1000
  const VeCm3 = core.Ve / 1000
  const Pcore = coreLossDensityB(fkHz, dBact) / 1000 * VeCm3
  const Ptot = Pcu + Pcore
  const effEst = Pout / (Pout + Ptot) * 100
  const Rth = 40 / Math.sqrt(VeCm3) // ℃/W 粗略
  const dT = Ptot * Rth
  // 漏感 + 器件应力
  const Lleak = K_LEAK * Lp
  const Vspike = K_SPIKE * VorA
  const VdcMax = VinMax
  const Vsw = VdcMax + VorA + Vspike
  const vdsReq = Vsw * 1.25
  const mosfet = pickMosfet(vdsReq)
  const VrDiode = VdcMax / nA + VsecTotal
  const vrReq = VrDiode * 1.3
  const diode = pickDiode(vrReq)

  return {
    core, NpMin: Math.floor(NpMin), Np: NpReal, Ns: NsReal, nA, VorA, DmaxA,
    Lcrit, Lp, Ipk, IpriRms, IspkSec, IsecRms, lgMm, dBact, BsEff,
    fill, needArea, gapOk, BsatOk, priWire, secWire, Rpri, Rsec,
    Pcu, Pcore, Ptot, effEst, dT, Lleak, Vspike, Vsw, vdsReq, mosfet, VrDiode, vrReq, diode,
    LpLabel: stdLabel(Lp), LcritLabel: stdLabel(Lcrit),
  }
}

// ── 核心计算入口 ──
export function computeFlyback(inp) {
  const VinMin = parseFloat(inp.vinMin), VinMax = parseFloat(inp.vinMax)
  const Vo = parseFloat(inp.vo), Io = parseFloat(inp.io)
  const Fs = parseFloat(inp.fs) * 1e3, Eta = parseFloat(inp.eta) / 100
  const DdB = parseFloat(inp.dBmax), VorT = parseFloat(inp.vorTarget)
  const diode = getPart(inp.diodeType)
  if (!diode || [VinMin, VinMax, Vo, Io, Fs, Eta, DdB, VorT].some(isNaN)) {
    return { error: '请填写所有字段，检查格式是否正确' }
  }
  const Vf = diode.Vf
  const Pout = Vo * Io
  const VdcMin = VinMin * Math.sqrt(2)
  const VdcMax = VinMax * Math.sqrt(2)
  const VsecTotal = Vo + Vf
  const DmaxCap = 0.48
  const VorCap = DmaxCap * VdcMin / (1 - DmaxCap)
  const VorEff = Math.min(VorT, VorCap)
  const n = VorEff / VsecTotal
  const Dmax = VorEff / (VdcMin + VorEff)
  const Ppri = Pout / Eta
  const mat = findMaterial(inp.coreMaterial)

  // 磁芯迭代：从满足功率的最小磁芯开始，逐个试；全不合格则取功率最大的并给警告
  const candidates = recommendPowerSet(Pout).sort((a, b) => a.Ae - b.Ae)
  let best = null
  for (const core of candidates) {
    const d = tryDesign(inp, core, Pout, Ppri, VdcMin, VdcMax, Vo, Vf, VsecTotal, VorEff, n, Dmax, Eta, DdB, Fs, mat)
    if (d) { best = d; break }
  }
  let usedFallback = false
  if (!best) {
    usedFallback = true
    const core = candidates[candidates.length - 1] || cores[cores.length - 1]
    best = tryDesign(inp, core, Pout, Ppri, VdcMin, VdcMax, Vo, Vf, VsecTotal, VorEff, n, Dmax, Eta, DdB, Fs, mat)
    // 保证有返回（最坏给一个近似，绝不为 null）
    if (!best) best = forcedDesign(inp, core, Pout, Ppri, VdcMin, VdcMax, Vo, Vf, VsecTotal, VorEff, n, Dmax, Eta, DdB, Fs, mat)
  }
  if (!best) return { error: '设计失败：请在给定输入下检查（功率/频率/磁芯选择是否合理）' }

  const rCore = best.core
  const modeStr = best.nA ? (Pout < 15 && inp.preferredMode === 'auto' ? 'dcm' : (inp.preferredMode === 'auto' ? 'ccm' : inp.preferredMode)) : 'ccm'
  const isCCM = modeStr === 'ccm'

  // 校验/提示
  const warnings = []
  if (VorT > VorCap) warnings.push(`⚠ 占空比控制(<50%)：目标 VOR ${VorT}V 会令占空比超 48%，已自动降为 ${VorEff.toFixed(0)}V（Dmax≈${(Dmax * 100).toFixed(1)}%）`)
  if (!best.BsatOk) warnings.push(`⚠ ΔB=${best.dBact.toFixed(3)}T 超过材料${mat.BsT}T 的 100℃ 安全上限 ${best.BsEff.toFixed(3)}T，磁芯会过热/饱和，建议降 ΔB 或换大磁芯`)
  if (best.fill > 1) warnings.push(`⚠ 窗口填充率 ${(best.fill * 100).toFixed(0)}% 超出 ${rCore.model} 窗口，放不下（建议换大磁芯或多股减线径）`)
  if (!best.gapOk) warnings.push(`⚠ 气隙 ${best.lgMm.toFixed(2)}mm 超出 ${rCore.model} 骨架气隙上限 ${rCore.maxGap}mm（需换中柱可磨更大的磁芯）`)
  if (Pout >= 65 && modeStr === 'ccm' && !inp.preferredMode) warnings.push('💡 65W 以上 CCM 峰值电流偏大，考虑半桥/LLC')
  if (Pout < 15 && modeStr === 'ccm') warnings.push('💡 小功率(<15W) 通常优先 DCM，控制更简单、无 RHP 零点')
  if (Pout > 20 && modeStr === 'dcm') warnings.push('💡 较大功率(>20W) 用 DCM 峰值/有效值电流偏高，建议 CCM')
  if (usedFallback) warnings.push(`⚠ 满足功率的磁芯均窗口/气隙/ΔB 超标，已取 ${rCore.model}（最大可用），请换更大磁芯或用多股减线径`)

  const conclusion = inp.preferredMode === 'auto'
    ? (isCCM ? `推荐 CCM —— ${Pout.toFixed(1)}W 属中功率，峰值低、发热小` : `推荐 DCM —— ${Pout.toFixed(1)}W 属小功率，控制简单`)
    : (isCCM ? `已选 CCM —— 峰值低、发热小；需 RCD 钳位` : `已选 DCM —— 控制简单；峰值高、EMI 偏大`)

  const LpCCM = best.Lcrit * 1.5, LpDCM = best.Lp
  const ILavgCCM = Pout / (Eta * VinMin * best.DmaxA)
  const IpkCCM = ILavgCCM * 1.175, IrmsCCM = IpkCCM * Math.sqrt(best.DmaxA * (1 + 0.35 * 0.35 / 3))
  const IspkCCM = IpkCCM * best.nA
  const ILavgSecCCM = Io / (1 - best.DmaxA)
  const IpkDCM = best.Ipk, IrmsDCM = best.IpriRms, IspkDCM = best.IspkSec

  return {
    input: { VinMin, VinMax, Vo, Io, Eta: parseFloat(inp.eta), coreMaterial: inp.coreMaterial, dBmax: DdB, vorTarget: VorT },
    derived: {
      VdcMin, VsecTotal, n, nActual: best.nA, Dmax, DmaxActual: best.DmaxA, Ppri, Pout,
      coreModel: rCore.model, materialName: `${inp.coreMaterial}(${mat.manufacturer})`,
      Ae: rCore.Ae, AeLe: rCore.Ae * rCore.Le, Ve: rCore.Ve, Le: rCore.Le, Aw: rCore.Aw, maxGap: rCore.maxGap, source: rCore.source,
      Lcrit: best.Lcrit, LcritLabel: best.LcritLabel, mode: modeStr,
      dBact: best.dBact, Bsat: mat.BsT, BsEff: best.BsEff,
    },
    winding: {
      NpMin: best.NpMin, Np: best.Np, Ns: best.Ns, nActual: best.nA,
      VorActual: best.VorA, lg: best.lgMm.toFixed(2), gapOk: best.gapOk,
      fillPct: Math.round(best.fill * 100), needArea: best.needArea, warnings,
    },
    ccm: {
      Lp: LpCCM, LpLabel: stdLabel(LpCCM), Ipk: IpkCCM, Irms: IrmsCCM, secAvg: ILavgSecCCM, secPeak: IspkCCM,
    },
    dcm: {
      Lp: LpDCM, LpLabel: stdLabel(LpDCM), Ipk: IpkDCM, Irms: IrmsDCM, secPeak: IspkDCM,
    },
    design: {
      mode: modeStr, Lp: best.Lp, LpLabel: best.LpLabel, lg: best.lgMm.toFixed(2),
      Ipk: best.Ipk, Irms: best.IpriRms, IsPk: best.IspkSec, IsecRms: best.IsecRms,
      priAWG: `AWG ${best.priWire.awg}${best.priWire.strands > 1 ? '×' + best.priWire.strands : ''}`,
      secAWG: `AWG ${best.secWire.awg}${best.secWire.strands > 1 ? '×' + best.secWire.strands : ''}`,
    },
    loss: {
      Pcu: best.Pcu, Pcore: best.Pcore, Ptot: best.Ptot, eff: best.effEst, dT: best.dT,
      Rpri: best.Rpri, Rsec: best.Rsec, Lleak: best.Lleak, VeCm3: rCore.Ve / 1000,
    },
    stress: {
      Vsw: best.Vsw, Vspike: best.Vspike, vdsReq: best.vdsReq, mosfet: best.mosfet,
      VrDiode: best.VrDiode, vrReq: best.vrReq, diode: best.diode,
    },
    conclusion,
  }
}

// 兜底：即使窗口/气隙超，也返回一个可显示的近似设计（带警告），避免空白
function forcedDesign(inp, core, Pout, Ppri, VinMin, VinMax, Vo, Vf, VsecTotal, VorEff, n, Dmax, Eta, dBmax, Fs, mat) {
  const Ae = core.Ae / 1e6
  const NpMin = (VinMin * Dmax) / (dBmax * Ae * Fs)
  const Np = Math.ceil(NpMin * 1.5), Ns = Math.round(Np / n), nA = Np / Ns
  const DmaxA = (VsecTotal * nA) / (VinMin + VsecTotal * nA)
  const Lcrit = (nA * nA * VsecTotal * Vo * (1 - DmaxA) * (1 - DmaxA)) / (2 * Pout * Fs)
  const Lp = (VinMin * VinMin * DmaxA * DmaxA) / (2 * Ppri * Fs)
  const Ipk = Math.sqrt(2 * Ppri / (Lp * Fs)), IsecRms = 0.5 * nA * Ipk, IpriRms = Ipk * Math.sqrt(DmaxA / 3)
  const lgMm = (MU0 * Np * Np * Ae) / Lp * 1000
  const dBact = (VinMin * DmaxA) / (Np * Ae * Fs)
  const VdcMax = VinMax
  const Vsw = VdcMax + VsecTotal * nA + K_SPIKE * VsecTotal * nA
  const VrDiode = VdcMax / nA + VsecTotal
  const priWire = pickWire(IpriRms), secWire = pickWire(IsecRms)
  const Apri = wireArea(priWire), Asec = wireArea(secWire)
  const fill = (Np * Apri + Ns * Asec) / K_UTIL / core.Aw
  return {
    core, NpMin: Math.floor(NpMin), Np, Ns, nA, VorA: VsecTotal * nA, DmaxA,
    Lcrit, Lp, Ipk, IpriRms, IspkSec: nA * Ipk, IsecRms, lgMm, dBact,
    BsEff: (mat.BsT || 0.39) * 0.75, BsatOk: dBact <= (mat.BsT || 0.39) * 0.75,
    fill, needArea: (Np * Apri + Ns * Asec) / K_UTIL, gapOk: lgMm <= core.maxGap,
    priWire, secWire, Rpri: 0, Rsec: 0, Pcu: 0, Pcore: 0, Ptot: 0, effEst: Eta * 100, dT: 0,
    Lleak: K_LEAK * Lp, Vspike: K_SPIKE * VsecTotal * nA, Vsw, vdsReq: Vsw * 1.25,
    mosfet: pickMosfet(Vsw * 1.25), VrDiode, vrReq: VrDiode * 1.3, diode: pickDiode(VrDiode * 1.3),
    LpLabel: stdLabel(Lp), LcritLabel: stdLabel(Lcrit),
  }
}
