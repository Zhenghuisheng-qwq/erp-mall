import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

type OrderResult = { ok: true } | { ok: false; message: string }
interface ManualOrderActions {
  move: (dragId: string, targetId: string, place: 'before' | 'after') => OrderResult | Promise<OrderResult>
  insert: (stagedIds: string[], targetId: string, place: 'before' | 'after') => OrderResult | Promise<OrderResult>
  hasFilters: () => boolean
  context?: () => string
  validateStage?: (ids: string[]) => OrderResult
  groupLabel?: (id: string) => string
  boundary?: (ids: string[], edge: 'top' | 'bottom') => OrderResult | Promise<OrderResult>
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
  const busy = ref(false), dropTargetId = ref(''), dropPlace = ref<'before' | 'after'>('before'), dropMessage = ref('')
  const stageContext = ref('')
  function captureManualState() { return { pickedIds: [...pickedIds.value], stageIds: [...stageIds.value], context: stageContext.value } }
  function restoreManualState(state: { pickedIds: string[]; stageIds: string[]; context: string }) {
    if (busy.value) return
    pickedIds.value = [...new Set(state.pickedIds)]
    stageIds.value = [...new Set(state.stageIds)]
    stageContext.value = state.context
  }
  let dragContext: string | undefined
  const stageContextValid = computed(() => !stageIds.value.length || !actions.context || stageContext.value === actions.context())
  const stageGroupLabel = computed(() => stageIds.value.length ? actions.groupLabel?.(stageIds.value[0]!) || '当前匹配范围' : '')
  const validate = (ids: string[]) => actions.validateStage?.([...new Set(ids)]) || { ok: true as const }
  function contextError() { ElMessage.warning('筛选、分组或数据范围已变化，排序暂存已保留；请核对后重新暂存。') }

