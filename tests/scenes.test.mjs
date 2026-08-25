// 场景求解逻辑单测（node 直跑，无 vue 依赖）
import { scenes } from '/home/hermes/projects/hw-tools/src/core/scenes.js'

const byId = Object.fromEntries(scenes.map((s) => [s.id, s]))
let pass = 0, fail = 0

function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n     got  ${g}\n     want ${w}`) }
}

// 1. 欧姆定律
{
  const s = byId.ohm
  const r = s.solve({ values: { v: 5, i: 0.02, r: null }, emptyKeys: ['r'] })
  check('ohm: v=5 i=20mA → r', r.results[0].value, '250Ω')
  const v = s.solve({ values: { v: null, i: 0.02, r: 1000 }, emptyKeys: ['v'] })
  check('ohm: i=20mA r=1k → v', v.results[0].value, '20V')
  const i = s.solve({ values: { v: 5, i: null, r: 1000 }, emptyKeys: ['i'] })
  check('ohm: v=5 r=1k → i', i.results[0].value, '5mA')
  check('ohm: 全填 → error', s.solve({ values: { v: 5, i: 0.02, r: 250 }, emptyKeys: [] }).error, '留空一个待求量')
}

// 2. LED 限流
{
  const s = byId.led
  const r = s.solve({ values: { vcc: 5, vf: 2, i: 0.02, r: null }, emptyKeys: ['r'] })
  check('led: 5V-2V-20mA → r', r.results[0].value, '150Ω')
  check('led: 功率建议', r.results[1].value, '60mW')
  const i = s.solve({ values: { vcc: 5, vf: 2, i: null, r: 150 }, emptyKeys: ['i'] })
  check('led: 反求电流', i.results[0].value, '20mA')
  const err = s.solve({ values: { vcc: 2, vf: 3, i: 0.02, r: null }, emptyKeys: ['r'] })
  check('led: vcc<vf → error', err.error, '电源电压需高于 LED 压降')
}

// 3. 分压
{
  const s = byId.divider
  const vo = s.solve({ values: { vcc: 12, r1: 10000, r2: 10000, vout: null }, emptyKeys: ['vout'] })
  check('divider: 12V 10k/10k → vout', vo.results[0].value, '6V')
  check('divider: 分压比', vo.results[1].value, '50.0%')
  const r1 = s.solve({ values: { vcc: 12, r1: null, r2: 10000, vout: 6 }, emptyKeys: ['r1'] })
  check('divider: 反求 R1', r1.results[0].value, '10kΩ')
  const r2 = s.solve({ values: { vcc: 12, r1: 10000, r2: null, vout: 6 }, emptyKeys: ['r2'] })
  check('divider: 反求 R2', r2.results[0].value, '10kΩ')
}

// 4. 串并联等效
{
  const s = byId.parallel
  const res = s.solve({ values: { resistors: [1000, 1000] } })
  check('parallel: 1k||1k 串联', res.results[0].value, '2kΩ')
  check('parallel: 1k||1k 并联', res.results[1].value, '500Ω')
  const single = s.solve({ values: { resistors: [4700] } })
  check('parallel: 单个电阻', single.results[0].value, '4.7kΩ')
}

// 5. 功率
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

// 6. RC
{
  const s = byId.rc
  const t = s.solve({ values: { r: 10000, c: 100e-6, t: null }, emptyKeys: ['t'] })
  check('rc: 10k 100uF → τ', t.results[0].value, '1s')
  check('rc: 5τ', t.results[3].value, '5s')
  const r = s.solve({ values: { r: null, c: 100e-6, t: 1 }, emptyKeys: ['r'] })
  check('rc: 反求 R', r.results[0].value, '10kΩ')
}

// 解析函数抽查（浮点用近似比较）
import { parseResistor, parseVolt, parseAmp, parseCap, parseSec, formatCap, formatSec } from '/home/hermes/projects/hw-tools/src/core/parse.js'
function approx(name, got, want) {
  if (Math.abs(got - want) < 1e-9) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n     got  ${got}\n     want ${want}`) }
}
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
