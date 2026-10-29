// ── Buck（降压）输出电感计算引擎（纯 JS，可 node 直测）──
// 依据 TI《降压变换器设计》7.2.2.3 输出电感器选型：
//   式(9)  ΔI_L   = Vout·(Vin_max − Vout) / (Vin_max · L · fsw)
//   式(10) L_MIN  = (Vin_max − Vout)/Iout · Vout/(Vin_max·fsw) / K_IND
//                 = Vout·(Vin_max − Vout) / (Vin_max · fsw · Iout · K_IND)
// 关键约定：
//   · 纹波在最高输入电压下最大（f(Vin)=Vout(1−Vout/Vin) 随 Vin 单调增）→ 一律按 Vin_max 设计
//   · 只知 Vin 时按 Vin_max ≈ Vin × 110% 估算（用户指定）
//   · K_IND（纹波系数 ΔI/Iout）合理区间 20%~40%，默认 40%
//   · 选型三件套：感值取不小于 L_MIN 的最小标准档；饱和电流 Isat > I_pk 并留裕量；额定 RMS ≳ I_rms
// 单位：引擎内部 V/A/Hz/H；对外显示 µH / mΩ。

// 市售功率电感常见感值档（µH），E12 系＋大感量补档
export const STD_IND_UH = [
  1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2,
  10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82, 100, 150, 220, 330, 470, 680, 1000,
]

// 一体成型/绕线电感的常见饱和电流档（A），用于给"建议 Isat"
export const ISAT_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100]

/** 取不小于 lmin 的最小标准感值；超出表尾则返回最大值并标记 */
export function selectStandardL(lminUH) {
  for (const s of STD_IND_UH) {
    if (s >= lminUH * 0.999999) return { lselUH: s, fromStd: true, over: false }
  }
  const last = STD_IND_UH[STD_IND_UH.length - 1]
  return { lselUH: last, fromStd: false, over: true }
}

/** 饱和电流建议取档：不小于 need 的最小常见档（超出表尾则向上取整到 10A 的倍数） */
export function selectIsatStep(need) {
  for (const s of ISAT_STEPS) if (s >= need) return s
  return Math.ceil(need / 10) * 10
}

/**
 * @param {object} p
 * @param {number} [p.vinMax] 最大输入电压 V（与 p.vin 二选一）
 * @param {number} [p.vin]    标称输入电压 V（按 ×1.1 推 Vin_max）
 * @param {number} p.vout     输出电压 V
 * @param {number} p.iout     输出电流 A
 * @param {number} p.fsw      开关频率 Hz
 * @param {number} [p.kInd]   纹波系数 ΔI/Iout（0.2~0.4，默认 0.4）
 * @param {number} [p.lUH]    实际选定感值 µH（选填：填了就按它验算而非自动选档）
 * @param {number} [p.isatMargin] Isat 相对 I_pk 的裕量倍数（默认 1.2）
 */
