<template>
  <div class="overview" :data-overview-view="mode">
    <div class="overview-bar">
      <el-radio-group :model-value="mode" size="small" @change="setMode">
        <el-radio-button value="graph">关系图</el-radio-button>
        <el-radio-button value="list">清单</el-radio-button>
      </el-radio-group>
      <el-input v-model="keyword" clearable placeholder="按模型名称查找" />
      <span>{{ modelTotal }} 个模型</span>
    </div>
    <p v-if="keyword.trim() && !hits.length" class="overview-note">没有找到这个名称的模型。</p>
    <div v-else-if="hits.length" class="hit-row">
      <button v-for="item in hits" :key="item.templateId + item.categoryId" type="button" :class="{ 'is-on': item.templateId === selectedModelId }" @click="focusModel(item.templateId, item.categoryId)">
        {{ item.name }}
        <em>{{ categoryPath(store.data, item.categoryId) }} / {{ item.typeName }}</em>
      </button>
    </div>
    <p v-if="mode === 'list'" class="overview-note">{{ contextText }}</p>
    <div v-show="mode === 'list'" class="overview-pane">
    <div v-if="rows.length" ref="listRef" class="overview-list">
      <div
        v-for="row in rows"
        :key="row.key"
        class="overview-row"
        :class="[`is-${row.tone}`, { 'is-on': row.selected, 'is-open': row.open }]"
        :style="{ paddingLeft: `${12 + row.depth * 16}px` }"
        :data-focus="row.selected && row.tone === 'model' ? '1' : undefined"
      >
        <button v-if="row.expandable" type="button" class="twist" @click="toggle(row)">{{ row.open ? '▾' : '▸' }}</button>
        <span v-else class="twist"></span>
        <button type="button" class="overview-label" @click="pick(row)">
          <strong>{{ row.label }}</strong>
          <em v-if="row.meta">{{ row.meta }}</em>
        </button>
        <el-button v-if="row.tone === 'model'" link type="primary" @click="openModel(row)">查看</el-button>
      </div>
    </div>
    <el-empty v-else description="还没有可查看的分类和模型" />
    </div>
    <OverviewGraph
      v-show="mode === 'graph'"
      class="overview-pane"
      :active="mode === 'graph'"
      :root-id="rootId || ''"
      :pin-tick="pinTick"
      :pin-template-id="pinTemplateId"
      :pin-category-id="pinCategoryId"
      @open="openFromGraph"
      @root="emit('root', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { categoryChain } from '../../domain/categoryTree'
import { categoryPath, modelVersionsOf } from '../../domain/logic'
import type { ProductSpecNode } from '../../domain/types'
import { useCatalogStore } from '../../stores/catalog'
import OverviewGraph from './OverviewGraph.vue'

const props = defineProps<{
  categoryId: string
  typeId: string
  keyword: string
  focusId: string
  view?: string
  rootId?: string
}>()

const emit = defineEmits<{
  open: [payload: { templateId: string; categoryId: string; typeId: string; keyword: string }]
  view: [view: 'list' | 'graph']
  root: [rootId: string]
}>()

const mode = ref<'list' | 'graph'>(props.view === 'list' ? 'list' : 'graph')
const pinTick = ref(0)
const pinTemplateId = ref('')
const pinCategoryId = ref('')

const store = useCatalogStore()
const listRef = ref<HTMLElement>()
const keyword = ref(props.keyword || '')
const selectedCategoryId = ref(props.categoryId || '')
const selectedTypeId = ref(props.typeId || '')
const selectedModelId = ref(props.focusId || '')
const openCategories = ref<string[]>([])
const openModels = ref<string[]>([])

interface OverviewRow {
  key: string
  tone: 'category' | 'type' | 'model' | 'attribute' | 'value' | 'empty'
  id: string
  depth: number
  label: string
  meta: string
  expandable: boolean
  open: boolean
  selected: boolean
  categoryId: string
  typeId: string
  templateId: string
}

interface ModelHit {
  templateId: string
  name: string
  typeId: string
  typeName: string
  categoryId: string
  statusText: string
  nodeCount: number
}

const roots = store.data.categories.filter((item) => !item.parentId).map((item) => item.id)
openCategories.value = [...new Set([...roots, ...chainIds(props.categoryId)])]

