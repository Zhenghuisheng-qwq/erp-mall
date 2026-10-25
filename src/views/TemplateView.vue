<template>
  <div>
    <PageHead title="属性方案" desc="一套方案可以被多个分类使用。绑定关系在商品分类中心维护。">
      <el-button type="primary" @click="create" :disabled="saving || !store.can('product:template:create')">新建方案</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="visibleTemplates">
        <el-table-column label="方案名称"><template #default="{ row }"><span :data-template-id="row.id">{{ row.name }}</span></template></el-table-column>
        <el-table-column label="启用状态" width="110">
          <template #default="{ row }">
            <el-switch :disabled="saving || !canTemplate(row.id, 'update')" :model-value="row.enabled" @change="onEnabled(row, $event)" />
          </template>
        </el-table-column>
        <el-table-column label="引用分类数量" width="130">
          <template #default="{ row }">{{ refCount(row.id) }}</template>
        </el-table-column>
        <el-table-column label="商品数量" width="110">
          <template #default="{ row }">{{ productCount(row.id) }}</template>
        </el-table-column>
        <el-table-column label="公共属性" min-width="160">
          <template #default="{ row }">{{ names(row.id, 'common') }}</template>
        </el-table-column>
        <el-table-column label="规格属性" min-width="200">
          <template #default="{ row }">{{ names(row.id, 'variant') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row.id)" :disabled="saving || !canTemplate(row.id, 'update')">配置</el-button>
            <el-button link @click="copy(row.id)" :disabled="saving || !canTemplate(row.id, 'create')">复制</el-button>
            <el-button link @click="preview(row.id)">预览录入</el-button>
            <el-button link type="primary" @click="router.push({ path: '/skus/new', query: { template: row.id } })" :disabled="!(store.can('product:sku:create'))">创建 SKU</el-button>
            <el-button link type="danger" @click="remove(row.id)" :disabled="saving || !canTemplate(row.id, 'delete')">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-drawer v-model="open" :title="draftTitle" size="520px" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <template v-if="draft">
        <el-alert v-if="error" :title="error" type="error" :closable="false" data-template-save-error style="margin-bottom:12px" />
        <p v-if="!draft.id" class="muted">保存前不会新增方案或参数绑定。</p>
        <h3>适用分类</h3>
        <p class="muted">当前使用分类只在这里查看。要更换绑定，请到商品分类中心。</p>
        <p v-if="draftUsers.length === 0">当前没有分类使用这个方案。</p>
        <el-tag v-for="item in draftUsers" :key="item" style="margin: 4px">{{ item }}</el-tag>
        <el-input v-model="draft.name" aria-label="方案名称" style="margin: 12px 0 8px" :disabled="saving || !canEditDraft" />
        <p class="muted">录入时先显示公共属性，再显示规格属性。下面的顺序仍是商品结构视图和商品总览的结构轴。</p>
        <div v-for="(id, index) in draft.structureOrder" :key="id" class="rule-card">
          <strong>{{ paramName(id) }}</strong>
          <div class="row-actions" style="margin-top: 8px">
            <el-select :model-value="roleOf(id)" style="width: 120px" @change="onRoleChange(id, $event)" :disabled="saving || !canEditDraft">
              <el-option label="公共属性" value="common" />
              <el-option label="规格属性" value="variant" />
            </el-select>
            <el-checkbox :model-value="requiredOf(id)" @change="onRequiredChange(id, $event)" :disabled="saving || !canEditDraft">必填</el-checkbox>
            <el-button size="small" :disabled="saving || !canEditDraft || index === 0" @click="move(index, -1)">上移</el-button>
            <el-button size="small" :disabled="saving || !canEditDraft || index >= draft.structureOrder.length - 1" @click="move(index, 1)">下移</el-button>
            <el-button size="small" type="danger" :disabled="saving || !canEditDraft" @click="dropBind(id)">移出</el-button>
          </div>
        </div>
        <el-select v-model="addId" placeholder="加入参数" aria-label="加入参数" style="width: 220px" :disabled="saving || !canEditDraft">
          <el-option v-for="item in store.data.params" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button style="margin-left: 8px" :disabled="saving || !canEditDraft || !addId" @click="addParam">加入</el-button>

      </template>
      <template #footer><el-button :disabled="saving" @click="open = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!canEditDraft" @click="save">保存</el-button></template>
    </el-drawer>
    <el-dialog v-model="previewOpen" title="录入效果预览" width="640px">
      <p>公共属性</p>
      <el-tag v-for="item in previewCommon" :key="item" style="margin: 4px">{{ item }}</el-tag>
      <p style="margin-top: 12px">规格属性</p>
      <el-tag v-for="item in previewVariant" :key="item" type="success" style="margin: 4px">{{ item }}</el-tag>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { boundParams } from '../domain/logic'
