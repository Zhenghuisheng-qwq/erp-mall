<template>
  <section v-if="entries.length" class="quick-filters" aria-label="常用筛选" data-quick-filters>
    <div class="quick-title"><strong>常用筛选</strong><el-button v-if="entries.length > 4" link @click="expanded = !expanded">{{ expanded ? '收起' : `展开全部 ${entries.length} 项` }}</el-button></div>
    <div class="quick-grid">
      <article v-for="(entry, index) in entries" v-show="expanded || index < 4" :key="entry.key" :data-quick-key="entry.key" class="quick-item" @keydown.esc.stop.prevent="reset(entry.key)">
        <header><span>{{ entry.field?.label || entry.rule?.field || '历史条件' }} · {{ operatorLabel(entry) }}</span><el-button link :disabled="busy || index === 0" :aria-label="`前移常用筛选 ${index + 1}`" @click="move(entry.key, -1)">↑</el-button><el-button link :disabled="busy || index === entries.length - 1" :aria-label="`后移常用筛选 ${index + 1}`" @click="move(entry.key, 1)">↓</el-button><el-button link :disabled="busy" @click="hide(entry.key)">隐藏</el-button></header>
        <small>{{ entry.context }}</small>
        <template v-if="entry.rule && entry.field">
          <span v-if="['empty', 'notEmpty'].includes(entry.rule.operator)">无需填写取值 <el-button link @click="emit('edit')">编辑条件</el-button></span>
          <el-select v-else-if="entry.rule.operator === 'relative'" :model-value="draft(entry).value" aria-label="常用相对日期" @change="(value: SkuValue) => choose(entry, value)"><el-option v-for="(label, value) in relative" :key="value" :value="value" :label="label" /></el-select>
          <div v-else-if="entry.rule.operator === 'between'" class="range" @focusout="rangeBlur(entry, $event)">
            <el-input :model-value="range(entry).from" :placeholder="entry.field.type === 'date' ? '开始 YYYY-MM-DD' : '最小值'" aria-label="常用范围开始" @update:model-value="(value: string) => changeRange(entry, 'from', value)" @keydown.enter.prevent="commitOne(entry)" />
            <span>至</span><el-input :model-value="range(entry).to" :placeholder="entry.field.type === 'date' ? '结束 YYYY-MM-DD' : '最大值'" aria-label="常用范围结束" @update:model-value="(value: string) => changeRange(entry, 'to', value)" @keydown.enter.prevent="commitOne(entry)" />
          </div>
          <el-select v-else-if="['enum', 'multi', 'spu', 'category', 'boolean'].includes(entry.field.type)" :model-value="draft(entry).value" :multiple="isMulti(entry)" filterable collapse-tags clearable aria-label="常用条件取值" @change="(value: SkuValue) => choose(entry, value)">
            <el-option v-for="option in entry.field.type === 'boolean' ? [{value: true, label: '是'}, {value: false, label: '否'}] : entry.field.options" :key="String(option.value)" :value="option.value" :label="option.label" />
          </el-select>
          <el-input v-else :model-value="draft(entry).value" :placeholder="entry.field.type === 'date' ? 'YYYY-MM-DD' : '输入取值'" aria-label="常用条件取值" @update:model-value="(value: string) => change(entry, value)" @compositionstart="composing.add(entry.key)" @compositionend="composing.delete(entry.key)" @keydown.enter="enter(entry, $event)" @blur="commitOne(entry)" />
        </template>
        <div v-else>{{ entry.ref.source === 'condition' ? '字段已失效，原条件保留，请进入高级筛选修复。' : '此历史条件保留原查询，请进入高级筛选维护。' }}<el-button link @click="emit('edit')">高级筛选</el-button></div>
        <p v-if="errors[entry.key]" role="alert">{{ errors[entry.key] }}</p>
        <el-button v-if="drafts[entry.key] && !busy" link @click="commitOne(entry)">应用输入</el-button>
      </article>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { AppData } from '../../../domain/types'
