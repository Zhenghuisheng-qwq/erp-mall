import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

type OrderResult = { ok: true } | { ok: false; message: string }
interface ManualOrderActions {
  move: (dragId: string, targetId: string, place: 'before' | 'after') => OrderResult | Promise<OrderResult>
  insert: (stagedIds: string[], targetId: string, place: 'before' | 'after') => OrderResult | Promise<OrderResult>
  hasFilters: () => boolean
  context?: () => string
}

/**
 * Owns temporary picks/staging for one mounted list, with the existing confirmations.
 * Only move/insert can persist order through the supplied page commands.
 * No watchers, subscriptions or persistence on mount; the page decides when to confirm switching.
 */
export function useProductListManualOrder(actions: ManualOrderActions) {
  const pickedIds = ref<string[]>([])
  const stageIds = ref<string[]>([])
  const dragId = ref('')

  async function confirmStage(discard = true) {
    if (!stageIds.value.length) return true
    try {
      await ElMessageBox.confirm('还有未提交的排序暂存。继续后会清空暂存，已经保存的手工顺序不受影响。', '清空暂存')
      if (discard) { stageIds.value = []; pickedIds.value = [] }
      return true
    } catch {
      return false
    }
  }
  function onRowDrag(id: string) {
    dragId.value = id
  }
  async function onRowDrop(id: string) {
    if (!dragId.value) return
    const result = await actions.move(dragId.value, id, 'before')
    dragId.value = ''
    if (!result.ok) ElMessage.warning(result.message)
  }
  function togglePick(id: string, checked: boolean) {
    pickedIds.value = checked ? [...pickedIds.value, id] : pickedIds.value.filter((item) => item !== id)
  }
  function addStage() {
    const next = [...stageIds.value]
    pickedIds.value.forEach((id) => {
      if (!next.includes(id)) next.push(id)
    })
    stageIds.value = next
    pickedIds.value = []
    ElMessage.success(`排序暂存区现有 ${next.length} 条`)
  }
  function clearStage() {
    stageIds.value = []
  }
  function removeStaged(id: string) {
    stageIds.value = stageIds.value.filter((item) => item !== id)
  }
  let inserting = false
  async function askInsert(id: string, name: string, place: 'before' | 'after') {
    if (inserting || !stageIds.value.length) return
    inserting = true
    const captured = [...stageIds.value], context = actions.context?.()
    try {
      const where = place === 'before' ? '之前' : '之后'
      try {
        await ElMessageBox.confirm(`把暂存的 ${stageIds.value.length} 条插入「${name}」${where}？`, '确认插入')
      } catch {
        return
      }
      if (context !== actions.context?.()) return
      const result = await actions.insert(captured, id, place)
      if (!result.ok) {
        ElMessage.warning(result.message)
        return
      }
      stageIds.value = stageIds.value.filter(id => !captured.includes(id))
      const hidden = actions.hasFilters() ? '当前筛选下可能看不到全部记录。' : ''
      ElMessage.success(`展示顺序已更新。${hidden}`)
    } finally { inserting = false }
  }

  return { pickedIds, stageIds, confirmStage, onRowDrag, onRowDrop, togglePick, addStage, clearStage, removeStaged, askInsert }
}
