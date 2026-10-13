<template>
  <div>
    <PageHead title="属性方案" desc="一套方案可以被多个分类使用。绑定关系在商品分类中心维护。">
      <el-button type="primary" @click="create">新建方案</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="store.data.templates">
        <el-table-column prop="name" label="方案名称" />
        <el-table-column label="启用状态" width="110">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="onEnabled(row, $event)" />
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
            <el-button link type="primary" @click="edit(row.id)">配置</el-button>
            <el-button link @click="copy(row.id)">复制</el-button>
            <el-button link @click="preview(row.id)">预览录入</el-button>
            <el-button link type="danger" @click="remove(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-drawer v-model="open" title="配置方案" size="520px">
      <template v-if="draft">
        <h3>适用分类</h3>
        <p class="muted">当前使用分类只在这里查看。要更换绑定，请到商品分类中心。</p>
        <p v-if="draftUsers.length === 0">当前没有分类使用这个方案。</p>
        <el-tag v-for="item in draftUsers" :key="item" style="margin: 4px">{{ item }}</el-tag>
        <el-input v-model="draft.name" style="margin: 12px 0 8px" />
        <p class="muted">录入时先显示公共属性，再显示规格属性。下面的顺序仍是商品结构视图和商品总览的结构轴。</p>
        <div v-for="(id, index) in draft.structureOrder" :key="id" class="rule-card">
          <strong>{{ paramName(id) }}</strong>
          <div class="row-actions" style="margin-top: 8px">
            <el-select :model-value="roleOf(id)" style="width: 120px" @change="onRoleChange(id, $event)">
              <el-option label="公共属性" value="common" />
              <el-option label="规格属性" value="variant" />
            </el-select>
            <el-checkbox :model-value="requiredOf(id)" @change="onRequiredChange(id, $event)">必填</el-checkbox>
            <el-button size="small" :disabled="index === 0" @click="move(index, -1)">上移</el-button>
            <el-button size="small" @click="move(index, 1)">下移</el-button>
            <el-button size="small" type="danger" @click="dropBind(id)">移出</el-button>
          </div>
        </div>
        <el-select v-model="addId" placeholder="加入参数" style="width: 220px">
          <el-option v-for="item in store.data.params" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button style="margin-left: 8px" @click="addParam">加入</el-button>
        <div style="margin-top: 16px">
          <el-button type="primary" @click="save">保存</el-button>
        </div>
      </template>
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
import { useRoute } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { boundParams } from '../domain/logic'
import type { CatalogTemplate, ParamRole } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

type SchemeDraft = {
  id: string
  name: string
  structureOrder: string[]
  binds: { paramId: string; role: ParamRole; required: boolean }[]
}

const store = useCatalogStore()
const route = useRoute()
const open = ref(false)
const previewOpen = ref(false)
const addId = ref('')
const previewId = ref('t-phone')
const draft = ref<SchemeDraft | null>(null)
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
  if (row) row.role = value as ParamRole
}
function onRequiredChange(id: string, value: string | number | boolean) {
  const row = bindOf(id)
  if (row) row.required = Boolean(value)
}
function dropBind(id: string) {
  if (!draft.value) return
  draft.value.structureOrder = draft.value.structureOrder.filter((item) => item !== id)
  draft.value.binds = draft.value.binds.filter((item) => item.paramId !== id)
}
function edit(id: string) {
  const source = store.data.templates.find((item) => item.id === id)
  if (!source) return
  draft.value = {
    id,
    name: source.name,
    structureOrder: [...source.structureOrder],
    binds: store.data.templateParams.filter((item) => item.templateId === id).map((item) => ({ paramId: item.paramId, role: item.role, required: item.required })),
  }
  addId.value = ''
  open.value = true
}
function move(index: number, direction: -1 | 1) {
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
  if (!draft.value || !addId.value || draft.value.structureOrder.includes(addId.value)) return
  draft.value.structureOrder.push(addId.value)
  draft.value.binds.push({ paramId: addId.value, role: 'variant', required: false })
  addId.value = ''
}
async function save() {
  if (!draft.value) return
  const name = draft.value.name.trim()
  if (!name) {
    ElMessage.warning('请填写方案名称')
    return
  }
  try {
    await ElMessageBox.confirm(impactText(draft.value.id), `修改：${name}`, { confirmButtonText: '确认保存', cancelButtonText: '取消' })
  } catch {
    return
  }
  const row = store.data.templates.find((item) => item.id === draft.value?.id)
  if (!row || !draft.value) return
  row.name = name
  row.structureOrder = [...draft.value.structureOrder]
  const templateId = row.id
  store.data.templateParams = store.data.templateParams.filter((item) => item.templateId !== templateId)
  draft.value.binds.forEach((item) => store.data.templateParams.push({ templateId, ...item }))
  open.value = false
  ElMessage.success('已保存')
}
async function onEnabled(row: CatalogTemplate, value: string | number | boolean) {
  try {
    await ElMessageBox.confirm(impactText(row.id), `修改：${row.name}`, { confirmButtonText: '确认保存', cancelButtonText: '取消' })
  } catch {
    return
  }
  row.enabled = Boolean(value)
}
function create() {
  const id = uid('tpl')
  store.data.templates.push({ id, name: '新方案', parentId: null, enabled: true, structureOrder: [] })
  edit(id)
}
function copy(id: string) {
  const source = store.data.templates.find((item) => item.id === id)
  if (!source) return
  const next = uid('tpl')
  store.data.templates.push({ ...source, id: next, name: `${source.name} 副本`, structureOrder: [...source.structureOrder] })
  store.data.templateParams.filter((item) => item.templateId === id).forEach((item) => store.data.templateParams.push({ ...item, templateId: next }))
  ElMessage.success('已复制方案')
}
function preview(id: string) {
  previewId.value = id
  previewOpen.value = true
}
function remove(id: string) {
  const message = store.removeTemplate(id)
  if (message) ElMessage.warning(message)
  else ElMessage.success('已删除')
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
