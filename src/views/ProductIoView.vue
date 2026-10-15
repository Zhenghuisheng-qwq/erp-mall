<template>
  <div>
    <PageHead title="导入导出" desc="先看清表格，再对字段，预览没问题后才写入。上传本身不会改现有物料。">
      <el-button @click="downloadTemplate">下载导入模板</el-button>
      <el-button @click="exportBooks">导出商品和规格</el-button>
    </PageHead>
    <div class="panel">
      <h2>1. 选择表格</h2>
      <input type="file" accept=".xlsx,.xls" @change="onFile" />
      <p v-if="fileName" class="muted">{{ fileName }} · {{ fileSize }}</p>
      <p v-for="item in sheets" :key="item.name" class="sheet">
        <label>
          <input v-if="item.kind === 'material'" type="checkbox" :checked="selected.includes(item.name)" @change="toggleSheet(item.name)" />
          <strong>{{ item.name }}</strong>
          <span>{{ item.title }} · {{ item.rows.length }} 行 · {{ item.reason }}</span>
        </label>
      </p>
    </div>
    <div v-if="activeSheet" class="panel">
      <h2>2. 字段对应</h2>
      <p class="muted">左边是表格列，右边是系统里的含义。改完不用重新上传。</p>
      <el-table :data="mapping" size="small">
        <el-table-column prop="header" label="表格列" min-width="140" />
        <el-table-column prop="sample" label="示例" min-width="180" />
        <el-table-column label="导入为" min-width="160">
          <template #default="{ row }">
            <el-select v-model="row.target" size="small">
              <el-option v-for="item in targets" :key="item.id" :label="item.label" :value="item.id" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
      <div class="row-actions" style="margin-top: 12px">
        <el-button type="primary" @click="buildPreview">预览导入</el-button>
        <el-button @click="installModels">补上已核对的手机、平板、保护壳模型</el-button>
      </div>
      <p class="muted">这一步只补分类、产品类型和模型，不改现有手机模型，也不会把行写成临时物料。屏幕膜、笔记本等还没有确认的结构，不会生成。</p>
      <label v-for="item in aliasOptions" :key="item.from" class="sheet">
        <input type="checkbox" :checked="aliases.some((alias) => alias.from === item.from)" @change="toggleAlias(item)" />
        <span>{{ item.reason }}</span>
      </label>
    </div>
    <div v-if="preview.length" class="panel">
      <h2>3. 导入预览</h2>
      <p>正式可导入 {{ formalCount }} 行，临时物料 {{ temporaryCount }} 行，已导入 {{ blockCount('imported') }} 行，还不能导入 {{ blockedCount }} 行。供应商编码相同的有 {{ dupCount }} 行，系统不会把它们并成一条。</p>
      <p class="muted">分类 {{ blockCount('category') }} 行，产品类型 {{ blockCount('product-type') }} 行，商品模型 {{ blockCount('model') }} 行，待指定模型 {{ blockCount('model-choice') }} 行，规格值 {{ blockCount('spec') }} 行，源数据缺字段 {{ blockCount('source') }} 行。</p>
      <div v-for="group in groups" :key="group.key" class="sheet">
        <strong>{{ group.count }} 行 · {{ group.title }}</strong>
        <span>{{ group.detail }}</span>
        <router-link :to="group.href">去配置</router-link>
        <button v-for="model in group.models" :key="model.id" type="button" @click="chooseModel(group.productTypeId, model.id)">用 {{ model.name }} 匹配</button>
        <button v-if="group.allowTemporary" type="button" @click="toggleTemporary(group.key)">{{ temporaryGroups.includes(group.key) ? '取消临时导入' : '这组按临时物料导入' }}</button>
      </div>
      <el-button @click="buildPreview">重新匹配</el-button>
      <el-table :data="previewView" size="small" max-height="420">
        <el-table-column prop="rowNumber" label="行" width="70" />
        <el-table-column prop="skuName" label="物料名称" min-width="220" />
        <el-table-column prop="supplierCode" label="供应商编码" width="140" />
        <el-table-column label="规格" min-width="220">
          <template #default="{ row }">{{ attrText(row) }}</template>
        </el-table-column>
        <el-table-column label="结果" min-width="240">
          <template #default="{ row }">{{ row.status === 'ready' ? (row.action === 'formal' ? '正式物料' : '临时物料') : '不导入' }} · {{ row.message }}</template>
        </el-table-column>
      </el-table>
      <p v-if="preview.length > 80" class="muted">只展示前 80 行，确认时会处理全部可导入行。</p>
      <el-button type="primary" :disabled="readyCount === 0 || saving" @click="confirm">确认导入 {{ readyCount }} 行</el-button>
      <p v-if="resultText" class="muted">{{ resultText }} <router-link to="/products">打开商品列表</router-link></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import PageHead from '../components/PageHead.vue'
