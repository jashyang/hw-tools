// ── 场景定义：表单字段 + 求解逻辑（留空即所求） ──
import {
  parseResistor, formatOhms,
  parseVolt, formatVolt,
  parseAmp, formatAmp,
  parseCap, formatCap,
  parseSec, formatSec,
  formatWatt,
} from './parse.js'

// 求解函数约定：接收 { values: {key→数值|null}, emptyKeys: [key...] }
// 返回 null（无法求解）| { error: '提示' } | { results: [{label, value, note?}] }

function val(values, key) {
  return values[key] ?? null
}

// ── 1. 欧姆定律 ──
export const ohm = {
  id: 'ohm',
  name: '欧姆定律',
  icon: '⚡',
  desc: 'V = I × R，知二求一',
  formula: 'V = I × R',
  fields: [
    { key: 'v', label: '电压', unit: 'V', parse: parseVolt, fmt: formatVolt, ph: '如 5 或 5V' },
    { key: 'i', label: '电流', unit: 'A', parse: parseAmp, fmt: formatAmp, ph: '如 20mA' },
    { key: 'r', label: '电阻', unit: 'Ω', parse: parseResistor, fmt: formatOhms, ph: '如 1k' },
  ],
  solve({ values, emptyKeys }) {
    const v = val(values, 'v'), i = val(values, 'i'), r = val(values, 'r')
    if (emptyKeys.length === 1) {
      if (emptyKeys[0] === 'v' && i != null && r != null) return { results: [{ label: '电压', value: formatVolt(i * r) }] }
      if (emptyKeys[0] === 'i' && v != null && r != null) {
        if (r === 0) return { error: '电阻不能为 0' }
        return { results: [{ label: '电流', value: formatAmp(v / r) }] }
      }
      if (emptyKeys[0] === 'r' && v != null && i != null) {
        if (i === 0) return { error: '电流不能为 0' }
        return { results: [{ label: '电阻', value: formatOhms(v / i) }] }
      }
    }
    return emptyKeys.length === 0 ? { error: '留空一个待求量' } : null
  },
}

// ── 2. LED 限流电阻 ──
export const led = {
  id: 'led',
  name: 'LED 限流电阻',
  icon: '💡',
  desc: 'R = (Vcc − Vf) / I，附功率建议',
  formula: 'R = (Vcc − Vf) / I',
  fields: [
    { key: 'vcc', label: '电源电压', unit: 'V', parse: parseVolt, fmt: formatVolt, ph: '如 5' },
    { key: 'vf', label: 'LED 压降', unit: 'V', parse: parseVolt, fmt: formatVolt, ph: '红2.0 绿3.2 白3.3' },
    { key: 'i', label: '目标电流', unit: 'A', parse: parseAmp, fmt: formatAmp, ph: '如 20mA' },
    { key: 'r', label: '限流电阻', unit: 'Ω', parse: parseResistor, fmt: formatOhms, ph: '如 150' },
  ],
  solve({ values, emptyKeys }) {
    const vcc = val(values, 'vcc'), vf = val(values, 'vf'), i = val(values, 'i'), r = val(values, 'r')
    if (emptyKeys.length !== 1) return emptyKeys.length === 0 ? { error: '留空一个待求量' } : null
    const k = emptyKeys[0]
    if (k === 'r') {
      if (vcc == null || vf == null || i == null) return null
      if (vcc <= vf) return { error: '电源电压需高于 LED 压降' }
      const R = (vcc - vf) / i
      const P = i * i * R
      return {
        results: [
          { label: '限流电阻', value: formatOhms(R) },
          { label: '耗散功率', value: formatWatt(P), note: '选 ≥ 2× 功率档位（如 1/4W）' },
        ],
      }
    }
    if (k === 'i') {
      if (vcc == null || vf == null || r == null) return null
      if (vcc <= vf) return { error: '电源电压需高于 LED 压降' }
      const I = (vcc - vf) / r
      return { results: [{ label: '实际电流', value: formatAmp(I), note: '建议 10~20mA 常规亮度' }] }
    }
    if (k === 'vf') {
      if (vcc == null || i == null || r == null) return null
      return { results: [{ label: 'LED 压降', value: formatVolt(vcc - i * r) }] }
    }
    if (k === 'vcc') {
      if (vf == null || i == null || r == null) return null
      return { results: [{ label: '电源电压', value: formatVolt(vf + i * r) }] }
    }
    return null
  },
}

