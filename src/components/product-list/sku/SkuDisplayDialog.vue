<template>
  <el-dialog :model-value="modelValue" title="SKU 展示配置" width="min(800px, calc(100vw - 24px))" top="6vh" data-sku-display-dialog @update:model-value="(value: boolean) => emit('update:modelValue', value)">
    <div class="display-body">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="字段" name="fields">
          <p class="muted">仅调整展示，不修改商品属性。至少保留 SKU 编号或名称；窄窗口暂不冻结列。</p>
          <el-input v-model="search" placeholder="搜索字段名称或来源" clearable aria-label="搜索字段" />
          <div class="section-heading"><strong>已配置字段</strong><el-button link @click="restoreColumns">恢复默认字段</el-button></div>
          <div class="column-header"><span></span><span>显示字段</span><span>宽度 / 自动</span><span>冻结</span><span>顺序</span></div>
          <div v-for="column in matchingColumns" :key="column.key" class="column-row" :data-sku-column="column.key" :class="{ 'drop-before': drop?.key === column.key && drop.place === 'before', 'drop-after': drop?.key === column.key && drop.place === 'after' }" @dragover.prevent="overColumn(column.key, $event)" @drop.prevent="dropColumn(column.key, $event)">
            <button class="column-grip" type="button" draggable="true" :aria-label="`拖动${labelOf(column.key)}`" @dragstart="startColumn(column.key, $event)" @dragend="cancelDrag">⋮⋮</button>
            <el-checkbox v-model="column.visible" :disabled="lastIdentity(column)">{{ labelOf(column.key) }}<small>{{ sourceOf(column.key) }}</small></el-checkbox>
            <div class="width-control"><el-input-number v-model="column.width" :min="80" :max="600" :step="10" controls-position="right" :aria-label="`${labelOf(column.key)}列宽`" /><el-button link :aria-label="`自动适应${labelOf(column.key)}列宽`" @click="autoWidth(column)">自动</el-button></div>
            <el-select :model-value="column.frozen || 'none'" :aria-label="`${labelOf(column.key)}冻结`" @change="(value: string) => setFrozen(column, value)"><el-option value="none" label="不冻结" /><el-option value="left" label="左侧" :disabled="!column.frozen && frozenCount >= 2" /><el-option value="right" label="右侧" :disabled="!column.frozen && frozenCount >= 2" /></el-select>
            <div class="move-actions"><el-button :disabled="columnIndex(column.key) === 0" :aria-label="`上移${labelOf(column.key)}`" @click="moveColumn(column.key, -1)">↑</el-button><el-button :disabled="columnIndex(column.key) === draft.columns.length - 1" :aria-label="`下移${labelOf(column.key)}`" @click="moveColumn(column.key, 1)">↓</el-button></div>
          </div>
          <p v-if="!matchingColumns.length" class="muted">没有匹配的已配置字段。</p>
          <div class="section-heading"><strong>可添加字段</strong></div>
          <div class="available-fields"><el-button v-for="field in availableFields" :key="field.id" :data-add-column="field.id" @click="addColumn(field.id)">{{ field.label }}<small> · {{ field.source }}</small></el-button></div>
          <p v-if="!availableFields.length" class="muted">没有其他匹配字段。</p>
          <p class="muted">冻结最多两列。使用上下按钮调整顺序，无需拖拽。</p>
        </el-tab-pane>
        <el-tab-pane label="排序" name="sort">
          <p class="muted">最多三项，按从上到下的优先级比较。新排序空值始终置后，同值保留稳定后备顺序。</p>
          <el-radio-group v-model="draft.sortMode"><el-radio-button value="default">默认顺序</el-radio-button><el-radio-button value="field">字段排序</el-radio-button><el-radio-button value="manual">手工排序</el-radio-button></el-radio-group>
          <div v-for="(order, index) in draft.sorts" :key="index" class="order-row" :data-sort-priority="index">
            <span>{{ index + 1 }}</span><el-select v-model="order.field" filterable placeholder="排序字段" aria-label="排序字段"><el-option v-for="field in sortableFields" :key="field.id" :value="field.id" :label="`${field.label} · ${field.source}`" :disabled="draft.sorts.some((item, other) => other !== index && item.field === field.id)" /></el-select>
            <el-select v-model="order.direction" aria-label="排序方向"><el-option value="asc" label="升序" /><el-option value="desc" label="降序" /></el-select>
            <div class="move-actions"><el-button :disabled="index === 0" :aria-label="`提高第${index + 1}项排序优先级`" @click="moveOrder(draft.sorts, index, -1)">↑</el-button><el-button :disabled="index === draft.sorts.length - 1" :aria-label="`降低第${index + 1}项排序优先级`" @click="moveOrder(draft.sorts, index, 1)">↓</el-button></div><el-button link type="danger" @click="draft.sorts.splice(index, 1)">删除</el-button>
          </div>
          <el-button :disabled="draft.sorts.length >= 3" @click="addSort">添加排序</el-button>
          <p v-if="draft.sortMode !== 'field' && draft.sorts.length" class="muted">上面的字段规则已保留；切换为“字段排序”后生效。</p>
          <div v-if="draft.legacy?.sorting" class="legacy-note">此历史视图保留原单级排序语义。<el-button link @click="useNewSorting">使用新的多级排序规则</el-button></div>
        </el-tab-pane>
        <el-tab-pane label="更多" name="more">
          <div class="section-heading"><strong>分组</strong></div>
          <p class="muted">最多两层。组数使用全部匹配结果统计，分页只决定当前展示的记录。</p>
          <div v-for="(order, index) in draft.groups" :key="index" class="order-row" :data-group-priority="index">
            <span>{{ index + 1 }}</span><el-select v-model="order.field" filterable placeholder="分组字段" aria-label="分组字段"><el-option v-for="field in groupableFields" :key="field.id" :value="field.id" :label="`${field.label} · ${field.source}`" :disabled="draft.groups.some((item, other) => other !== index && item.field === field.id)" /></el-select>
            <el-select v-model="order.direction" aria-label="分组方向"><el-option value="asc" label="升序" /><el-option value="desc" label="降序" /></el-select>
            <div class="move-actions"><el-button :disabled="index === 0" aria-label="提高分组层级" @click="moveOrder(draft.groups, index, -1)">↑</el-button><el-button :disabled="index === draft.groups.length - 1" aria-label="降低分组层级" @click="moveOrder(draft.groups, index, 1)">↓</el-button></div><el-button link type="danger" @click="draft.groups.splice(index, 1)">删除</el-button>
          </div>
          <el-button :disabled="draft.groups.length >= 2" @click="addGroup">添加分组</el-button>
          <div v-if="draft.sortMode === 'manual' && (draft.groups.length || draft.sorts.length)" class="conflict" role="alert">手工顺序仍保留；已有分组或字段排序时不能按手工顺序排列。<el-button link @click="draft.groups = []; draft.sorts = []">清除分组和字段排序，使用手工顺序</el-button></div>
          <div class="section-heading"><strong>显示密度</strong></div>
          <el-radio-group v-model="draft.density"><el-radio-button value="comfortable">舒适</el-radio-button><el-radio-button value="compact">紧凑</el-radio-button></el-radio-group>
          <div class="section-heading"><strong>分类面板</strong></div>
          <el-radio-group v-model="draft.categoryLayout"><el-radio-button value="popover">按需打开</el-radio-button><el-radio-button value="sidebar">常驻分类栏</el-radio-button></el-radio-group>
        </el-tab-pane>
      </el-tabs>
      <div v-if="errors.length" class="errors" role="alert"><ul><li v-for="error in errors" :key="error">{{ error }}</li></ul></div>
    </div>
    <template #footer><div class="footer"><span class="muted">应用到当前工作配置，保存视图后才成为正式配置。</span><el-button @click="emit('update:modelValue', false)">取消</el-button><el-button type="primary" :disabled="errors.length > 0" data-apply-sku-display @click="apply">应用配置</el-button></div></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { reorderSkuColumn } from '../../../domain/skuColumnOrder'