import { installAcceptanceCatalog } from '../domain/acceptanceCatalog'
import { applyExcelImport, observedMaterials, previewGroups, previewSheet, readSheet, suggestMapping, suggestValueAliases, type ColumnMapping, type ColumnTarget, type ImportBlock, type ImportPreviewRow, type SheetProfile, type ValueAlias } from '../domain/excelImport'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const fileName = ref('')
const fileSize = ref('')
const fileKey = ref('')
const sheets = ref<SheetProfile[]>([])
const selected = ref<string[]>([])
const mapping = ref<ColumnMapping[]>([])
const preview = ref<ImportPreviewRow[]>([])
const aliases = ref<ValueAlias[]>([])
const temporaryGroups = ref<string[]>([])
const modelChoice = ref<Record<string, string>>({})
const saving = ref(false)
const resultText = ref('')
const targets: { id: ColumnTarget; label: string }[] = [
  { id: 'ignore', label: '不导入' },
  { id: 'guanjiapo', label: '管家婆编号' },
  { id: 'legacyName', label: '旧系统描述' },
  { id: 'stock', label: '库存（不保存）' },
  { id: 'supplier', label: '供应商编码' },
  { id: 'skuName', label: '物料名称' },
  { id: 'category', label: '商品分类' },
  { id: 'productType', label: '产品类型' },
  { id: 'manage', label: '管理方式（不保存）' },
  { id: 'attrName', label: '属性名' },
  { id: 'attrValue', label: '属性值' },
]
const activeSheet = computed(() => sheets.value.find((item) => item.name === selected.value[0] && item.kind === 'material'))
function attrText(row: ImportPreviewRow) {
  return row.attrs.map((item) => `${item.name} ${item.value}`).join(' · ')
}
const readyCount = computed(() => preview.value.filter((item) => item.status === 'ready').length)
const formalCount = computed(() => preview.value.filter((item) => item.block === 'formal').length)
const temporaryCount = computed(() => preview.value.filter((item) => item.block === 'temporary').length)
const blockedCount = computed(() => preview.value.filter((item) => item.status === 'blocked' && item.block !== 'imported').length)
const dupCount = computed(() => preview.value.filter((item) => item.message.includes('分成两条')).length)
const groups = computed(() => previewGroups(store.data, preview.value))
const aliasOptions = computed(() => activeSheet.value ? suggestValueAliases(store.data, activeSheet.value, mapping.value) : [])
const previewView = computed(() => {
  const dups = preview.value.filter((item) => item.message.includes('分成两条'))
  const blocked = preview.value.filter((item) => item.status === 'blocked' && !dups.includes(item))
  const ready = preview.value.filter((item) => item.status === 'ready')
  return [...dups, ...blocked, ...ready].slice(0, 80)
})
function blockCount(block: ImportBlock) {
  return preview.value.filter((item) => item.block === block).length
}

