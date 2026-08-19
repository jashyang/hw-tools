// ── 电阻值解析与格式化 ──

// 解析 "470" "1k" "2.2k" "4.7M" "100R" "1M5" "1.5K" → Ω 数值；非法返回 null
export function parseResistor(str) {
  if (str == null) return null;
  const s = String(str).trim().replace(/\s+/g, '');
  if (!s) return null;
  // 工程记法: 数字 + [kKmMgG] 或 rR；也支持 1M5 这类（数字单位数字）
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([kKmMgGrR]?)(?:(\d+))?$/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  const tail = m[3] ? parseFloat('0.' + m[3].padStart(3, '0')) : 0;
  let mult = 1;
  if (unit === 'k') mult = 1e3;
  else if (unit === 'm') mult = 1e6;
  else if (unit === 'g') mult = 1e9;
  else if (unit === 'r') mult = 1;
  const ohms = v * mult + tail * mult;
  if (!isFinite(ohms) || ohms <= 0) return null;
  return ohms;
}

// 格式化 Ω → 工程单位字符串
export function formatOhms(ohms) {
  if (ohms == null || !isFinite(ohms)) return '—';
  const abs = Math.abs(ohms);
  if (abs >= 1e9) return trim((ohms / 1e9)) + 'GΩ';
  if (abs >= 1e6) return trim(ohms / 1e6) + 'MΩ';
  if (abs >= 1e3) return trim(ohms / 1e3) + 'kΩ';
  if (abs >= 1) return trim(ohms) + 'Ω';
  return trim(ohms * 1e3) + 'mΩ';
}

function trim(n) {
  if (!isFinite(n)) return '∞';
  const s = parseFloat(n.toPrecision(5)).toString();
  return s;
}

// 格式化电压/电流数值
export function formatVolt(v) {
  if (v == null || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e3) return trim(v / 1e3) + 'kV';
  if (abs >= 1) return trim(v) + 'V';
  return trim(v * 1e3) + 'mV';
}
export function formatAmp(a) {
  if (a == null || !isFinite(a)) return '—';
  const abs = Math.abs(a);
  if (abs >= 1) return trim(a) + 'A';
  if (abs >= 1e-3) return trim(a * 1e3) + 'mA';
  if (abs >= 1e-6) return trim(a * 1e6) + 'µA';
  return trim(a * 1e9) + 'nA';
}
