// Buck 输出电感引擎单测（node 直跑，无 vue 依赖）
// 基准：式(9)(10) 解析值（独立手算）＋ TI 文档选档示例（L_MIN 7.17µH → 标准 8.2µH）
import { computeBuckInductor, selectStandardL } from '/home/hermes/projects/hw-tools/src/core/buck-inductor.js'

let pass = 0, fail = 0
function approx(name, got, want, tolPct = 0.5) {
  const rel = Math.abs(got - want) / Math.abs(want) * 100
  if (rel < tolPct) { pass++; console.log(`  ✓ ${name}  (${got.toFixed(4)} vs ${want})`) }
  else { fail++; console.log(`  ✗ ${name}  got ${got.toFixed(4)}  want ${want}  (差 ${rel.toFixed(2)}%)`) }
}
function eq(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name}  (${got})`) }
  else { fail++; console.log(`  ✗ ${name}  got ${got}  want ${want}`) }
}

console.log('── 案例 A：24V→5V/2A，f=500kHz，K=0.4（Vin_max=26.4V）──')
// 解析手算：Lmin = 5×21.4/(26.4×500k×2×0.4) = 10.1326µH → 标准 12µH
let r = computeBuckInductor({ vinMax: 26.4, vout: 5, iout: 2, fsw: 500e3, kInd: 0.4 })
approx('L_MIN = 10.1326µH', r.lminUH, 10.1326, 0.1)
eq('自动选标准档 12µH', r.lselUH, 12)
approx('ΔI_L @12µH = 0.67551A', r.dIL, 0.67551, 0.1)
approx('纹波率 = 33.78%', r.ripplePct * 100, 33.775, 0.5)
approx('I_pk = 2.3378A', r.ipk, 2.33775, 0.1)
approx('I_rms = 2.0095A', r.irms, 2.00948, 0.1)
approx('占空比 D = 18.94%', r.duty * 100, 18.939, 0.5)
approx('DCR 上限 = 24.76mΩ', r.dcrMaxOhm * 1000, 24.765, 0.5)
approx('Isat 需求 = 2.805A（1.2×）', r.isatNeed, 2.8053, 0.5)
eq('Isat 建议档 3A', r.isatRec, 3)
eq('未填 Vin 时不应标记估算', r.vinAssumed, false)
eq('无告警', r.warnings.length, 0)

console.log('── 案例 B：36V→12V/3A，f=300kHz，K=0.3 ──')
// Lmin = 12×24/(36×300k×3×0.3) = 29.6296µH → 33µH
r = computeBuckInductor({ vinMax: 36, vout: 12, iout: 3, fsw: 300e3, kInd: 0.3 })
approx('L_MIN = 29.6296µH', r.lminUH, 29.6296, 0.1)
eq('标准档 33µH', r.lselUH, 33)
approx('I_rms = 3.0091A', r.irms, 3.00906, 0.1)
eq('Isat 建议档 5A', r.isatRec, 5)   // 1.2×3.404 = 4.085 → 5A

console.log('── 案例 C：只填 Vin=12 → 自动 Vin_max=13.2 ──')
r = computeBuckInductor({ vin: 12, vout: 3.3, iout: 10, fsw: 400e3, kInd: 0.4 })
approx('推算 Vin_max = 13.2V', r.vinMax, 13.2, 0.01)
eq('标记为估算值', r.vinAssumed, true)
// Lmin = 3.3×9.9/(13.2×400k×10×0.4) = 32.67/21.12e6 = 1.5469µH → 1.8µH
approx('L_MIN = 1.5469µH', r.lminUH, 1.5469, 0.2)
eq('标准档 1.8µH', r.lselUH, 1.8)
eq('有"按 110% 估算"提示', r.warnings.some(w => w.includes('110%')), true)

console.log('── 案例 D：手填感值不足 → 告警 ──')
r = computeBuckInductor({ vinMax: 26.4, vout: 5, iout: 2, fsw: 500e3, kInd: 0.4, lUH: 6.8 })
eq('采用手填值 6.8µH', r.lselUH, 6.8)
eq('标记 manual', r.manual, true)
eq('感值不足告警', r.warnings.some(w => w.includes('小于最小感值')), true)
eq('纹波率偏高告警', r.warnings.some(w => w.includes('纹波率')), true)
approx('ΔI @6.8µH = 1.1921A', r.dIL, 1.19207, 0.2)

console.log('── 案例 E：TI 文档选档示例 L_MIN 7.17µH → 8.2µH ──')
eq('7.17µH → 8.2µH', selectStandardL(7.17).lselUH, 8.2)
eq('恰好等于标准档时取该档（12µH）', selectStandardL(12).lselUH, 12)
eq('超表尾标记 over', selectStandardL(5000).over, true)

console.log('── 案例 F：输入校验 ──')
eq('Vin ≤ Vout 报错', !!computeBuckInductor({ vinMax: 5, vout: 5, iout: 1, fsw: 500e3 }).error, true)
eq('缺 Vout 报错', !!computeBuckInductor({ vinMax: 24, iout: 1, fsw: 500e3 }).error, true)
eq('缺输入电压报错', !!computeBuckInductor({ vout: 5, iout: 1, fsw: 500e3 }).error, true)
eq('缺 fsw 报错', !!computeBuckInductor({ vinMax: 24, vout: 5, iout: 1 }).error, true)

console.log(`\n${fail === 0 ? '✅' : '❌'}  Buck 电感引擎：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
