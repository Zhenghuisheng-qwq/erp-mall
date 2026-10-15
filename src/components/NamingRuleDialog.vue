<template>
  <el-dialog :model-value="open" title="命名规则" width="520px" @close="emit('close')">
    <p class="muted">点一下字段就加入或去掉，拖动下面的顺序即可。空的内容会自动跳过。不用写公式，也不用保存才能看预览。</p>
    <div class="chips">
      <button v-for="item in fields" :key="item.key" type="button" :class="{ 'is-on': hasField(item.key) }" @click="toggleField(item.key)">{{ item.label }}</button>
    </div>
    <ol class="parts">
      <li v-for="(part, index) in parts" :key="partKey(part, index)" draggable="true" @dragstart="dragFrom = index" @dragover.prevent @drop="dropAt(index)">
        <span>{{ partLabel(part) }}</span>
        <span>
          <el-button size="small" :disabled="index === 0" @click="move(index, -1)">上移</el-button>
          <el-button size="small" :disabled="index === parts.length - 1" @click="move(index, 1)">下移</el-button>
          <el-button size="small" @click="parts.splice(index, 1)">去掉</el-button>
        </span>
      </li>
    </ol>
    <div class="row-actions">
      <el-input v-model="fixedText" placeholder="固定文字，例如：国行" style="width: 180px" />
      <el-button @click="addText">加入文字</el-button>
    </div>
    <p v-if="combos.length">预览规格</p>
    <el-select v-if="combos.length" v-model="comboKey" style="width: 100%">
      <el-option v-for="item in combos" :key="item.identityKey" :label="item.label" :value="item.identityKey" />
    </el-select>
    <p class="preview">{{ preview || '还没有可预览的名称' }}</p>
    <p v-if="conflict" class="warn">{{ conflict }}</p>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="save">保存规则</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { legalPlanningCombinations } from '../domain/planning'
import { applicableNamingRules, composeName, PRODUCT_TYPE } from '../domain/naming'
import type { NamingPart } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const props = defineProps<{ open: boolean; nodeId: string; templateId: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const store = useCatalogStore()
const parts = ref<NamingPart[]>([])
const fixedText = ref('')
const comboKey = ref('')
const dragFrom = ref(-1)

const fields = computed(() => {
  const rows = [{ key: PRODUCT_TYPE, label: '产品类型' }]
  const seen = new Set<string>()
  store.data.productSpecNodes.filter((item) => item.templateId === props.templateId && item.nodeType === 'ATTRIBUTE').forEach((item) => {
    if (!item.attributeId || seen.has(item.attributeId)) return
    seen.add(item.attributeId)
    rows.push({ key: item.attributeId, label: store.data.params.find((param) => param.id === item.attributeId)?.name || '未命名属性' })
  })
  return rows
})
const combos = computed(() => legalPlanningCombinations(store.data, props.templateId, store.data.productSpecNodes.filter((item) => item.templateId === props.templateId)))
const preview = computed(() => {
  const combo = combos.value.find((item) => item.identityKey === comboKey.value) || combos.value[0]
  if (!combo) return ''
  const values: Record<string, string> = { [PRODUCT_TYPE]: productTypeName() }
  combo.steps.forEach((step) => { values[step.attributeId] = step.valueId })
  return composeName(parts.value, values)
})
const conflict = computed(() => {
  const combo = combos.value.find((item) => item.identityKey === comboKey.value) || combos.value[0]
  if (!combo || !parts.value.length) return ''
  const nodes = store.data.productSpecNodes.filter((item) => item.templateId === props.templateId).map((item) => item.id === props.nodeId ? { ...item, namingRule: parts.value } : item)
  const rules = applicableNamingRules(nodes, combo.steps.map((step) => step.valueNodeId))
  if (rules.length < 2) return ''
  const places = rules.map((rule) => {
    const node = store.data.productSpecNodes.find((item) => item.id === rule.nodeId)
    if (!node) return '未命名位置'
    if (node.nodeType === 'VALUE') return node.valueId || '取值'
    return store.data.params.find((item) => item.id === node.attributeId)?.name || '属性'
  })
  return `「${places.join('」和「')}」上都写了命名规则。新建物料不会自动选其中一条，当前预览先按默认顺序。请只留一条规则，或在建档时自己写名称。`
})

watch(() => props.open, (open) => {
  if (!open) return
  const node = store.data.productSpecNodes.find((item) => item.id === props.nodeId)
  parts.value = (node?.namingRule || []).map((item) => ({ ...item }))
  comboKey.value = combos.value[0]?.identityKey || ''
})

function productTypeName() {
  const canvas = store.data.specCanvases.find((item) => item.templateId === props.templateId)
  return store.data.productTypes.find((item) => item.id === canvas?.productTypeId)?.name || ''
}
function partLabel(part: NamingPart) {
  if (part.kind === 'text') return `文字「${part.text || ''}」`
  return fields.value.find((item) => item.key === part.key)?.label || '字段'
}
function hasField(key: string) {
  return parts.value.some((item) => item.kind === 'field' && item.key === key)
}
function toggleField(key: string) {
  const index = parts.value.findIndex((item) => item.kind === 'field' && item.key === key)
  if (index >= 0) parts.value.splice(index, 1)
  else parts.value.push({ kind: 'field', key })
}
function partKey(part: NamingPart, index: number) {
  return `${part.kind}:${part.key || part.text || index}`
}
function dropAt(index: number) {
  const from = dragFrom.value
  dragFrom.value = -1
  if (from < 0 || from === index) return
  const [item] = parts.value.splice(from, 1)
  parts.value.splice(index, 0, item)
}
function addText() {
  const text = fixedText.value.trim()
  if (!text) return
  parts.value.push({ kind: 'text', text })
  fixedText.value = ''
}
function move(index: number, direction: -1 | 1) {
  const next = index + direction
  const current = parts.value[index]
  parts.value[index] = parts.value[next]
  parts.value[next] = current
}
function save() {
  const node = store.data.productSpecNodes.find((item) => item.id === props.nodeId)
  if (!node) return
  node.namingRule = parts.value.length ? parts.value.map((item) => ({ ...item })) : undefined
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.parts { margin: 8px 0; padding: 0; list-style: none; }
.parts li { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid #eef2f6; }
.preview { margin: 12px 0 0; padding: 10px 12px; background: #f3f8ff; color: #1f2a37; font-weight: 650; }
.warn { color: #c45656; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips button { border: 1px solid #d7e0ea; background: #fff; border-radius: 14px; padding: 4px 10px; cursor: pointer; }
.chips button.is-on { border-color: #1677ff; color: #1677ff; background: #f3f8ff; }
.row-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
