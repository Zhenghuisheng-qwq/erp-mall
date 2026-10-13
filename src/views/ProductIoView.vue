<template>
  <div>
    <PageHead title="导入导出" desc="用表格批量维护商品。导出的是属性名和值，不会出现规格节点编号。">
      <el-button @click="downloadTemplate">下载导入模板</el-button>
      <el-button @click="exportBooks">导出商品和规格</el-button>
    </PageHead>
    <div class="panel">
      <p>导入流程：上传表格，匹配分类和属性方案，预览将生成的规格，确认后保存。</p>
      <input type="file" accept=".xlsx,.xls,.csv" @change="onFile" />
      <p v-if="note" class="muted">{{ note }}</p>
      <el-table v-if="preview.length" :data="preview" size="small" style="margin-top: 12px">
        <el-table-column prop="name" label="商品名称" />
        <el-table-column prop="category" label="分类" />
        <el-table-column prop="scheme" label="属性方案" />
        <el-table-column prop="path" label="规格" />
        <el-table-column prop="warning" label="说明" />
      </el-table>
      <el-button v-if="groups.length" type="primary" style="margin-top: 12px" @click="confirm">确认保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import PageHead from '../components/PageHead.vue'
import { latestPublishedVersion, mappingForCategory, specTreeState } from '../domain/logic'
import type { ProductFamily, Sku } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

type Row = Record<string, string>
type Preview = { name: string; category: string; scheme: string; path: string; warning: string }
type Group = { name: string; categoryId: string; templateId: string; rows: Row[]; warning: string }

const store = useCatalogStore()
const preview = ref<Preview[]>([])
const groups = ref<Group[]>([])
const note = ref('价格列只在模板里给运营看，当前规格不保存价格。')

function sheetRows(rows: Row[]) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), '商品')
  return book
}
function downloadTemplate() {
  const book = sheetRows([{ 分类: '手机', 商品名称: '示例手机', 品牌: 'Apple', 型号: 'iPhone 17', 容量: '256G', 颜色: '黑色', 价格: '' }])
  XLSX.writeFile(book, '商品导入模板.xlsx')
}
function exportBooks() {
  const products = store.data.families.map((family) => ({
    分类: store.data.categories.find((item) => item.id === family.categoryId)?.name || '',
    商品名称: family.name,
    商品状态: family.shelfStatus || family.lifecycle,
    品牌: family.commonAttrs['品牌'] || '',
    型号: family.commonAttrs['型号'] || '',
    规格数: store.skusOf(family.id).length,
  }))
  const skus = store.data.skus.map((sku) => {
    const family = store.data.families.find((item) => item.id === sku.familyId)
    return {
      商品名称: family?.name || '',
      分类: store.data.categories.find((item) => item.id === family?.categoryId)?.name || '',
      ...family?.commonAttrs,
      ...sku.variantAttrs,
      规格状态: sku.status,
    }
  })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products), '商品')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(skus), '规格')
  XLSX.writeFile(book, '商品导出.xlsx')
}
function findCategory(name: string) {
  const matched = store.data.categories.filter((item) => item.name === name)
  return matched.find((item) => store.data.mappings.some((mapping) => mapping.categoryId === item.id)) || matched[0]
}
async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  let book: XLSX.WorkBook
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    bytes.forEach((item) => {
      binary += String.fromCharCode(item)
    })
    book = XLSX.read(binary, { type: 'binary' })
  } catch (error) {
    note.value = error instanceof Error ? error.message : '表格无法解析'
    return
  }
  const sheet = book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' })
  const next = new Map<string, Group>()
  rows.forEach((row) => {
    const category = findCategory(String(row['分类'] || '').trim())
    const name = String(row['商品名称'] || '').trim()
    if (!category || !name) return
    const mapping = mappingForCategory(store.data, category.id)
    const key = `${category.id}|${name}`
    const current = next.get(key) || { name, categoryId: category.id, templateId: mapping?.templateId || '', rows: [], warning: '' }
    if (!mapping) current.warning = '分类还没有属性方案'
    else if (specTreeState(store.data, mapping.templateId) !== 'ready') current.warning = '没有已发布的完整规格模型，仍按属性名生成规格'
    current.rows.push(row)
    next.set(key, current)
  })
  groups.value = [...next.values()]
  preview.value = groups.value.flatMap((group) => group.rows.map((row) => ({
    name: group.name,
    category: String(row['分类'] || ''),
    scheme: store.data.templates.find((item) => item.id === group.templateId)?.name || '未匹配',
    path: ['品牌', '型号', '容量', '颜色'].map((key) => row[key]).filter(Boolean).join(' / '),
    warning: row['价格'] ? `${group.warning} 价格不入库` : group.warning,
  })))
}
function confirm() {
  const ready = groups.value.filter((item) => item.templateId)
  ready.forEach((group) => {
    const family: ProductFamily = {
      id: uid('fam'),
      name: group.name,
      templateId: group.templateId,
      modelVersionId: latestPublishedVersion(store.data, group.templateId)?.id || '',
      categoryId: group.categoryId,
      oaProductId: '',
      commonAttrs: { 品牌: String(group.rows[0]?.['品牌'] || ''), 型号: String(group.rows[0]?.['型号'] || ''), 系列: String(group.rows[0]?.['系列'] || '') },
      productGroupIds: [],
      lifecycle: 'draft',
      shelfStatus: 'draft',
      createdAt: new Date().toISOString(),
      origin: 'created',
      updatedAt: new Date().toISOString(),
    }
    const skus: Sku[] = group.rows.map((row) => ({
      id: uid('sku'),
      familyId: family.id,
      code: '',
      oaSkuId: '',
      status: 'draft',
      variantAttrs: { 容量: String(row['容量'] || ''), 颜色: String(row['颜色'] || '') },
      projectedAttrs: {},
    }))
    store.saveBundle(family, skus)
  })
  ElMessage.success(`已保存 ${ready.length} 款商品`)
  preview.value = []
  groups.value = []
}
</script>
