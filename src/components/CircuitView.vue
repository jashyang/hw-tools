<script setup>
import { ref, computed } from 'vue'
import { layout } from '../core/layout.js'
import { equivR } from '../core/simplify.js'
import { formatOhms } from '../core/parse.js'

// 电路图画布：SVG 渲染（垂直走向）+ 滚轮缩放 + 空白拖动平移 + 元件拖拽吸附
// 交互状态（选中/操作）由外部 useCircuit 实例提供
const props = defineProps({
  node: { type: Object, required: true },
  ops: { type: Object, required: true },
  seamMode: { type: Boolean, default: false },
})
const emit = defineEmits(['mark-seam'])

const MIN_W = 600
const MIN_H = 260

const L = computed(() => layout(props.node))
const rootElem = computed(() => L.value.elems.find((e) => e.id === props.node.id))
const contentW = computed(() => rootElem.value.w)
const contentH = computed(() => rootElem.value.h)
const viewW = computed(() => Math.max(contentW.value, MIN_W))
const viewH = computed(() => Math.max(contentH.value, MIN_H))
const dx = computed(() => (viewW.value - contentW.value) / 2)
const dy = computed(() => (viewH.value - contentH.value) / 2)

// ── 缩放 / 平移 ──
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const canvasRef = ref(null)
const svgRef = ref(null)
const panning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panOrigin = ref({ x: 0, y: 0 })

function onWheel(e) {
  e.preventDefault()
  const rect = canvasRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.12 : 0.89
  const nz = Math.min(3, Math.max(0.3, zoom.value * factor))
  pan.value.x = mx - ((mx - pan.value.x) * nz) / zoom.value
  pan.value.y = my - ((my - pan.value.y) * nz) / zoom.value
  zoom.value = nz
}
function onPanStart(e) {
  // 只响应空白区域拖动（按钮/元件不触发：元件点击有 stopPropagation）
  panning.value = true
  panStart.value = { x: e.clientX, y: e.clientY }
  panOrigin.value = { ...pan.value }
}
function onPanMove(e) {
  if (!panning.value) return
  pan.value.x = panOrigin.value.x + (e.clientX - panStart.value.x)
  pan.value.y = panOrigin.value.y + (e.clientY - panStart.value.y)
}
function onPanEnd() {
  panning.value = false
}

// ── 拖拽吸附 ──
const DRAG_TYPE = 'application/x-hwtype'
const DRAG_ID = 'application/x-hwid'
const hoverSnap = ref(null)
const dragSrc = ref(null) // 当前拖动的源电阻 id（移动模式）

// 吸附点列表：series 缝 = 串联插入点；parallel top/bot 缝 = 并联追加点
const snaps = computed(() => {
  const out = []
  for (const s of L.value.seams) {
    if (s.id === 'IN' || s.id === 'GND') continue
    const m = s.id.match(/^(.+):s(\d+)$/)
    if (m) {
      const g = props.ops.findNode(props.node, m[1])
      if (g && g.mode === 'series') {
        out.push({ kind: 'series', groupId: m[1], index: Number(m[2]), x: s.x + dx.value, y: s.y + dy.value })
      }
      continue
    }
    const m2 = s.id.match(/^(.+):(top|bot)$/)
    if (m2) {
      const g = props.ops.findNode(props.node, m2[1])
      if (g && g.mode === 'parallel') {
        out.push({ kind: 'parallel', groupId: m2[1], x: s.x + dx.value, y: s.y + dy.value })
      }
    }
  }
  return out
})

