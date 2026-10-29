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

// ── PCB 走线线宽计算（单端微带 / 差分微带 / 单端带状线）──
export const impedance = {
  id: 'impedance',
  name: '线宽计算',
  icon: '📐',
  desc: 'PCB 走线阻抗/线宽：单端微带 · 差分微带 · 单端带状线 · 反解线宽或算阻抗',
  component: 'impedance',
}

// ── Buck（降压）输出电感选型 ──
export const buckInductor = {
  id: 'buck-inductor',
  name: 'Buck 电感',
  icon: '🧲',
  desc: '降压变换器输出电感：最小感值 · 感值裕量选档 · 纹波 · 饱和/RMS 电流选型',
  component: 'buck-inductor',
  formula: 'L_MIN = Vout·(Vin_max − Vout) / (Vin_max · fsw · Iout · K_IND)　→ 选档门槛 = L_MIN / (1 − 感值降额)',
  derivation: [
    {
      title: '① 伏秒平衡：稳态下电感「充的伏秒 = 放的伏秒」',
      lines: [
        `Buck 主管导通时电感承受 Vin − Vout，电流线性上升；关断时电感经续流管承受 −Vout，电流线性下降。`,
        `稳态下每周期电流必须回到同一起点，否则电流会逐周期累积（发散）：`,
        `  (Vin − Vout) · D·T = Vout · (1 − D)·T`,
        `约去周期 T，得到占空比：`,
        `  D = Vout / Vin`,
        `物理意义：D 由输入输出电压比唯一决定，与负载、电感量无关——所以 Buck 的占空比在给定输入下是固定的。`,
      ],
    },
    {
      title: '② 由 V = L·di/dt 得纹波公式（式 9）',
      lines: [
        `电感的基本关系是 V = L · di/dt，即 ΔI = V·Δt / L。`,
        `取关断段：电感电压恒定等于 Vout，持续时间 Δt = (1−D)·T = (1−D)/fsw：`,
        `  ΔI_L = Vout · (1 − D) / (L · fsw)`,
        `把 ① 的 D = Vout/Vin 代入，1 − D = (Vin − Vout)/Vin：`,
        `  ΔI_L = Vout · (Vin − Vout) / (Vin · L · fsw)     ← 式(9)`,
        `物理意义：纹波正比于 Vout·(1−D)，反比于 L 与 fsw。升压比越大（D 越大），关断时间越长，纹波越大。`,
      ],
    },
    {
      title: '③ 为什么必须用 Vin_max（式 9 的单调性）',
      lines: [
        `把 Vin 单独拿出来看，纹波对输入电压的依赖项是：`,
        `  ΔI ∝ Vout · (1 − Vout/Vin)`,
        `Vin 越大，Vout/Vin 越小，括号越大 → 纹波随输入电压单调递增。`,
        `物理意义：Vin 升高时关断时间 (1−D)·T 变长（占空比变小、电感有更多时间放能），而电感承受的电压 Vout 不变，`,
        `所以每个周期电流掉得更多。最坏情况永远出现在最高输入电压 → 感值必须按 Vin_max 设计。`,
        `这也是为什么只知标称 Vin 时要按 Vin×110%（含电网波动/容差）推 Vin_max，否则满载最坏点上纹波会超标。`,
      ],
    },
    {
      title: '④ 反解最小感值（式 10）',
      lines: [
        `用纹波系数 K_IND 把纹波归一化到输出电流：`,
        `  K_IND = ΔI_L / Iout`,
        `代入式(9)并解出 L：`,
        `  L_MIN = Vout · (Vin_max − Vout) / (Vin_max · fsw · Iout · K_IND)     ← 式(10)`,
        `物理意义：满载、最高输入、最坏容差三件事叠加时，感值不低于 L_MIN 才能保证纹波率不超过设计的 K_IND。`,
      ],
    },
    {
      title: '⑤ 为什么 K_IND 取 20%~40%（工程权衡）',
      lines: [
        `感值大（K 小）：纹波小 → 输出纹波小、峰值电流低、峰值电流模式比较器信噪比好；`,
        `代价是体积大、DCR 高（铜损大）、瞬态响应慢（电流爬升慢，负载跳变时输出跌落深）。`,
        `感值小（K 大）：瞬态快、体积小、DCR 低；`,
        `代价是纹波电流大 → 输出电容上的纹波电压大、电感与开关管 RMS 电流大（传导损耗上升），`,
        `更危险的是峰值电流逼近甚至超过过流保护阈值 → 满载时可能误触发限流/打嗝。`,
        `所以 K_IND 控制在 20%~40% 是"纹波可接受 + 峰值电流留有余量"的折中，K_IND 上限不应超过 50%。`,
      ],
    },
    {
      title: '⑥ 选型三件套：感值、饱和电流、RMS 电流',
      lines: [
        `峰值电流：  I_pk = Iout + ΔI_L/2`,
        `RMS 电流：   I_rms = √(Iout² + ΔI_L²/12)   （直流 + 三角波纹波的有效值，用于估发热）`,
        `· 饱和电流 Isat：必须大于 I_pk，且要留裕量——短路/过流/启动瞬间电感电流远超稳态值，`,
        `  并且 Isat 随温度下降（数据手册通常给 20℃ 与 100℃ 两组），应按高温值与限流点判定。`,
        `· 额定/温升电流：须 ≥ I_rms，否则满载温升超标（磁芯与绕组一起决定，两家厂商口径可能不同）。`,
        `· DCR：按铜损预算反推上限——P_dcr = I_rms²·DCR ≤ 1%·Pout。`,
        `· 谷值电流 Iout − ΔI_L/2 ≤ 0 时进入 DCM，实际纹波/环路特性都会偏离 CCM 设计，需重新评估。`,
      ],
    },
    {
      title: '⑦ 为什么选档还要留感值裕量（10% 为什么不够）',
      lines: [
        `式(10) 算出的 L_MIN 是「标称感值」口径，但电感真实到手的感值一定低于标称，来源有两个且互相独立：`,
        `  ① 出厂公差：功率电感主流是 ±20%（±10% 的少且贵，成品半成品更差）；`,
        `  ② 直流偏置软饱和：一体成型合金电感在接近额定电流时感量已下降 10%~20%（datasheet 有 L–I 曲线），`,
        `     即"还没到 Isat"感值就已经掉了——这是材料特性，不是个体差异。`,
        `两者乘性叠加（同一颗电感上同时发生）：`,
        `  L_worst = L_nom · (1 − tol) · (1 − bias) = L_nom · 0.8 · 0.9 = 0.72 · L_nom`,
        `即总降额约 28% → 选档门槛：`,
        `  L_NEED = L_MIN / (1 − 28%) ≈ 1.39 · L_MIN   （工程圆整取 30%，即 1.43×）`,
        `反证：若只留 10%，10% 连公差本身（±20%）都盖不住，最坏情况下纹波必然超出 K_IND——`,
        `例如 L_MIN 10.1µH 取 12µH（名义 +18%），−20% 公差后只剩 9.6µH，纹波直接由 40% 变 42%。`,
        `而"裕量越大越好"也不成立：档位间距约 20%，1.3× 通常只是跳一档，再大就要白付 DCR（铜损上升）、`,
        `体积、瞬态变慢与成本——所以按 30% 门槛选档，同时在结果里给出「不加裕量档位及其最坏纹波」供体积受限时取舍。`,
        `注意：这是"感值裕量"，与饱和电流裕量（Isat/I_pk）是两笔独立的账，不要互相顶替。`,
      ],
    },
  ],
}

// ── 场景注册表 ──
export const scenes = [resistor, power, rc, flyback, buckInductor, impedance]

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
    items: ['flyback', 'buck-inductor'],
  },
  {
    id: 'impedance',
    name: 'Layout计算',
    icon: '📐',
    items: ['impedance'],
  },
]

export const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]))
