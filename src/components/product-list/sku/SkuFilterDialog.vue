<template>
  <el-dialog :model-value="modelValue" title="筛选 SKU" width="min(820px, calc(100vw - 24px))" top="6vh" :close-on-click-modal="!applying" :close-on-press-escape="!applying" :show-close="!applying" class="sku-filter-dialog" data-sku-filter-dialog @update:model-value="(value: boolean) => emit('update:modelValue', value)">
    <div class="dialog-body" :inert="applying">
      <p class="context">当前视图：<strong>{{ viewName }}</strong><span v-if="scopeId"> · 限定 SPU：{{ scopeName }}（仅本次浏览）</span></p>
      <p class="muted">编辑期间列表保持不变；应用后可选择保存。日期按 Asia/Shanghai，周一开始。</p>
      <div v-if="draft.legacy && (draft.legacy.keyword || draft.legacy.filters.length)" class="legacy">
        <strong>历史条件（保留原语义）</strong>
        <p v-if="draft.legacy.keyword">已保存搜索：{{ draft.legacy.keyword }}</p>
        <p v-for="condition in draft.legacy.filters" :key="condition.id">{{ legacyText(condition) }}</p>
        <p class="muted">历史条件与下方新条件同时满足。旧创建日期仍指所属 SPU 日期。</p>
        <el-button size="small" @click="clearLegacyFilters">清除历史条件</el-button>
      </div>
      <div class="logic-row"><span>满足以下</span><el-radio-group v-model="draft.conditions.logic"><el-radio-button value="all">全部条件</el-radio-button><el-radio-button value="any">任一条件</el-radio-button></el-radio-group></div>
      <p v-if="!draft.conditions.children.length" class="empty-hint">尚未添加条件，显示范围内的全部 SKU。</p>
      <template v-for="(node, index) in draft.conditions.children" :key="node.id">
        <SkuRuleEditor v-if="node.kind === 'rule'" :rule="node" :fields="fields" @copy="draft.conditions.children.splice(index + 1, 0, { ...copy(node), id: nextId() })" :exposed="isExposed(node.id)" @expose="shown => expose(node.id, shown)" @update="value => draft.conditions.children[index] = value" @remove="draft.conditions.children.splice(index, 1)" />
        <section v-else class="condition-group" :data-condition-group="node.id">
          <div class="group-heading"><strong>条件组 {{ groupNumber(index) }}</strong><el-radio-group v-model="node.logic" size="small"><el-radio-button value="all">全部满足</el-radio-button><el-radio-button value="any">任一满足</el-radio-button></el-radio-group><span class="spacer" /><el-button link @click="copyGroup(node, index)">复制组</el-button><el-button link type="danger" @click="draft.conditions.children.splice(index, 1)">删除组</el-button></div>
          <template v-for="(child, childIndex) in node.children" :key="child.id">
            <SkuRuleEditor v-if="child.kind === 'rule'" :rule="child" :fields="fields" @copy="node.children.splice(childIndex + 1, 0, { ...copy(child), id: nextId() })" :exposed="isExposed(child.id)" @expose="shown => expose(child.id, shown)" @update="value => node.children[childIndex] = value" @remove="node.children.splice(childIndex, 1)" />
            <el-alert v-else type="error" :closable="false" title="条件组层级超出支持范围，请删除此组后重建。" />
          </template>
          <p v-if="!node.children.length" class="group-empty">空条件组不能应用，请添加条件或删除组。</p>
          <el-button size="small" @click="node.children.push(newRule())">组内添加条件</el-button>
        </section>
      </template>
      <div class="add-actions"><el-button data-add-rule @click="draft.conditions.children.push(newRule())">添加条件</el-button><el-button data-add-group @click="addGroup">添加条件组</el-button></div>
      <p v-if="applyError" role="alert" class="validation">{{ applyError }}</p>
      <div v-if="preview.errors.length" class="validation" role="alert"><strong>请先处理配置问题</strong><ul><li v-for="error in preview.errors" :key="error">{{ error }}</li></ul></div>
    </div>
    <template #footer><div class="dialog-footer"><span class="preview" data-sku-preview-count>{{ preview.errors.length ? '配置无效，暂不查询' : `匹配 ${preview.total} 条 SKU` }}</span><el-button :disabled="applying" @click="reset">重置条件</el-button><el-button :disabled="applying" @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :loading="applying" :disabled="preview.errors.length > 0 || applying" data-apply-sku-filter @click="apply">应用筛选</el-button></div></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { repairQuickFilters, setQuickFilter } from '../../../domain/skuQuickFilters'
