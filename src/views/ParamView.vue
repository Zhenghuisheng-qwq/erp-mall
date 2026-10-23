<template>
  <div>
    <PageHead title="属性词典" desc="颜色、容量这些取值全局共用。商品里新增的取值也会出现在这里。品牌没有单独的数据库。">
      <el-button type="primary" @click="openCreate">新建参数</el-button>
      <el-button @click="openBrand">维护品牌</el-button>
    </PageHead>
    <div class="panel">
      <el-input v-model="keyword" placeholder="搜索参数或取值" clearable style="width: 240px; margin-bottom: 12px" />
      <el-table :data="rows">
        <el-table-column prop="name" label="参数" width="120" />
        <el-table-column label="取值" min-width="240">
          <template #default="{ row }">{{ row.values.join('、') || '-' }}</template>
        </el-table-column>
        <el-table-column label="用在" min-width="160">
          <template #default="{ row }">{{ usedTemplates(row.id) }}</template>
        </el-table-column>
        <el-table-column label="参与旧结构" width="120">
          <template #default="{ row }"><el-switch v-model="row.participateInStructure" /></template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row.id)">编辑</el-button>
            <el-button link type="danger" @click="remove(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-drawer v-model="open" :title="editing?.name || '参数'" size="480px">
      <template v-if="editing">
        <div class="filters">
          <el-input v-model="nameDraft" placeholder="属性名称" style="width: 220px" />
          <el-button type="primary" @click="saveName">保存名称</el-button>
        </div>
        <p v-if="renameHint" class="rename-hint">{{ renameHint }}</p>
        <div class="filters">
          <el-input v-model="valueKeyword" placeholder="搜索取值" style="width: 180px" />
          <el-input v-model="newValue" placeholder="新取值" style="width: 140px" @keyup.enter="addValue" />
          <el-button @click="addValue">添加</el-button>
        </div>
        <div v-for="value in shownValues" :key="value" class="row-actions" style="margin: 6px 0">
          <span>{{ value }}</span>
          <el-button link type="danger" @click="removeValue(value)">删除</el-button>
        </div>
        <h3 style="margin: 16px 0 8px">取值分组</h3>
        <div v-for="group in editing.valueGroups" :key="group.id" class="rule-card">
          <el-input v-model="group.name" />
          <el-select v-model="group.values" multiple style="width: 100%; margin-top: 8px">
            <el-option v-for="value in editing.values" :key="value" :label="value" :value="value" />
          </el-select>
        </div>
        <el-button @click="editing.valueGroups.push({ id: uid('vg'), name: '新分组', values: [] })">新增分组</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import PageHead from '../components/PageHead.vue'
import { attributeRenameDecision } from '../domain/dictionaryGuard'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const keyword = ref('')
const nameDraft = ref('')
const valueKeyword = ref('')
const newValue = ref('')
const open = ref(false)
const editingId = ref('p-brand')
const editing = computed(() => store.data.params.find((item) => item.id === editingId.value))
const renameHint = computed(() => (editing.value ? attributeRenameDecision(store.data, editing.value.id, nameDraft.value.trim() || `${editing.value.name}新名`).message : ''))
watch(editing, (param) => {
  nameDraft.value = param?.name || ''
}, { immediate: true })
const rows = computed(() => store.data.params.filter((item) => !keyword.value || item.name.includes(keyword.value) || item.values.some((value) => value.includes(keyword.value))))
const shownValues = computed(() => editing.value?.values.filter((item) => !valueKeyword.value || item.includes(valueKeyword.value)) ?? [])

function usedTemplates(id: string) {
  const ids = store.data.templateParams.filter((item) => item.paramId === id).map((item) => item.templateId)
  return store.data.templates.filter((item) => ids.includes(item.id)).map((item) => item.name).join('、') || '未使用'
}
function edit(id: string) {
  editingId.value = id
  nameDraft.value = store.data.params.find((item) => item.id === id)?.name || ''
  open.value = true
}
async function saveName() {
  if (!editing.value) return
  const decision = attributeRenameDecision(store.data, editing.value.id, nameDraft.value)
  if (!decision.ok) {
    ElMessage.warning(decision.message)
    return
  }
  if (decision.needsConfirm) {
    try {
      await ElMessageBox.confirm(decision.message, '编辑全局词典')
    } catch {
      return
    }
  }
  if (!decision.needsConfirm && editing.value.name === nameDraft.value.trim()) { await flushChanges(); return }
  editing.value.name = nameDraft.value.trim()
  if (!await flushChanges()) return
  ElMessage.success('已修改全局属性名称。节点引用和已发布快照没有改写。')
}
function openBrand() {
  edit('p-brand')
}
function openCreate() {
  const id = uid('param')
  store.data.params.push({ id, name: '新参数', values: [], valueGroups: [], participateInStructure: true })
  edit(id)
}
async function flushChanges() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '当前词典修改尚未保存，输入已保留。'); return false }
  return true
}
async function addValue() {
  if (!editing.value || !newValue.value.trim()) return
  if (!editing.value.values.includes(newValue.value.trim())) editing.value.values.push(newValue.value.trim())
  if (!await flushChanges()) return
  newValue.value = ''
}
async function removeValue(value: string) {
  if (!editing.value) return
  const message = store.removeParamValue(editing.value.id, value)
  if (message) ElMessage.warning(message)
  else await flushChanges()
}
async function remove(id: string) {
  const message = store.removeParam(id)
  if (message) ElMessage.warning(message)
  else if (await flushChanges()) ElMessage.success('已删除')
}
</script>