  async function confirmStage(discard = true) {
    if (!stageIds.value.length) return true
    try {
      await ElMessageBox.confirm('还有未提交的排序暂存。继续后会清空暂存，已经保存的手工顺序不受影响。', '清空暂存')
      if (discard) { clearStage(); pickedIds.value = [] }
      return true
    } catch {
      return false
    }
  }
  function onRowDrag(id: string, event?: DragEvent) {
    if (busy.value) { event?.preventDefault(); return }
    const result = validate([id])
    if (!result.ok) { event?.preventDefault(); ElMessage.warning(result.message); return }
    dragId.value = id
    dragContext = actions.context?.()
    event?.stopPropagation()
    if (event?.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }
  }
  function onRowOver(id: string, event: DragEvent) {
    if (!dragId.value || busy.value) return
    event.preventDefault()
    const row = event.target instanceof Element ? event.target.closest('.el-table__row') || event.currentTarget as Element : event.currentTarget as Element
    const rect = row?.getBoundingClientRect()
    dropPlace.value = rect && event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before'
    dropTargetId.value = id
    const result = dragContext !== actions.context?.() ? { ok: false, message: '排序范围已变化' } : validate([dragId.value, id])
    dropMessage.value = result.ok ? '' : result.message
    if (event.dataTransfer) event.dataTransfer.dropEffect = result.ok ? 'move' : 'none'
  }
  function endDrag() { dragId.value = ''; dropTargetId.value = ''; dropMessage.value = ''; dragContext = undefined }
  function rowDropClass(id: string) { return dropTargetId.value === id ? dropMessage.value ? 'manual-drop-blocked' : `manual-drop-${dropPlace.value}` : '' }
  async function onRowDrop(id: string, event?: DragEvent) {
    event?.preventDefault()
    if (!dragId.value || busy.value) return
    const source = dragId.value, place = dropTargetId.value === id ? dropPlace.value : 'before', captured = dragContext
    const valid = validate([source, id])
    endDrag()
    if (captured !== actions.context?.()) { contextError(); return }
    if (!valid.ok) { ElMessage.warning(valid.message); return }
    busy.value = true
    try { const result = await actions.move(source, id, place); if (!result.ok) ElMessage.warning(result.message) }
    catch (error) { ElMessage.error(error instanceof Error ? error.message : '顺序未保存，请重试。') }
    finally { busy.value = false }
  }
  function togglePick(id: string, checked: boolean) {
    if (busy.value) return
    pickedIds.value = checked ? [...new Set([...pickedIds.value, id])] : pickedIds.value.filter((item) => item !== id)
  }
  function addStage() {
    if (busy.value) return
    if (!stageContextValid.value) { contextError(); return }
    const next = [...stageIds.value]
    pickedIds.value.forEach((id) => {
      if (!next.includes(id)) next.push(id)
    })
    const valid = validate(next)
    if (!valid.ok) { ElMessage.warning(valid.message); return }
    stageIds.value = next
    stageContext.value = actions.context?.() || ''
    pickedIds.value = []
    ElMessage.success(`排序暂存区现有 ${next.length} 条`)
  }
  function clearStage() {
    if (busy.value) return
    stageIds.value = []
    stageContext.value = ''
  }
  function removeStaged(id: string) {
    if (busy.value) return
    stageIds.value = stageIds.value.filter((item) => item !== id)
    if (!stageIds.value.length) stageContext.value = ''
  }
  async function askInsert(id: string, name: string, place: 'before' | 'after') {
    if (busy.value || !stageIds.value.length) return
    if (!stageContextValid.value) { contextError(); return }
    const valid = validate([...stageIds.value, id])
    if (!valid.ok) { ElMessage.warning(valid.message); return }
    busy.value = true
    const captured = [...stageIds.value], context = actions.context?.()
    try {
      const where = place === 'before' ? '之前' : '之后'
      try {
        await ElMessageBox.confirm(`把暂存的 ${stageIds.value.length} 条插入「${name}」${where}？`, '确认插入')
      } catch {
        return
      }
      if (context !== actions.context?.()) { contextError(); return }
      const result = await actions.insert(captured, id, place)
      if (!result.ok) {
        ElMessage.warning(result.message)
        return
      }
      stageIds.value = stageIds.value.filter(id => !captured.includes(id))
      if (!stageIds.value.length) stageContext.value = ''
      const hidden = actions.hasFilters() ? '当前筛选下可能看不到全部记录。' : ''
      ElMessage.success(`展示顺序已更新。${hidden}`)
    } catch (error) { ElMessage.error(error instanceof Error ? error.message : '排序未保存，暂存已保留。') }
    finally { busy.value = false }
  }
  async function askBoundary(edge: 'top' | 'bottom', ids?: string[]) {
    if (busy.value || !actions.boundary) return
    const captured = [...new Set(ids || (stageIds.value.length ? stageIds.value : pickedIds.value))]
    if (!captured.length) return
    if (captured.some(id => stageIds.value.includes(id)) && !stageContextValid.value) { contextError(); return }
    const valid = validate(captured)
    if (!valid.ok) { ElMessage.warning(valid.message); return }
    const context = actions.context?.()
    busy.value = true
    try {
      if (context !== actions.context?.()) { contextError(); return }
      const result = await actions.boundary(captured, edge)
      if (!result.ok) { ElMessage.warning(result.message); return }
      stageIds.value = stageIds.value.filter(id => !captured.includes(id)); pickedIds.value = pickedIds.value.filter(id => !captured.includes(id))
      if (!stageIds.value.length) stageContext.value = ''
      ElMessage.success('手工顺序已应用，排序暂存已提交')
    } catch (error) { ElMessage.error(error instanceof Error ? error.message : '排序未保存，暂存已保留。') }
    finally { busy.value = false }
  }

  return { pickedIds, stageIds, busy, stageContextValid, stageGroupLabel, dropTargetId, dropPlace, dropMessage, confirmStage, onRowDrag, onRowOver, onRowDrop, endDrag, rowDropClass, togglePick, addStage, clearStage, removeStaged, askInsert, askBoundary, captureManualState, restoreManualState }
}
