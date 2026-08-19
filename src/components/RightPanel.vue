<script setup>
// 右侧属性面板：多选组合（并联/串联）+ 单选属性编辑 + 组操作
import { ref, watch } from 'vue'

const props = defineProps({
  ops: { type: Object, required: true },
  seamMode: { type: Boolean, default: false },
})

const valDraft = ref('')
watch(
  () => props.ops.selectedIds.join(','),
  () => {
    const n = props.ops.selected[0]
    valDraft.value = n && n.type === 'res' ? n.raw || '' : ''
  }
)
function commit() {
  props.ops.selValue = valDraft.value
  props.ops.onValueCommit()
}
function selNames() {
  return props.ops.selected.map((n) => (n.type === 'res' ? n.label : n.mode === 'series' ? '串组' : '并组')).join('、')
}
</script>

<template>
  <div class="right-panel">
    <slot></slot>

    <!-- 多选：组合按钮 -->
    <div v-if="ops.selCount >= 2" class="sel-box multi">
      <div class="section-title">已选 {{ ops.selCount }} 个元件</div>
      <div class="sel-names">{{ selNames() }}</div>
      <div class="btn-row">
        <button class="btn cyan big" @click="ops.combine('parallel')">∥ 并联组合</button>
        <button class="btn cyan big" @click="ops.combine('series')">⊕ 串联组合</button>
      </div>
      <button class="btn sm" @click="ops.clearSelect()">取消选择</button>
    </div>

    <!-- 单选：电阻属性 -->
    <div v-else-if="ops.selIsRes" class="sel-box">
      <div class="section-title">电阻 · {{ ops.selected[0].label }}</div>
      <input
        v-model="valDraft" type="text" class="prop-input"
        :class="{ invalid: ops.selected[0].invalid }"
        :placeholder="ops.selected[0].unknown ? '取消未知后输入阻值' : '阻值，如 1k / 2.2k / 4.7M'"
        :disabled="ops.selected[0].unknown"
        @change="commit"
      />
      <div class="btn-row">
        <button v-if="seamMode" class="btn sm" :class="{ 'amber active': ops.selected[0].unknown }" @click="ops.toggleUnknown">
          {{ ops.selected[0].unknown ? '未知 ✓' : '标未知' }}
        </button>
        <button class="btn sm cyan" @click="ops.addSeries()">+串联</button>
        <button class="btn sm cyan" @click="ops.addParallel()">+并联</button>
        <button class="btn sm danger" @click="ops.removeSelected()">删除</button>
      </div>
    </div>

    <!-- 单选：组操作 -->
    <div v-else-if="ops.selIsGroup" class="sel-box">
      <div class="section-title">{{ ops.selected[0].mode === 'series' ? '串联组' : '并联组' }}</div>
      <div class="btn-row">
        <button class="btn sm" @click="ops.toggleGroupMode()">⇄ {{ ops.selected[0].mode === 'series' ? '串联' : '并联' }}</button>
        <button class="btn sm cyan" @click="ops.groupAddRes()">+电阻</button>
        <button class="btn sm" @click="ops.groupAddGroup()">+组</button>
        <button class="btn sm" @click="ops.toggleFold()">{{ ops.selected[0].folded ? '展开' : '折叠' }}</button>
      </div>
      <div class="btn-row">
        <button class="btn sm danger" @click="ops.dissolveGroup()">解散组</button>
        <button class="btn sm danger" @click="ops.removeSelected()">删除组</button>
      </div>
    </div>

    <!-- 未选中 -->
    <div v-else class="sel-empty">
      <div>点选元件可多选</div>
      <div>选中多个后点「并联/串联组合」</div>
      <div class="tip">点空白处取消选择</div>
    </div>
  </div>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sel-box {
  background: var(--panel);
  border: 1px solid var(--cyan-dim);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sel-box.multi { border-color: var(--amber-dim); }
.sel-names {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--amber);
}
.prop-input {
  font-size: 14px !important;
  padding: 7px 10px !important;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.btn.big { flex: 1; padding: 9px; font-size: 13px; letter-spacing: 1px; }
.sel-empty {
  font-size: 11px;
  color: var(--dim);
  text-align: center;
  padding: 16px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  line-height: 2;
}
.sel-empty .tip { color: var(--neon-dim); font-size: 10px; }
</style>
