<script setup>
// 通用下拉选择组件 —— 贴字段展开的自定义浮层面板（替代原生 <select>）
// props: modelValue, options=[{value,label}], placeholder, size('sm'|默认)
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: '请选择' },
  size: { type: String, default: '' }, // 'sm' 对应表单小号输入框
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const rootEl = ref(null)

const current = computed(() =>
  props.options.find((o) => String(o.value) === String(props.modelValue))
)

function select(opt) {
  emit('update:modelValue', opt.value)
  close()
}
function toggle() {
  open.value = !open.value
}
function close() {
  open.value = false
}
function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) close()
}
function onKey(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="rootEl" class="hw-select" :class="{ sm: size === 'sm' }">
    <button class="hw-trigger" type="button" @click="toggle">
      <span class="hw-value" :class="{ placeholder: !current }">{{ current ? current.label : placeholder }}</span>
      <span class="hw-arrow" :class="{ open }">▾</span>
    </button>

    <Transition name="hw-pop">
      <div v-if="open" class="hw-pop">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="hw-opt"
          :class="{ selected: String(opt.value) === String(modelValue) }"
          @click.stop="select(opt)"
        >
          <span class="hw-opt-dot">{{ String(opt.value) === String(modelValue) ? '●' : '' }}</span>
          <span class="hw-opt-label">{{ opt.label }}</span>
        </button>
        <div v-if="!options.length" class="hw-empty">无可用选项</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hw-select {
  position: relative;
  width: 100%;
}
.hw-trigger {
  width: 100%;
  box-sizing: border-box;
  font-family: var(--mono);
  font-size: 14px;
  color: var(--text);
  background: rgba(6, 9, 15, 0.4);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.hw-select.sm .hw-trigger {
  font-size: 16px;
  padding: 8px 10px;
}
.hw-trigger:hover { border-color: var(--neon-dim); }
.hw-trigger:focus-visible { border-color: var(--neon); box-shadow: var(--glow-green); }
.hw-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hw-value.placeholder { color: var(--dim); }
.hw-arrow {
  color: var(--dim);
  font-size: 12px;
  transition: transform 0.18s ease;
  flex-shrink: 0;
}
.hw-arrow.open { transform: rotate(180deg); }

.hw-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 240px;
  overflow-y: auto;
  background: rgba(16, 20, 27, 0.92);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  padding: 4px;
  display: flex;
  flex-direction: column;
}
.hw-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 5px;
  padding: 7px 9px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.hw-opt:hover { background: rgba(88, 166, 143, 0.12); color: var(--neon); }
.hw-opt.selected { background: rgba(88, 166, 143, 0.16); color: var(--neon); }
.hw-opt-dot {
  width: 14px;
  flex-shrink: 0;
  color: var(--neon);
  font-size: 10px;
  text-align: center;
}
.hw-opt-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hw-empty {
  padding: 10px;
  text-align: center;
  color: var(--dim);
  font-size: 12px;
  font-family: var(--mono);
}

/* 滑入动画 */
.hw-pop-enter-active, .hw-pop-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.hw-pop-enter-from, .hw-pop-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
