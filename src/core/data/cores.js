// 磁芯库 —— Ae/Le/Ve 为 TDK 官方 datasheet 标准真实值（符合 IEC 63093-8 E 型磁芯标准，均满足 Ve≈Ae×Le 自洽）。
// 型号用标准 IEC 后缀命名（EE25/13/7 等），通用可直接对应市售磁芯。
// Aw(绕组窗口面积mm²)/MLT(平均匝长mm)/maxGap(气隙上限mm) 为配套骨架+工艺**参考值**，
// 以实际骨架/bobbin datasheet 为准；maxPower 为按体积/经验的设计功率参考（非标准值）。
export const cores = [
  { series: 'EE', model: 'EE13/7/4',   Ae: 12.4,  Le: 29.6,  Ve: 367,   maxPower: 5,   Aw: 15,  MLT: 30,  maxGap: 0.40, source: 'TDK E13/7/4' },
  { series: 'EE', model: 'EE16/8/5',   Ae: 20.1,  Le: 37.6,  Ve: 756,   maxPower: 8,   Aw: 24,  MLT: 38,  maxGap: 0.40, source: 'TDK E16/8/5' },
  { series: 'EE', model: 'EE20/10/6',  Ae: 32.1,  Le: 46.3,  Ve: 1490,  maxPower: 15,  Aw: 46,  MLT: 50,  maxGap: 0.50, source: 'TDK E20/10/6' },
  { series: 'EE', model: 'EE25/13/7',  Ae: 52.5,  Le: 57.5,  Ve: 3020,  maxPower: 25,  Aw: 70,  MLT: 62,  maxGap: 0.50, source: 'TDK E25/13/7 (B66317)' },
  { series: 'EE', model: 'EE30/15/7',  Ae: 60.0,  Le: 67.0,  Ve: 4000,  maxPower: 40,  Aw: 95,  MLT: 72,  maxGap: 0.60, source: 'TDK E30/15/7' },
  { series: 'EE', model: 'EE36/18/11', Ae: 120,   Le: 81.0,  Ve: 9720,  maxPower: 80,  Aw: 150, MLT: 88,  maxGap: 0.70, source: 'TDK E36/18/11' },
  { series: 'EE', model: 'EE42/21/15', Ae: 178,   Le: 97.0,  Ve: 17300, maxPower: 120, Aw: 210, MLT: 105, maxGap: 0.80, source: 'TDK E42/21/15' },
  { series: 'EE', model: 'EE55/28/21', Ae: 354,   Le: 124,   Ve: 43900, maxPower: 250, Aw: 330, MLT: 135, maxGap: 0.90, source: 'TDK E55/28/21' },
  { series: 'EE', model: 'EE65/32/27', Ae: 535,   Le: 147,   Ve: 78650, maxPower: 450, Aw: 520, MLT: 165, maxGap: 1.00, source: 'TDK E65/32/27' }
]
