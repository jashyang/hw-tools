// Buck 输出电感引擎单测（node 直跑，无 vue 依赖）
// 基准：式(9)(10) 解析值（独立手算）＋ 感值裕量选档（默认 30% 降额）＋ TI 选档示例
import { computeBuckInductor, selectStandardL, DEFAULT_DERATE } from '/home/hermes/projects/hw-tools/src/core/buck-inductor.js'

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

console.log('── 案例 A：24V→5V/2A，f=500kHz，K=0.4，裕量默认 30% ──')
// Lmin = 5×21.4/(26.4×500k×2×0.4) = 10.1326µH；门槛 10.1326/0.7 = 14.475µH → 15µH
let r = computeBuckInductor({ vinMax: 26.4, vout: 5, iout: 2, fsw: 500e3, kInd: 0.4 })
approx('L_MIN = 10.1326µH', r.lminUH, 10.1326, 0.1)
approx('选档门槛 = 14.475µH', r.lneedUH, 14.475, 0.1)
eq('默认裕量 30%', r.derate, DEFAULT_DERATE)
eq('推荐档 15µH（而非名义档 12µH）', r.lselUH, 15)
eq('名义档（不加裕量）12µH', r.lselNomUH, 12)
approx('最坏感值 = 10.5µH', r.lworstUH, 10.5, 0.01)
approx('名义纹波 ΔI = 0.54040A', r.dIL, 0.54040, 0.1)
approx('名义纹波率 27.02%', r.ripplePct * 100, 27.02, 0.5)
approx('最坏纹波 ΔI = 0.77201A', r.dILWorst, 0.77201, 0.1)
approx('最坏纹波率 38.60%（仍 ≤ K_IND 40%）', r.rippleWorstPct * 100, 38.60, 0.5)
eq('最坏纹波率不超过 K_IND', r.rippleWorstPct <= r.kInd + 1e-9, true)
approx('I_pk = 2.3860A（按最坏感值）', r.ipk, 2.3860, 0.1)
approx('I_rms = 2.0124A', r.irms, 2.0124, 0.1)
approx('Isat 需求 = 2.8632A', r.isatNeed, 2.8632, 0.5)
eq('Isat 建议档 3A', r.isatRec, 3)
approx('DCR 上限 = 24.69mΩ', r.dcrMaxOhm * 1000, 24.69, 0.5)
approx('名义档最坏纹波 48.25%（说明为何不能选 12µH）', r.rippleNomTierWorstPct * 100, 48.25, 0.5)
eq('无告警', r.warnings.length, 0)

console.log('── 案例 B：36V→12V/3A，f=300kHz，K=0.3 ──')
r = computeBuckInductor({ vinMax: 36, vout: 12, iout: 3, fsw: 300e3, kInd: 0.3 })
approx('L_MIN = 29.6296µH', r.lminUH, 29.6296, 0.1)
approx('门槛 = 42.328µH', r.lneedUH, 42.328, 0.2)
eq('推荐档 47µH', r.lselUH, 47)
eq('名义档 33µH', r.lselNomUH, 33)
approx('最坏纹波率 27.02%', r.rippleWorstPct * 100, 27.02, 0.5)
eq('Isat 建议档 5A', r.isatRec, 5)   // 1.2×3.405 = 4.086

console.log('── 案例 C：只填 Vin=12 → Vin_max=13.2，3.3V/10A ──')
r = computeBuckInductor({ vin: 12, vout: 3.3, iout: 10, fsw: 400e3, kInd: 0.4 })
approx('推算 Vin_max = 13.2V', r.vinMax, 13.2, 0.01)
eq('标记为估算值', r.vinAssumed, true)
approx('L_MIN = 1.5469µH', r.lminUH, 1.5469, 0.2)
approx('门槛 = 2.2099µH', r.lneedUH, 2.2099, 0.2)
eq('2.2µH 差一线不够 → 取 2.7µH', r.lselUH, 2.7)
eq('有"按 110% 估算"提示', r.warnings.some(w => w.includes('110%')), true)

console.log('── 案例 D：裕量设为 0（只按 K_IND 名义口径）──')
r = computeBuckInductor({ vinMax: 26.4, vout: 5, iout: 2, fsw: 500e3, kInd: 0.4, derate: 0 })
eq('门槛 = L_MIN → 名义档 12µH', r.lselUH, 12)
eq('裕量 0 有告警', r.warnings.some(w => w.includes('裕量设为 0')), true)

console.log('── 案例 E：手填感值不足 → 告警 ──')
r = computeBuckInductor({ vinMax: 26.4, vout: 5, iout: 2, fsw: 500e3, kInd: 0.4, lUH: 6.8 })
eq('采用手填值 6.8µH', r.lselUH, 6.8)
eq('标记 manual', r.manual, true)
approx('最坏感值 4.76µH（−30%）', r.lworstUH, 4.76, 0.1)
eq('感值不足告警', r.warnings.some(w => w.includes('小于最小感值')), true)
eq('纹波率偏高告警', r.warnings.some(w => w.includes('纹波率')), true)
approx('名义 ΔI @6.8µH = 1.1921A', r.dIL, 1.19207, 0.2)

console.log('── 案例 F：TI 文档选档示例 L_MIN 7.17µH → 8.2µH ──')
eq('7.17µH → 8.2µH', selectStandardL(7.17).lselUH, 8.2)
eq('恰好等于标准档时取该档（12µH）', selectStandardL(12).lselUH, 12)
eq('超表尾标记 over', selectStandardL(5000).over, true)

console.log('── 案例 G：输入校验 ──')
eq('Vin ≤ Vout 报错', !!computeBuckInductor({ vinMax: 5, vout: 5, iout: 1, fsw: 500e3 }).error, true)
eq('缺 Vout 报错', !!computeBuckInductor({ vinMax: 24, iout: 1, fsw: 500e3 }).error, true)
eq('缺输入电压报错', !!computeBuckInductor({ vout: 5, iout: 1, fsw: 500e3 }).error, true)
eq('缺 fsw 报错', !!computeBuckInductor({ vinMax: 24, vout: 5, iout: 1 }).error, true)

console.log(`\n${fail === 0 ? '✅' : '❌'}  Buck 电感引擎：${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
