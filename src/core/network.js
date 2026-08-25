// ── 串并联网络计算（纯逻辑，可 node 直测） ──
// 模型：多行网络，每行 = { mode: 'series'|'parallel', resistors: [Ω...] }
// 行内按 mode 合并，行与行之间串联，最终 = 各行等效值之和

export function seriesSum(resistors) {
  return resistors.reduce((a, b) => a + b, 0)
}

export function parallelSum(resistors) {
  if (!resistors.length) return 0
  let inv = 0
  for (const r of resistors) {
    if (r <= 0) return NaN
    inv += 1 / r
  }
  return 1 / inv
}

// 单行等效值；非法（空列表/含非正值）返回 NaN
export function rowEquiv(mode, resistors) {
  const list = (resistors || []).filter((v) => v != null && isFinite(v) && v > 0)
  if (!list.length) return NaN
  if (mode === 'parallel') return parallelSum(list)
  return seriesSum(list)
}

// 多行网络总等效（行内合并 → 行间串联；空行跳过）
export function networkEquiv(rows) {
  if (!rows || !rows.length) return NaN
  let total = 0
  let hasAny = false
  for (const row of rows) {
    const list = (row.resistors || []).filter((v) => v != null && isFinite(v) && v > 0)
    if (!list.length) continue // 空行跳过
    hasAny = true
    const eq = rowEquiv(row.mode, list)
    if (!isFinite(eq)) return NaN
    total += eq
  }
  return hasAny ? total : NaN
}

// 分压下臂电阻：Vcc → R_net → Vout → Rx → GND
// Rx = R_net × Vout / (Vcc − Vout)；无解返回 null
export function dividerRx(rNet, vcc, vout) {
  if (rNet == null || vcc == null || vout == null) return null
  if (!isFinite(rNet) || rNet <= 0 || vcc <= 0 || vout <= 0) return null
  if (vout >= vcc) return null
  return (rNet * vout) / (vcc - vout)
}
