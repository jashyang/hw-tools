// 磁芯库 —— Ae/Le/Ve 为真实标准值（Acme Ferrite / TDK 规格表，符合 IEC 63093-8 E 型磁芯标准，
// 均满足 Ve ≈ Ae×Le 自洽校验；EE25/13/7 另经 TDK 官方 datasheet 交叉核对）。
// Aw(绕组窗口面积mm²)/MLT(平均匝长mm)/maxGap(可磨气隙上限mm) 为配套骨架+工艺**参考值**，
// 以实际骨架/bobbin datasheet 为准（引擎界面会提示可覆写）。
// maxPower 为按磁芯体积/频率的**推荐功率参考**（工程估算，非标准值）。
export const cores = [
  { series: 'EE', model: 'EE13/7/4',   Ae: 17.7,  Le: 24.3,  Ve: 430,    maxPower: 3,   Aw: 22,  MLT: 32,  maxGap: 0.15, source: 'Acme/IEC EE13/7/4' },
  { series: 'EE', model: 'EE16/8/5',   Ae: 26.1,  Le: 32.3,  Ve: 842,    maxPower: 6,   Aw: 34,  MLT: 42,  maxGap: 0.20, source: 'Acme EE16.4' },
  { series: 'EE', model: 'EE19/16',    Ae: 22.1,  Le: 40.6,  Ve: 897,    maxPower: 10,  Aw: 40,  MLT: 52,  maxGap: 0.25, source: 'Acme EE19B' },
  { series: 'EE', model: 'EE20/10/6',  Ae: 32.1,  Le: 46.3,  Ve: 1490,   maxPower: 15,  Aw: 52,  MLT: 58,  maxGap: 0.30, source: 'Acme EE20A' },
  { series: 'EE', model: 'EE22',       Ae: 44.3,  Le: 46.7,  Ve: 2070,   maxPower: 20,  Aw: 60,  MLT: 60,  maxGap: 0.30, source: 'Acme EE20.5B' },
  { series: 'EE', model: 'EE25/13/7',  Ae: 52.5,  Le: 57.5,  Ve: 3020,   maxPower: 30,  Aw: 70,  MLT: 72,  maxGap: 0.40, source: 'TDK E25/13/7 (B66317)' },
  { series: 'EE', model: 'EE30/15/7',  Ae: 60.6,  Le: 70.8,  Ve: 4290,   maxPower: 45,  Aw: 95,  MLT: 88,  maxGap: 0.45, source: 'Acme EE30A' },
  { series: 'EE', model: 'EE35',       Ae: 82.6,  Le: 69.2,  Ve: 5719,   maxPower: 55,  Aw: 110, MLT: 95,  maxGap: 0.50, source: 'Acme EE35A' },
  { series: 'EE', model: 'EE36',       Ae: 115.5, Le: 81.7,  Ve: 9441,   maxPower: 75,  Aw: 140, MLT: 105, maxGap: 0.55, source: 'Acme EE36' },
  { series: 'EE', model: 'EE42/21/15', Ae: 178,   Le: 97.6,  Ve: 17400,  maxPower: 120, Aw: 210, MLT: 125, maxGap: 0.65, source: 'Acme EE42A' },
  { series: 'EE', model: 'EE65/32/27', Ae: 532,   Le: 146.9, Ve: 78183,  maxPower: 350, Aw: 520, MLT: 185, maxGap: 0.90, source: 'Acme EE65' },
  { series: 'EE', model: 'EE70',       Ae: 674.6, Le: 149.9, Ve: 101106, maxPower: 450, Aw: 600, MLT: 200, maxGap: 1.00, source: 'Acme EE70' }
]
