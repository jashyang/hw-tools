// ── 场景定义：表单字段 + 求解逻辑（留空即所求） ──
import {
  parseResistor, formatOhms,
  parseVolt, formatVolt,
  parseAmp, formatAmp,
  parseCap, formatCap,
  parseSec, formatSec,
  formatWatt,
} from './parse.js'

function val(values, key) {
  return values[key] ?? null
}

// ── 1. 电阻计算（等效电阻 / 分压电阻，自定义组件渲染） ──
export const resistor = {
  id: 'resistor',
  name: '电阻计算',
  icon: '⚡',
  desc: '多行串并联网络：等效电阻 / 分压电阻',
  formula: '行内合并 → 行间串联',
  component: 'resistor', // SceneView 按此渲染 ResistorCalc
}

// ── 2. 功率计算 ──
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

// ── 3. RC 时间常数 ──
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
export const scenes = [resistor, power, rc]

// ── 分类结构（大类 → 小类） ──
export const CATEGORIES = [
  {
    id: 'resistor',
    name: '电阻计算',
    icon: '⚡',
    items: ['resistor', 'power'],
  },
  {
    id: 'cap',
    name: '电容与时间',
    icon: '⏱',
    items: ['rc'],
  },
]

export const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]))
