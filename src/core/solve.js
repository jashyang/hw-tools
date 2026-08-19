// ── 场景 2：电压传播 + 二分反推未知电阻 ──
// 树形二端网络：根组高端 = 输入正端(Vin)，根组低端 = 地(0V)
//
// 缝（节点）模型：串联组内 children[i] 的低端缝 id = `${group.id}:s${i}`
// 根高端缝 id = 'IN'，根低端 = 'GND'
//
// 未知电阻：ohms = null 的叶子。二分搜索使其使目标缝电压逼近目标值。
// 线性网络性质：任意节点电压对单个电阻是单调函数（分式线性），二分必然收敛。

import { equivR } from './simplify.js';

// 电压传播：计算所有缝电压 + 各电阻端电压/电流/功率
// 返回 { seams: Map<缝id, 电压>, elems: Map<电阻id, {v, i, p}>, ok }
export function propagate(root, vin) {
  const seams = new Map();
  const elems = new Map();
  seams.set('IN', vin);
  seams.set('GND', 0);

  function walk(node, vHigh, vLow) {
    if (node.type === 'res') {
      const v = vHigh - vLow;
      const i = v / node.ohms;
      elems.set(node.id, { v: Math.abs(v), i: Math.abs(i), p: Math.abs(v * i) });
      return;
    }
    if (node.mode === 'series') {
      const total = node.children.reduce((a, c) => a + (c.type === 'res' ? c.ohms : equivR(c)), 0);
      if (!isFinite(total) || total === 0) return;
      const I = (vHigh - vLow) / total;
      let cur = vHigh;
      for (let k = 0; k < node.children.length; k++) {
        const child = node.children[k];
        const rChild = child.type === 'res' ? child.ohms : equivR(child);
        const vLow = cur - I * rChild;
        walk(child, cur, vLow);
        seams.set(`${node.id}:s${k}`, vLow);
        cur = vLow;
      }
    } else {
      // parallel：所有支路两端同压
      for (const child of node.children) walk(child, vHigh, vLow);
    }
  }

  walk(root, vin, 0);
  return { seams, elems };
}

// 主入口：给定 Vin 求解
export function solveUnknownWithVin(root, seamId, targetV, unknownId, vin, opts = {}) {
  const { lo0 = 1e-6, hi0 = 1e12, iters = 60 } = opts;
  if (!isFinite(targetV) || targetV < 0) return { error: '目标电压非法' };
  if (!isFinite(vin) || vin <= 0) return { error: '输入电压非法' };

  const unk = findNode(root, unknownId);
  if (!unk || unk.type !== 'res') return { error: '未知电阻不存在' };

  const f = (r) => {
    unk.ohms = r;
    const { seams } = propagate(root, vin);
    const v = seams.get(seamId);
    return v == null ? NaN : v;
  };

  // 检查目标缝是否存在
  let probe = f(lo0);
  if (isNaN(probe)) return { error: '目标节点不存在' };

  // 方向判断：f 单调。若 f(lo) < f(hi) 则递增。
  const fLo = f(lo0);
  const fHi = f(hi0);
  if (isNaN(fHi)) return { error: '求解失败：节点电压无法计算' };
  // 目标必须落在 [min(fLo,fHi), max(fLo,fHi)] 内，否则无解
  const vMin = Math.min(fLo, fHi);
  const vMax = Math.max(fLo, fHi);
  if (targetV < vMin - 1e-9 || targetV > vMax + 1e-9) {
    return {
      error: `无解：该节点电压范围 [${vMin.toPrecision(4)}V, ${vMax.toPrecision(4)}V]，目标 ${targetV}V 不在范围内`,
    };
  }

  let lo = lo0;
  let hi = hi0;
  const rising = fLo < fHi;
  let best = null;
  for (let k = 0; k < iters; k++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (isNaN(v)) break;
    best = { ohms: mid, voltage: v };
    if (Math.abs(v - targetV) <= 1e-9 * Math.max(1, Math.abs(targetV))) break;
    if (rising ? v < targetV : v > targetV) lo = mid;
    else hi = mid;
  }

  if (!best) return { error: '求解失败' };
  // 代回验证
  const { seams, elems } = propagate(root, vin);
  const finalV = seams.get(seamId);
  return {
    ohms: best.ohms,
    voltage: finalV,
    errorV: finalV - targetV,
    iterations: iters,
    seams,
    elems,
  };
}

export function findNode(node, id) {
  if (node.id === id) return node;
  if (node.type === 'group') {
    for (const c of node.children) {
      const r = findNode(c, id);
      if (r) return r;
    }
  }
  return null;
}

// 收集所有缝 id（用于 UI 列出可标记的节点）
export function collectSeams(node, out = [], prefix = '') {
  if (node.type === 'res') return out;
  if (node.mode === 'series') {
    for (let k = 0; k < node.children.length; k++) {
      out.push(`${node.id}:s${k}`);
    }
  }
  for (const c of node.children) collectSeams(c, out, prefix);
  return out;
}
