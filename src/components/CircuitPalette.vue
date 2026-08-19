<script setup>
// 元件库：只保留电阻 —— 点击加入根组；拖出到画布导线/母线吸附连接
const props = defineProps({
  node: { type: Object, required: true },
  ops: { type: Object, required: true },
})

const DRAG_TYPE = 'application/x-hwtype'

function onDragStart(e) {
  e.dataTransfer.setData(DRAG_TYPE, 'res')
  e.dataTransfer.effectAllowed = 'copy'
}
function onClick() {
  const node = props.ops.mkRes()
  props.node.children.push(node)
  props.ops.selectOnly(node.id)
}
</script>

<template>
  <div class="palette">
    <div class="palette-title">元件库</div>
    <div
      class="pal-item" draggable="true"
      @dragstart="onDragStart"
      @click="onClick"
      title="点击加入电路 / 拖到画布导线或母线上连接"
    >
      <span class="pal-icon">▯</span>
      <span class="pal-name">电阻</span>
    </div>
    <div class="palette-hint">
      点击：加入电路<br />
      拖到画布：导线中间=串联插入，母线=并联新支路<br />
      电路里的电阻也可直接拖动重组
    </div>
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
