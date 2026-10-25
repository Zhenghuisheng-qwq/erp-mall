<template>
  <div>
    <PageHead title="品牌中心" desc="新商品的品牌从这里选。已经保存的商品仍读取公共属性里的「品牌」，不会丢。">
      <el-button type="primary" :disabled="saving || !store.can('product:brand:create')" @click="openCreate">新增品牌</el-button>
    </PageHead>
    <el-alert v-if="pageError" :title="pageError" type="error" :closable="false" style="margin-bottom:12px" />
    <div class="panel">
      <el-table :data="store.data.brands">
        <el-table-column prop="name" label="品牌" />
        <el-table-column prop="logo" label="标识" />
        <el-table-column prop="description" label="说明" />
        <el-table-column label="状态" width="120"><template #default="{ row }"><el-switch :model-value="row.status === 'enabled'" :disabled="saving || !store.can('product:brand:update')" @change="setStatus(row, Boolean($event))" /></template></el-table-column>
        <el-table-column label="操作" width="120"><template #default="{ row }"><el-button link type="primary" :disabled="saving || !store.can('product:brand:update')" @click="edit(row.id)">编辑</el-button></template></el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="open" :title="editing.id ? '编辑品牌' : '新增品牌'" width="460px" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-alert v-if="error" :title="error" type="error" :closable="false" data-brand-save-error style="margin-bottom:12px" />
      <el-form label-width="72px" :disabled="saving || !canSave">
        <el-form-item label="名称" required><el-input v-model="editing.name" aria-label="品牌名称" /></el-form-item>
        <el-form-item label="标识"><el-input v-model="editing.logo" placeholder="图片地址，可空" aria-label="品牌标识" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="editing.description" type="textarea" aria-label="品牌说明" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="open = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!canSave" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import type { Brand } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'
const store = useCatalogStore(), open = ref(false), saving = ref(false), error = ref(''), pageError = ref('')
const blank = (): Brand => ({ id: '', name: '', logo: '', description: '', status: 'enabled' })
const editing = reactive<Brand>(blank())
const canSave = computed(() => store.can(editing.id ? 'product:brand:update' : 'product:brand:create'))
function openCreate() { if (saving.value || !store.can('product:brand:create')) return; Object.assign(editing, blank()); error.value = ''; open.value = true }
function edit(id: string) {
  if (saving.value || !store.can('product:brand:update')) return
  const row = store.data.brands.find(item => item.id === id)
  if (row) { Object.assign(editing, { ...row }); error.value = ''; open.value = true }
}
async function save() {
  if (saving.value) return
  if (!canSave.value) { error.value = '没有保存此品牌的权限。'; return }
  if (!editing.name.trim()) { error.value = '请填写品牌名称。'; return }
  saving.value = true; error.value = ''
  try {
    const result = await store.saveBrand({ ...editing, name: editing.name.trim(), logo: editing.logo.trim(), description: editing.description.trim() })
    if (!result.ok) { error.value = result.message || '品牌尚未保存，当前输入已保留。'; return }
    open.value = false; ElMessage.success('品牌已保存。历史商品里的品牌文字不会被改写。')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '品牌保存失败，当前输入已保留，可重试。' }
  finally { saving.value = false }
}
async function setStatus(row: Brand, enabled: boolean) {
  if (saving.value || !store.can('product:brand:update')) return
  saving.value = true; pageError.value = ''
  try { const result = await store.saveBrand({ ...row, status: enabled ? 'enabled' : 'disabled' }); if (!result.ok) pageError.value = result.message || '状态没有保存，请重试。' }
  catch (cause) { pageError.value = cause instanceof Error ? cause.message : '状态没有保存，请重试。' }
  finally { saving.value = false }
}
</script>
