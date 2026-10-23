<template>
  <aside v-if="store.persistenceState.message" class="catalog-storage-notice" role="alert" data-catalog-storage-notice>
    <div><strong>{{ store.persistenceState.external ? '其他页面已更新数据' : '本机保存需要处理' }}</strong><p>{{ store.persistenceState.message }}</p></div>
    <el-button v-if="store.persistenceState.external" :loading="reading" @click="readLatest">读取最新</el-button>
  </aside>
</template>
<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { ref } from 'vue'
import { useCatalogStore } from '../stores/catalog'
const store = useCatalogStore()
const reading = ref(false)
async function readLatest() {
  if (reading.value) return
  reading.value = true
  try {
    await ElMessageBox.confirm('读取最新会重新打开当前页面，本页尚未保存的表单、弹窗和画布输入将被放弃。请先复制需要保留的内容；取消后可以继续编辑，但旧页面不能覆盖新数据。', '读取最新数据', { confirmButtonText: '放弃本页输入并读取', cancelButtonText: '继续编辑', type: 'warning', distinguishCancelAndClose: true })
    store.persistenceState.discardConfirmed = true
    window.location.reload()
  } catch { /* Cancel keeps all local drafts and the persistent conflict notice. */ }
  finally { reading.value = false }
}
</script>
<style scoped>
.catalog-storage-notice { position: sticky; top: 0; z-index: 4000; display: flex; align-items: center; gap: 16px; padding: 12px 20px; color: var(--el-text-color-primary); background: var(--el-color-warning-light-9); border-bottom: 1px solid var(--el-color-warning-light-5); }
.catalog-storage-notice div { flex: 1; }.catalog-storage-notice strong { font-size: 14px; }.catalog-storage-notice p { margin: 4px 0 0; font-size: 13px; line-height: 1.5; }
@media(max-width:600px) { .catalog-storage-notice { padding: 10px 12px; gap: 8px; align-items: flex-start; } }
</style>
