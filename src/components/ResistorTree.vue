<script setup>
import { computed } from 'vue'
import { parseResistor } from '../core/parse.js'
import { equivR } from '../core/simplify.js'

// 递归树组件：node = { type:'res'|'group', id, label?, mode?, children?, ohms?, raw?, unknown?, folded? }
// seamMode=true 时串联链元素间显示焊盘缝点（场景 2 标记电压）
const props = defineProps({
  node: { type: Object, required: true },
  seamMode: { type: Boolean, default: false },
})
const emit = defineEmits(['mark-seam'])

const isGroup = computed(() => props.node.type === 'group')
const isRes = computed(() => props.node.type === 'res')

const equiv = computed(() => {
  if (isRes.value) return props.node.ohms
  return equivR(props.node)
})

function onValueChange() {
  const v = parseResistor(props.node.raw)
  if (v != null) {
    props.node.ohms = v
    props.node.invalid = false
  } else {
    props.node.invalid = true
  }
}

function addRes() {
  props.node.children.push({
    type: 'res',
    id: `r${Math.random().toString(36).slice(2, 8)}`,
    label: `R${props.node.children.length + 1}`,
    raw: '',
    ohms: null,
    unknown: false,
  })
}
function addGroup() {
  props.node.children.push({
    type: 'group',
    id: `g${Math.random().toString(36).slice(2, 8)}`,
    mode: 'parallel',
    folded: false,
    children: [],
  })
}
function remove() {
  emit('remove', props.node.id)
}
function toggleUnknown() {
  props.node.unknown = !props.node.unknown
}
function seamId(k) {
  return `${props.node.id}:s${k}`
}
</script>

<template>
  <div class="tree-node" :class="[node.type, { folded: node.folded }]">
    <!-- ── 组节点 ── -->
    <template v-if="isGroup">
      <div class="group-head">
        <button class="fold-btn" @click="node.folded = !node.folded">{{ node.folded ? '▶' : '▼' }}</button>
        <button class="mode-btn" :class="node.mode" @click="node.mode = node.mode === 'series' ? 'parallel' : 'series'">
          {{ node.mode === 'series' ? '串' : '并' }}
        </button>
        <span class="group-equiv led" :class="{ 'led-dim': node.children.length === 0 }">
          {{ node.children.length === 0 ? '—' : equiv }}
        </span>
        <span class="group-hint" v-if="node.children.length === 0">空组</span>
        <span class="spacer"></span>
        <button class="btn sm cyan" @click="addRes">+R</button>
        <button class="btn sm" @click="addGroup">+组</button>
        <button class="btn sm danger" @click="remove">×</button>
      </div>

      <div class="children" v-if="!node.folded">
        <div v-for="(child, i) in node.children" :key="child.id" class="child-row">
          <!-- 串联链元素间：焊盘缝点 -->
          <button
            v-if="seamMode && node.mode === 'series' && i > 0"
            class="seam" :title="`缝 ${seamId(i - 1)}`"
            @click="emit('mark-seam', seamId(i - 1))"
          >●</button>
          <span v-else-if="node.mode === 'series' && i > 0" class="wire"></span>

          <ResistorTree :node="child" :seam-mode="seamMode" @mark-seam="(id) => emit('mark-seam', id)" @remove="(id) => (node.children = node.children.filter((c) => c.id !== id))" />

          <!-- 末尾缝点（串联链最后一个元素之后） -->
          <button
            v-if="seamMode && node.mode === 'series' && i === node.children.length - 1"
            class="seam" :title="`缝 ${seamId(i)}`"
            @click="emit('mark-seam', seamId(i))"
          >●</button>
        </div>
        <button v-if="node.children.length === 0" class="empty-hint" @click="addRes">+ 添加电阻</button>
      </div>
    </template>

    <!-- ── 电阻叶子 ── -->
    <template v-else>
      <div class="res-row" :class="{ unknown: node.unknown }">
        <span class="res-label">{{ node.label }}</span>
        <input
          v-if="!node.unknown"
          v-model="node.raw"
          type="text"
          class="res-input"
          :class="{ invalid: node.invalid }"
          placeholder="阻值，如 1k / 2.2k / 4.7M"
          @change="onValueChange"
        />
        <span v-else class="unknown-badge led amber">UNKNOWN</span>
        <button v-if="seamMode" class="btn sm" :class="{ 'amber active': node.unknown }" @click="toggleUnknown">未知</button>
        <button class="btn sm danger" @click="remove">×</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tree-node { width: 100%; }
/* ── 组 ── */
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(0, 229, 255, 0.04);
  border: 1px solid var(--border);
  border-left: 2px solid var(--cyan);
  border-radius: 6px;
  margin: 2px 0;
}
.fold-btn, .mode-btn {
  font-family: var(--mono);
  font-size: 11px;
  width: 26px; height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-deep);
  color: var(--dim);
  cursor: pointer;
}
.mode-btn.series { color: var(--cyan); border-color: var(--cyan-dim); }
.mode-btn.parallel { color: var(--neon); border-color: var(--neon-dim); }
.group-equiv { font-size: 13px; white-space: nowrap; }
.group-hint { font-size: 10px; color: var(--dim); }
.spacer { flex: 1; }
.children { padding-left: 16px; border-left: 1px dashed var(--border); margin-left: 12px; }
.child-row { display: flex; align-items: center; gap: 6px; position: relative; }
.wire { width: 10px; height: 2px; background: var(--border); flex-shrink: 0; }
.seam {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 1px solid var(--neon);
  background: var(--bg-deep);
  color: var(--neon);
  font-size: 9px;
  line-height: 1;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
}
.seam:hover { background: var(--neon); color: var(--bg); box-shadow: var(--glow-green); }
.empty-hint {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--dim);
  background: none;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 8px;
  width: 100%;
  cursor: pointer;
  margin: 4px 0;
}
.empty-hint:hover { color: var(--neon); border-color: var(--neon-dim); }

/* ── 电阻 ── */
.res-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-left: 2px solid var(--neon);
  border-radius: 6px;
  margin: 2px 0;
  background: var(--bg-deep);
}
.res-row.unknown { border-left-color: var(--amber); border-color: var(--amber-dim); }
.res-label {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--cyan);
  min-width: 34px;
}
.res-input {
  font-size: 13px !important;
  padding: 4px 8px !important;
  min-width: 0;
  flex: 1;
}
.unknown-badge {
  font-size: 12px;
  flex: 1;
  letter-spacing: 2px;
}
.btn.active { background: rgba(255, 176, 32, 0.15); }
</style>
