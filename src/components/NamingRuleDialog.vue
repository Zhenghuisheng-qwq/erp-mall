<template>
  <el-dialog :model-value="open" title="物料命名规则" width="780px" @close="emit('close')">
    <p class="source">这条规则属于{{ editingPlace }}。保存只写入当前草稿的这个节点。</p>
    <p class="source">{{ sourceText }}</p>
    <p class="muted">自有规则会整段覆盖祖先规则，不会把两段拼在一起。预览只读合法组合，不会创建物料或改发布快照。</p>
    <div class="editor" :class="{ 'is-readonly': readonly }">
      <div v-if="!readonly" class="palette">
        <p class="col-title">可用字段</p>
        <button
          v-for="item in fields"
          :key="item.key"
          type="button"
          draggable="true"
          :data-field="item.key"
          @dragstart="onFieldDrag($event, item.key)"
          @dragend="onDragEnd"
          @click="addField(item.key)"
        ><em>属性</em>{{ item.label }}</button>
        <p class="muted">拖到右侧，或点击加入。可以重复加入同一个字段。</p>
      </div>
      <div class="sheet" :class="{ 'is-over': overSheet }" @dragover.prevent="overSheet = true" @dragleave="overSheet = false" @drop="dropOnSheet">
        <p class="col-title">命名模板</p>
        <p v-if="!parts.length" class="empty">把左侧字段拖到这里。顺序就是名称顺序，和模型树上的位置无关。</p>
        <ol class="parts">
          <li v-for="(part, index) in parts" :key="part.uid" class="token" :class="{ 'is-over': overIndex === index }" :data-token="tokenMark(part)" @dragover.prevent="overIndex = index" @drop.stop="dropOnPart(index)">
            <span v-if="!readonly" class="grip" draggable="true" title="拖动调整顺序" @dragstart.stop="onPartDrag($event, index)" @dragend="onDragEnd">⋮⋮</span>
            <em class="kind">{{ part.kind === 'text' ? '文字' : '属性' }}</em>
            <el-input v-if="part.kind === 'text' && !readonly" v-model="part.text" />
            <span v-else class="token-text">{{ partLabel(part) }}</span>
            <span v-if="!readonly" class="token-ops">
              <el-button size="small" :disabled="index === 0" @click="move(index, -1)">上移</el-button>
              <el-button size="small" :disabled="index === parts.length - 1" @click="move(index, 1)">下移</el-button>
              <el-button size="small" @click="insertText(index)">此后插入文字</el-button>
              <el-button size="small" @click="parts.splice(index, 1)">去掉</el-button>
            </span>
          </li>
        </ol>
        <div v-if="parts.length && !readonly" class="tail" @dragover.prevent @drop.stop="dropOnSheet">拖到这里，接到模板末尾</div>
      </div>
    </div>
    <div v-if="!readonly" class="row-actions">
      <el-input v-model="fixedText" placeholder="固定文字，空格会原样保存" style="width: 240px" />
      <el-button @click="addText">加入文字</el-button>
    </div>
    <p v-if="combos.length">预览这条合法组合</p>
    <el-select v-if="comboOptions.length" v-model="comboKey" style="width: 100%">
      <el-option v-for="item in comboOptions" :key="item.identityKey" :label="item.label" :value="item.identityKey" />
    </el-select>
    <p v-if="combos.length > comboOptions.length" class="muted">只列出前 {{ comboOptions.length }} 条合法组合。</p>
    <p class="preview">{{ previewText }}</p>
    <p v-if="previewReason" class="muted">{{ previewReason }}</p>
    <p v-for="item in previewGaps" :key="item.key + item.reason" class="warn">{{ item.reason }}</p>
    <template #footer>
      <el-button v-if="hasOwn && !readonly" @click="clearOwn">删除本节点规则</el-button>
      <el-button @click="emit('close')">{{ readonly ? '关闭' : '取消' }}</el-button>
      <el-button v-if="!readonly" type="primary" @click="save">保存规则</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { legalPlanningCombinations } from '../domain/planning'
import { nearestNamingRule, PRODUCT_TYPE, renderNamingRule } from '../domain/naming'
import type { NamingPart } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

interface DraftPart extends NamingPart { uid: string }

