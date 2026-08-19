// ── 树形电阻网络：递归化简（场景 1）──
// 节点模型:
//   { type:'res',   id, label, ohms }                 — 叶子电阻
//   { type:'group', id, mode:'series'|'parallel', children:[] } — 组

// 等效电阻 + 化简步骤
export function simplify(node, steps = [], ctx = { counter: 0 }) {
  if (node.type === 'res') {
    return node.ohms; // 必须是有效数值
  }
  const vals = node.children.map((c) => simplify(c, steps, ctx));
  let R;
  let text;
  if (node.mode === 'series') {
    R = vals.reduce((a, b) => a + b, 0);
    text = node.children.map((c) => c.label || c.id).join(' + ');
  } else {
    const inv = vals.reduce((a, b) => a + 1 / b, 0);
    R = 1 / inv;
    text = node.children.map((c) => c.label || c.id).join(' ∥ ');
  }
  steps.push({ text, ohms: R, mode: node.mode });
  return R;
}

// 纯数值等效（不记步骤，用于求解内核）
export function equivR(node) {
  if (node.type === 'res') return node.ohms;
  if (node.mode === 'series') {
    return node.children.reduce((a, c) => a + equivR(c), 0);
  }
  const inv = node.children.reduce((a, c) => a + 1 / equivR(c), 0);
  return 1 / inv;
}

// 网络中是否存在未知电阻（ohms 为 null）
export function hasUnknown(node) {
  if (node.type === 'res') return node.ohms == null;
  return node.children.some(hasUnknown);
}

// 网络中是否所有电阻都已知（场景 1 求解前提）
export function allKnown(node) {
  return !hasUnknown(node);
}
