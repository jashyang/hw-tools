// PCB 阻抗引擎单测（node 直跑，无 vue 依赖）—— 对标 Polar SI9000 基准
import { computeImpedance, MIL } from '/home/hermes/projects/hw-tools/src/core/impedance.js'

let pass = 0, fail = 0
function approx(name, got, want, tolPct = 0.02) {
  // 相对误差百分比判定 (默认 2%)
  const rel = Math.abs(got - want) / Math.abs(want) * 100
  if (rel < tolPct) { pass++; console.log(`  ✓ ${name}  (${got.toFixed(3)} vs ${want}, 差 ${rel.toFixed(2)}%)`) }
  else { fail++; console.log(`  ✗ ${name}  got ${got.toFixed(4)}  want ${want}  (差 ${rel.toFixed(2)}%)`) }
}

// ── 单端微带（简化 ΔW）──
// C1: Polar 基准 H8.5 W1=7 W2=6 T1.2 Er4.2 → 75.18
let r = computeImpedance({ model:'sms', er:4.2, H:8.5*MIL, T:1.2*MIL, W1:7*MIL })
approx('单端微带 C1 (75.18Ω)', r.Z, 75.18, 0.5)
// C2: Polar 基准 H4.2 W1=9.5 W2=8.5 T2.2 Er3.95 → 43.91
r = computeImpedance({ model:'sms', er:3.95, H:4.2*MIL, T:2.2*MIL, W1:9.5*MIL })
approx('单端微带 C2 (43.91Ω)', r.Z, 43.91, 1.0)

// ── 差分微带（Jensen ΔW）──
// C3: Polar 基准 H4.2 W1=6 W2=5 S8 T2.2 Er3.95 → 100.44
r = computeImpedance({ model:'diff', er:3.95, H:4.2*MIL, T:2.2*MIL, W1:6*MIL, S:8*MIL })
approx('差分微带 C3 (100.44Ω)', r.Z, 100.44, 0.5)

// ── 反解一致性：回代应等于目标 ──
r = computeImpedance({ model:'sms', er:4.2, H:8.5*MIL, T:1.2*MIL, targetZ:50, direction:'solve' })
approx('单端反解50Ω → 回代Z0', r.Z, 50, 0.01)
r = computeImpedance({ model:'diff', er:3.95, H:4.2*MIL, T:2.2*MIL, S:8*MIL, targetZ:100.44, direction:'solve' })
approx('差分反解100.44Ω → 回代Zdiff', r.Z, 100.44, 0.01)
// 差分反解回到 Polar 的 W1=6（附近）
r = computeImpedance({ model:'diff', er:3.95, H:4.2*MIL, T:2.2*MIL, S:8*MIL, targetZ:100.44, direction:'solve' })
approx('差分反解 W1≈6mil (5.97)', r.W1 / MIL, 5.966, 0.2)

// ── W2 = W1 − 1mil 规则 ──
r = computeImpedance({ model:'sms', er:4.2, H:8.5*MIL, T:1.2*MIL, W1:7*MIL })
approx('W2 = W1 − 1mil (6)', r.W2 / MIL, 6, 0.01)

// ── 带状线 sanity（无基准，仅确认有限值）──
r = computeImpedance({ model:'sl', er:4.2, b:24*MIL, T:1.37*MIL, W1:8*MIL })
if (isFinite(r.Z) && r.Z > 0) { pass++; console.log(`  ✓ 带状线有限值 (Z0=${r.Z.toFixed(2)}Ω)`) }
else { fail++; console.log(`  ✗ 带状线 NaN/非法: ${r.Z}`) }

// ── 输入校验 ──
r = computeImpedance({ model:'sms', er:4.2, H:8.5*MIL, T:1.2*MIL, direction:'solve' })
if (r.error) { pass++; console.log(`  ✓ 缺目标阻抗报错: ${r.error}`) }
else { fail++; console.log('  ✗ 缺目标阻抗未报错') }

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
