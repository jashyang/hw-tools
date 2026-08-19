import { ref, computed } from 'vue'
import { parseResistor } from '../core/parse.js'

// 电路编辑操作集：选中、改值、增删、串并联、组操作
// 由视图层实例化一次，CircuitView 与 RightPanel 共享同一实例
export function useCircuit(root) {
  const selectedId = ref(null)
  const selValue = ref('')

  const selected = computed(() => {
    if (!selectedId.value) return null
    return findNode(root.value, selectedId.value)
  })
  const selIsRes = computed(() => selected.value && selected.value.type === 'res')
  const selIsGroup = computed(() => selected.value && selected.value.type === 'group')

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

  function select(id) {
    selectedId.value = id
    const n = findNode(root.value, id)
    selValue.value = n && n.type === 'res' ? n.raw || '' : ''
  }
  function clearSelect() {
    selectedId.value = null
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
    removeById(root.value, selectedId.value)
    selectedId.value = null
  }

  // 在电阻上"串联一个"
  function addSeries(node) {
    const n = node || selected.value
    const p = findParent(root.value, n.id)
    if (!n || n.type !== 'res') return
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
    select(nn.id)
  }
  // 在电阻上"并联一个"
  function addParallel(node) {
    const n = node || selected.value
    const p = findParent(root.value, n.id)
    if (!n || n.type !== 'res') return
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
    select(nn.id)
  }

  // 插入新元件到组内指定位置（拖拽吸附用）
  function insertInto(groupId, index, node) {
    const g = findNode(root.value, groupId)
    if (!g || g.type !== 'group') return
    const idx = Math.min(Math.max(index, 0), g.children.length)
    g.children.splice(idx, 0, node)
    select(node.id)
  }
  function pushInto(groupId, node) {
    const g = findNode(root.value, groupId)
    if (!g || g.type !== 'group') return
    g.children.push(node)
    select(node.id)
  }

  function toggleGroupMode() {
    const n = selected.value
    if (n && n.type === 'group') n.mode = n.mode === 'series' ? 'parallel' : 'series'
  }
  function groupAddRes() {
    const n = selected.value
    if (n && n.type === 'group') {
      const nn = mkRes()
      n.children.push(nn)
      select(nn.id)
    }
  }
  function groupAddGroup() {
    const n = selected.value
    if (n && n.type === 'group') {
      const nn = { type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`, mode: 'parallel', folded: false, children: [] }
      n.children.push(nn)
      select(nn.id)
    }
  }
  function toggleFold() {
    const n = selected.value
    if (n && n.type === 'group') n.folded = !n.folded
  }

  function mkRes() {
    let cnt = 0
    ;(function walk(n) {
      if (!n) return
      if (n.type === 'res') cnt++
      else if (n.type === 'group') n.children.forEach(walk)
    })(root.value)
    return { type: 'res', id: `r${Math.random().toString(36).slice(2, 8)}`, label: `R${cnt + 1}`, raw: '', ohms: null, unknown: false }
  }
  function mkGroup(mode) {
    return { type: 'group', id: `g${Math.random().toString(36).slice(2, 8)}`, mode, folded: false, children: [] }
  }

  return {
    selectedId, selected, selValue, selIsRes, selIsGroup,
    select, clearSelect, onValueCommit, toggleUnknown, removeSelected,
    addSeries, addParallel, insertInto, pushInto,
    toggleGroupMode, groupAddRes, groupAddGroup, toggleFold,
    mkRes, mkGroup, findNode, findParent, removeById,
  }
}
