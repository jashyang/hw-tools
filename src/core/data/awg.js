// AWG 铜线标准数据（直径/截面积/载流/单位电阻）
// 直径与截面积对照 IEC 标准（裸铜）；载流按自然对流 ~4.5A/mm² 电流密度估算；
// rPerKm = 20℃ 铜电阻率 1.72e-8 Ω·m 折算（Ω/km）。
export const awgTable = [
  { awg: 40, diaMM: 0.080, areaMm2: 0.0050, currentA: 0.02, rPerKm: 3440 },
  { awg: 39, diaMM: 0.089, areaMm2: 0.0062, currentA: 0.03, rPerKm: 2774 },
  { awg: 38, diaMM: 0.102, areaMm2: 0.0082, currentA: 0.04, rPerKm: 2098 },
  { awg: 37, diaMM: 0.113, areaMm2: 0.0100, currentA: 0.05, rPerKm: 1720 },
  { awg: 36, diaMM: 0.127, areaMm2: 0.0127, currentA: 0.06, rPerKm: 1354 },
  { awg: 35, diaMM: 0.143, areaMm2: 0.0160, currentA: 0.07, rPerKm: 1075 },
  { awg: 34, diaMM: 0.160, areaMm2: 0.0202, currentA: 0.09, rPerKm: 851 },
  { awg: 33, diaMM: 0.180, areaMm2: 0.0254, currentA: 0.11, rPerKm: 677 },
  { awg: 32, diaMM: 0.203, areaMm2: 0.0324, currentA: 0.15, rPerKm: 531 },
  { awg: 31, diaMM: 0.226, areaMm2: 0.0403, currentA: 0.18, rPerKm: 427 },
  { awg: 30, diaMM: 0.254, areaMm2: 0.0509, currentA: 0.23, rPerKm: 338 },
  { awg: 29, diaMM: 0.287, areaMm2: 0.0647, currentA: 0.29, rPerKm: 266 },
  { awg: 28, diaMM: 0.321, areaMm2: 0.0810, currentA: 0.36, rPerKm: 212 },
  { awg: 27, diaMM: 0.361, areaMm2: 0.1020, currentA: 0.46, rPerKm: 169 },
  { awg: 26, diaMM: 0.404, areaMm2: 0.1280, currentA: 0.58, rPerKm: 134 },
  { awg: 25, diaMM: 0.457, areaMm2: 0.1620, currentA: 0.73, rPerKm: 106 },
  { awg: 24, diaMM: 0.511, areaMm2: 0.2050, currentA: 0.92, rPerKm: 84.1 },
  { awg: 23, diaMM: 0.574, areaMm2: 0.2580, currentA: 1.16, rPerKm: 66.5 },
  { awg: 22, diaMM: 0.645, areaMm2: 0.3240, currentA: 1.46, rPerKm: 52.8 },
  { awg: 21, diaMM: 0.724, areaMm2: 0.4120, currentA: 1.85, rPerKm: 41.9 },
  { awg: 20, diaMM: 0.812, areaMm2: 0.5170, currentA: 2.33, rPerKm: 33.3 },
  { awg: 19, diaMM: 0.912, areaMm2: 0.6530, currentA: 2.94, rPerKm: 26.4 },
  { awg: 18, diaMM: 1.024, areaMm2: 0.8230, currentA: 3.70, rPerKm: 21.0 },
  { awg: 17, diaMM: 1.150, areaMm2: 1.0400, currentA: 4.68, rPerKm: 16.6 },
  { awg: 16, diaMM: 1.291, areaMm2: 1.3100, currentA: 5.90, rPerKm: 13.2 },
  { awg: 15, diaMM: 1.450, areaMm2: 1.6500, currentA: 7.43, rPerKm: 10.5 },
  { awg: 14, diaMM: 1.628, areaMm2: 2.0800, currentA: 9.36, rPerKm: 8.29 },
  { awg: 13, diaMM: 1.829, areaMm2: 2.6200, currentA: 11.8, rPerKm: 6.58 },
  { awg: 12, diaMM: 2.052, areaMm2: 3.3100, currentA: 14.9, rPerKm: 5.21 }
]
