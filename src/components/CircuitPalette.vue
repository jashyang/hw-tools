<script setup>
// 元件库：电阻 / 串联组 / 并联组 —— 点击添加到根组，长按拖出到画布吸附
const props = defineProps({
  node: { type: Object, required: true },
  ops: { type: Object, required: true },
})

const DRAG_TYPE = 'application/x-hwtype'
const items = [
  { type: 'res', name: '电阻', icon: '▯' },
  { type: 'series', name: '串联组', icon: '⊕' },
  { type: 'parallel', name: '并联组', icon: '∥' },
]

function onDragStart(e, type) {
  e.dataTransfer.setData(DRAG_TYPE, type)
  e.dataTransfer.effectAllowed = 'copy'
}
// 点击 = 直接加入根组（作为新元素/新支路）
function onClick(type) {
  const node = type === 'res' ? props.ops.mkRes() : props.ops.mkGroup(type)
  props.node.children.push(node)
  props.ops.select(node.id)
}
</script>

<template>
  <div class="palette">
    <div class="palette-title">元件库</div>
    <div
      v-for="it in items" :key="it.type"
      class="pal-item" draggable="true"
      @dragstart="onDragStart($event, it.type)"
      @click="onClick(it.type)"
      :title="`点击加入电路 / 拖到画布导线或母线上连接`"
    >
      <span class="pal-icon">{{ it.icon }}</span>
      <span class="pal-name">{{ it.name }}</span>
    </div>
    <div class="palette-hint">拖到画布：导线中间=串联插入，母线=并联新支路</div>
  </div>
</template>

<style scoped>
.palette {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.palette-title {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--dim);
  text-transform: uppercase;
  margin-bottom: 2px;
}
.pal-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s;
  user-select: none;
}
.pal-item:hover {
  border-color: var(--neon-dim);
  box-shadow: var(--glow-green);
}
.pal-item:active { cursor: grabbing; }
.pal-icon {
  font-family: var(--mono);
  font-size: 16px;
  color: var(--neon);
  width: 22px;
  text-align: center;
}
.pal-name { font-size: 13px; color: var(--text); }
.palette-hint {
  font-size: 10px;
  color: var(--dim);
  line-height: 1.7;
  border-top: 1px dashed var(--border);
  padding-top: 8px;
}
</style>