// ── 3. 分压电路 ──
export const divider = {
  id: 'divider',
  name: '分压电路',
  icon: '📉',
  desc: 'Vout = Vcc × R2 / (R1 + R2)，可反求元件',
  formula: 'Vout = Vcc × R2 / (R1 + R2)',
  fields: [
    { key: 'vcc', label: '电源电压', unit: 'V', parse: parseVolt, fmt: formatVolt, ph: '如 12' },
    { key: 'r1', label: '上电阻 R1', unit: 'Ω', parse: parseResistor, fmt: formatOhms, ph: '如 10k' },
    { key: 'r2', label: '下电阻 R2', unit: 'Ω', parse: parseResistor, fmt: formatOhms, ph: '如 10k' },
    { key: 'vout', label: '输出电压', unit: 'V', parse: parseVolt, fmt: formatVolt, ph: '如 6' },
  ],
  solve({ values, emptyKeys }) {
    const vcc = val(values, 'vcc'), r1 = val(values, 'r1'), r2 = val(values, 'r2'), vout = val(values, 'vout')
    if (emptyKeys.length !== 1) return emptyKeys.length === 0 ? { error: '留空一个待求量' } : null
    const k = emptyKeys[0]
    const ratio = (vo, vc) => (vc > 0 ? `${(vo / vc * 100).toFixed(1)}%` : '—')
    if (k === 'vout') {
      if (vcc == null || r1 == null || r2 == null) return null
      const Vo = vcc * r2 / (r1 + r2)
      return {
        results: [
          { label: '输出电压', value: formatVolt(Vo) },
          { label: '分压比', value: ratio(Vo, vcc) },
        ],
      }
    }
    if (k === 'r1') {
      if (vcc == null || r2 == null || vout == null) return null
      if (vout === 0) return { error: '输出电压不能为 0' }
      const R1 = r2 * (vcc - vout) / vout
      if (R1 <= 0) return { error: 'Vout 需小于 Vcc 才有解' }
      return { results: [{ label: '上电阻 R1', value: formatOhms(R1) }] }
    }
    if (k === 'r2') {
      if (vcc == null || r1 == null || vout == null) return null
      if (vcc <= vout) return { error: 'Vout 需小于 Vcc 才有解' }
      const R2 = r1 * vout / (vcc - vout)
      return { results: [{ label: '下电阻 R2', value: formatOhms(R2) }] }
    }
    if (k === 'vcc') {
      if (r1 == null || r2 == null || vout == null) return null
      const Vc = vout * (r1 + r2) / r2
      return {
        results: [
          { label: '电源电压', value: formatVolt(Vc) },
          { label: '分压比', value: ratio(vout, Vc) },
        ],
      }
    }
    return null
  },
}

// ── 4. 串并联等效 ──
export const parallel = {
  id: 'parallel',
  name: '串并联等效',
  icon: '🔀',
  desc: '多个电阻合并：串联相加，并联倒数相加',
  formula: 'Rs = ΣR，Rp = 1 / Σ(1/R)',
  mode: 'list', // 特殊：电阻列表，全填求两结果
  listField: { key: 'resistors', label: '电阻值', parse: parseResistor, fmt: formatOhms, ph: '如 10k' },
  solve({ values }) {
    const list = values.resistors || []
    if (list.length < 1) return null
    if (list.length === 1) return { results: [{ label: '等效电阻', value: formatOhms(list[0]) }] }
    const Rs = list.reduce((a, b) => a + b, 0)
    let Rp = 0
    for (const r of list) {
      if (r === 0) return { error: '电阻不能为 0' }
      Rp += 1 / r
    }
    return {
      results: [
        { label: '串联等效', value: formatOhms(Rs), note: 'n 个串联直接相加' },
        { label: '并联等效', value: formatOhms(1 / Rp), note: 'n 个并联小于最小阻值' },
      ],
    }
  },
}