function screenToCircuitXY(clientX, clientY) {
  const svg = svgRef.value
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  return pt.matrixTransform(svg.getScreenCTM().inverse())
}
function findSnapAt(clientX, clientY) {
  const p = screenToCircuitXY(clientX, clientY)
  const thr = 46 / zoom.value
  let best = null
  let bestD = thr
  for (const s of snaps.value) {
    const d = Math.hypot(s.x - p.x, s.y - p.y)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

function hasDragType(e) {
  const t = e.dataTransfer.types
  if (!t) return false
  for (let i = 0; i < t.length; i++) if (t[i] === DRAG_TYPE) return true
  return false
}

function onDragOver(e) {
  if (!hasDragType(e)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = e.dataTransfer.getData(DRAG_TYPE) === 'move' ? 'move' : 'copy'
  hoverSnap.value = findSnapAt(e.clientX, e.clientY)
}
function onDragLeave() {
  hoverSnap.value = null
}
function onDrop(e) {
  if (!hasDragType(e)) return
  e.preventDefault()
  const type = e.dataTransfer.getData(DRAG_TYPE)
  const srcId = e.dataTransfer.getData(DRAG_ID)
  const s = hoverSnap.value
  hoverSnap.value = null
  dragSrc.value = null
  if (!s) return

  if (type === 'move' && srcId) {
    moveResToSnap(srcId, s)
    return
  }

  // 新建元件
  const node = type === 'res' ? props.ops.mkRes() : props.ops.mkGroup(type)
  if (s.kind === 'series') {
    props.ops.insertInto(s.groupId, s.index + 1, node)
  } else if (s.kind === 'parallel') {
    props.ops.pushInto(s.groupId, node)
  }
}

// 已有电阻拖动（Pointer Events 实现，绕开 SVG 元素不支持 HTML5 draggable 的问题）
const dragCandidate = ref(null) // { id, sx, sy, active }
const DRAG_THRESHOLD = 6

function onResDown(e, id) {
  dragCandidate.value = { id, sx: e.clientX, sy: e.clientY, active: false }
  try {
    e.target.setPointerCapture(e.pointerId)
  } catch { /* ignore */ }
  e.stopPropagation()
}
function onResMove(e) {
  const d = dragCandidate.value
  if (!d) return
  if (!d.active) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return
    d.active = true
    dragSrc.value = d.id
  }
  hoverSnap.value = findSnapAt(e.clientX, e.clientY)
}
function onResUp(e) {
  const d = dragCandidate.value
  dragCandidate.value = null
  if (!d) return
  if (d.active) {
    const s = hoverSnap.value
    hoverSnap.value = null
    dragSrc.value = null
    if (s) moveResToSnap(d.id, s)
  }
}
function onResCancel() {
  dragCandidate.value = null
  hoverSnap.value = null
  dragSrc.value = null
}

// 执行移动：从原位置移除 → 插入目标吸附点
function moveResToSnap(srcId, s) {
  const src = props.ops.findNode(props.node, srcId)
  if (!src || src.type !== 'res') return false
  const targetGroup = props.ops.findNode(props.node, s.groupId)
  if (targetGroup && s.kind === 'parallel' && targetGroup.children.includes(src)) return false
  props.ops.removeById(props.node, srcId)
  if (s.kind === 'series') {
    props.ops.insertInto(s.groupId, s.index + 1, src)
  } else {
    props.ops.pushInto(s.groupId, src)
  }
  props.ops.select(srcId)
  return true
}

// ── 折叠 / 缝 ──
function onGroupFold(e, id) {
  e.stopPropagation()
  const n = props.ops.findNode(props.node, id)
  if (n) n.folded = !n.folded
}
function onSeamClick(e, id) {
  e.stopPropagation()
  if (!props.seamMode) return
  emit('mark-seam', id)
}

// 折叠组隐藏后代
const hiddenIds = computed(() => {
  const s = new Set()
  ;(function walk(n) {
    if (n.type === 'group' && n.folded) {
      ;(function collect(c) {
        s.add(c.id)
        if (c.type === 'group') c.children.forEach(collect)
      })(n)
      return
    }
    if (n.type === 'group') n.children.forEach(walk)
  })(props.node)
  return s
})
const visElems = computed(() => L.value.elems.filter((e) => !hiddenIds.value.has(e.id)))
function groupEquiv(id) {
  return formatOhms(equivR(props.ops.findNode(props.node, id)))
}

const BANDS = ['#b3402a', '#e8a33d', '#3d7ea6', '#6a4d9e', '#4a9e5a', '#c94f6d', '#8c8c8c']
function bands(label) {
  let h = 0
  for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) % 997
  return [BANDS[h % 7], BANDS[(h * 3 + 2) % 7], BANDS[(h * 5 + 4) % 7]]
}
</script>

<template>
  <div
    ref="canvasRef" class="canvas"
    :class="{ panning }"
    @wheel="onWheel"
    @pointerdown="onPanStart"
    @pointermove="onPanMove"
    @pointerup="onPanEnd"
    @pointerleave="onPanEnd"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      class="canvas-inner"
      :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }"
    >
      <svg
        ref="svgRef"
        class="circuit"
        :viewBox="`0 0 ${viewW} ${viewH}`"
        :width="viewW" :height="viewH"
        @click="ops.clearSelect"
      >
        <!-- 导线 -->
        <line
          v-for="(w, i) in L.wires" :key="'w' + i"
          :x1="w.x1 + dx" :y1="w.y1 + dy" :x2="w.x2 + dx" :y2="w.y2 + dy"
          class="wire"
        />

        <!-- 组边框（展开） -->
        <rect
          v-for="e in visElems.filter((x) => x.type === 'group' && !x.folded)"
          :key="'gb' + e.id"
          :x="e.x + dx - 8" :y="e.y + dy - 8" :width="e.w + 16" :height="e.h + 16"
          class="group-box" rx="8"
          @pointerdown.stop
          @click.stop="ops.select(e.id)"
        />

        <!-- 折叠组 -->
        <g v-for="e in visElems.filter((x) => x.type === 'group' && x.folded)" :key="'gf' + e.id" @pointerdown.stop @click.stop="onGroupFold($event, e.id)">
          <rect :x="e.x + dx - 6" :y="e.y + dy - 6" :width="e.w + 12" :height="e.h + 12" class="group-box folded" rx="8" />
          <rect :x="e.x + dx + e.w / 2 - 30" :y="e.y + dy + e.h / 2 - 10" width="60" height="20" class="folded-body" rx="3" />
          <text :x="e.x + dx + e.w / 2" :y="e.y + dy + e.h / 2 + 4" class="folded-val" text-anchor="middle">{{ groupEquiv(e.id) }}</text>
        </g>

        <!-- 电阻 -->
        <g
          v-for="e in visElems.filter((x) => x.type === 'res')" :key="e.id"
          class="res-g" :class="{ sel: ops.selectedId === e.id, dragging: dragSrc === e.id }"
          @pointerdown="onResDown($event, e.id)"
          @pointermove="onResMove"
          @pointerup="onResUp"
          @pointercancel="onResCancel"
          @click.stop="ops.select(e.id)"
        >
          <line :x1="e.x + e.w / 2 + dx" :y1="e.y + dy" :x2="e.x + e.w / 2 + dx" :y2="e.y + 10 + dy" class="wire" />
          <line :x1="e.x + e.w / 2 + dx" :y1="e.y + e.h - 10 + dy" :x2="e.x + e.w / 2 + dx" :y2="e.y + e.h + dy" class="wire" />
          <rect
            :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 10 + dy" width="18" height="34" rx="2"
            :class="['res-body', { unknown: e.unknown, invalid: e.invalid }]"
          />
          <rect :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 10 + dy" width="18" height="5" class="cap" />
          <rect :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 39 + dy" width="18" height="5" class="cap" />
          <rect v-for="(b, bi) in bands(e.label)" :key="bi" :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 17 + bi * 7 + dy" width="18" height="4" :fill="b" opacity="0.9" />
          <text :x="e.x + e.w + dx - 2" :y="e.y + 20 + dy" class="res-label-t">{{ e.label }}</text>
          <text :x="e.x + e.w + dx - 2" :y="e.y + 34 + dy" class="res-val-t" :class="{ 'unk-t': e.unknown }">{{ e.unknown ? '?' : formatOhms(e.ohms) }}</text>
        </g>

        <!-- 缝点 -->
        <g v-for="s in L.seams" :key="s.id">
          <circle
            :cx="s.x + dx" :cy="s.y + dy" r="5"
            :class="['seam-dot', { clickable: seamMode && s.id !== 'IN' && s.id !== 'GND' }]"
            @pointerdown.stop
            @click.stop="onSeamClick($event, s.id)"
          />
          <text v-if="s.id === 'IN'" :x="s.x + dx + 10" :y="s.y + dy - 6" class="port-label">Vin ↑</text>
          <text v-else-if="s.id === 'GND'" :x="s.x + dx + 10" :y="s.y + dy + 14" class="port-label">GND</text>
        </g>

        <!-- 吸附高亮 -->
        <g v-if="hoverSnap" :transform="`translate(${hoverSnap.x}, ${hoverSnap.y})`">
          <circle r="14" class="snap-ring" />
          <circle r="5" class="snap-dot" />
        </g>
      </svg>
    </div>

    <div class="zoom-hud" v-if="zoom !== 1">
      <button class="btn sm" @click="zoom = Math.min(3, zoom * 1.25)">＋</button>
      <span class="zoom-val">{{ Math.round(zoom * 100) }}%</span>
      <button class="btn sm" @click="zoom = Math.max(0.3, zoom / 1.25)">－</button>
      <button class="btn sm cyan" @click="zoom = 1; pan = { x: 0, y: 0 }">复位</button>
    </div>
  </div>