function chainIds(id: string) {
  if (!id) return []
  return categoryChain(store.data.categories, id).map((item) => item.id)
}

function typesOn(categoryId: string) {
  const seen = new Set<string>()
  return store.data.productTypes
    .filter((item) => item.categoryId === categoryId)
    .slice()
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh') || a.id.localeCompare(b.id))
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}

function modelsOf(typeId: string): ModelHit[] {
  const seen = new Set<string>()
  const type = store.data.productTypes.find((item) => item.id === typeId)
  return store.data.specCanvases
    .filter((item) => item.productTypeId === typeId && item.templateId)
    .filter((item) => {
      if (seen.has(item.templateId)) return false
      seen.add(item.templateId)
      return true
    })
    .map((item) => ({
      templateId: item.templateId,
      name: item.name?.trim() || store.data.templates.find((template) => template.id === item.templateId)?.name || '未命名模型',
      typeId,
      typeName: type?.name || '未命名类型',
      categoryId: type?.categoryId || '',
      statusText: statusText(item.templateId, item.status),
      nodeCount: store.data.productSpecNodes.filter((node) => node.templateId === item.templateId).length,
    }))
}

function statusText(templateId: string, status?: string) {
  const published = modelVersionsOf(store.data, templateId).filter((item) => item.status === 'published')
  const latest = published[published.length - 1]
  if (status === 'published' && latest) return `已发布 ${latest.versionName}`
  if (status === 'offline') return latest ? `已下线 · 快照 ${latest.versionName}` : '已下线'
  if (latest) return `草稿 · 快照 ${latest.versionName}`
  return '草稿'
}

function otherPaths(typeId: string, categoryId: string) {
  const ids = [...new Set(store.data.productTypes.filter((item) => item.id === typeId).map((item) => item.categoryId))]
  return ids.filter((id) => id && id !== categoryId).map((id) => categoryPath(store.data, id)).filter(Boolean)
}

function nodeLabel(node: ProductSpecNode) {
  if (node.nodeType === 'VALUE') return node.valueId || '未命名取值'
  const name = store.data.params.find((item) => item.id === node.attributeId)?.name
  return name || '未绑定属性'
}

function nodeRows(templateId: string, categoryId: string, typeId: string, depth: number): OverviewRow[] {
  const source = store.data.productSpecNodes.filter((item) => item.templateId === templateId)
  const rows: OverviewRow[] = []
  const walk = (parentId: string | null, level: number, stack: string[]) => {
    source
      .filter((item) => item.parentId === parentId && !stack.includes(item.id))
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .forEach((node) => {
        rows.push({
          key: `node:${categoryId}:${templateId}:${node.id}`,
          tone: node.nodeType === 'VALUE' ? 'value' : 'attribute',
          id: node.id,
          depth: level,
          label: nodeLabel(node),
          meta: node.nodeType === 'VALUE' ? '取值' : '属性',
          expandable: false,
          open: false,
          selected: false,
          categoryId,
          typeId,
          templateId,
        })
        walk(node.id, level + 1, [...stack, node.id])
      })
  }
  walk(null, depth, [])
  if (!rows.length) {
    rows.push({
      key: `empty-node:${categoryId}:${templateId}`,
      tone: 'empty',
      id: '',
      depth,
      label: '这个模型还没有结构节点',
      meta: '',
      expandable: false,
      open: false,
      selected: false,
      categoryId,
      typeId,
      templateId,
    })
  }
  return rows
}

const modelTotal = computed(() => {
  const ids = new Set(store.data.specCanvases.map((item) => item.templateId).filter(Boolean))
  return ids.size
})

const hits = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return []
  const list: ModelHit[] = []
  const seen = new Set<string>()
  store.data.productTypes.forEach((type) => {
    modelsOf(type.id).forEach((model) => {
      if (!model.name.toLowerCase().includes(text)) return
      const key = `${type.categoryId}:${model.templateId}`
      if (seen.has(key)) return
      seen.add(key)
      list.push({ ...model, categoryId: type.categoryId, typeName: type.name })
    })
  })
  return list
})

