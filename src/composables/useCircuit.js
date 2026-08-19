import { ref, computed } from 'vue'
import { parseResistor } from '../core/parse.js'

// 电路编辑操作集：多选（点选累积）、组合（串/并联）、改值、增删
// 由视图层实例化一次，CircuitView 与 RightPanel 共享同一实例
export function useCircuit(root) {
  const selectedIds = ref([]) // 多选：点选累积
  const selValue = ref('')

  const selected = computed(() =>
    selectedIds.value.map((id) => findNode(root, id)).filter(Boolean)
  )
  const selCount = computed(() => selectedIds.value.length)
  const selIsRes = computed(() => selCount.value === 1 && selected.value[0] && selected.value[0].type === 'res')
  const selIsGroup = computed(() => selCount.value === 1 && selected.value[0] && selected.value[0].type === 'group')

  function findNode(n, id) {
    if (!n) return null
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
    if (!n) return null
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
    if (!n || n.type !== 'group') return false
    const idx = n.children.findIndex((c) => c.id === id)
    if (idx >= 0) {
      n.children.splice(idx, 1)
      return true
    }
    for (const c of n.children) if (removeById(c, id)) return true
    return false
  }

  function syncSelValue() {
    const n = selected.value[0]
    selValue.value = n && n.type === 'res' ? n.raw || '' : ''
  }
  // 单选（替换选择集）
  function selectOnly(id) {
    selectedIds.value = [id]
    syncSelValue()
  }
  // 点选切换（多选累积）
  function toggleSelect(id) {
    const i = selectedIds.value.indexOf(id)
    if (i >= 0) selectedIds.value.splice(i, 1)
    else selectedIds.value.push(id)
    syncSelValue()
  }
  function clearSelect() {
    selectedIds.value = []
  }
  function isSelected(id) {
    return selectedIds.value.includes(id)
  }

  function onValueCommit() {
    const n = selected.value[0]
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
    const n = selected.value[0]
    if (n && n.type === 'res') n.unknown = !n.unknown
  }

  function removeSelected() {
    for (const n of selected.value) removeById(root, n.id)
    clearSelect()
  }

  // 在单选电阻上"串联一个"
  function addSeries() {
    const n = selected.value[0]
    if (!n || n.type !== 'res') return
    const p = findParent(root, n.id)
    const nn = mkRes()
    if (p && p.type === 'group' && p.mode === 'series') {
      const idx = p.children.findIndex((c) => c.id === n.id)
      p.children.splice(idx + 1, 0, nn)
    } else if (p && p.type === 'group') {
      const idx = p.children.findIndex((c) => c.id === n.id)
      p.children.splice(idx, 1, {
        type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`,
        mode: 'series', folded: false, children: [n, nn],
      })
    }
    selectOnly(nn.id)
  }
  // 在单选电阻上"并联一个"
  function addParallel() {
    const n = selected.value[0]
    if (!n || n.type !== 'res') return
    const p = findParent(root, n.id)
    const nn = mkRes()
    if (p && p.type === 'group' && p.mode === 'parallel') {
      p.children.push(nn)
    } else if (p && p.type === 'group') {
      const idx = p.children.findIndex((c) => c.id === n.id)
      p.children.splice(idx, 1, {
        type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`,
        mode: 'parallel', folded: false, children: [n, nn],
      })
    }
    selectOnly(nn.id)
  }

  // 组合选中的多个元件为串/并联组
  function combine(mode) {
    const nodes = selected.value
    if (nodes.length < 2) return
    const first = nodes[0]
    const parent = findParent(root, first.id)
    if (!parent) return
    const idx = parent.children.indexOf(first)
    for (const n of nodes) removeById(root, n.id)
    const G = {
      type: 'group',
      id: `g${Math.random().toString(36).slice(2, 8)}`,
      mode,
      folded: false,
      children: nodes,
    }
    parent.children.splice(Math.min(idx, parent.children.length), 0, G)
    selectOnly(G.id)
  }

  // 解散选中的组（组内元素提升到父级）
  function dissolveGroup() {
    const n = selected.value[0]
    if (!n || n.type !== 'group') return
    const parent = findParent(root, n.id)
    if (!parent) return
    const idx = parent.children.indexOf(n)
    parent.children.splice(idx, 1, ...n.children)
    clearSelect()
  }

  // 插入新元件到组内指定位置（拖拽吸附用）
  function insertInto(groupId, index, node) {
    const g = findNode(root, groupId)
    if (!g || g.type !== 'group') return
    const idx = Math.min(Math.max(index, 0), g.children.length)
    g.children.splice(idx, 0, node)
    selectOnly(node.id)
  }
  function pushInto(groupId, node) {
    const g = findNode(root, groupId)
    if (!g || g.type !== 'group') return
    g.children.push(node)
    selectOnly(node.id)
  }

  function toggleGroupMode() {
    const n = selected.value[0]
    if (n && n.type === 'group') n.mode = n.mode === 'series' ? 'parallel' : 'series'
  }
  function groupAddRes() {
    const n = selected.value[0]
    if (n && n.type === 'group') {
      const nn = mkRes()
      n.children.push(nn)
      selectOnly(nn.id)
    }
  }
  function groupAddGroup() {
    const n = selected.value[0]
    if (n && n.type === 'group') {
      const nn = { type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`, mode: 'parallel', folded: false, children: [] }
      n.children.push(nn)
      selectOnly(nn.id)
    }
  }
  function toggleFold() {
    const n = selected.value[0]
    if (n && n.type === 'group') n.folded = !n.folded
  }

  function mkRes() {
    let cnt = 0
    ;(function walk(n) {
      if (!n) return
      if (n.type === 'res') cnt++
      else if (n.type === 'group') n.children.forEach(walk)
    })(root)
    return { type: 'res', id: `r${Math.random().toString(36).slice(2, 8)}`, label: `R${cnt + 1}`, raw: '', ohms: null, unknown: false }
  }
  function mkGroup(mode) {
    return { type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`, mode, folded: false, children: [] }
  }

  return {
    selectedIds, selected, selCount, selValue, selIsRes, selIsGroup,
    selectOnly, toggleSelect, clearSelect, isSelected,
    onValueCommit, toggleUnknown, removeSelected,
    addSeries, addParallel, combine, dissolveGroup,
    insertInto, pushInto,
    toggleGroupMode, groupAddRes, groupAddGroup, toggleFold,
    mkRes, mkGroup, findNode, findParent, removeById,
  }
}
