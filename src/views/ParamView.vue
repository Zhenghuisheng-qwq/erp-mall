<template>
  <div>
    <PageHead title="属性词典" desc="颜色、容量这些取值全局共用。商品里新增的取值也会出现在这里。品牌没有单独的数据库。">
      <el-button type="primary" @click="openCreate" :disabled="!(store.can('product:dictionary:create'))">新建参数</el-button>
      <el-button @click="openBrand">维护品牌</el-button>
    </PageHead>
    <div class="panel">
      <el-input v-model="keyword" placeholder="搜索属性名称、ID 或取值" aria-label="搜索属性词典" clearable style="width: min(320px, 100%); margin-bottom: 12px" />
      <el-table :data="rows">
        <el-table-column prop="name" label="参数" min-width="150" />
        <el-table-column label="属性 ID" width="218">
          <template #default="{ row }"><div class="dictionary-id" :data-param-id="row.id"><el-tooltip :content="row.id" placement="top"><code class="dictionary-id-text" :title="row.id">{{ row.id }}</code></el-tooltip><el-button link size="small" :aria-label="`复制属性 ID ${row.id}`" @click="copyId(row.id)">复制</el-button></div></template>
        </el-table-column>
        <el-table-column label="取值" min-width="280">
          <template #default="{ row }">{{ row.values.join('、') || '-' }}</template>
        </el-table-column>
        <el-table-column label="用在" min-width="160">
          <template #default="{ row }">{{ usedTemplates(row.id) }}</template>
        </el-table-column>
        <el-table-column label="参与旧结构" width="120">
          <template #default="{ row }"><el-switch v-model="row.participateInStructure"  :disabled="!(store.can('product:dictionary:update'))" /></template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row.id)" :disabled="!(store.can('product:dictionary:update'))">编辑</el-button>
            <el-button link type="danger" @click="remove(row.id)" :disabled="!(store.can('product:dictionary:delete'))">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-drawer v-model="open" :title="editing?.name || '参数'" size="min(520px, 96vw)" :close-on-click-modal="!valuesSaving" :close-on-press-escape="!valuesSaving" :show-close="!valuesSaving" :before-close="closeDrawer">
      <div v-if="editing" :inert="valuesSaving" :aria-busy="valuesSaving">
        <div class="dictionary-editor-id"><span>属性 ID（只读）</span><div class="dictionary-id"><code :title="editing.id" data-param-editor-id>{{ editing.id }}</code><el-button link size="small" aria-label="复制当前属性 ID" @click="copyId(editing.id)">复制</el-button></div></div>
        <div class="filters">
          <el-input v-model="nameDraft" placeholder="属性名称" style="width: 220px" />
          <el-button type="primary" @click="saveName" :disabled="!(store.can('product:dictionary:update'))">保存名称</el-button>
        </div>
        <p v-if="renameHint" class="rename-hint">{{ renameHint }}</p>
        <section class="dictionary-batch" aria-label="批量添加词典取值">
          <h3>添加取值</h3><p class="dictionary-hint">一行一个，可粘贴多行。预览会去除空行和重复值，已有取值跳过；确认前不会写入词典或新增模型节点。</p>
          <el-input v-model="valueDraft" type="textarea" :rows="4" placeholder="一行一个取值，例如：&#10;黑色&#10;白色" aria-label="批量取值" :disabled="!store.can('product:dictionary:update')" />
          <p v-if="valueRows.length" class="dictionary-hint" data-value-preview-summary>本次新增 {{ additions.length }} 项 · 已有跳过 {{ valueRows.length - additions.length }} 项<span v-if="duplicateCount"> · 已去重 {{ duplicateCount }} 项</span></p>
          <ul v-if="valueRows.length" class="dictionary-value-preview" aria-label="待添加取值预览"><li v-for="row in valueRows" :key="row.value" :data-preview-value="row.value"><span class="dictionary-preview-text">{{ row.value }}</span><el-tag size="small" :type="row.exists ? 'info' : 'success'">{{ row.exists ? '已有 · 跳过' : '本次新增' }}</el-tag><el-button link size="small" :aria-label="`移除待添加取值 ${row.value}`" @click="removeDraftValue(row.value)">移除</el-button></li></ul>
          <el-alert v-if="valueError" :title="valueError" type="error" :closable="false" data-dictionary-value-error />
          <div class="dictionary-batch-actions"><el-button :disabled="!valueDraft" @click="clearValueDraft">取消本次输入</el-button><el-button type="primary" :loading="valuesSaving" :disabled="!additions.length || !store.can('product:dictionary:update')" @click="confirmValues">确认添加 {{ additions.length }} 项</el-button></div>
        </section>
        <el-input v-model="valueKeyword" placeholder="搜索取值" style="width: min(240px, 100%); margin: 12px 0" />
        <div v-for="value in shownValues" :key="value" class="row-actions" style="margin: 6px 0">
          <span>{{ value }}</span>
          <el-button link type="danger" @click="removeValue(value)" :disabled="!(store.can('product:dictionary:delete'))">删除</el-button>
        </div>
        <h3 style="margin: 16px 0 8px">取值分组</h3>
        <div v-for="group in editing.valueGroups" :key="group.id" class="rule-card">
          <el-input v-model="group.name"  :disabled="!(store.can('product:dictionary:update'))" />
          <el-select v-model="group.values" multiple style="width: 100%; margin-top: 8px" :disabled="!(store.can('product:dictionary:update'))">
            <el-option v-for="value in editing.values" :key="value" :label="value" :value="value" />
          </el-select>
        </div>
        <el-button @click="editing.valueGroups.push({ id: uid('vg'), name: '新分组', values: [] })" :disabled="!(store.can('product:dictionary:update'))">新增分组</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PageHead from '../components/PageHead.vue'
