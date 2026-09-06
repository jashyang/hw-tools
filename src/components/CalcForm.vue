<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { useCopy } from '../composables/useCopy.js'

const props = defineProps({
  scene: { type: Object, required: true },
})

// ── 输入状态 ──
const inputs = reactive({})
for (const f of props.scene.fields || []) inputs[f.key] = ''

// list 模式（串并联等效）：电阻行
const listRows = reactive(['', ''])

const isList = computed(() => props.scene.mode === 'list')
const isPair = computed(() => props.scene.mode === 'pair')

// ── 解析与校验 ──
const parsed = computed(() => {
  const out = {}
  for (const f of props.scene.fields || []) {
    const raw = (inputs[f.key] || '').trim()
    out[f.key] = raw === '' ? null : f.parse(raw)
  }
  return out
})

const invalid = computed(() => {
  const out = {}
  for (const f of props.scene.fields || []) {
    const raw = (inputs[f.key] || '').trim()
    out[f.key] = raw !== '' && parsed.value[f.key] === null
  }
  return out
})

// list 模式：行解析（非法行返回 null）
const listParsed = computed(() => {
  return listRows.map((r) => {
    const raw = r.trim()
    return raw === '' ? null : props.scene.listField.parse(raw)
  })
})
const listInvalid = computed(() => listParsed.value.map((v, i) => listRows[i].trim() !== '' && v === null))
const listValidRows = computed(() => listParsed.value.filter((v) => v !== null))

// ── 求解（手动触发，避免每敲一个字符就重算） ──
const result = ref(null)
function compute() {
  result.value = buildResult()
}
function buildResult() {
  const scene = props.scene
  if (isList.value) {
    if (listValidRows.value.length === 0) return null
    if (listInvalid.value.some(Boolean)) return { error: '有电阻值格式不对，示例：1k / 2.2k / 470' }
    return scene.solve({ values: { resistors: listValidRows.value } })
  }
  const values = {}
  for (const f of scene.fields) values[f.key] = parsed.value[f.key]

  if (isPair.value) {
    const knownCount = scene.fields.filter((f) => values[f.key] != null).length
    if (knownCount < 2) return { error: `已填 ${knownCount} 个，请填写任意两个已知量` }
    if (Object.values(invalid.value).some(Boolean)) return { error: '有输入格式不对，检查单位写法' }
    return scene.solve({ values })
  }

  // unknown 模式：留空即所求
  if (Object.values(invalid.value).some(Boolean)) return { error: '有输入格式不对，检查单位写法' }
  const empties = scene.fields.filter((f) => values[f.key] == null).map((f) => f.key)
  if (empties.length === 0) return { error: '留空一个待求量' }
  if (empties.length > 1) return { error: `留空了 ${empties.length} 个，只留一个待求量即可` }
  return scene.solve({ values, emptyKeys: empties })
}

// 输入变化 → 结果失效
watch([inputs, listRows], () => { result.value = null }, { deep: true })

// ── 复制结果（useCopy composable）──
const { copied, copy } = useCopy()
async function copyResult() {
  if (!result.value || result.value.error) return
  const lines = result.value.results.map((r) => `${r.label}: ${r.value}${r.note ? '（' + r.note + '）' : ''}`)
  copy(`${props.scene.name}\n${lines.join('\n')}`)
}

function addRow() { listRows.push('') }
function removeRow(i) { if (listRows.length > 1) listRows.splice(i, 1) }
</script>

<template>
  <div class="calc-form">
    <!-- 普通字段 -->
    <div v-for="f in scene.fields" :key="f.key" class="field">
      <label class="field-label">
        <span class="fname">{{ f.label }}</span>
        <span class="funit">{{ f.unit }}</span>
      </label>
      <input
        v-model="inputs[f.key]"
        type="text"
        inputmode="decimal"
        class="field-input"
        :class="{ invalid: invalid[f.key] }"
        :placeholder="f.ph"
        autocomplete="off"
        spellcheck="false"
      />
      <div v-if="invalid[f.key]" class="field-err">格式不对，示例：{{ f.ph }}</div>
    </div>

    <!-- list 模式：电阻行 -->
    <div v-if="isList" class="field list-field">
      <label class="field-label">
        <span class="fname">{{ scene.listField.label }}</span>
        <span class="funit">{{ scene.listField.unit }}</span>
      </label>
      <div v-for="(row, i) in listRows" :key="i" class="list-row">
        <input
          v-model="listRows[i]"
          type="text"
          inputmode="decimal"
          class="field-input"
          :class="{ invalid: listInvalid[i] }"
          :placeholder="scene.listField.ph"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn danger sm list-del" :disabled="listRows.length <= 1" @click="removeRow(i)">✕</button>
      </div>
      <button class="btn cyan sm list-add" @click="addRow">+ 加一个电阻</button>
    </div>

    <!-- 计算按钮 -->
    <button class="btn cyan compute-btn" @click="compute">⚡ 计算</button>

    <!-- 结果 -->
    <div v-if="result" class="result-panel">
      <div v-if="result.error" class="result-error">⚠ {{ result.error }}</div>
      <template v-else>
        <div v-for="(res, i) in result.results" :key="i" class="result-row">
          <span class="result-label">{{ res.label }}</span>
          <span class="result-value led">{{ res.value }}</span>
          <span v-if="res.note" class="result-note">{{ res.note }}</span>
        </div>
        <button class="btn cyan copy-btn" @click="copyResult">{{ copied ? '✓ 已复制' : '⧉ 复制结果' }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.calc-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.fname { font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: 1px; }
.funit { font-family: var(--mono); font-size: 10px; color: var(--cyan); opacity: 0.8; }
.field-input {
  font-size: 18px !important;
  padding: 10px 12px !important;
}
.field-err { font-family: var(--mono); font-size: 11px; color: var(--red); }

.list-field { gap: 8px; }
.list-row { display: flex; gap: 8px; align-items: center; }
.list-row .field-input { flex: 1; }
.list-del { flex-shrink: 0; width: 32px; }
.list-add { align-self: flex-start; }
</style>
