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

// ── 通用反推：多行串联网络中求唯一未知电阻 ──
// rows: [{mode:'series'|'parallel', values:[Ω|...|null]}]，全网络恰好一个 null（待求 x）
// ref: {type:'row'|'node', index}
//   'row'  → 第 index 行两端压降 = v（Vcc 流经该行的电压）
//   'node' → 节点 index 对地电压 = v；节点 0 = Vcc 顶端，节点 N = GND（N=行数），
//            节点 k（0<k<N）位于第 k-1 行与第 k 行之间
// 返回 {rx, rTotal}（Ω）或 null（无解/条件非法）
export function solveUnknownResistor(rows, vcc, v, ref) {
  if (!rows || !rows.length || vcc == null || v == null || !ref) return null
  if (!isFinite(vcc) || vcc <= 0 || !isFinite(v) || v <= 0 || v >= vcc) return null

  // 每行等效值随 x 变化的函数
  const fns = rows.map((row) => {
    if (!row.values || row.values.length === 0) return () => 0 // 空行跳过（等效 0Ω）
    const known = row.values.filter((val) => val != null && isFinite(val) && val > 0)
    const hasX = row.values.some((val) => val == null)
    if (!hasX) {
      const eq = rowEquiv(row.mode, known)
      return isFinite(eq) ? () => eq : null
    }
    if (known.length === 0) return (x) => x // 整行只有未知电阻
    if (row.mode === 'series') {
      const base = known.reduce((a, b) => a + b, 0)
      return (x) => base + x
    }
    // 并联：1/R = 1/x + Σ(1/已知)
    const invKnown = known.reduce((a, b) => a + 1 / b, 0)
    return (x) => 1 / (invKnown + 1 / x)
  })
  if (fns.some((f) => f === null)) return null
  // 没有任何未知量 → 无需反推
  if (!rows.some((row) => row.values.some((val) => val == null))) return null

  const rTotal = (x) => fns.reduce((a, f) => a + f(x), 0)
  const below = (x, k) => { // 节点 k 到 GND 的等效（行 k..N-1）
    let s = 0
    for (let i = k; i < fns.length; i++) s += fns[i](x)
    return s
  }

  // 电压比目标
  let ratioFn
  if (ref.type === 'row') {
    const i = ref.index
    if (i < 0 || i >= fns.length) return null
    ratioFn = (x) => fns[i](x) / rTotal(x)
  } else if (ref.type === 'node') {
    const k = ref.index
    if (k < 1 || k >= fns.length) return null // 节点 0=Vcc、节点 N=GND 无意义
    ratioFn = (x) => below(x, k) / rTotal(x)
  } else {
    return null
  }

  const target = v / vcc
  // x 在 [lo,hi] 内二分（单调函数，用边界定方向）；相对精度收敛
  let lo = 1e-3, hi = 1e12
  let fLo = ratioFn(lo) - target
  let fHi = ratioFn(hi) - target
  if (fLo * fHi > 0) return null // 同号：目标电压比不在可达范围内
  let x = null
  for (let i = 0; i < 300; i++) {
    x = (lo + hi) / 2
    const fx = ratioFn(x) - target
    if (Math.abs(fx) < 1e-14 || (hi - lo) / x < 1e-12) break
    if (fx * fLo < 0) hi = x
    else { lo = x; fLo = fx }
  }
  if (x == null || !isFinite(x) || x <= 0) return null
  return { rx: x, rTotal: rTotal(x) }
}

