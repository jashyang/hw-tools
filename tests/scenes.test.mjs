// 场景求解逻辑 + 串并联网络计算单测（node 直跑，无 vue 依赖）
import { scenes } from '/home/hermes/projects/hw-tools/src/core/scenes.js'
import {
  rowEquiv, networkEquiv, dividerRx,
  seriesSum, parallelSum, solveUnknownResistor, solveVoltagePoints,
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

// ── 通用反推：多行网络求未知电阻 ──
// 经典分压：Vcc=12, 上臂 1k 串联, 下臂待求 x, 节点1（第1行后）对地=6V → x = 1k
{
  const s = solveUnknownResistor(
    [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }],
    12, 6, { type: 'node', index: 1 }
  )
  approx('solve: 经典分压节点6V → x=1k', s.rx, 1000)
}
// 反推上臂：Vcc=12, 上臂待求 x, 下臂 2k, 节点1对地=8V → x = 1k
{
  const s = solveUnknownResistor(
    [{ mode: 'series', values: [null] }, { mode: 'series', values: [2000] }],
    12, 8, { type: 'node', index: 1 }
  )
  approx('solve: 反推上臂 → x=1k', s.rx, 1000)
}
// 行两端压降：Vcc=12, 行1 串联 2k, 行2 待求 x，行2两端=4V → x=1k
{
  const s = solveUnknownResistor(
    [{ mode: 'series', values: [2000] }, { mode: 'series', values: [null] }],
    12, 4, { type: 'row', index: 1 }
  )
  approx('solve: 行2压降4V → x=1k', s.rx, 1000)
}
// 未知在并联行内：Vcc=12, 行1 并联 [2k, null] 待求, 行2 串联 1k, 节点1对地=6V
// 行2=1k 占 6V → 行1 等效必须 =1k；行1 并联 2k||x=1k → x=2k
{
  const s = solveUnknownResistor(
    [{ mode: 'parallel', values: [2000, null] }, { mode: 'series', values: [1000] }],
    12, 6, { type: 'node', index: 1 }
  )
  approx('solve: 并联行内求 x (2k||x=1k) → x=2k', s.rx, 2000)
}
// 节点电压在未知行之后：Vcc=12, 行1 待求 x, 行2 串联 1k, 节点1对地=4V
// 节点1在行1与行2之间 → 对地电压 = 行2压降 = 12×1000/(x+1000) = 4 → x=2000
{
  const s = solveUnknownResistor(
    [{ mode: 'series', values: [null] }, { mode: 'series', values: [1000] }],
    12, 4, { type: 'node', index: 1 }
  )
  approx('solve: 节点在未知后 → x=2000', s.rx, 2000)
}
// 无解：目标电压超出可达范围
check('solve: V>=Vcc → null', solveUnknownResistor(
  [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }],
  12, 12, { type: 'node', index: 1 }
), null)
check('solve: 全已知无未知 → null', solveUnknownResistor(
  [{ mode: 'series', values: [1000] }, { mode: 'series', values: [1000] }],
  12, 6, { type: 'node', index: 1 }
), null)

// ── 多电压点反推（Vcc 可选） ──
// 经典：Vcc=5 已知 + 1 电压点（第1行后=0.596V），行1=100k 待求行2 → x=13.533k
// 节点1 电压 = Vcc×Rx/(100k+Rx) = 0.596 → Rx = 13.533k
{
  const s = solveVoltagePoints(
    [{ mode: 'series', values: [100000] }, { mode: 'series', values: [null] }],
    5, [{ index: 1, v: 0.596 }]
  )
  approx('vpts: Vcc+1点 经典分压 → x=13.533k', s.rx, 13533.151680289553)
  approx('vpts: 反推 vcc 保留原值', s.vcc, 5)
}
// 无 Vcc：3 行网络（100k | 待求x | 1k），节点1=4V、节点2=0.596V
// v1/v2 = (x+1k)/1k = 4/0.596 → x = 5711
{
  const s = solveVoltagePoints(
    [{ mode: 'series', values: [100000] }, { mode: 'series', values: [null] }, { mode: 'series', values: [1000] }],
    null, [{ index: 1, v: 4 }, { index: 2, v: 0.596 }]
  )
  approx('vpts: 无Vcc 2点 → x=5711', s.rx, 5711.409395973154)
  approx('vpts: 无Vcc 反推 vcc>0', s.vcc > 0, true)
}
// 多电压点校验：Vcc=12 已知 + 2 点（节点1=8V、节点2=4V），行1=1k 待求行2 行3=1k
// 节点2 = 12×1k/(1k+x+1k) = 4 → x = 1k
{
  const s = solveVoltagePoints(
    [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }, { mode: 'series', values: [1000] }],
    12, [{ index: 1, v: 8 }, { index: 2, v: 4 }]
  )
  approx('vpts: Vcc+2点校验 → x=1k', s.rx, 1000)
}
// 矛盾输入 → null：两个点电压不满足同一网络（节点2 应=4V 却给 6V）
check('vpts: 矛盾输入 → null', solveVoltagePoints(
  [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }, { mode: 'series', values: [1000] }],
  12, [{ index: 1, v: 8 }, { index: 2, v: 6 }]
), null)
check('vpts: 位置越界 → null', solveVoltagePoints(
  [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }],
  5, [{ index: 5, v: 1 }]
), null)
check('vpts: 电压点电压非递增 → null', solveVoltagePoints(
  [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }, { mode: 'series', values: [1000] }],
  null, [{ index: 1, v: 4 }, { index: 2, v: 8 }]
), null)
// Vcc 已知但电压点比 Vcc 高 → null
check('vpts: 电压点高于Vcc → null', solveVoltagePoints(
  [{ mode: 'series', values: [1000] }, { mode: 'series', values: [null] }],
  5, [{ index: 1, v: 8 }]
), null)

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