</template>

<style scoped>
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(0, 255, 159, 0.04), transparent 60%),
    var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.canvas.panning { cursor: grabbing; }
.canvas-inner { position: absolute; top: 0; left: 0; will-change: transform; }
.circuit {
  display: block;
  /* 尺寸 = viewBox 1:1，由 canvas-inner 的 transform 统一缩放 */
}
.wire { stroke: var(--neon-dim); stroke-width: 2; }
.group-box {
  fill: rgba(0, 229, 255, 0.03);
  stroke: var(--cyan-dim);
  stroke-width: 1;
  stroke-dasharray: 5 4;
  cursor: pointer;
}
.group-box.folded { stroke: var(--amber-dim); }
.group-label { fill: var(--dim); font-size: 10px; font-family: var(--mono); }
.folded-body { fill: var(--panel-2); stroke: var(--amber); stroke-width: 1; }
.folded-val { fill: var(--amber); font-size: 11px; font-family: var(--mono); }
.res-body {
  fill: #1a2434;
  stroke: var(--neon);
  stroke-width: 1.5;
  cursor: pointer;
  transition: filter 0.15s;
}
.res-body.unknown { stroke: var(--amber); }
.res-body.invalid { stroke: var(--red); }
.res-g.dragging { opacity: 0.4; }
.res-g.sel .res-body { filter: drop-shadow(0 0 5px var(--neon-dim)); stroke-width: 2.2; }
.cap { fill: var(--dim); }
.res-label-t { fill: var(--cyan); font-size: 11px; font-family: var(--mono); }
.res-val-t { fill: var(--neon); font-size: 10px; font-family: var(--mono); }
.res-val-t.unk-t { fill: var(--amber); }
.seam-dot {
  fill: var(--bg-deep);
  stroke: var(--neon);
  stroke-width: 1.5;
}
.seam-dot.clickable {
  cursor: pointer;
  fill: var(--neon-dim);
  stroke-width: 2;
}
.seam-dot.clickable:hover { fill: var(--neon); }
.port-label { fill: var(--dim); font-size: 10px; font-family: var(--mono); }
.snap-ring {
  fill: none;
  stroke: var(--amber);
  stroke-width: 2;
  stroke-dasharray: 4 3;
  animation: pulse-glow 1s infinite;
}
.snap-dot { fill: var(--amber); }
.zoom-hud {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: rgba(10, 14, 20, 0.85);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.zoom-val {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--cyan);
  min-width: 40px;
  text-align: center;
}
</style>