import { skuFields, skuFieldValue } from '../../../domain/skuWorkbenchFields'
import { defaultSkuConfig } from '../../../domain/skuWorkbenchState'
import { isRealSku } from '../../../domain/catalogIdentity'
import type { AppData } from '../../../domain/types'
import type { SkuColumn, SkuOrder, SkuViewConfig } from '../../../domain/skuWorkbenchTypes'

const props = defineProps<{ modelValue: boolean; data: AppData; config: SkuViewConfig; tab?: 'fields' | 'sort' | 'more' }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; apply: [config: SkuViewConfig] }>()
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const draft = ref(copy(props.config))
const activeTab = ref(props.tab || 'fields')
const search = ref('')
watch(() => props.modelValue, open => { if (open) { draft.value = copy(props.config); activeTab.value = props.tab || 'fields'; search.value = '' } })
const dragging = ref(''), drop = ref<{key:string;place:'before'|'after'} | null>(null)
function cancelDrag() { dragging.value = ''; drop.value = null }
function startColumn(key: string, event: DragEvent) {
  dragging.value = key
  event.dataTransfer?.setData('application/x-sku-column', key)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function overColumn(key: string, event: DragEvent) {
  if (!dragging.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  drop.value = {key, place: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'}
}
function dropColumn(key: string, event: DragEvent) {
  if (drop.value?.key === key && event.dataTransfer?.getData('application/x-sku-column') === dragging.value)
    draft.value.columns = reorderSkuColumn(draft.value.columns, dragging.value, key, drop.value.place)
  cancelDrag()
}
function escapeDrag(event: KeyboardEvent) {
  if (event.key === 'Escape' && dragging.value) { cancelDrag(); event.preventDefault(); event.stopImmediatePropagation() }
}
watch(() => props.modelValue, cancelDrag)
watch(search, cancelDrag)
onMounted(() => document.addEventListener('keydown', escapeDrag, true))
onBeforeUnmount(() => document.removeEventListener('keydown', escapeDrag, true))
const fields = computed(() => skuFields(props.data))
const sortableFields = computed(() => fields.value.filter(field => field.sortable))
const groupableFields = computed(() => fields.value.filter(field => field.groupable))
function labelOf(id: string) { return fields.value.find(field => field.id === id)?.label || `失效字段：${id}` }
function sourceOf(id: string) { return fields.value.find(field => field.id === id)?.source || '' }
function matches(id: string) { return `${labelOf(id)} ${sourceOf(id)}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()) }
const matchingColumns = computed(() => draft.value.columns.filter(column => matches(column.key)))
const availableFields = computed(() => fields.value.filter(field => !draft.value.columns.some(column => column.key === field.id) && matches(field.id)))
const frozenCount = computed(() => draft.value.columns.filter(column => column.visible && column.frozen).length)
const errors = computed(() => {
  const result: string[] = []
  if (!draft.value.columns.some(column => column.visible && ['code', 'name'].includes(column.key))) result.push('至少显示 SKU 编号或 SKU 名称。')
  if (frozenCount.value > 2) result.push('最多冻结两列，请减少冻结字段。')
  if (draft.value.columns.some(column => column.width !== undefined && (!Number.isFinite(column.width) || column.width < 80 || column.width > 600))) result.push('列宽应在 80–600 像素之间。')
  for (const [name, orders, allowed, limit] of [
    ['排序', draft.value.sorts, sortableFields.value, 3], ['分组', draft.value.groups, groupableFields.value, 2],
  ] as const) {
    if (orders.length > limit) result.push(`${name}最多 ${limit} 项。`)
    if (new Set(orders.map(order => order.field)).size !== orders.length) result.push(`${name}字段不能重复。`)
    if (orders.some(order => !allowed.some(field => field.id === order.field))) result.push(`请选择有效的${name}字段。`)
  }
  if (draft.value.sortMode === 'field' && !draft.value.sorts.length && !draft.value.legacy?.sorting) result.push('请添加至少一项字段排序。')
  return result
})
function lastIdentity(column: SkuColumn) { return column.visible && ['code', 'name'].includes(column.key) && draft.value.columns.filter(item => item.visible && ['code', 'name'].includes(item.key)).length === 1 }
function columnIndex(key: string) { return draft.value.columns.findIndex(column => column.key === key) }
function moveColumn(key: string, delta: number) { const index = columnIndex(key); const target = index + delta; if (index < 0 || target < 0 || target >= draft.value.columns.length) return; const [column] = draft.value.columns.splice(index, 1); if (column) draft.value.columns.splice(target, 0, column) }
function addColumn(key: string) { draft.value.columns.push({ key, visible: true }) }
function restoreColumns() { draft.value.columns = copy(defaultSkuConfig().columns) }
function setFrozen(column: SkuColumn, value: string) { column.frozen = value === 'left' || value === 'right' ? value : false }
function autoWidth(column: SkuColumn) {
  const field = fields.value.find(item => item.id === column.key)
  let width = labelOf(column.key).length * 15 + 45
  for (const sku of props.data.skus.filter(item => isRealSku(props.data, item)).slice(0, 200)) {
    const family = props.data.families.find(item => item.id === sku.familyId)
    if (!family) continue
    const raw = skuFieldValue(props.data, sku, family, column.key).value
    const rendered = field?.options.find(item => item.value === raw)?.label || (Array.isArray(raw) ? raw.join('、') : String(raw ?? ''))
    width = Math.max(width, Math.min(rendered.length, 36) * 13 + 36)
  }
  column.width = Math.max(80, Math.min(520, Math.ceil(width / 10) * 10))
}
function moveOrder(orders: SkuOrder[], index: number, delta: number) { const target = index + delta; if (target < 0 || target >= orders.length) return; const [order] = orders.splice(index, 1); if (order) orders.splice(target, 0, order) }
function addSort() { const field = sortableFields.value.find(item => !draft.value.sorts.some(order => order.field === item.id)); if (field && draft.value.sorts.length < 3) { draft.value.sorts.push({ field: field.id, direction: 'asc' }); draft.value.sortMode = 'field' } }
function addGroup() { const field = groupableFields.value.find(item => !draft.value.groups.some(order => order.field === item.id)); if (field && draft.value.groups.length < 2) draft.value.groups.push({ field: field.id, direction: 'asc' }) }
function useNewSorting() { if (draft.value.legacy) { draft.value.legacy.sorting = null; draft.value.legacy.sortMode = 'default' }; draft.value.sortMode = 'field'; if (!draft.value.sorts.length) addSort() }
function apply() { if (errors.value.length) return; emit('apply', copy(draft.value)); emit('update:modelValue', false) }
</script>

<style scoped>
.display-body { max-height: calc(82vh - 150px); overflow: auto; padding-right: 5px; }
.section-heading { display: flex; justify-content: space-between; align-items: center; margin: 22px 0 12px; gap: 10px; }
.column-row, .column-header { display: grid; grid-template-columns: 24px minmax(150px, 1fr) 170px 100px 78px; gap: 12px; align-items: center; padding: 9px 0; }
.column-grip{cursor:grab;border:0;background:none;color:var(--el-text-color-secondary);padding:4px}.column-row.drop-before{box-shadow:inset 0 3px var(--el-color-primary)}.column-row.drop-after{box-shadow:inset 0 -3px var(--el-color-primary)}
.column-row { border-bottom: 1px solid var(--el-border-color-lighter); }
.column-header { color: var(--el-text-color-secondary); font-size: 12px; }
.column-row small { display: block; color: var(--el-text-color-secondary); font-size: 11px; }
.width-control, .move-actions, .footer, .order-row { display: flex; align-items: center; gap: 6px; }
.width-control .el-input-number { width: 116px; }
.move-actions .el-button { padding: 6px; margin: 0; min-width: 32px; }
.available-fields { display: flex; flex-wrap: wrap; gap: 8px; }
.available-fields .el-button { margin: 0; }
.available-fields small { color: var(--el-text-color-secondary); }
.order-row { margin: 14px 0; }
.order-row > .el-select:nth-child(2) { flex: 1; min-width: 120px; }
.order-row > .el-select:nth-child(3) { width: 90px; }
.footer { justify-content: flex-end; flex-wrap: wrap; }
.footer > span { margin-right: auto; text-align: left; font-size: 12px; }
.errors, .conflict { color: var(--el-color-danger); margin: 16px 0; }
.conflict, .legacy-note { padding: 12px; border-radius: 6px; background: var(--el-fill-color-light); }
.legacy-note { margin-top: 16px; }
@media (max-width: 640px) { .column-header { display: none; } .column-row { grid-template-columns: 24px minmax(130px, 1fr) 170px; gap: 8px; } .column-row > .el-select { max-width: 140px; } .order-row { flex-wrap: wrap; } .footer > span { flex-basis: 100%; } }
</style>
