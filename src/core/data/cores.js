// 磁芯库 —— 数据取自《功率磁芯规格表》(厂商总表, 材质 TP4, 符合行业标准)，Ae/Le/Ve 均满足 Ve≈Ae×Le 自洽。
// maxPower 为该磁芯的「约设计功率」(表列 TP4 材质下)；比设计师保守取值更高，实际选芯还叠加用户保守段。
// Aw(窗口mm²)/MLT(平均匝长mm)/maxGap(气隙mm) 为配套骨架+工艺**参考值**，以实际骨架 datasheet 为准（界面可覆写）。
export const cores = [
  { model: 'EE13/12/6',   Ae: 16.08,  Le: 30.88,  Ve: 496.55,   maxPower: 8,   Aw: 20,  MLT: 38,  maxGap: 0.40, source: '功率磁芯规格表' },
  { model: 'EE16/14/5',   Ae: 18.88,  Le: 35.00,  Ve: 660.80,   maxPower: 10,  Aw: 28,  MLT: 42,  maxGap: 0.40, source: '功率磁芯规格表' },
  { model: 'EE19/16/5',   Ae: 22.70,  Le: 39.60,  Ve: 898.92,   maxPower: 14,  Aw: 34,  MLT: 48,  maxGap: 0.50, source: '功率磁芯规格表' },
  { model: 'EE22/19/5.7', Ae: 36.30,  Le: 42.00,  Ve: 1524.60,  maxPower: 20,  Aw: 48,  MLT: 52,  maxGap: 0.50, source: '功率磁芯规格表' },
  { model: 'EE25/20/6',   Ae: 39.77,  Le: 50.21,  Ve: 1996.85,  maxPower: 33,  Aw: 60,  MLT: 60,  maxGap: 0.50, source: '功率磁芯规格表' },
  { model: 'EE28/21/11',  Ae: 82.90,  Le: 51.70,  Ve: 4285.93,  maxPower: 60,  Aw: 100, MLT: 66,  maxGap: 0.60, source: '功率磁芯规格表' },
  { model: 'EE30/26/11',  Ae: 107.00, Le: 57.90,  Ve: 6195.30,  maxPower: 90,  Aw: 120, MLT: 70,  maxGap: 0.60, source: '功率磁芯规格表' },
  { model: 'EE33/28/13',  Ae: 113.70, Le: 68.20,  Ve: 7754.34,  maxPower: 120, Aw: 150, MLT: 80,  maxGap: 0.70, source: '功率磁芯规格表' },
  { model: 'EE40/35/12',  Ae: 147.50, Le: 77.60,  Ve: 11446.00, maxPower: 175, Aw: 200, MLT: 92,  maxGap: 0.70, source: '功率磁芯规格表' },
  { model: 'EE42/42/15',  Ae: 178.00, Le: 97.90,  Ve: 17426.20, maxPower: 265, Aw: 230, MLT: 110, maxGap: 0.80, source: '功率磁芯规格表' },
  { model: 'EE55/55/21',  Ae: 352.00, Le: 123.00, Ve: 43296.00, maxPower: 660, Aw: 380, MLT: 150, maxGap: 0.90, source: '功率磁芯规格表' },
  { model: 'EE65/65/27',  Ae: 535.00, Le: 147.00, Ve: 78645.00, maxPower: 1250, Aw: 560, MLT: 180, maxGap: 1.00, source: '功率磁芯规格表' }
]
