export const materials = {
  PC40: { manufacturer: 'TDK', BsT: 0.39, deltaBDyn: 0.20, rho: 0.018, costTier: 'low', note: '通用级，性价比最高' },
  PC4B: { manufacturer: 'TDK', BsT: 0.50, deltaBDyn: 0.20, rho: 0.015, costTier: 'medium', note: '高性能，损耗低' },
  N87: { manufacturer: 'TDK/Master', BsT: 0.50, deltaBDyn: 0.20, rho: 0.015, costTier: 'medium', note: '高频低损，最常用替代PC40' },
  PC95: { manufacturer: 'TDK', BsT: 0.52, deltaBDyn: 0.20, rho: 0.014, costTier: 'medium-high', note: '超高频率优化' },
  '3C90': { manufacturer: '宁波东力(国巨)', BsT: 0.47, deltaBDyn: 0.20, rho: 0.016, costTier: 'mid-high', note: '国内大厂，性能接近N87' },
  '3C95': { manufacturer: '宁波东力(国巨)', BsT: 0.49, deltaBDyn: 0.20, rho: 0.014, costTier: 'mid-high', note: '高频低损版' }
}
