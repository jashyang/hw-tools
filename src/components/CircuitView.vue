<script setup>
import { ref, computed } from 'vue'
import { layout, resBodyRect } from '../core/layout.js'
import { equivR } from '../core/simplify.js'
import { parseResistor, formatOhms } from '../core/parse.js'

// 电路图组件：SVG 渲染树形网络（垂直走向，Vin 上 → GND 下）
// 交互：点选元件 → 底部操作面板；点缝点（seamMode）→ emit mark-seam
const props = defineProps({
  node: { type: Object, required: true },
  seamMode: { type: Boolean, default: false },
})
const emit = defineEmits(['mark-seam'])

const PAD = 40 // SVG 四周留白

const L = computed(() => layout(props.node))
const viewW = computed(() => L.value.elems.find((e) => e.id === props.node.id).w + PAD * 2)
const viewH = computed(() => L.value.elems.find((e) => e.id === props.node.id).h + PAD * 2)
const dx = computed(() => PAD)
const dy = computed(() => PAD)

const selectedId = ref(null)
const selValue = ref('')

const selected = computed(() => {
  if (!selectedId.value) return null
  return findNode(props.node, selectedId.value)
})

function findNode(n, id) {
  if (n.id === id) return n
  if (n.type === 'group') {
    for (const c of n.children) {
      const r = findNode(c, id)
      if (r) return r
    }
  }
  return null
}
function findParent(n, id, parent = null) {
  if (n.id === id) return parent
  if (n.type === 'group') {
    for (const c of n.children) {
      const r = findParent(c, id, n)
      if (r) return r
    }
  }
  return null
}
function removeById(n, id) {
  if (n.type === 'group') {
    const idx = n.children.findIndex((c) => c.id === id)
    if (idx >= 0) {
      n.children.splice(idx, 1)
      return true
    }
    for (const c of n.children) if (removeById(c, id)) return true
  }
  return false
}

function select(id) {
  selectedId.value = id
  const n = findNode(props.node, id)
  selValue.value = n && n.type === 'res' ? (n.raw || '') : ''
}

function onResClick(e, id) {
  e.stopPropagation()
  select(id)
}

function onSeamClick(e, id) {
  e.stopPropagation()
  if (!props.seamMode) return
  emit('mark-seam', id)
}

function onGroupFold(e, id) {
  e.stopPropagation()
  const n = findNode(props.node, id)
  if (n) n.folded = !n.folded
}

function onValueCommit() {
  const n = selected.value
  if (!n || n.type !== 'res') return
  const v = parseResistor(selValue.value)
  if (v != null) {
    n.ohms = v
    n.raw = selValue.value
    n.invalid = false
  } else {
    n.invalid = true
  }
}

function toggleUnknown() {
  const n = selected.value
  if (n && n.type === 'res') n.unknown = !n.unknown
}

function removeSelected() {
  if (!selectedId.value) return
  removeById(props.node, selectedId.value)
  selectedId.value = null
}

// 在选中元素之后加一个串联电阻（父组须为串联）
function addSeriesAfter() {
  const n = selected.value
  const p = findParent(props.node, selectedId.value)
  if (!n || !p || p.type !== 'group' || p.mode !== 'series') return
  const idx = p.children.findIndex((c) => c.id === n.id)
  const nn = mkRes()
  p.children.splice(idx + 1, 0, nn)
  selectedId.value = nn.id
  selValue.value = ''
}
// 选中元素所在并联组追加一条支路
function addParallelBranch() {
  const p = findParent(props.node, selectedId.value)
  if (!p || p.type !== 'group' || p.mode !== 'parallel') return
  const nn = mkRes()
  p.children.push(nn)
  selectedId.value = nn.id
  selValue.value = ''
}
function mkRes() {
  return { type: 'res', id: `r${Math.random().toString(36).slice(2, 8)}`, label: 'R?', raw: '', ohms: null, unknown: false }
}