import { attributeRenameDecision } from '../domain/dictionaryGuard'
import { parseDictionaryValueLines } from '../domain/modelDictionaryCommands'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
let alive = true
onBeforeUnmount(() => { alive = false })
const keyword = ref('')
const nameDraft = ref('')
const valueKeyword = ref('')
const valueDraft = ref(''), valueError = ref(''), valuesSaving = ref(false)
const open = ref(false)
const editingId = ref('p-brand')
const editing = computed(() => store.data.params.find((item) => item.id === editingId.value))
const renameHint = computed(() => (editing.value ? attributeRenameDecision(store.data, editing.value.id, nameDraft.value.trim() || `${editing.value.name}新名`).message : ''))
watch(() => editing.value?.id, () => {
  nameDraft.value = editing.value?.name || ''
}, { immediate: true })
const rows = computed(() => { const term = keyword.value.trim().toLocaleLowerCase(); return store.data.params.filter((item) => !term || [item.name, item.id, ...item.values].some(value => value.toLocaleLowerCase().includes(term))) })
const shownValues = computed(() => editing.value?.values.filter((item) => !valueKeyword.value || item.includes(valueKeyword.value)) ?? [])
const valueRows = computed(() => { const existing = new Set(editing.value?.values || []); return parseDictionaryValueLines(valueDraft.value).map(value => ({ value, exists: existing.has(value) })) })
const additions = computed(() => valueRows.value.filter(row => !row.exists).map(row => row.value))
const duplicateCount = computed(() => valueDraft.value.split(/\r\n|\r|\n/).filter(line => line.trim()).length - valueRows.value.length)

