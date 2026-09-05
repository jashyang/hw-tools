// ── 场景定义：表单字段 + 求解逻辑（留空即所求） ──
import FlybackCalc from '../components/FlybackCalc.vue'
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
  derivation: [
    {
      title: '① 基本定义：电功率 = 电压 × 电流',
      lines: [
        `电功率描述电能转化为热/光/运动的速率。`,
        `电压 V 是单位电荷的能量（J/C），电流 I 是单位时间流过电荷量（C/s），`,
        `两者相乘得到单位时间的能量（J/s = W）：`,
        `  P = V · I`,
      ],
    },
    {
      title: '② 代入欧姆定律 V = IR → P = I²R',
      lines: [
        `纯电阻负载满足欧姆定律：V = I · R`,
        `代入功率公式：`,
        `  P = (I · R) · I = I² · R`,
        `物理意义：电流流过电阻时发热——电流越大、电阻越大，发热越强。`,
      ],
    },
    {
      title: '③ 同理代入 I = V/R → P = V²/R',
      lines: [
        `从 V = IR 得 I = V / R，代入：`,
        `  P = V · (V / R) = V² / R`,
        `这解释了为什么高压输电用大电阻导线会浪费巨大功率。`,
      ],
    },
    {
      title: '④ 四者关系一览',
      lines: [
        `以上三个公式互推可得所有组合：`,
        `  P = V·I   （已知电压、电流）`,
        `  P = I²·R  （已知电流、电阻）`,
        `  P = V²/R  （已知电压、电阻）`,
        `反解：`,
        `  V = √(P·R) = P/I`,
        `  I = P/V = √(P/R)`,
        `  R = V²/P = V/I = P/I²`,
      ],
    },
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
  derivation: [
    {
      title: '① 什么是时间常数 τ？',
      lines: [
        `RC 电路（一个电阻 + 一个电容串联）充电或放电时`,
        `电压不会突变——电容需要时间累积/释放电荷。`,
        `时间常数 τ（tau）描述了这种"惯性"的大小：`,
        `  τ = R × C`,
        `单位：欧姆(Ω) × 法拉(F) = 秒(s)`,
      ],
    },
    {
      title: '② 充电过程：指数上升',
      lines: [
        `电容从 0 开始充电，电压随时间按指数律上升：`,
        `  V(t) = V₀ · (1 - e^(-t/τ))`,
        `其中 V₀ 是电源电压，e ≈ 2.718 是自然对数的底。`,
        `代入 t = τ：`,
        `  V(τ) = V₀ · (1 - 1/e) ≈ 0.632 · V₀`,
        `即 1 个 τ 后达到最终值的 63.2%。`,
      ],
    },
    {
      title: '③ 关键时间点',
      lines: [
        `由于指数特性，理论上永远到不了 100%，但实际中：`,
        `  1τ → 63.2%   （首次可测量到的变化量）`,
        `  2τ → 86.5%`,
        `  3τ → 95.0%   （工程上常认为"已充满"）`,
        `  4τ → 98.2%`,
        `  5τ → 99.3%   （视为完全充/放电完毕）`,
      ],
    },
    {
      title: '④ 反推 R 或 C',
      lines: [
        `已知 τ 和其中一个参数即可反推另一个：`,
        `  R = τ / C`,
        `  C = τ / R`,
      ],
    },
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

// ── 反激式变压器设计 ──
export const flyback = {
  id: 'flyback',
  name: '变压器设计',
  icon: '🔌',
  desc: '反激式变压器电磁设计：磁芯选型 · 绕组计算 · CCM/DCM 对比',
  component: 'flyback',
}

// ── 场景注册表 ──
export const scenes = [resistor, power, rc, flyback]

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
  {
    id: 'flyback',
    name: '开关电源',
    icon: '🔌',
    items: ['flyback'],
  },
]

export const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]))