export function computeBuckInductor({ vinMax, vin, vout, iout, fsw, kInd = 0.4, lUH = null, isatMargin = 1.2 } = {}) {
  const num = (x) => (typeof x === 'number' && isFinite(x) && x > 0 ? x : null)
  const Vo = num(vout), Io = num(iout), f = num(fsw)
  if (!Vo) return { error: '请填写输出电压 Vout' }
  if (!Io) return { error: '请填写输出电流 Iout' }
  if (!f) return { error: '请填写开关频率 fsw' }

  const vinAssumed = num(vinMax) == null
  const Vin = num(vinMax) ?? (num(vin) != null ? num(vin) * 1.1 : null)
  if (!Vin) return { error: '请填写 Vin_max，或填 Vin（自动按 110% 估算 Vin_max）' }
  if (Vin <= Vo) return { error: `Buck 要求 Vin > Vout（当前 Vin_max=${Vin.toFixed(2)}V ≤ Vout=${Vo}V）` }

  const K = num(kInd) ?? 0.4
  const margin = num(isatMargin) ?? 1.2

  // 式(10)：最小感值
  const lminH = (Vo * (Vin - Vo)) / (Vin * f * Io * K)
  const lminUH = lminH * 1e6

  // 感值：手动填入则原样验算，否则取标准档
  const manual = num(lUH) != null
  let lselUH, fromStd = false, over = false
  if (manual) {
    lselUH = num(lUH)
  } else {
    ;({ lselUH, fromStd, over } = selectStandardL(lminUH))
  }

  // 式(9)：用选定感值回算纹波（Vin_max 下的最坏情况）
  const dIL = (Vo * (Vin - Vo)) / (Vin * lselUH * 1e-6 * f)
  const ripplePct = dIL / Io
  const ipk = Io + dIL / 2
  const ilow = Io - dIL / 2
  const irms = Math.sqrt(Io * Io + (dIL * dIL) / 12) // 直流 + 三角波纹波的有效值
  const D = Vo / Vin
  const pout = Vo * Io

  const isatNeed = ipk * margin
  const isatRec = selectIsatStep(isatNeed)
  // 铜损预算 1% Pout → DCR 上限
  const dcrMaxOhm = (0.01 * pout) / (irms * irms)

  const warnings = []
  if (vinAssumed) warnings.push(`未填 Vin_max，已按 Vin × 110% = ${Vin.toFixed(2)}V 估算最高输入电压`)
  if (manual && lselUH < lminUH * 0.999) {
    warnings.push(`手填感值 ${lselUH}µH 小于最小感值 ${lminUH.toFixed(2)}µH，最坏输入下纹波会超过 K_IND`)
  }
  if (over) warnings.push(`所需感值超过档位上限 ${STD_IND_UH[STD_IND_UH.length - 1]}µH，需定制或提高开关频率`)
  if (K > 0.5) warnings.push('K_IND 超过 50%，纹波/峰值电流过大，建议回到 20%~40%')
  if (ripplePct > 0.5) warnings.push(`实际纹波率 ${(ripplePct * 100).toFixed(0)}% 偏高：输出纹波大、峰值电流高，峰值电流模式控制下易误触发过流保护`)
  if (ilow <= 0) warnings.push('谷值电流 ≤ 0：轻载/满载已进入 DCM，实际感量与环路需重新评估')
  if (D > 0.85) warnings.push(`占空比 ${(D * 100).toFixed(0)}% 偏高：Vin 与 Vout 太近，接近降压极限`)

  // ── 选型建议（面向采购/选料的落地口径）──
  const coreByCurrent =
    ipk < 3 ? '绕线式（铁氧体磁芯 + 漆包线，如 CD54/CD75）'
    : ipk < 10 ? '合金一体成型（如 IHLP/XAL 类，低 DCR、屏蔽好）'
    : '大电流一体成型或铁硅铝磁粉芯环形（如 XAL1510、CS 系列）'

  const suggestions = [
    {
      title: '感值',
      text: manual
        ? `手填 ${lselUH}µH ${lselUH >= lminUH ? '≥' : '<'} L_MIN ${lminUH.toFixed(2)}µH → ${lselUH >= lminUH ? '满足最小感量' : '不满足，需加大'}` +
          (fromStd ? '' : '')
        : `L_MIN ≈ ${lminUH.toFixed(2)}µH → 取标准档 ${lselUH}µH（不小于 L_MIN 的最小档，余量 ${((lselUH / lminUH - 1) * 100).toFixed(0)}%）`,
    },
    {
      title: '饱和电流',
      text: `峰值电流 I_pk = Iout + ΔI/2 ≈ ${ipk.toFixed(2)}A → 建议 Isat ≥ ${isatNeed.toFixed(2)}A（${margin}× 裕量），选 ≥ ${isatRec}A 档；务必按 100℃ 降额后的 Isat 判定，并覆盖输出短路/限流点的电流`,
    },
    {
      title: 'RMS 电流',
      text: `I_rms ≈ ${irms.toFixed(2)}A（含纹波发热效应）→ 电感额定/温升电流须 ≥ ${irms.toFixed(2)}A，否则满载温升超标`,
    },
    {
      title: 'DCR',
      text: `按铜损 ≤ 1% Pout（${pout.toFixed(1)}W）反推，DCR 上限 ≈ ${(dcrMaxOhm * 1000).toFixed(1)}mΩ；DCR 越小效率越高，但通常体积/成本上升`,
    },
    {
      title: '磁芯结构',
      text: `I_pk ${ipk.toFixed(2)}A 量级 → ${coreByCurrent}`,
    },
  ]

  return {
    vinMax: Vin,
    vinAssumed,
    vout: Vo,
    iout: Io,
    fsw: f,
    kInd: K,
    isatMargin: margin,
    lminUH,
    lselUH,
    manual,
    fromStd,
    over,
    dIL,
    ripplePct,
    ipk,
    ilow,
    irms,
    duty: D,
    pout,
    isatNeed,
    isatRec,
    dcrMaxOhm,
    warnings,
    suggestions,
  }
}
