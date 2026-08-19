// ── SVG 垂直布局引擎：树 → 电路图坐标 ──
// 走向：Vin 顶部 → GND 底部，电流自上而下
// 输出：{ elems: [{id,type,x,y,w,h,label,ohms,unknown,folded,mode}], seams: [{id,x,y}] }
//
// 几何约定：
//   每个节点是一个"盒子"，顶部中心 = 输入端口，底部中心 = 输出端口
//   电阻体：竖直长方形 18×34，盒内上下各留 10px 导线
//   串联组：子盒垂直堆叠，间距 gap（导线长度）
//   并联组：子盒水平排列，上下母线汇合

const RES_W = 18  // 电阻体宽
const RES_H = 34  // 电阻体高
const BOX_PAD = 10 // 电阻盒内上下导线
const RES_BOX_H = RES_H + BOX_PAD * 2
const LABEL_W = 46 // 右侧标注预留宽度
const BOX_W = RES_W + LABEL_W // 电阻盒宽
const SERIES_GAP = 26 // 串联间距（导线）
const PARALLEL_GAP = 18 // 并联支路间距
const PARALLEL_RAIL = 22 // 母线到支路端口的竖线长度

export function layout(root) {
  const elems = []
  const seams = []
  const wires = []

  // 递归布局，返回 { w, h, cx }（cx = 本节点输出端口 x），并把元素/缝/导线写入数组
  function place(node, x, y) {
    if (node.type === 'res') {
      elems.push({
        id: node.id,
        type: 'res',
        x, y, w: BOX_W, h: RES_BOX_H,
        label: node.label, ohms: node.ohms, raw: node.raw, unknown: node.unknown,
      })
      return { w: BOX_W, h: RES_BOX_H, cx: x + BOX_W / 2 }
    }
    // group
    if (node.mode === 'series') {
      let totalH = 0
      let maxW = 0
      const sizes = []
      const cxs = []
      for (let i = 0; i < node.children.length; i++) {
        const s = place(node.children[i], x, y + totalH)
        sizes.push(s)
        cxs.push(s.cx)
        totalH += s.h
        if (i < node.children.length - 1) totalH += SERIES_GAP
        maxW = Math.max(maxW, s.w)
      }
      // 串联导线：元素 i 底端口 → 元素 i+1 顶端口
      let curY = y
      for (let i = 0; i < node.children.length; i++) {
        const botY = curY + sizes[i].h
        if (i < node.children.length - 1) {
          const topY = botY + SERIES_GAP
          wires.push({ x1: cxs[i], y1: botY, x2: cxs[i + 1], y2: topY })
          seams.push({ id: `${node.id}:s${i}`, x: (cxs[i] + cxs[i + 1]) / 2, y: (botY + topY) / 2 })
        }
        curY = botY + SERIES_GAP
      }
      elems.push({
        id: node.id, type: 'group', x, y, w: maxW, h: totalH,
        mode: 'series', folded: node.folded, label: node.label,
      })
      return { w: maxW, h: totalH, cx: x + maxW / 2 }
    }
    // parallel
    let totalW = 0
    let maxH = 0
    const sizes = []
    const cxs = []
    let cx = x
    for (let i = 0; i < node.children.length; i++) {
      const s = place(node.children[i], cx, y + PARALLEL_RAIL)
      sizes.push(s)
      cxs.push(s.cx)
      totalW += s.w
      if (i < node.children.length - 1) totalW += PARALLEL_GAP
      cx += s.w + PARALLEL_GAP
      maxH = Math.max(maxH, s.h)
    }
    const h = maxH + PARALLEL_RAIL * 2
    // 母线导线：上端横线 + 各支路竖线；下端同理
    const xL = cxs[0]
    const xR = cxs[cxs.length - 1]
    const yTop = y + PARALLEL_RAIL / 2
    const yBot = y + h - PARALLEL_RAIL / 2
    wires.push({ x1: xL, y1: yTop, x2: xR, y2: yTop })
    wires.push({ x1: xL, y1: yBot, x2: xR, y2: yBot })
    for (const cxx of cxs) {
      wires.push({ x1: cxx, y1: yTop, x2: cxx, y2: y + PARALLEL_RAIL })
      wires.push({ x1: cxx, y1: y + h - PARALLEL_RAIL, x2: cxx, y2: yBot })
    }
    seams.push({ id: `${node.id}:top`, x: (xL + xR) / 2, y: yTop })
    seams.push({ id: `${node.id}:bot`, x: (xL + xR) / 2, y: yBot })
    elems.push({
      id: node.id, type: 'group', x, y, w: totalW, h,
      mode: 'parallel', folded: node.folded, label: node.label,
    })
    return { w: totalW, h, cx: x + totalW / 2 }
  }

  place(root, 0, 0)
  const rootElem = elems.find((e) => e.id === root.id)
  // 根端口缝 + 上下引出导线
  wires.push({ x1: rootElem.w / 2, y1: 0, x2: rootElem.w / 2, y2: rootElem.h })
  seams.push({ id: 'IN', x: rootElem.w / 2, y: 0 })
  seams.push({ id: 'GND', x: rootElem.w / 2, y: rootElem.h })

  return { elems, seams, wires }
}

// 电阻体内坐标（供渲染矩形/标注）
export function resBodyRect(e) {
  return { x: e.x + (e.w - RES_W) / 2, y: e.y + BOX_PAD, w: RES_W, h: RES_H }
}
export const GEOM = { RES_W, RES_H, BOX_PAD, SERIES_GAP, PARALLEL_GAP, PARALLEL_RAIL }