import { skuFields } from '../../../domain/skuWorkbenchFields'
import { querySkuWorkbench } from '../../../domain/skuWorkbenchQuery'
import type { AppData, ProductListViewFilter } from '../../../domain/types'
import type { SkuCondition, SkuConditionGroup, SkuViewConfig } from '../../../domain/skuWorkbenchTypes'
import SkuRuleEditor from './SkuRuleEditor.vue'

const props = defineProps<{ modelValue: boolean; data: AppData; config: SkuViewConfig; viewName: string; scopeId?: string; now?: Date; applyConfig?: (config: SkuViewConfig) => Promise<{ok: boolean; message?: string}> }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; apply: [config: SkuViewConfig] }>()
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const applying = ref(false), applyError = ref('')
const draft = ref<SkuViewConfig>(copy(props.config))
watch(() => props.modelValue, open => { if (open) draft.value = copy(props.config) })
const fields = computed(() => skuFields(props.data))
const scopeName = computed(() => props.data.families.find(item => item.id === props.scopeId)?.name || props.scopeId)
const preview = computed(() => querySkuWorkbench(props.data, draft.value, { scopeId: props.scopeId, page: 1, pageSize: 1, now: props.now }))
let seq = 0
function nextId() { return `sku-condition-${Date.now().toString(36)}-${++seq}` }
function newRule(): SkuCondition { return { kind: 'rule', id: nextId(), field: 'name', operator: 'contains', value: '' } }
function addGroup() { draft.value.conditions.children.push({ kind: 'group', id: nextId(), logic: 'all', children: [newRule()] }) }
function groupNumber(index: number) { return draft.value.conditions.children.slice(0, index + 1).filter(item => item.kind === 'group').length }
function copyGroup(group: SkuConditionGroup, index: number) {
  const next = copy(group)
  next.id = nextId()
  next.children.forEach(child => { child.id = nextId() })
  draft.value.conditions.children.splice(index + 1, 0, next)
}
function clearLegacyFilters() { if (draft.value.legacy) { draft.value.legacy.keyword = ''; draft.value.legacy.filters = [] } }
function reset() { draft.value.quickFilters = []; draft.value.conditions = { kind: 'group', id: 'root', logic: 'all', children: [] }; clearLegacyFilters() }
function isExposed(id: string) { return draft.value.quickFilters?.some(ref => ref.source === 'condition' && ref.ruleId === id) || false }
function expose(id: string, shown: boolean) { setQuickFilter(draft.value, { source: 'condition', ruleId: id }, shown) }
async function apply() {
  if (preview.value.errors.length || applying.value) return
  draft.value.quickFilters = repairQuickFilters(draft.value)
  applying.value = true; applyError.value = ''
  try {
    if (props.applyConfig) { const result = await props.applyConfig(copy(draft.value)); if (!result.ok) { applyError.value = result.message || '应用失败，请重试。'; return } }
    else emit('apply', copy(draft.value))
    emit('update:modelValue', false)
  } finally { applying.value = false }
}
function legacyText(condition: ProductListViewFilter) {
  const field = fields.value.find(item => item.id === condition.field)
  const labels = { contains: '包含', notContains: '不包含', eq: '等于', neq: '不等于', in: '属于任意一个', before: '早于', after: '晚于', between: '范围' }
  const name = (value: string) => field?.options.find(item => item.value === value)?.label || value
  const value = Array.isArray(condition.value) ? condition.value.map(name).join('、')
    : condition.value && typeof condition.value === 'object' ? `${condition.value.from || '不限'} 至 ${condition.value.to || '不限'}`
      : name(String(condition.value ?? ''))
  return `${field?.label || condition.field} · ${labels[condition.operator]} · ${value}`
}
</script>

<style scoped>
.dialog-body { max-height: calc(82vh - 150px); overflow: auto; padding-right: 5px; }
.context { margin-top: 0; color: var(--el-text-color-regular); }
.logic-row, .add-actions, .group-heading, .dialog-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.logic-row { margin: 18px 0; }
.condition-group, .legacy { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 14px; margin: 12px 0; background: var(--el-fill-color-extra-light); }
.legacy p { margin: 7px 0; overflow-wrap: anywhere; }
.spacer { flex: 1; }
.add-actions { margin: 18px 0 8px; }
.empty-hint, .group-empty { color: var(--el-text-color-secondary); padding: 14px 0; }
.group-empty { color: var(--el-color-danger); }
.preview { margin-right: auto; color: var(--el-text-color-secondary); }
.validation { color: var(--el-color-danger); margin: 16px 0; }
.validation ul { margin: 8px 0; padding-left: 20px; }
.dialog-footer { justify-content: flex-end; }
@media (max-width: 640px) { .condition-group { padding: 10px; } .preview { flex-basis: 100%; text-align: left; } }
</style>