const props = defineProps<{ open: boolean; nodeId: string; templateId: string; readonly?: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const store = useCatalogStore()
const parts = ref<DraftPart[]>([])
const fixedText = ref('')
const comboKey = ref('')
const dragFrom = ref(-1)
const dragField = ref('')
const overSheet = ref(false)
const overIndex = ref(-1)
let skipClick = false
let partSeq = 0

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
const modelNodes = computed(() => store.data.productSpecNodes.filter((item) => item.templateId === props.templateId))
const combos = computed(() => legalPlanningCombinations(store.data, props.templateId, modelNodes.value))
const comboOptions = computed(() => combos.value.slice(0, 40))
const hasOwn = computed(() => Boolean(modelNodes.value.find((item) => item.id === props.nodeId)?.namingRule?.length))
const previewNodes = computed(() => modelNodes.value.map((item) => item.id === props.nodeId ? { ...item, namingRule: storedParts(parts.value) } : item))
const activeCombo = computed(() => combos.value.find((item) => item.identityKey === comboKey.value) || combos.value[0])
const previewHit = computed(() => {
  const leaf = activeCombo.value?.steps.at(-1)?.valueNodeId
  if (!leaf) return null
  return nearestNamingRule(previewNodes.value, leaf)
})
const previewBody = computed(() => {
  const hit = previewHit.value
  const combo = activeCombo.value
  if (!combo) return null
  if (!hit) return null
  const labels = Object.fromEntries(fields.value.map((item) => [item.key, item.label]))
  return renderNamingRule(hit.rule, combo.steps, { [PRODUCT_TYPE]: productTypeName() }, labels)
})
const editingPlace = computed(() => {
  const node = modelNodes.value.find((item) => item.id === props.nodeId)
  if (!node) return '未找到的节点'
  return `${node.nodeType === 'VALUE' ? '取值' : '属性'}「${nodeLabel(node.id)}」`
})
const sourceText = computed(() => {
  const own = modelNodes.value.find((item) => item.id === props.nodeId)?.namingRule?.length
  if (own) return '这个节点有自有规则。它会完整覆盖祖先规则。'
  const parent = modelNodes.value.find((item) => item.id === props.nodeId)?.parentId
  const inherited = parent ? nearestNamingRule(modelNodes.value, parent) : null
  if (!inherited) return '这个节点和它的祖先都没有命名规则。'
  return `这个节点没有自有规则，最近祖先是「${nodeLabel(inherited.nodeId)}」。查看不会把规则复制到本节点。`
})
const previewText = computed(() => {
  if (!activeCombo.value) return '当前模型还没有可预览的合法组合'
  if (!previewHit.value) return '当前路径未配置命名规则'
  return previewBody.value?.name || '当前路径未配置命名规则'
})
const previewReason = computed(() => {
  const hit = previewHit.value
  if (!activeCombo.value || !hit) return ''
  const place = nodeLabel(hit.nodeId)
  if (hit.nodeId === props.nodeId) return `规则来自当前节点「${place}」。原因：路径末端向上遇到的第一条自有规则。`
  return `规则来自祖先「${place}」。原因：当前路径上没有更近的自有规则，不使用兄弟分支的规则。`
})
const previewGaps = computed(() => [...(previewBody.value?.missing || []), ...(previewBody.value?.ambiguous || [])])

watch(() => props.open, (open) => {
  if (!open) return
  const node = store.data.productSpecNodes.find((item) => item.id === props.nodeId)
  parts.value = (node?.namingRule || []).map((item) => ({ uid: nextUid(), kind: item.kind, key: item.key, text: item.text }))
  fixedText.value = ''
  comboKey.value = combos.value[0]?.identityKey || ''
  clearDrag()
})

function nextUid() {
  partSeq += 1
  return `part-${partSeq}`
}
function storedParts(list: DraftPart[]) {
  if (!list.length) return undefined
  return list.map((item) => item.kind === 'text' ? { kind: 'text' as const, text: item.text ?? '' } : { kind: 'field' as const, key: item.key })
}
function nodeLabel(nodeId: string) {
  const node = modelNodes.value.find((item) => item.id === nodeId)
  if (!node) return '未命名节点'
  if (node.nodeType === 'VALUE') return node.valueId || '取值'
  return store.data.params.find((item) => item.id === node.attributeId)?.name || '属性'
}
function productTypeName() {
  const canvas = store.data.specCanvases.find((item) => item.templateId === props.templateId)
  return store.data.productTypes.find((item) => item.id === canvas?.productTypeId)?.name || ''
}
function partLabel(part: NamingPart) {
  if (part.kind === 'text') return part.text ?? ''
  return fields.value.find((item) => item.key === part.key)?.label || '字段'
}
function tokenMark(part: DraftPart) {
  return part.kind === 'text' ? 'text' : `field:${part.key || ''}`
}
function makeField(key: string): DraftPart {
  return { uid: nextUid(), kind: 'field', key }
}
function makeText(text: string): DraftPart {
  return { uid: nextUid(), kind: 'text', text }
}
function addField(key: string) {
  if (props.readonly) return
  if (skipClick) {
    skipClick = false
    return
  }
  parts.value.push(makeField(key))
}
function addText() {
  if (props.readonly || fixedText.value === '') return
  parts.value.push(makeText(fixedText.value))
  fixedText.value = ''
}
function insertText(index: number) {
  if (props.readonly || fixedText.value === '') return
  parts.value.splice(index + 1, 0, makeText(fixedText.value))
  fixedText.value = ''
}
function move(index: number, direction: -1 | 1) {
  if (props.readonly) return
  const next = index + direction
  const current = parts.value[index]
  parts.value[index] = parts.value[next]
  parts.value[next] = current
}
function onFieldDrag(event: DragEvent, key: string) {
  dragFrom.value = -1
  dragField.value = key
  event.dataTransfer?.setData('text/plain', `field:${key}`)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}
function onPartDrag(event: DragEvent, index: number) {
  dragFrom.value = index
  dragField.value = ''
  event.dataTransfer?.setData('text/plain', `index:${index}`)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  skipClick = true
  window.setTimeout(() => { skipClick = false }, 0)
  clearDrag()
}
function clearDrag() {
  dragFrom.value = -1
  dragField.value = ''
  overSheet.value = false
  overIndex.value = -1
}
function dropOnPart(index: number) {
  const field = dragField.value
  const from = dragFrom.value
  clearDrag()
  if (props.readonly) return
  if (field) {
    parts.value.splice(index, 0, makeField(field))
    return
  }
  if (from < 0 || from === index) return
  const [item] = parts.value.splice(from, 1)
  const target = from < index ? index - 1 : index
  parts.value.splice(target, 0, item)
}
function dropOnSheet() {
  const field = dragField.value
  const from = dragFrom.value
  clearDrag()
  if (props.readonly) return
  if (field) {
    parts.value.push(makeField(field))
    return
  }
  if (from < 0 || from === parts.value.length - 1) return
  const [item] = parts.value.splice(from, 1)
  parts.value.push(item)
}
function save() {
  if (props.readonly) return
  const node = store.data.productSpecNodes.find((item) => item.id === props.nodeId && item.templateId === props.templateId)
  if (!node) return
  node.namingRule = storedParts(parts.value)
  emit('saved')
  emit('close')
}
function clearOwn() {
  parts.value = []
  save()
}
</script>

<style scoped>
.editor { display: grid; grid-template-columns: 210px 1fr; gap: 12px; margin-top: 8px; }
.editor.is-readonly { grid-template-columns: 1fr; }
.palette, .sheet { border: 1px solid #e6edf5; border-radius: 8px; padding: 8px; min-height: 180px; background: #fff; }
.sheet.is-over { border-color: #1677ff; background: #f3f8ff; }
.col-title { margin: 0 0 8px; color: #607089; font-size: 13px; }
.palette button { display: flex; align-items: center; gap: 6px; width: 100%; margin-bottom: 6px; border: 1px solid #d7e0ea; background: #fff; border-radius: 6px; padding: 6px 8px; cursor: grab; text-align: left; }
.palette em, .kind { flex: none; color: #1677ff; font-style: normal; font-size: 11px; }
.parts { margin: 0; padding: 0; list-style: none; }
.token { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 6px; border: 1px dashed #d7e0ea; border-radius: 6px; background: #fff; }
.token.is-over { border-color: #1677ff; background: #f3f8ff; }
.grip { cursor: grab; color: #607089; user-select: none; }
.token-text { white-space: pre-wrap; }
.token-ops { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
.empty, .tail { margin: 8px 0; color: #607089; text-align: center; }
.tail { border: 1px dashed #d7e0ea; border-radius: 6px; padding: 8px; }
.source { margin: 0 0 8px; font-weight: 650; }
.preview { margin: 12px 0 0; padding: 10px 12px; background: #f3f8ff; color: #1f2a37; font-weight: 650; }
.warn { color: #c45656; }
.muted { color: #607089; font-size: 13px; }
.row-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