function sheetRows(rows: Record<string, string>[]) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), '商品')
  return book
}
function downloadTemplate() {
  const book = sheetRows([{ 分类: '手机', 商品名称: '示例手机', 品牌: 'Apple', 型号: 'iPhone 17', 容量: '256G', 颜色: '黑色' }])
  XLSX.writeFile(book, '商品导入模板.xlsx')
}
function exportBooks() {
  const products = store.data.families.map((family) => ({
    分类: store.data.categories.find((item) => item.id === family.categoryId)?.name || '',
    商品名称: family.name,
    商品状态: family.shelfStatus || family.lifecycle,
    品牌: family.commonAttrs['品牌'] || '',
    规格数: store.skusOf(family.id).length,
  }))
  const skus = store.data.skus.map((sku) => {
    const family = store.data.families.find((item) => item.id === sku.familyId)
    return { 商品名称: family?.name || '', 物料编码: sku.materialCode || '', 供应商编码: sku.supplierCode || '', 管家婆编号: sku.guanjiapoCode || '', 物料名称: sku.skuName || '', ...sku.variantAttrs }
  })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products), '商品')
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(skus), '物料')
  XLSX.writeFile(book, '商品导出.xlsx')
}
async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const bytes = new Uint8Array(await file.arrayBuffer())
  const book = XLSX.read(bytes, { type: 'array' })
  fileName.value = file.name
  fileSize.value = `${Math.ceil(file.size / 1024)} KB`
  fileKey.value = `${file.name}:${file.size}`
  sheets.value = book.SheetNames.map((name) => readSheet(name, XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: false, defval: '' }) as unknown[][]))
  selected.value = sheets.value.filter((item) => item.kind === 'material').slice(0, 1).map((item) => item.name)
  mapping.value = activeSheet.value ? suggestMapping(activeSheet.value.headers, activeSheet.value.sample) : []
  aliases.value = []
  temporaryGroups.value = []
  modelChoice.value = {}
  preview.value = []
  resultText.value = ''
}
function toggleSheet(name: string) {
  selected.value = selected.value.includes(name) ? [] : [name]
  const sheet = sheets.value.find((item) => item.name === name)
  mapping.value = sheet && selected.value.includes(name) ? suggestMapping(sheet.headers, sheet.sample) : []
  preview.value = []
}
function buildPreview() {
  const sheet = activeSheet.value
  if (!sheet) return
  preview.value = previewSheet(store.data, sheet, mapping.value, fileKey.value, { aliases: aliases.value, temporaryGroups: temporaryGroups.value, modelChoice: modelChoice.value })
  resultText.value = ''
}
function toggleAlias(item: ValueAlias) {
  aliases.value = aliases.value.some((alias) => alias.from === item.from) ? aliases.value.filter((alias) => alias.from !== item.from) : aliases.value.concat(item)
}
function toggleTemporary(key: string) {
  temporaryGroups.value = temporaryGroups.value.includes(key) ? temporaryGroups.value.filter((item) => item !== key) : temporaryGroups.value.concat(key)
}
function chooseModel(productTypeId: string, modelId: string) {
  modelChoice.value = { ...modelChoice.value, [productTypeId]: modelId }
}
function installModels() {
  const sheet = activeSheet.value
  if (!sheet) return
  const result = installAcceptanceCatalog(store.data, observedMaterials(sheet, mapping.value))
  buildPreview()
  ElMessage.success(result.created ? '已补上手机、平板和保护壳模型。原有手机模型没有改。' : '这三套模型已经在，没有重复创建。')
}
watch([aliases, temporaryGroups, modelChoice, mapping], () => { if (preview.value.length) buildPreview() }, { deep: true })
function confirm() {
  if (saving.value) return
  saving.value = true
  let result: ReturnType<typeof applyExcelImport> = []
  try {
    result = applyExcelImport(store.data, preview.value, uid)
  } finally {
    saving.value = false
  }
  const created = result.filter((item) => item.ok && item.created).length
  const replayed = result.filter((item) => item.ok && !item.created).length
  const failed = result.filter((item) => !item.ok)
  resultText.value = `新写入 ${created} 条，已导入过的 ${replayed} 条没有重复创建，失败 ${failed.length} 条。${failed[0] && !failed[0].ok ? failed[0].message : ''}`
  ElMessage.success(resultText.value)
}
</script>

<style scoped>
.sheet { margin: 8px 0; }
.sheet label { display: flex; gap: 8px; align-items: flex-start; }
.sheet span { color: #607089; }
</style>
