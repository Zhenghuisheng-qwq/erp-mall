<template>
  <div class="rule" :data-rule-id="rule.id" :data-rule-active="rule.active!==false">
    <el-select :model-value="rule.field" filterable placeholder="选择字段" aria-label="条件字段" data-rule-field @change="changeField">
      <el-option-group v-for="group in fieldGroups" :key="group.source" :label="group.source">
        <el-option v-for="field in group.fields" :key="field.id" :value="field.id" :label="`${field.label} · ${field.source}`" />
      </el-option-group>
      <el-option v-if="!field && rule.field" :value="rule.field" :label="`失效字段：${rule.field}`" disabled />
    </el-select>
    <el-select :model-value="rule.operator" placeholder="操作符" aria-label="条件操作符" data-rule-operator @change="changeOperator">
      <el-option v-for="item in operators" :key="item.value" :value="item.value" :label="item.label" />
    </el-select>
    <span v-if="noValue" class="value-placeholder">无需填写值</span>
    <el-select v-else-if="rule.operator === 'relative'" :model-value="textValue" placeholder="选择相对日期" aria-label="相对日期" @change="(value: string) => setValue(value)">
      <el-option v-for="item in relativeOptions" :key="item.value" :value="item.value" :label="item.label" />
    </el-select>
    <el-date-picker v-else-if="field?.type === 'date' && rule.operator === 'between'" :model-value="rangeDates" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" unlink-panels @update:model-value="dateRange" />
    <el-date-picker v-else-if="field?.type === 'date'" :model-value="textValue" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" @update:model-value="(value: string | null) => setValue(value || '')" />
    <div v-else-if="field?.type === 'number' && rule.operator === 'between'" class="number-range">
      <el-input :model-value="rangeValue.from" type="number" placeholder="最小值" @update:model-value="(value: string) => updateRange('from', value)" />
      <span>至</span><el-input :model-value="rangeValue.to" type="number" placeholder="最大值" @update:model-value="(value: string) => updateRange('to', value)" />
    </div>
    <el-input-number v-else-if="field?.type === 'number'" :model-value="numberValue" controls-position="right" aria-label="条件数值" @update:model-value="(value: number | undefined) => setValue(value ?? null)" />
    <el-select v-else-if="field?.type === 'boolean'" :model-value="booleanValue" placeholder="选择是或否" aria-label="布尔值" @change="(value: boolean) => setValue(value)">
      <el-option :value="true" label="是" /><el-option :value="false" label="否" />
    </el-select>
    <el-select v-else-if="choiceField" :model-value="multiple ? arrayValue : textValue" :multiple="multiple" filterable clearable collapse-tags placeholder="选择取值" aria-label="条件取值" data-rule-value @change="(value: string | string[]) => setValue(value)">
      <el-option v-for="item in field?.options || []" :key="item.value" :value="item.value" :label="item.label" />
    </el-select>
    <el-input v-else :model-value="textValue" placeholder="填写条件值" aria-label="条件取值" data-rule-value @update:model-value="(value: string) => setValue(value)" />
    <el-button link aria-label="复制条件" @click="emit('copy')">复制</el-button>
    <el-button link type="danger" aria-label="删除条件" @click="emit('remove')">删除</el-button>
    <el-checkbox v-if="exposed !== undefined" :model-value="exposed" class="expose" @change="(value: boolean | string | number) => emit('expose', Boolean(value))">显示在常用筛选</el-checkbox>
    <el-checkbox :model-value="rule.active!==false" class="expose" @change="(value:boolean|string|number)=>emit('update',{...rule,active:Boolean(value)})">启用此条件<span v-if="rule.active===false">（未设置，不参与匹配）</span></el-checkbox>
    <p v-if="!field" class="invalid">该字段已失效，请更换或删除条件。</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { skuOperators } from '../../../domain/skuWorkbenchFields'
import type { SkuCondition, SkuField, SkuOperator, SkuValue } from '../../../domain/skuWorkbenchTypes'