const rows = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  const matchCategories = new Set<string>()
  if (text) {
    hits.value.forEach((item) => chainIds(item.categoryId).forEach((id) => matchCategories.add(id)))
  }
  const list: OverviewRow[] = []
  const walk = (parentId: string | null, depth: number) => {
    store.data.categories
      .filter((item) => item.parentId === parentId)
      .slice()
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh'))
      .forEach((category) => {
        if (text && !matchCategories.has(category.id)) return
        const opened = openCategories.value.includes(category.id) || (text ? matchCategories.has(category.id) : false)
        const childCategories = store.data.categories.some((item) => item.parentId === category.id)
        const types = typesOn(category.id)
        list.push({
          key: `category:${category.id}`,
          tone: 'category',
          id: category.id,
          depth,
          label: category.name,
          meta: `${types.length} 个类型`,
          expandable: childCategories || types.length > 0,
          open: opened,
          selected: selectedCategoryId.value === category.id && !selectedTypeId.value,
          categoryId: category.id,
          typeId: '',
          templateId: '',
        })
        if (!opened) return
        types.forEach((type) => {
          const models = modelsOf(type.id).filter((model) => !text || model.name.toLowerCase().includes(text))
          if (text && !models.length) return
          const extras = otherPaths(type.id, category.id)
          list.push({
            key: `type:${category.id}:${type.id}`,
            tone: 'type',
            id: type.id,
            depth: depth + 1,
            label: type.name,
            meta: extras.length ? `${models.length} 个模型 · 另见 ${extras.join('、')}` : `${models.length} 个模型`,
            expandable: false,
            open: true,
            selected: selectedTypeId.value === type.id && selectedCategoryId.value === category.id && !selectedModelId.value,
            categoryId: category.id,
            typeId: type.id,
            templateId: '',
          })
          if (!models.length) {
            list.push({
              key: `empty-model:${category.id}:${type.id}`,
              tone: 'empty',
              id: '',
              depth: depth + 2,
              label: '这个产品类型还没有商品模型',
              meta: '',
              expandable: false,
              open: false,
              selected: false,
              categoryId: category.id,
              typeId: type.id,
              templateId: '',
            })
            return
          }
          models.forEach((model) => {
            const modelKey = `${category.id}:${model.templateId}`
            const openedModel = openModels.value.includes(modelKey)
            list.push({
              key: `model:${modelKey}`,
              tone: 'model',
              id: model.templateId,
              depth: depth + 2,
              label: model.name,
              meta: `${model.statusText} · ${model.nodeCount} 个节点`,
              expandable: true,
              open: openedModel,
              selected: selectedModelId.value === model.templateId && selectedCategoryId.value === category.id,
              categoryId: category.id,
              typeId: type.id,
              templateId: model.templateId,
            })
            if (openedModel) list.push(...nodeRows(model.templateId, category.id, type.id, depth + 3))
          })
        })
        if (!types.length && !childCategories) {
          list.push({
            key: `empty-category:${category.id}`,
            tone: 'empty',
            id: '',
            depth: depth + 1,
            label: '这个分类还没有产品类型',
            meta: '',
            expandable: false,
            open: false,
            selected: false,
            categoryId: category.id,
            typeId: '',
            templateId: '',
          })
        }
        walk(category.id, depth + 1)
      })
  }
  walk(null, 0)
  return list
})

const contextText = computed(() => {
  const path = selectedCategoryId.value ? categoryPath(store.data, selectedCategoryId.value) : '未选择分类'
  const type = store.data.productTypes.find((item) => item.id === selectedTypeId.value)
  const model = store.data.specCanvases.find((item) => item.templateId === selectedModelId.value)
  const parts = [path]
  if (type) parts.push(type.name)
  if (model) parts.push(model.name?.trim() || '未命名模型')
  return `当前：${parts.join(' / ')}。总览只读，查看模型会进入现有设计页。`
})

function toggle(row: OverviewRow) {
  pick(row)
  if (row.tone === 'category') {
    openCategories.value = openCategories.value.includes(row.id)
      ? openCategories.value.filter((id) => id !== row.id)
      : [...openCategories.value, row.id]
    return
  }
  if (row.tone !== 'model') return
  const key = `${row.categoryId}:${row.templateId}`
  openModels.value = openModels.value.includes(key)
    ? openModels.value.filter((id) => id !== key)
    : [...openModels.value, key]
}