import type { CatalogTemplate, ParamRole } from '../domain/types'
import { templateAccessResource } from '../domain/rbac'
import { useCatalogStore } from '../stores/catalog'

type SchemeDraft = {
  id: string
  name: string
  enabled: boolean
  sourceId?: string
  structureOrder: string[]
  binds: { paramId: string; role: ParamRole; required: boolean }[]
}

const store = useCatalogStore()
const router = useRouter()
const route = useRoute()
const open = ref(false), saving = ref(false), error = ref('')
const previewOpen = ref(false)
const addId = ref('')
const previewId = ref('t-phone')
const draft = ref<SchemeDraft | null>(null)
function canTemplate(id: string, action: 'read' | 'create' | 'update' | 'delete') { return store.can(`product:${templateAccessResource(store.data, id)}:${action}`) }
const canEditDraft = computed(() => !!draft.value && (draft.value.id ? canTemplate(draft.value.id, 'update') : store.can('product:template:create')))
const draftTitle = computed(() => draft.value?.id ? '配置方案' : draft.value?.sourceId ? '复制方案' : '新建方案')
const visibleTemplates = computed(() => store.data.templates.filter(item => canTemplate(item.id, 'read')))

const draftUsers = computed(() => (draft.value ? categoryNames(draft.value.id) : []))
const previewCommon = computed(() => boundParams(store.data, previewId.value, 'common').map((item) => `${item.param.name}${item.required ? '（必填）' : ''}`))
const previewVariant = computed(() => boundParams(store.data, previewId.value, 'variant').map((item) => `${item.param.name}${item.required ? '（必填）' : ''}`))