const props = defineProps<{ rule: SkuCondition; fields: SkuField[]; exposed?: boolean }>()
const emit = defineEmits<{ update: [rule: SkuCondition]; remove: []; copy: []; expose: [shown: boolean] }>()
const field = computed(() => props.fields.find(item => item.id === props.rule.field))
const fieldGroups = computed(() => [...new Set(props.fields.map(item => item.source))].map(source => ({ source, fields: props.fields.filter(item => item.source === source) })))
const operators = computed(() => skuOperators(field.value?.type || 'text'))
const noValue = computed(() => ['empty', 'notEmpty'].includes(props.rule.operator))
const multiple = computed(() => ['in', 'notIn', 'hasAny', 'hasAll', 'descendants'].includes(props.rule.operator))
const choiceField = computed(() => ['enum', 'multi', 'spu', 'category'].includes(field.value?.type || ''))
const textValue = computed(() => typeof props.rule.value === 'string' ? props.rule.value : '')
const numberValue = computed(() => typeof props.rule.value === 'number' ? props.rule.value : undefined)
const booleanValue = computed(() => typeof props.rule.value === 'boolean' ? props.rule.value : undefined)
const arrayValue = computed(() => Array.isArray(props.rule.value) ? props.rule.value : typeof props.rule.value === 'string' && props.rule.value ? [props.rule.value] : [])
const rangeValue = computed(() => props.rule.value && typeof props.rule.value === 'object' && !Array.isArray(props.rule.value) ? props.rule.value : { from: '', to: '' })
const rangeDates = computed(() => rangeValue.value.from && rangeValue.value.to ? [rangeValue.value.from, rangeValue.value.to] : null)
const relativeOptions = [
  { value: 'today', label: '今天' }, { value: 'yesterday', label: '昨天' },
  { value: 'week', label: '本周（周一开始）' }, { value: 'month', label: '本月' },
  { value: 'last7', label: '近 7 天（含今天）' }, { value: 'last30', label: '近 30 天（含今天）' },
]
function setValue(value:SkuValue){const empty=value===null||value===''||Array.isArray(value)&&!value.length||value&&typeof value==='object'&&!Array.isArray(value)&&!value.from&&!value.to;emit('update',{...props.rule,value,active:!empty})}
function changeField(id: string) {
  const next = props.fields.find(item => item.id === id)
  emit('update', { ...props.rule, field: id, operator: skuOperators(next?.type || 'text')[0]?.value || 'eq', value: next?.type === 'boolean' ? null : '' })
}
function changeOperator(operator: SkuOperator) {
  const multi = ['in', 'notIn', 'hasAny', 'hasAll', 'descendants'].includes(operator)
  const value: SkuValue = operator === 'between' ? { from: '', to: '' } : multi ? [] : operator === 'relative' ? 'today' : typeof props.rule.value === 'object' ? '' : props.rule.value
  emit('update', { ...props.rule, operator, value })
}
function dateRange(value: [string, string] | null) { setValue({ from: value?.[0] || '', to: value?.[1] || '' }) }
function updateRange(key: 'from' | 'to', value: string) { setValue({ ...rangeValue.value, [key]: value }) }
</script>

<style scoped>
.rule { display: grid; grid-template-columns: minmax(150px, 1fr) 124px minmax(175px, 1.2fr) 40px 40px; gap: 8px; align-items: center; margin: 10px 0; }
.rule > * { min-width: 0; max-width: 100%; }
.rule .el-date-editor { width: 100%; }
.number-range { display: flex; align-items: center; gap: 6px; }
.expose { grid-column: 1 / -1; margin-top: -6px; }
.invalid { grid-column: 1 / -1; color: var(--el-color-danger); margin: 0; }
.value-placeholder { color: var(--el-text-color-secondary); font-size: 13px; }
@media (max-width: 640px) { .rule { grid-template-columns: minmax(130px, 1fr) minmax(110px, 1fr) 40px 40px; } .rule > :nth-child(3) { grid-column: 1 / 3; grid-row: 2; } .rule > .el-button { grid-row: 1 / 3; }.rule > .el-button:nth-child(4) { grid-column:3; }.rule > .el-button:nth-child(5) { grid-column:4; } }
</style>