function pick(row: OverviewRow) {
  if (row.tone === 'empty') return
  selectedCategoryId.value = row.categoryId
  selectedTypeId.value = row.typeId
  selectedModelId.value = row.templateId
}

function openModel(row: OverviewRow) {
  if (!row.templateId) return
  emit('open', {
    templateId: row.templateId,
    categoryId: row.categoryId,
    typeId: row.typeId,
    keyword: keyword.value.trim(),
  })
}

function openFromGraph(payload: { templateId: string; categoryId: string; typeId: string }) {
  emit('open', { ...payload, keyword: keyword.value.trim() })
}

function setMode(value: string | number | boolean) {
  const next = value === 'graph' ? 'graph' : 'list'
  mode.value = next
  emit('view', next)
}

function focusModel(templateId: string, categoryId: string) {
  const type = store.data.productTypes.find((item) => item.categoryId === categoryId && modelsOf(item.id).some((model) => model.templateId === templateId))
    || store.data.productTypes.find((item) => modelsOf(item.id).some((model) => model.templateId === templateId))
  selectedCategoryId.value = categoryId || type?.categoryId || ''
  selectedTypeId.value = type?.id || ''
  selectedModelId.value = templateId
  openCategories.value = [...new Set([...openCategories.value, ...chainIds(selectedCategoryId.value)])]
  pinTemplateId.value = templateId
  pinCategoryId.value = categoryId
  pinTick.value += 1
  nextTick(() => listRef.value?.querySelector('[data-focus="1"]')?.scrollIntoView({ block: 'nearest' }))
}

watch(() => props.focusId, (id) => {
  if (id) focusModel(id, props.categoryId || selectedCategoryId.value)
}, { immediate: true })
watch(() => props.keyword, (value) => {
  if (value) keyword.value = value
})
watch(() => props.view, (value) => {
  mode.value = value === 'list' ? 'list' : 'graph'
})
</script>

<style scoped>
.overview { min-height: 0; height: 100%; display: flex; flex-direction: column; gap: 8px; }
.overview-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.overview-pane { min-height: 0; flex: 1; display: flex; flex-direction: column; }
.overview-bar .el-input { max-width: 320px; }
.overview-bar span, .overview-note { color: var(--text-secondary, #66788a); font-size: 13px; }
.overview-note { margin: 0; }
.hit-row { display: flex; flex-wrap: wrap; gap: 8px; }
.hit-row button { border: 1px solid var(--border-default, #e4e8ef); background: var(--surface-bg, #fff); border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.hit-row button.is-on { border-color: var(--el-color-primary); color: var(--el-color-primary); }
.hit-row em { margin-left: 6px; color: var(--text-secondary, #8b98a8); font-style: normal; }
.overview-list { min-height: 0; flex: 1; overflow: auto; background: var(--surface-bg, #fff); border: 1px solid var(--border-default, #e4e8ef); border-radius: 8px; padding: 8px 0; }
.overview-row { display: flex; align-items: center; gap: 4px; min-height: 32px; }
.overview-row.is-on { background: var(--el-color-primary-light-9, #f0f7ff); }
.twist { width: 16px; border: 0; background: transparent; color: #98a2b3; cursor: pointer; }
.overview-label { min-width: 0; flex: 1; display: flex; align-items: baseline; gap: 8px; border: 0; background: transparent; text-align: left; cursor: pointer; padding: 4px 0; }
.overview-label strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.overview-label em { flex: none; color: var(--text-secondary, #8b98a8); font-style: normal; font-size: 12px; }
.overview-row.is-category strong { font-weight: 650; }
.overview-row.is-type strong { font-weight: 600; }
.overview-row.is-attribute .overview-label strong { flex: none; max-width: 100%; padding: 1px 8px; border: 1px solid var(--spec-attr-border, #9aa6d4); border-radius: 6px; background: var(--spec-attr-bg, color-mix(in srgb, #5d6eb8 16%, #fff)); font-weight: 600; }
.overview-row.is-value .overview-label strong { flex: none; max-width: 100%; padding: 1px 10px; border: 1px solid var(--spec-value-border, #c3ccd6); border-radius: 999px; background: var(--spec-value-bg, #fff); font-weight: 400; }
.overview-row.is-empty .overview-label { color: var(--text-secondary, #8b98a8); cursor: default; }
</style>
