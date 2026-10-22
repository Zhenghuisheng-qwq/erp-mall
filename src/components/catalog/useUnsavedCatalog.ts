import { ElMessageBox } from 'element-plus'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import type { Ref } from 'vue'

export function useUnsavedCatalog(dirty: Ref<boolean>) {
  const confirm = async () => {
    if (!dirty.value) return true
    try { await ElMessageBox.confirm('离开后，这次未保存的输入会丢失。', '离开编辑', { confirmButtonText: '离开', cancelButtonText: '继续编辑' }); dirty.value = false; return true }
    catch { return false }
  }
  onBeforeRouteLeave(confirm)
  onBeforeRouteUpdate(confirm)
  return confirm
}