function names(id: string, role: ParamRole) {
  return boundParams(store.data, id, role).map((item) => item.param.name).join('、') || '-'
}
function paramName(id: string) {
  return store.data.params.find((item) => item.id === id)?.name || id
}
function refCount(id: string) {
  return store.data.mappings.filter((item) => item.templateId === id).length
}
function productCount(id: string) {
  return store.data.families.filter((item) => item.templateId === id).length
}
function categoryNames(id: string) {
  return store.data.mappings
    .filter((item) => item.templateId === id)
    .map((item) => store.data.categories.find((category) => category.id === item.categoryId)?.name || '')
    .filter(Boolean)
}
function impactText(id: string) {
  return `该方案当前被${refCount(id)}个分类使用。修改后会影响这些分类未来创建的商品。历史商品不会变化。`
}
function bindOf(id: string) {
  return draft.value?.binds.find((item) => item.paramId === id)
}
function roleOf(id: string) {
  return bindOf(id)?.role || 'variant'
}
function requiredOf(id: string) {
  return Boolean(bindOf(id)?.required)
}
function onRoleChange(id: string, value: string) {
  const row = bindOf(id)
  if (row && canEditDraft.value && !saving.value) row.role = value as ParamRole
}
function onRequiredChange(id: string, value: string | number | boolean) {
  const row = bindOf(id)
  if (row && canEditDraft.value && !saving.value) row.required = Boolean(value)
}
function dropBind(id: string) {
  if (!draft.value || saving.value || !canEditDraft.value) return
  draft.value.structureOrder = draft.value.structureOrder.filter((item) => item !== id)
  draft.value.binds = draft.value.binds.filter((item) => item.paramId !== id)
}
function edit(id: string) {
  if (saving.value || !canTemplate(id, 'read')) return
  error.value = ''
  const source = store.data.templates.find((item) => item.id === id)
  if (!source) return
  draft.value = {
    id,
    name: source.name,
    enabled: source.enabled,
    structureOrder: [...source.structureOrder],
    binds: store.data.templateParams.filter((item) => item.templateId === id).map((item) => ({ paramId: item.paramId, role: item.role, required: item.required })),
  }
  addId.value = ''
  open.value = true
}
function move(index: number, direction: -1 | 1) {
  if (saving.value || !canEditDraft.value) return
  const order = draft.value?.structureOrder
  if (!order) return
  const target = index + direction
  const left = order[index]
  const right = order[target]
  if (!left || !right) return
  order[index] = right
  order[target] = left
}
function addParam() {
  if (!draft.value || saving.value || !canEditDraft.value || !addId.value || draft.value.structureOrder.includes(addId.value)) return
  draft.value.structureOrder.push(addId.value)
  draft.value.binds.push({ paramId: addId.value, role: 'variant', required: false })
  addId.value = ''
}
async function save() {
  if (saving.value || !draft.value) return
  if (!canEditDraft.value) { error.value = '没有保存当前方案的权限，输入已保留。'; return }
  const name = draft.value.name.trim()
  if (!name) { error.value = '请填写方案名称。'; return }
  if (draft.value.id) {
    try { await ElMessageBox.confirm(impactText(draft.value.id), `修改：${name}`, { confirmButtonText: '确认保存', cancelButtonText: '取消' }) }
    catch { return }
  }
  const candidate = JSON.parse(JSON.stringify({ ...draft.value, name })) as SchemeDraft
  saving.value = true; error.value = ''
  try {
    const result = await store.saveTemplateScheme(candidate)
    if (!result.ok) { error.value = result.message || '方案尚未保存，当前输入与参数绑定已保留，可重试。'; return }
    open.value = false; ElMessage.success(candidate.id ? '已保存方案' : candidate.sourceId ? '已复制方案' : '已新建方案')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '方案保存失败，当前输入已保留，可重试。' }
  finally { saving.value = false }
}
async function onEnabled(row: CatalogTemplate, value: string | number | boolean) {
  if (saving.value || !canTemplate(row.id, 'update')) return
  try { await ElMessageBox.confirm(impactText(row.id), `修改：${row.name}`, { confirmButtonText: '确认保存', cancelButtonText: '取消' }) }
  catch { return }
  saving.value = true
  try {
    const result = await store.saveTemplateScheme({ id: row.id, name: row.name, structureOrder: [...row.structureOrder], enabled: Boolean(value), binds: schemeBinds(row.id) })
    if (!result.ok) ElMessage.error(result.message || '方案状态未保存，请重试。')
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '方案状态未保存，请重试。') }
  finally { saving.value = false }
}
function schemeBinds(id: string) { return store.data.templateParams.filter(item => item.templateId === id).map(item => ({ paramId: item.paramId, role: item.role, required: item.required })) }
function create() {
  if (saving.value || !store.can('product:template:create')) return
  draft.value = { id: '', name: '新方案', enabled: true, structureOrder: [], binds: [] }
  addId.value = ''; error.value = ''; open.value = true
}
async function flushChanges() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '方案修改尚未保存，当前输入已保留。'); return false }
  return true
}
async function copy(id: string) {
  if (saving.value || !canTemplate(id, 'create')) return
  const source = store.data.templates.find(item => item.id === id)
  if (!source) return
  if (templateAccessResource(store.data, id) === 'model') {
    saving.value = true
    try { const result = await store.copyProductModel(id, { name: `${source.name} 副本` }); if (!result.ok) ElMessage.warning(result.message || '模型复制失败'); else ElMessage.success('已复制模型') }
    catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '模型复制失败') }
    finally { saving.value = false }
    return
  }
  draft.value = { id: '', name: `${source.name} 副本`, sourceId: source.id, enabled: source.enabled, structureOrder: [...source.structureOrder], binds: schemeBinds(source.id) }
  addId.value = ''; error.value = ''; open.value = true
}
function preview(id: string) {
  previewId.value = id
  previewOpen.value = true
}
async function remove(id: string) {
  if (!canTemplate(id, 'delete')) return
  const message = store.removeTemplate(id)
  if (message) ElMessage.warning(message)
  else if (await flushChanges()) ElMessage.success('已删除')
}
watch(
  () => route.query.scheme,
  (value) => {
    const id = typeof value === 'string' ? value : ''
    if (!id || !store.data.templates.some((item) => item.id === id)) return
    edit(id)
  },
  { immediate: true },
)
</script>