// 组操作
function toggleGroupMode() {
  const n = selected.value
  if (n && n.type === 'group') n.mode = n.mode === 'series' ? 'parallel' : 'series'
}
function groupAddRes() {
  const n = selected.value
  if (n && n.type === 'group') n.children.push(mkRes())
}
function groupAddGroup() {
  const n = selected.value
  if (n && n.type === 'group') {
    n.children.push({ type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`, mode: 'parallel', folded: false, children: [] })
  }
}

const selIsRes = computed(() => selected.value && selected.value.type === 'res')
const selIsGroup = computed(() => selected.value && selected.value.type === 'group')
const selParentMode = computed(() => {
  const p = findParent(props.node, selectedId.value)
  return p && p.type === 'group' ? p.mode : null
})

// 折叠组隐藏的后代 id 集合（折叠时组内元素不渲染）
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
  return formatOhms(equivR(findNode(props.node, id)))
}

// 电阻端帽配色（按 label 哈希取 3 色）
const BANDS = ['#b3402a', '#e8a33d', '#3d7ea6', '#6a4d9e', '#4a9e5a', '#c94f6d', '#8c8c8c']
function bands(label) {
  let h = 0
  for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) % 997
  return [BANDS[h % 7], BANDS[(h * 3 + 2) % 7], BANDS[(h * 5 + 4) % 7]]
}
</script>

<template>
  <div class="circuit-wrap">
    <svg
      class="circuit" :viewBox="`0 0 ${viewW} ${viewH}`"
      @click="selectedId = null"
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
        @click.stop="select(e.id)"
      />
      <text
        v-for="e in visElems.filter((x) => x.type === 'group' && !x.folded)"
        :key="'gl' + e.id"
        :x="e.x + dx - 2" :y="e.y + dy - 14"
        class="group-label"
      >{{ e.mode === 'series' ? '串联组' : '并联组' }} · 点击折叠</text>

      <!-- 折叠组：等效电阻框 -->
      <g v-for="e in visElems.filter((x) => x.type === 'group' && x.folded)" :key="'gf' + e.id" @click.stop="onGroupFold(e.id)">
        <rect :x="e.x + dx - 6" :y="e.y + dy - 6" :width="e.w + 12" :height="e.h + 12" class="group-box folded" rx="8" />
        <rect :x="e.x + dx + e.w / 2 - 30" :y="e.y + dy + e.h / 2 - 10" width="60" height="20" class="folded-body" rx="3" />
        <text :x="e.x + dx + e.w / 2" :y="e.y + dy + e.h / 2 + 4" class="folded-val" text-anchor="middle">{{ groupEquiv(e.id) }}</text>
      </g>

      <!-- 电阻 -->
      <g v-for="e in visElems.filter((x) => x.type === 'res')" :key="e.id" class="res-g" :class="{ sel: selectedId === e.id }" @click.stop="onResClick($event, e.id)">
        <!-- 端口短线 -->
        <line :x1="e.x + e.w / 2 + dx" :y1="e.y + dy" :x2="e.x + e.w / 2 + dx" :y2="e.y + 10 + dy" class="wire" />
        <line :x1="e.x + e.w / 2 + dx" :y1="e.y + e.h - 10 + dy" :x2="e.x + e.w / 2 + dx" :y2="e.y + e.h + dy" class="wire" />
        <!-- 电阻体：竖直长方形 -->
        <rect
          :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 10 + dy" width="18" height="34" rx="2"
          :class="['res-body', { unknown: e.unknown, invalid: e.invalid }]"
        />
        <!-- 端帽 -->
        <rect :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 10 + dy" width="18" height="5" class="cap" />
        <rect :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 39 + dy" width="18" height="5" class="cap" />
        <!-- 色环 -->
        <rect v-for="(b, bi) in bands(e.label)" :key="bi" :x="e.x + (e.w - 18) / 2 + dx" :y="e.y + 17 + bi * 7 + dy" width="18" height="4" :fill="b" opacity="0.9" />
        <!-- 标注 -->
        <text :x="e.x + e.w + dx - 2" :y="e.y + 20 + dy" class="res-label-t">{{ e.label }}</text>
        <text :x="e.x + e.w + dx - 2" :y="e.y + 34 + dy" class="res-val-t" :class="{ 'unk-t': e.unknown }">{{ e.unknown ? '?' : formatOhms(e.ohms) }}</text>
      </g>

      <!-- 缝点 -->
      <g v-for="s in L.seams" :key="s.id">
        <circle
          :cx="s.x + dx" :cy="s.y + dy" r="5"
          :class="['seam-dot', { clickable: seamMode && s.id !== 'IN' && s.id !== 'GND' }]"
          @click.stop="onSeamClick($event, s.id)"
        />
        <text
          v-if="s.id === 'IN'" :x="s.x + dx + 10" :y="s.y + dy - 6" class="port-label"
        >Vin ↑</text>
        <text
          v-else-if="s.id === 'GND'" :x="s.x + dx + 10" :y="s.y + dy + 14" class="port-label"
        >GND</text>
      </g>
    </svg>

    <!-- 操作面板 -->
    <transition name="fade">
      <div v-if="selected" class="op-panel">
        <!-- 电阻操作 -->
        <template v-if="selIsRes">
          <input
            v-model="selValue" type="text" class="op-input"
            :class="{ invalid: selected.invalid }"
            :placeholder="selected.unknown ? '取消未知后输入阻值' : '阻值，如 1k / 2.2k'"
            :disabled="selected.unknown"
            @change="onValueCommit"
          />
          <button v-if="seamMode" class="btn sm" :class="{ 'amber active': selected.unknown }" @click="toggleUnknown">未知</button>
          <button v-if="selParentMode === 'series'" class="btn sm cyan" @click="addSeriesAfter">+串联</button>
          <button v-if="selParentMode === 'parallel'" class="btn sm cyan" @click="addParallelBranch">+并支</button>
          <button class="btn sm danger" @click="removeSelected">删</button>
        </template>
        <!-- 组操作 -->
        <template v-else-if="selIsGroup">
          <span class="op-mode" @click="toggleGroupMode">
            {{ selected.mode === 'series' ? '串联' : '并联' }} ⇄
          </span>
          <button class="btn sm cyan" @click="groupAddRes">+电阻</button>
          <button class="btn sm" @click="groupAddGroup">+组</button>
          <button class="btn sm" @click="onGroupFold(selected.id)">{{ selected.folded ? '展开' : '折叠' }}</button>
          <button class="btn sm danger" @click="removeSelected">删</button>
        </template>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.circuit-wrap { position: relative; }
.circuit {
  width: 100%;
  height: auto;
  background: var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: block;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
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

.op-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 8px;
  background: linear-gradient(180deg, var(--panel-2), var(--panel));
  border: 1px solid var(--cyan-dim);
  border-radius: 8px;
  flex-wrap: wrap;
}
.op-input { flex: 1; min-width: 120px; font-size: 13px !important; padding: 5px 8px !important; }
.op-mode {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--cyan);
  border: 1px dashed var(--cyan-dim);
  border-radius: 5px;
  padding: 4px 8px;
  cursor: pointer;
}
</style>
