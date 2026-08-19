<script setup>
// 右侧属性面板：选中元件操作（电阻/组），场景内容通过插槽注入
import { ref } from 'vue'

const props = defineProps({
  ops: { type: Object, required: true },
  seamMode: { type: Boolean, default: false },
})

const valDraft = ref('')
// 选中变化时同步草稿
import { watch } from 'vue'
watch(
  () => props.ops.selectedId.value,
  () => {
    const n = props.ops.selected.value
    valDraft.value = n && n.type === 'res' ? n.raw || '' : ''
  }
)
function commit() {
  props.ops.selValue.value = valDraft.value
  props.ops.onValueCommit()
}
</script>

<template>
  <div class="right-panel">
    <slot></slot>

    <!-- 选中元件操作 -->
    <div v-if="ops.selected" class="sel-box">
      <div class="section-title">
        选中 · {{ ops.selected.type === 'res' ? ops.selected.label : (ops.selected.mode === 'series' ? '串联组' : '并联组') }}
      </div>

      <!-- 电阻 -->
      <template v-if="ops.selIsRes">
        <input
          v-model="valDraft" type="text" class="prop-input"
          :class="{ invalid: ops.selected.invalid }"
          :placeholder="ops.selected.unknown ? '取消未知后输入阻值' : '阻值，如 1k / 2.2k / 4.7M'"
          :disabled="ops.selected.unknown"
          @change="commit"
        />
        <div class="btn-row">
          <button v-if="seamMode" class="btn sm" :class="{ 'amber active': ops.selected.unknown }" @click="ops.toggleUnknown">
            {{ ops.selected.unknown ? '未知 ✓' : '标未知' }}
          </button>
          <button class="btn sm cyan" @click="ops.addSeries()">+串联</button>
          <button class="btn sm cyan" @click="ops.addParallel()">+并联</button>
          <button class="btn sm danger" @click="ops.removeSelected()">删除</button>
        </div>
      </template>

      <!-- 组 -->
      <template v-else-if="ops.selIsGroup">
        <div class="btn-row">
          <button class="btn sm" @click="ops.toggleGroupMode()">⇄ {{ ops.selected.mode === 'series' ? '串联' : '并联' }}</button>
          <button class="btn sm cyan" @click="ops.groupAddRes()">+电阻</button>
          <button class="btn sm" @click="ops.groupAddGroup()">+组</button>
          <button class="btn sm" @click="ops.toggleFold()">{{ ops.selected.folded ? '展开' : '折叠' }}</button>
        </div>
        <button class="btn sm danger full" @click="ops.removeSelected()">删除该组</button>
      </template>
    </div>

    <!-- 未选中提示 -->
    <div v-else class="sel-empty">
      点选电路中的元件查看/修改属性
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
.prop-input {
  font-size: 14px !important;
  padding: 7px 10px !important;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.btn.full { width: 100%; padding: 7px; }
.sel-empty {
  font-size: 11px;
  color: var(--dim);
  text-align: center;
  padding: 20px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}
</style>
