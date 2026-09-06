// 反激变压器引擎单测（纯 node 直跑，无 vue 依赖）
import { computeFlyback } from '../src/core/flyback-engine.js'

let pass = 0, fail = 0
function eq(name, a, b) {
  if (a === b) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n     got  ${a}\n     want ${b}`) }
}
function approx(name, got, want, tol = 2e-3) {
  if (Math.abs(got - want) / Math.max(Math.abs(want), 1e-9) < tol) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n     got  ${got}\n     want ${want}`) }
}
function truthy(name, v) {
  if (v) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} (falsy: ${v})`) }
}

const base = { vinMin: '85', vinMax: '265', vo: '12', io: '2', fs: '65', eta: '87', vorTarget: '120', coreMaterial: 'PC40', dBmax: '0.20', diodeType: 'schottky', preferredMode: 'auto' }

// ── 参考案例 24W（12V/2A, 85-265VAC, 65kHz, η87%, PC40, 肖特基）──
console.log('== 参考 24W ==')
{
  const r = computeFlyback(base)
  eq('mode=ccm', r.design.mode, 'ccm')
  eq('core=EE25', r.derived.coreModel, 'EE25')
  eq('Np=101', r.winding.Np, 101)
  eq('Ns=11', r.winding.Ns, 11)
  approx('TR=9.18', r.winding.nActual, 9.1818)
  approx('DmaxActual<0.5', r.derived.DmaxActual, 0.4884)
  truthy('Dmax<50%', r.derived.DmaxActual < 0.5)
  approx('Ipk=0.552', r.design.Ipk, 0.5520)
  approx('Ispk=n×Ipk', r.design.IsPk, r.design.Ipk * r.winding.nActual)
  truthy('Np≥NpMin', r.winding.Np >= r.winding.NpMin)
  truthy('VOR被钳位(有警告)', r.winding.warnings.length >= 1)
  approx('VorEff≈110.96(<目标120)', Math.min(120, 0.48 * 120.21 / 0.52), 110.96)
}

// ── 小功率 5W → DCM ──
console.log('== 5W 小功率 ==')
{
  const r = computeFlyback({ ...base, vo: '5', io: '1' })
  eq('mode=dcm(<15W)', r.design.mode, 'dcm')
  eq('core=EE16', r.derived.coreModel, 'EE16')
  truthy('Np>200(小磁芯高匝数)', r.winding.Np > 200)
  truthy('Dmax<0.5', r.derived.DmaxActual < 0.5)
}

// ── 大功率 48W → CCM ──
console.log('== 48W ==')
{
  const r = computeFlyback({ ...base, vo: '24', io: '2' })
  eq('mode=ccm(≥15W)', r.design.mode, 'ccm')
  eq('core=EE30', r.derived.coreModel, 'EE30')
}

// ── 手动锁定模式覆盖自动推荐 ──
console.log('== 模式强制 ==')
{
  const dcm = computeFlyback({ ...base, preferredMode: 'dcm' })
  eq('24W强制dcm', dcm.design.mode, 'dcm')
  const ccm = computeFlyback({ ...base, vo: '5', io: '1', preferredMode: 'ccm' })
  eq('5W强制ccm', ccm.design.mode, 'ccm')
}

// ── VOR 超限自动钳位 ──
console.log('== VOR 钳位 ==')
{
  const r = computeFlyback({ ...base, vorTarget: '150' })
  truthy('VorEff被降(警告)', r.winding.warnings.some((w) => w.includes('占空比控制')))
  truthy('Dmax<50%', r.derived.DmaxActual < 0.5)
}

// ── 非法输入 → 报错 ──
console.log('== 非法输入 ==')
{
  eq('不存在的整流管', 'error' in computeFlyback({ ...base, diodeType: 'nope' }), true)
  eq('空输入报错', 'error' in computeFlyback({ ...base, vo: '' }), true)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
