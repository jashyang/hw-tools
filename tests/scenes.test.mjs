// 场景求解逻辑 + 串并联网络计算单测（node 直跑，无 vue 依赖）
import { scenes } from '/home/hermes/projects/hw-tools/src/core/scenes.js'
import {
  rowEquiv, networkEquiv, dividerRx,
  seriesSum, parallelSum,
} from '/home/hermes/projects/hw-tools/src/core/network.js'

const byId = Object.fromEntries(scenes.map((s) => [s.id, s]))
let pass = 0, fail = 0

function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n     got  ${g}\n     want ${w}`) }
}
function approx(name, got, want) {
  if (Math.abs(got - want) < 1e-9) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n     got  ${got}\n     want ${want}`) }
}

// ── 串并联网络 ──
approx('series: 1k+1k', seriesSum([1000, 1000]), 2000)
approx('parallel: 1k||1k', parallelSum([1000, 1000]), 500)
approx('parallel: 1k||1k||1k', parallelSum([1000, 1000, 1000]), 1000 / 3)
approx('row: series 1k+2.2k', rowEquiv('series', [1000, 2200]), 3200)
approx('row: parallel 1k||2.2k', rowEquiv('parallel', [1000, 2200]), 1 / (1 / 1000 + 1 / 2200))
check('row: 空列表 → NaN', isNaN(rowEquiv('series', [])), true)
check('row: 非法值过滤', rowEquiv('series', [null, 1000]), 1000)
// 行间串联：行1 串联 1k+1k=2k，行2 并联 1k||1k=500 → 总 2500
approx('network: 串行(1k+1k)+并行(1k||1k)', networkEquiv([
  { mode: 'series', resistors: [1000, 1000] },
  { mode: 'parallel', resistors: [1000, 1000] },
]), 2500)
// 三行混合
approx('network: 三行混合', networkEquiv([
  { mode: 'series', resistors: [1000] },
  { mode: 'parallel', resistors: [1000, 1000] },
  { mode: 'series', resistors: [470, 470] },
]), 1000 + 500 + 940)
check('network: 空行忽略', isNaN(networkEquiv([
  { mode: 'series', resistors: [] },
  { mode: 'series', resistors: [1000] },
])), false)
// 分压 Rx
approx('divider: R_net=2k Vcc=12 Vout=6 → Rx=2k', dividerRx(2000, 12, 6), 2000)
approx('divider: R_net=10k Vcc=5 Vout=3.3', dividerRx(10000, 5, 3.3), 10000 * 3.3 / 1.7)
check('divider: Vout>=Vcc → null', dividerRx(1000, 5, 5), null)
check('divider: Vout=0 → null', dividerRx(1000, 5, 0), null)

// ── 功率计算 ──
{
  const s = byId.power
  const a = s.solve({ values: { p: null, v: 12, i: 0.5, r: null } })
  check('power: 12V 0.5A → P', a.results[0].value, '6W')
  check('power: 12V 0.5A → R', a.results[3].value, '24Ω')
  const b = s.solve({ values: { p: 2, v: null, i: null, r: 50 } })
  check('power: 2W 50Ω → V', b.results[1].value, '10V')
  check('power: 2W 50Ω → I', b.results[2].value, '200mA')
  check('power: 只填1个 → error', s.solve({ values: { p: null, v: 12, i: null, r: null } }).error, '请填写任意两个已知量')
}

// ── RC 时间常数 ──
{
  const s = byId.rc
  const t = s.solve({ values: { r: 10000, c: 100e-6, t: null }, emptyKeys: ['t'] })
  check('rc: 10k 100uF → τ', t.results[0].value, '1s')
  check('rc: 5τ', t.results[3].value, '5s')
  const r = s.solve({ values: { r: null, c: 100e-6, t: 1 }, emptyKeys: ['r'] })
  check('rc: 反求 R', r.results[0].value, '10kΩ')
}

// ── 解析函数抽查 ──
import { parseResistor, parseVolt, parseAmp, parseCap, parseSec, formatCap, formatSec } from '/home/hermes/projects/hw-tools/src/core/parse.js'
approx('parse: 1M5', parseResistor('1M5'), 1500000)
approx('parse: 4k7', parseResistor('4k7'), 4700)
approx('parse: 2.2k', parseResistor('2.2k'), 2200)
approx('parse: 100R', parseResistor('100R'), 100)
approx('parse: 20mA', parseAmp('20mA'), 0.02)
approx('parse: 5V', parseVolt('5V'), 5)
approx('parse: 100uF', parseCap('100uF'), 1e-4)
approx('parse: 0.5s', parseSec('0.5s'), 0.5)
check('parse: 非法 abc', parseVolt('abc'), null)
check('format: cap', formatCap(0.0001), '100µF')
check('format: sec', formatSec(0.001), '1ms')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