function usedTemplates(id: string) {
  const ids = store.data.templateParams.filter((item) => item.paramId === id).map((item) => item.templateId)
  return store.data.templates.filter((item) => ids.includes(item.id)).map((item) => item.name).join('、') || '未使用'
}
function edit(id: string) {
  if (valuesSaving.value) return
  if (editingId.value !== id || !open.value) clearValueDraft()
  editingId.value = id
  nameDraft.value = store.data.params.find((item) => item.id === id)?.name || ''
  open.value = true
}
async function copyId(id: string) {
  try { await navigator.clipboard.writeText(id); ElMessage.success('已复制完整属性 ID') }
  catch { ElMessage.info('无法自动复制，请选择属性 ID 手动复制') }
}
function closeDrawer(done: () => void) { if (!valuesSaving.value) done() }
function clearValueDraft() { valueDraft.value = ''; valueError.value = '' }
function removeDraftValue(value: string) { valueDraft.value = valueDraft.value.split(/\r\n|\r|\n/).filter(line => line.trim() !== value).join('\n'); valueError.value = '' }
async function confirmValues() {
  if (valuesSaving.value) return
  const ownerId = editingId.value, input = valueDraft.value, values = [...additions.value]
  if (!alive || !open.value || !editing.value || editing.value.id !== ownerId || !values.length) return
  if (!store.can('product:dictionary:update')) { valueError.value = '没有添加词典取值的权限，当前输入已保留。'; return }
  valuesSaving.value = true; valueError.value = ''
  try {
    const result = await store.appendDictionaryValues(ownerId, values, () => alive && open.value && editingId.value === ownerId)
    if (!result.ok) { valueError.value = result.message || '取值尚未保存，当前输入已保留，可重试。'; return }
    if (editingId.value === ownerId && valueDraft.value === input) clearValueDraft()
    ElMessage.success(`已保存 ${result.addedValues.length} 个新取值${result.existingValues.length ? `，${result.existingValues.length} 个已有取值已跳过` : ''}`)
  } catch (cause) { valueError.value = cause instanceof Error ? cause.message : '取值保存失败，当前输入已保留，可重试。' }
  finally { valuesSaving.value = false }
}
async function saveName() {
  if (valuesSaving.value) return
  if (!(store.can('product:dictionary:update'))) return
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
  if (valuesSaving.value) return
  if (!(store.can('product:dictionary:create'))) return
  const id = uid('param')
  store.data.params.push({ id, name: '新参数', values: [], valueGroups: [], participateInStructure: true })
  edit(id)
}
async function flushChanges() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '当前词典修改尚未保存，输入已保留。'); return false }
  return true
}
async function removeValue(value: string) {
  if (valuesSaving.value) return
  if (!(store.can('product:dictionary:delete'))) return
  if (!editing.value) return
  const message = store.removeParamValue(editing.value.id, value)
  if (message) ElMessage.warning(message)
  else await flushChanges()
}
async function remove(id: string) {
  if (valuesSaving.value) return
  if (!(store.can('product:dictionary:delete'))) return
  const message = store.removeParam(id)
  if (message) ElMessage.warning(message)
  else if (await flushChanges()) ElMessage.success('已删除')
}
</script>
<style scoped>
.dictionary-id{display:flex;align-items:center;gap:8px;min-width:0}.dictionary-id .el-button{flex:none;margin-left:0}.dictionary-id-text{display:block;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--el-text-color-secondary)}
.dictionary-editor-id{margin-bottom:16px;font-size:13px;color:var(--el-text-color-secondary)}.dictionary-editor-id .dictionary-id{margin-top:5px}.dictionary-editor-id code{flex:1;min-width:0;overflow-wrap:anywhere;color:var(--el-text-color-primary);font-size:13px}
.dictionary-batch{margin:18px 0 6px;padding:14px 0;border-top:1px solid var(--el-border-color-lighter);border-bottom:1px solid var(--el-border-color-lighter)}.dictionary-batch h3{font-size:15px;margin:0 0 8px}.dictionary-hint{font-size:12px;line-height:1.7;color:var(--el-text-color-secondary);margin:8px 0}.dictionary-value-preview{list-style:none;margin:10px 0;padding:0;max-height:240px;overflow:auto}.dictionary-value-preview li{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--el-border-color-extra-light)}.dictionary-preview-text{flex:1;min-width:0;overflow-wrap:anywhere}.dictionary-value-preview .el-button,.dictionary-value-preview .el-tag{flex:none}.dictionary-batch-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px}.dictionary-batch-actions .el-button{margin-left:0}
</style>