// ── 多电压点反推：Vcc 可选，任意 ≥1 个电压点（含 Vcc 时）或 ≥2 个电压点（无 Vcc） ──
// rows: [{mode, values:[Ω|null...]}]，恰好一个 null（待求 x）
// vcc: 顶部电压（Ω 数值）或 null（未知，靠电压点反推）
// points: [{index, v}]，index=节点位置（第 index 行之后，1..N-1），v=该点对地电压
// 隐含 GND：节点 N 电压 0（最末端）
// 返回 {rx, rTotal, vcc}（vcc 为反推值或原值）或 null
export function solveVoltagePoints(rows, vcc, points) {
  if (!rows || !rows.length || !points || !points.length) return null
  // 电压点位置合法性：1..N-1
  const N = rows.length
  const pts = points
    .filter((p) => p && p.index >= 1 && p.index < N && p.v != null && isFinite(p.v) && p.v > 0)
    .map((p) => ({ index: p.index, v: p.v }))
    .sort((a, b) => a.index - b.index)
  if (!pts.length) return null
  // 位置去重
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].index === pts[i - 1].index) return null
  }

  // 每行等效值随 x 变化的函数（与 solveUnknownResistor 相同）
  const fns = rows.map((row) => {
    if (!row.values || row.values.length === 0) return () => 0 // 空行跳过（等效 0Ω）
    const known = row.values.filter((val) => val != null && isFinite(val) && val > 0)
    const hasX = row.values.some((val) => val == null)
    if (!hasX) {
      const eq = rowEquiv(row.mode, known)
      return isFinite(eq) ? () => eq : null
    }
    if (known.length === 0) return (x) => x
    if (row.mode === 'series') {
      const base = known.reduce((a, b) => a + b, 0)
      return (x) => base + x
    }
    const invKnown = known.reduce((a, b) => a + 1 / b, 0)
    return (x) => 1 / (invKnown + 1 / x)
  })
  if (fns.some((f) => f === null)) return null
  if (!rows.some((row) => row.values.some((val) => val == null))) return null

  const rTotal = (x) => fns.reduce((a, f) => a + f(x), 0)
  const below = (x, k) => {
    let s = 0
    for (let i = k; i < fns.length; i++) s += fns[i](x)
    return s
  }

  // 二分求比值方程：ratioFn(x) = target（单调）
  const bisect = (ratioFn, target) => {
    let lo = 1e-3, hi = 1e12
    let fLo = ratioFn(lo) - target
    let fHi = ratioFn(hi) - target
    if (fLo * fHi > 0) return null
    let x = null
    for (let i = 0; i < 300; i++) {
      x = (lo + hi) / 2
      const fx = ratioFn(x) - target
      if (Math.abs(fx) < 1e-14 || (hi - lo) / x < 1e-12) break
      if (fx * fLo < 0) hi = x
      else { lo = x; fLo = fx }
    }
    return x != null && isFinite(x) && x > 0 ? x : null
  }

  // 回代校验：给定 x，算各电压点电压并与输入比对（相对误差容差）
  const verify = (x, vccGuess) => {
    const Rt = rTotal(x)
    for (const p of pts) {
      const vCalc = vccGuess * below(x, p.index) / Rt
      if (Math.abs(vCalc - p.v) > 1e-6 * Math.max(p.v, 1e-9)) return false
    }
    return true
  }

  // 各节点对地电压（结果展示用）：nodeVoltages[index] = V
  const nodeVoltages = (x, vccGuess) => {
    const Rt = rTotal(x)
    const out = []
    for (const p of pts) out.push({ index: p.index, v: vccGuess * below(x, p.index) / Rt })
    return out
  }

  let candidate = null

  if (vcc != null && isFinite(vcc) && vcc > 0) {
    // Vcc 已知：用第一个电压点求 x：v_1/vcc = below(index1)/R_total
    const p0 = pts[0]
    const ratioFn = (x) => below(x, p0.index) / rTotal(x)
    const x = bisect(ratioFn, p0.v / vcc)
    if (x != null && verify(x, vcc)) candidate = { rx: x, rTotal: rTotal(x), vcc, nodes: nodeVoltages(x, vcc) }
  } else {
    // Vcc 未知：需要 ≥2 个点，用相邻点对比例求 x，再回代全部点
    if (pts.length < 2) return null
    // 依次尝试相邻点对（a 在上，b 在下）：v_a/v_b = below(a)/below(b)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      if (a.v <= b.v) continue // 电压必须沿链递减，否则物理不可能
      const ratioFn = (x) => below(x, a.index) / below(x, b.index)
      const x = bisect(ratioFn, a.v / b.v)
      if (x == null) continue
      // 用第一个点反推 vcc
      const vccGuess = a.v * rTotal(x) / below(x, a.index)
      if (vccGuess > 0 && verify(x, vccGuess)) {
        candidate = { rx: x, rTotal: rTotal(x), vcc: vccGuess, nodes: nodeVoltages(x, vccGuess) }
        break
      }
    }
  }
  return candidate
}
