import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'

export function useRbacDraftGuard(dirty: Readonly<Ref<boolean>>) {
  async function confirmDiscard() {
    if (!dirty.value) return true
    try { await ElMessageBox.confirm('当前修改尚未保存。离开将丢弃这些修改。', '未保存的修改', { confirmButtonText: '丢弃修改', cancelButtonText: '继续编辑', type: 'warning' }); return true } catch { return false }
  }
  onBeforeRouteLeave((_to, from) => {
    // Revoked read access must not be kept alive by a draft-discard dialog.
    if (!useCatalogStore().canRoute({ path: from.path, query: from.query })) return true
    return confirmDiscard()
  })
  const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  return { confirmDiscard }
}