// ── 5. 功率计算 ──
export const power = {
  id: 'power',
  name: '功率计算',
  icon: '🔥',
  desc: 'P = V·I = I²R = V²/R，填任意两个求另外两个',
  formula: 'P = V·I = I²·R = V²/R',
  mode: 'pair', // 填 2 个，求其余 2 个
  fields: [
    { key: 'p', label: '功率', unit: 'W', parse: parseQuantityWatt, fmt: formatWatt, ph: '如 2' },
    { key: 'v', label: '电压', unit: 'V', parse: parseVolt, fmt: formatVolt, ph: '如 12' },
    { key: 'i', label: '电流', unit: 'A', parse: parseAmp, fmt: formatAmp, ph: '如 500mA' },
    { key: 'r', label: '电阻', unit: 'Ω', parse: parseResistor, fmt: formatOhms, ph: '如 100' },
  ],
  solve({ values }) {
    const p = val(values, 'p'), v = val(values, 'v'), i = val(values, 'i'), r = val(values, 'r')
    const known = { p, v, i, r }
    const pairs = [
      ['v', 'i', () => ({ p: v * i, r: v / i })],
      ['p', 'i', () => ({ v: p / i, r: p / (i * i) })],
      ['p', 'v', () => ({ i: p / v, r: v * v / p })],
      ['p', 'r', () => ({ v: Math.sqrt(p * r), i: Math.sqrt(p / r) })],
      ['v', 'r', () => ({ i: v / r, p: v * v / r })],
      ['i', 'r', () => ({ v: i * r, p: i * i * r })],
    ]
    for (const [a, b, calc] of pairs) {
      if (known[a] != null && known[b] != null) {
        let out
        try {
          out = calc()
        } catch {
          return { error: '参数组合无解（检查是否为 0）' }
        }
        const results = []
        for (const [key, fmt, label] of [
          ['p', formatWatt, '功率'],
          ['v', formatVolt, '电压'],
          ['i', formatAmp, '电流'],
          ['r', formatOhms, '电阻'],
        ]) {
          const val2 = out[key] ?? known[key]
          if (val2 == null || !isFinite(val2) || val2 <= 0) continue
          results.push({ label, value: fmt(val2) })
        }
        return { results }
      }
    }
    return { error: '请填写任意两个已知量' }
  },
}

// 功率字段解析：接受 "2" "2W" "500mW" "1kW"
function parseQuantityWatt(s) {
  if (s == null) return null
  const t = String(s).trim().replace(/\s+/g, '')
  const m = t.match(/^(\d+(?:\.\d+)?)\s*([a-zµμ]*)$/i)
  if (!m) return null
  const map = { '': 1, w: 1, kw: 1e3, mw: 1e-3, uw: 1e-6 }
  const mult = map[(m[2] || '').toLowerCase()]
  if (mult === undefined) return null
  const v = parseFloat(m[1]) * mult
  return isFinite(v) && v > 0 ? v : null
}

// ── 6. RC 时间常数 ──
export const rc = {
  id: 'rc',
  name: 'RC 时间常数',
  icon: '⏱',
  desc: 'τ = R × C，含充放电进度参考',
  formula: 'τ = R × C',
  fields: [
    { key: 'r', label: '电阻', unit: 'Ω', parse: parseResistor, fmt: formatOhms, ph: '如 10k' },
    { key: 'c', label: '电容', unit: 'F', parse: parseCap, fmt: formatCap, ph: '如 100uF' },
    { key: 't', label: '时间常数', unit: 's', parse: parseSec, fmt: formatSec, ph: '如 1s' },
  ],
  solve({ values, emptyKeys }) {
    const r = val(values, 'r'), c = val(values, 'c'), t = val(values, 't')
    if (emptyKeys.length !== 1) return emptyKeys.length === 0 ? { error: '留空一个待求量' } : null
    const k = emptyKeys[0]
    if (k === 't') {
      if (r == null || c == null) return null
      const T = r * c
      return {
        results: [
          { label: '时间常数 τ', value: formatSec(T) },
          { label: '1τ 充至 63.2%', value: formatSec(T) },
          { label: '3τ 充至 95.0%', value: formatSec(T * 3) },
          { label: '5τ 充至 99.3%', value: formatSec(T * 5), note: '5τ 视为完全充满/放完' },
        ],
      }
    }
    if (k === 'r') {
      if (t == null || c == null) return null
      return { results: [{ label: '电阻', value: formatOhms(t / c) }] }
    }
    if (k === 'c') {
      if (t == null || r == null) return null
      return { results: [{ label: '电容', value: formatCap(t / r) }] }
    }
    return null
  },
}

// ── 场景注册表 ──
export const scenes = [ohm, led, divider, parallel, power, rc]
