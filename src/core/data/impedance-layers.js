// ── PCB 阻抗下拉数据（来自用户《硬件初学笔记·Learning Layout》）──
// 结构：{ er, h, b, t } 各组为 [{ label, value, note? }]。
// value 统一为 mil（主单位）；label 为友好描述（含 mm/mil、材料名、Er）。
// 组件里"自定义"选项由 UI 统一追加（编辑框中直接输入数字），数据文件不含自定义项。

// —— 介电常数 Er：来自 PP 半固化片 + 芯板（普通 FR4 / 高 Tg IT180）——
export const erOptions = [
  { value: 3.06, label: '106 PP · FR4', note: 'Er 3.06' },
  { value: 3.09, label: '106 PP · 高Tg(IT180)', note: 'Er 3.09' },
  { value: 3.65, label: '1080 PP · FR4', note: 'Er 3.65' },
  { value: 3.95, label: '1080 PP · 高Tg(IT180)', note: 'Er 3.95' },
  { value: 3.85, label: '3313 PP · FR4', note: 'Er 3.85' },
  { value: 4.15, label: '3313 PP · 高Tg(IT180)', note: 'Er 4.15' },
  { value: 3.95, label: '2116 PP · FR4', note: 'Er 3.95' },
  { value: 4.25, label: '2116 PP · 高Tg(IT180)', note: 'Er 4.25' },
  { value: 4.20, label: '7628 PP · FR4', note: 'Er 4.20' },
  { value: 4.50, label: '7628 PP · 高Tg(IT180)', note: 'Er 4.50' },
  { value: 3.60, label: '芯板 2.0mil', note: 'Er 3.60' },
  { value: 3.65, label: '芯板 3.0mil', note: 'Er 3.65' },
  { value: 3.95, label: '芯板 4.0mil', note: 'Er 3.95' },
  { value: 3.95, label: '芯板 4.33mil', note: 'Er 3.95' },
  { value: 3.95, label: '芯板 5.1mil', note: 'Er 3.95' },
  { value: 3.65, label: '芯板 5.9mil', note: 'Er 3.65' },
  { value: 4.20, label: '芯板 7.1mil', note: 'Er 4.20' },
  { value: 3.95, label: '芯板 8.27mil', note: 'Er 3.95' },
  { value: 3.95, label: '芯板 10mil', note: 'Er 3.95' },
  { value: 4.20, label: '芯板 14.2mil', note: 'Er 4.20' },
  { value: 4.10, label: '芯板 20.1mil', note: 'Er 4.10' },
  { value: 4.20, label: '芯板 28.0mil', note: 'Er 4.20' },
  { value: 4.20, label: '芯板 31.5mil', note: 'Er 4.20' },
]

// —— 介质厚度 H（单端微带：到参考面）｜ b（带状线：两平面总间距）——
// 共用 PP + 芯板厚度（mil）。用户用哪个字段→单端用 H，带状线用 b，组件按子模式路由。
export const hOptions = [
  // PP 半固化片
  { value: 2.02, label: '106 PP · 0.0513mm', note: '2.02mil' },
  { value: 3.04, label: '1080 PP · 0.0773mm', note: '3.04mil' },
  { value: 4.07, label: '3313 PP · 0.1034mm', note: '4.07mil' },
  { value: 4.66, label: '2116 PP · 0.1185mm', note: '4.66mil' },
  { value: 7.68, label: '7628 PP · 0.1951mm', note: '7.68mil' },
  // 芯板
  { value: 2.0, label: '芯板 0.051mm', note: '2.0mil' },
  { value: 3.0, label: '芯板 0.075mm', note: '3.0mil' },
  { value: 4.0, label: '芯板 0.102mm', note: '4.0mil' },
  { value: 4.33, label: '芯板 0.11mm', note: '4.33mil' },
  { value: 5.1, label: '芯板 0.13mm', note: '5.1mil' },
  { value: 5.9, label: '芯板 0.15mm', note: '5.9mil' },
  { value: 7.1, label: '芯板 0.18mm', note: '7.1mil' },
  { value: 8.27, label: '芯板 0.21mm', note: '8.27mil' },
  { value: 10, label: '芯板 0.25mm', note: '10mil' },
  { value: 14.2, label: '芯板 0.36mm', note: '14.2mil' },
  { value: 20.1, label: '芯板 0.51mm', note: '20.1mil' },
  { value: 28.0, label: '芯板 0.71mm', note: '28.0mil' },
  { value: 31.5, label: '芯板 0.80mm', note: '31.5mil' },
]

// —— 铜厚 T（mil 计算值）—— 外层含电镀加厚
export const tOptions = [
  { value: 0.65, label: '0.5oz · 内层', note: '0.65mil (18µm)' },
  { value: 1.25, label: '1oz · 内层', note: '1.25mil (35µm)' },
  { value: 2.56, label: '2oz · 内层', note: '2.56mil (70µm)' },
  { value: 3.8, label: '3oz · 内层', note: '3.8mil (105µm)' },
  { value: 5.0, label: '4oz · 内层', note: '5.0mil (140µm)' },
  { value: 2.2, label: '0.5oz · 外层', note: '2.2mil' },
  { value: 2.9, label: '1oz · 外层', note: '2.9mil' },
  { value: 4.2, label: '2oz · 外层', note: '4.2mil' },
  { value: 5.5, label: '3oz · 外层', note: '5.5mil' },
  { value: 6.8, label: '4oz · 外层', note: '6.8mil' },
]

// —— 常用阻抗速查（单端/差分参考，note 用）——
export const zTargetPresets = [
  { value: 50, label: '50Ω 单端', note: '射频/天线/高速单端' },
  { value: 75, label: '75Ω 单端', note: '有线电视/视频' },
  { value: 90, label: '90Ω 差分', note: 'USB2/3.x/4' },
  { value: 100, label: '100Ω 差分', note: '以太网/MIPI/HDMI/PCIe' },
  { value: 120, label: '120Ω 差分', note: 'CAN/RS485/Profibus' },
  { value: 85, label: '85Ω 差分', note: '车载以太网 100BASE-T1' },
]
