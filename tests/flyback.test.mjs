// 反激变压器商用引擎单测（纯 node 直跑）
// 断言以物理不变量 + 关键锚点为主，不硬编码会随磁芯迭代变化的型号。
import { computeFlyback } from '../src/core/flyback-engine.js'

let pass = 0, fail = 0
function eq(n, a, b) { if (a === b) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n} got ${a} want ${b}`) } }
function truthy(n, v) { if (v) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n} falsy ${v}`) } }
function approx(n, g, w, tol = 2e-2) { if (Math.abs(g - w) / Math.max(Math.abs(w), 1e-9) < tol) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n} got ${g} want ${w}`) } }

const base = { vinMin: '85', vinMax: '265', vo: '12', io: '2', fs: '65', eta: '87', vorTarget: '120', coreMaterial: 'PC40', dBmax: '0.20', diodeType: 'schottky', preferredMode: 'auto' }

// ── 24W 参考 ──
console.log('== 24W (12V/2A) ==')
{
  const r = computeFlyback(base)
  truthy('不报错', !r.error)
  eq('mode=ccm(>=15W)', r.design.mode, 'ccm')
  truthy('Dmax<50%', r.derived.DmaxActual < 0.5)
  truthy('Dmax≈48%', r.derived.DmaxActual > 0.4)
  truthy('窗口填充 0<x≤100', r.winding.fillPct > 0 && r.winding.fillPct <= 100)
  truthy('ΔB≤Bs@100C安全', r.derived.dBact <= r.derived.BsEff)
  truthy('VOR钳位警告', r.winding.warnings.some(w => w.includes('占空比控制')))
  truthy('有磁芯来源', typeof r.derived.source === 'string' && r.derived.source.length > 0)
  // 次级RMS = |n*Ipk| 相关（次级峰值>初级峰值）
  truthy('次级峰值=n×初级峰值', Math.abs(r.design.IsPk - r.design.Ipk * r.winding.nActual) < 1e-6)
  truthy('次级RMS>0', r.design.IsecRms > 0)
  truthy('损耗>0', r.loss.Ptot > 0)
  truthy('估算效率合理 85~99', r.loss.eff > 85 && r.loss.eff < 99)
  truthy('MOSFET推荐非空', r.stress.mosfet.length > 0)
  truthy('次级二极管推荐非空', r.stress.diode.length > 0)
}

// ── 5W → DCM ──
console.log('== 5W (5V/1A) ==')
{
  const r = computeFlyback({ ...base, vo: '5', io: '1' })
  truthy('不报错', !r.error)
  eq('mode=dcm(<15W)', r.design.mode, 'dcm')
  truthy('Dmax<50%', r.derived.DmaxActual < 0.5)
  truthy('窗口填充 0<x≤100', r.winding.fillPct > 0 && r.winding.fillPct <= 100)
}

// ── 48W → CCM ──
console.log('== 48W (24V/2A) ==')
{
  const r = computeFlyback({ ...base, vo: '24', io: '2' })
  truthy('不报错', !r.error)
  eq('mode=ccm', r.design.mode, 'ccm')
}

// ── 手动锁定模式 ──
console.log('== 模式强制 ==')
{
  eq('24W强制dcm', computeFlyback({ ...base, preferredMode: 'dcm' }).design.mode, 'dcm')
  eq('5W强制ccm', computeFlyback({ ...base, vo: '5', io: '1', preferredMode: 'ccm' }).design.mode, 'ccm')
}

// ── VOR 钳位 ──
console.log('== VOR 超限钳位 ==')
{
  const r = computeFlyback({ ...base, vorTarget: '150' })
  truthy('有钳位警告', r.winding.warnings.some(w => w.includes('占空比控制')))
  truthy('Dmax<50%', r.derived.DmaxActual < 0.5)
}

// ── 非法输入 → error ──
console.log('== 非法输入 ==')
{
  eq('不存在整流管', 'error' in computeFlyback({ ...base, diodeType: 'nope' }), true)
  eq('空输出报错', 'error' in computeFlyback({ ...base, vo: '' }), true)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
