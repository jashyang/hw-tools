// ── 电阻值解析与格式化 ──

// 解析 "470" "1k" "2.2k" "4.7M" "100R" "1M5" "1.5K" → Ω 数值；非法返回 null
export function parseResistor(str) {
  if (str == null) return null;
  const s = String(str).trim().replace(/\s+/g, '');
  if (!s) return null;
  // 工程记法: 数字 + [kKmMgG] 或 rR；也支持 1M5=1.5M、4k7=4.7k（数字单位数字，尾数直接拼成小数）
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([kKmMgGrR]?)(?:(\d+))?$/);
  if (!m) return null;
  const num = m[3] ? parseFloat(m[1] + '.' + m[3]) : parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  let mult = 1;
  if (unit === 'k') mult = 1e3;
  else if (unit === 'm') mult = 1e6;
  else if (unit === 'g') mult = 1e9;
  else if (unit === 'r') mult = 1;
  const ohms = num * mult;
  if (!isFinite(ohms) || ohms <= 0) return null;
  return ohms;
}

// 格式化 Ω → 工程单位字符串
export function formatOhms(ohms) {
  if (ohms == null || !isFinite(ohms)) return '—'
  const abs = Math.abs(ohms)
  if (abs >= 1e12) return trim(ohms / 1e12) + 'TΩ'
  if (abs >= 1e9) return trim(ohms / 1e9) + 'GΩ'
  if (abs >= 1e6) return trim(ohms / 1e6) + 'MΩ'
  if (abs >= 1e3) return trim(ohms / 1e3) + 'kΩ'
  if (abs >= 1) return trim(ohms) + 'Ω'
  return trim(ohms * 1e3) + 'mΩ'
}

function trim(n) {
  if (!isFinite(n)) return '∞';
  const s = parseFloat(n.toPrecision(5)).toString();
  return s;
}

// 格式化电压/电流数值
export function formatVolt(v) {
  if (v == null || !isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e3) return trim(v / 1e3) + 'kV'
  if (abs >= 1) return trim(v) + 'V'
  if (abs >= 1e-3) return trim(v * 1e3) + 'mV'
  if (abs >= 1e-6) return trim(v * 1e6) + 'µV'
  return trim(v * 1e9) + 'nV'
}
export function formatAmp(a) {
  if (a == null || !isFinite(a)) return '—';
  const abs = Math.abs(a);
  if (abs >= 1) return trim(a) + 'A';
  if (abs >= 1e-3) return trim(a * 1e3) + 'mA';
  if (abs >= 1e-6) return trim(a * 1e6) + 'µA';
  return trim(a * 1e9) + 'nA';
}

// ── 通用数量解析：数字 + 可选工程后缀 → SI 基准值 ──
// "5" "5V" "20mA" "10uF" "0.5s" "1k"；unitMap: 小写后缀 → 倍率（含 ''）
export function parseQuantity(str, unitMap) {
  if (str == null) return null;
  const s = String(str).trim().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-zµμ]*)$/i);
  if (!m) return null;
  const mult = unitMap[(m[2] || '').toLowerCase()];
  if (mult === undefined) return null;
  const v = parseFloat(m[1]) * mult;
  return isFinite(v) && v > 0 ? v : null;
}

const UNIT_VOLT = { '': 1, v: 1, kv: 1e3, mv: 1e-3, uv: 1e-6 };
const UNIT_AMP = { '': 1, a: 1, ma: 1e-3, ua: 1e-6, 'µa': 1e-6, 'μa': 1e-6, na: 1e-9 };
const UNIT_CAP = { '': 1, f: 1, mf: 1e-3, uf: 1e-6, 'µf': 1e-6, 'μf': 1e-6, nf: 1e-9, pf: 1e-12 };
const UNIT_SEC = { '': 1, s: 1, ms: 1e-3, us: 1e-6, 'µs': 1e-6, 'μs': 1e-6 };

export const parseVolt = (s) => parseQuantity(s, UNIT_VOLT);
export const parseAmp = (s) => parseQuantity(s, UNIT_AMP);
export const parseCap = (s) => parseQuantity(s, UNIT_CAP);
export const parseSec = (s) => parseQuantity(s, UNIT_SEC);

// 格式化电容 F → 工程单位
export function formatCap(f) {
  if (f == null || !isFinite(f)) return '—';
  const abs = Math.abs(f);
  if (abs >= 1) return trim(f) + 'F';
  if (abs >= 1e-3) return trim(f * 1e3) + 'mF';
  if (abs >= 1e-6) return trim(f * 1e6) + 'µF';
  if (abs >= 1e-9) return trim(f * 1e9) + 'nF';
  return trim(f * 1e12) + 'pF';
}

// 格式化时间 s → 工程单位
export function formatSec(s) {
  if (s == null || !isFinite(s)) return '—';
  const abs = Math.abs(s);
  if (abs >= 1) return trim(s) + 's';
  if (abs >= 1e-3) return trim(s * 1e3) + 'ms';
  if (abs >= 1e-6) return trim(s * 1e6) + 'µs';
  return trim(s * 1e9) + 'ns';
}

// 格式化功率 W → mW/W/kW
export function formatWatt(w) {
  if (w == null || !isFinite(w)) return '—';
  const abs = Math.abs(w);
  if (abs >= 1e3) return trim(w / 1e3) + 'kW';
  if (abs >= 1) return trim(w) + 'W';
  return trim(w * 1e3) + 'mW';
}