import type { SkuCondition, SkuField, SkuQuickFilterRef, SkuValue, SkuViewConfig } from '../../../domain/skuWorkbenchTypes'
import { cloneSku, defaultSkuConfig } from '../../../domain/skuWorkbenchState'
import { conditionEntries, quickFilterKey, repairQuickFilters } from '../../../domain/skuQuickFilters'
import { skuFields, skuOperators } from '../../../domain/skuWorkbenchFields'
import { validateSkuConfig } from '../../../domain/skuWorkbenchQuery'
const props = defineProps<{ data: AppData; config: SkuViewConfig; apply: (config: SkuViewConfig) => Promise<{ok: boolean; message?: string}>; busy: boolean }>()
const emit = defineEmits<{ edit: [] }>()
type Entry = { key: string; ref: SkuQuickFilterRef; rule?: SkuCondition; field?: SkuField; context: string }
const expanded = ref(false), drafts = reactive<Record<string, SkuCondition>>({}), errors = reactive<Record<string, string>>({})
const composing = reactive(new Set<string>())
const relative = { today: '今天', yesterday: '昨天', week: '本周', month: '本月', last7: '近 7 天', last30: '近 30 天' }
const entries = computed<Entry[]>(() => {
  const fields = skuFields(props.data), rules = conditionEntries(props.config.conditions)
  return repairQuickFilters(props.config).map(ref => {
    if (ref.source === 'condition') {
      const found = rules.find(item => item.rule.id === ref.ruleId)
      return { ref, key: quickFilterKey(ref), rule: found?.rule, field: fields.find(field => field.id === found?.rule.field), context: found?.context || '条件失效' }
    }
    const old = props.config.legacy?.filters.find(item => item.id === ref.filterId)
    const fieldId = old?.field === 'created' ? 'legacy.created' : old?.field === 'family' ? 'familyId' : old?.field
    const field = fields.find(item => item.id === fieldId)
    const safe = old && field && skuOperators(field.type).some(item => item.value === old.operator)
    const rule = safe ? { kind: 'rule' as const, id: old.id, field: field.id, operator: old.operator, value: cloneSku(old.value) as SkuValue } : undefined
    return { ref, key: quickFilterKey(ref), rule, field, context: '历史条件 · 与新条件同时满足（日期沿用 SPU 日期）' }
  })
})
function draft(entry: Entry) { return drafts[entry.key] || entry.rule! }
function range(entry: Entry) { const value = draft(entry).value; return value && typeof value === 'object' && !Array.isArray(value) ? value : {from: '', to: ''} }
function isMulti(entry: Entry) { return ['in', 'notIn', 'hasAny', 'hasAll'].includes(entry.rule!.operator) }
function operatorLabel(entry: Entry) { return skuOperators(entry.field?.type || 'text').find(item => item.value === entry.rule?.operator)?.label || '原语义' }
function change(entry: Entry, value: SkuValue) { drafts[entry.key] = { ...cloneSku(draft(entry)), value }; delete errors[entry.key] }
function changeRange(entry: Entry, key: 'from' | 'to', value: string) { change(entry, { ...range(entry), [key]: value }) }
function reset(key: string) { delete drafts[key]; delete errors[key]; composing.delete(key) }
function enter(entry: Entry, event: KeyboardEvent) { if (!event.isComposing && !composing.has(entry.key)) { event.preventDefault(); void commitOne(entry) } }
function rangeBlur(entry: Entry, event: FocusEvent) { if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) void commitOne(entry) }
async function choose(entry: Entry, value: SkuValue) { change(entry, value); await commitOne(entry) }
let running: Promise<boolean> | undefined
async function commitEntries(selected: Entry[]): Promise<boolean> {
  if (running) { await running; return commitEntries(selected) }
  if (props.busy) return false
  if (composing.size) { for (const key of composing) errors[key] = '请完成中文输入后再应用。'; return false }
  const next = cloneSku(props.config), applied: string[] = []
  for (const entry of selected) {
    const input = drafts[entry.key]
    if (!input) continue
    if (composing.has(entry.key)) { errors[entry.key] = '请完成中文输入后再应用。'; return false }
    const rule = cloneSku(input)
    if (entry.field?.type === 'number' && rule.operator !== 'between') rule.value = typeof rule.value === 'string' && rule.value.trim() ? Number(rule.value) : rule.value
    const sample = defaultSkuConfig(); sample.conditions.children = [rule]
    const messages = validateSkuConfig(props.data, sample)
    if (messages.length) { errors[entry.key] = messages.join('；'); return false }
    if (entry.ref.source === 'condition') {
      const target = conditionEntries(next.conditions).find(item => item.rule.id === rule.id)?.rule
      if (!target) return false
      target.value = rule.value
    } else {
      const id = entry.ref.filterId, target = next.legacy?.filters.find(item => item.id === id)
      if (!target) return false
      target.value = rule.value as typeof target.value
    }
    applied.push(entry.key)
  }
  if (!applied.length) return true
  running = (async () => {
    let outcome: {ok: boolean; message?: string}
    try { outcome = await props.apply(next) } catch (error) { outcome = {ok: false, message: error instanceof Error ? error.message : '应用失败，请重试。'} }
    if (!outcome.ok) { for (const key of applied) errors[key] = outcome.message || '保存失败，请重试。'; return false }
    for (const key of applied) reset(key)
    return true
  })()
  try { return await running } finally { running = undefined }
}
function commitOne(entry: Entry) { return commitEntries([entry]) }
function flush() { return commitEntries(entries.value) }
async function hide(key: string) {
  if (!(await flush())) return
  const next = cloneSku(props.config); next.quickFilters = repairQuickFilters(next).filter(ref => quickFilterKey(ref) !== key)
  const result = await props.apply(next); if (!result.ok) errors[key] = result.message || '保存失败，请重试。'
}
async function move(key: string, delta: number) {
  if (!(await flush())) return
  const next = cloneSku(props.config), refs = repairQuickFilters(next), index = refs.findIndex(ref => quickFilterKey(ref) === key), target = index + delta
  if (index < 0 || target < 0 || target >= refs.length) return
  const [ref] = refs.splice(index, 1); refs.splice(target, 0, ref!); next.quickFilters = refs
  const result = await props.apply(next); if (!result.ok) errors[key] = result.message || '保存失败，请重试。'
}
defineExpose({ flush })
</script>
<style scoped>
.quick-filters { margin-top: 12px; padding: 10px 0; border-block: 1px solid var(--el-border-color-lighter); }
.quick-title,.quick-item header { display:flex; align-items:center; gap:6px; }
.quick-title { margin-bottom:8px; }.quick-title strong { font-size:13px; }
.quick-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(245px,1fr)); gap:10px; }
.quick-item { min-width:0; }.quick-item header { font-size:12px; }.quick-item header span { flex:1; overflow-wrap:anywhere; }
.quick-item small { display:block; color:var(--el-text-color-secondary); margin:3px 0 6px; }.quick-item p { color:var(--el-color-danger); margin:4px 0; font-size:12px; }
.range { display:flex; align-items:center; gap:5px; }.range .el-input { min-width:0; }.quick-item .el-select { width:100%; }
@media(max-width:640px) { .quick-grid { grid-template-columns:minmax(0,1fr); } }
</style>
