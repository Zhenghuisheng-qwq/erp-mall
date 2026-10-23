<template>
  <div :inert="saving" :aria-busy="saving">
    <PageHead :title="pageTitle" :desc="pageDesc">
      <el-tag v-if="draft.origin === 'sample'" type="info">预设演示</el-tag>
    </PageHead>
    <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />

    <V3FamilyBoard v-if="v3View" :family-id="familyRouteId" :sku-id="skuQuery" />
    <template v-else>
    <div class="panel">
      <h2>基本信息</h2>
      <el-form label-width="110px">
        <el-form-item label="商品分类" required>
          <CategoryTreeSelect :model-value="draft.categoryId" :categories="store.data.categories" :disabled="locked" :block-reason="categoryBlock" placeholder="选择分类" style="width: 320px" @update:model-value="onCategoryValue" />
          <span v-if="isNew && draft.categoryId && modelGate === 'none' && !v3Create" class="issue-error" style="margin-left: 8px">当前分类未配置商品模型，使用普通录入。</span>
          <span v-else-if="isNew && modelGate === 'unpublished'" class="issue-error" style="margin-left: 8px">当前模型未发布，不能用于新增商品。</span>
          <span v-else-if="isNew && modelGate === 'invalid'" class="issue-error" style="margin-left: 8px">商品模型配置异常，请联系管理员。</span>
        </el-form-item>
      </el-form>
      <V3CreateFlow v-if="v3Create" :category-id="draft.categoryId" />
      <div v-else-if="isNew && categoryTypes.length" class="row-actions">
        <el-select v-if="categoryTypes.length > 1" v-model="temporaryTypeId" placeholder="选择产品类型" style="width: 220px">
          <el-option v-for="item in categoryTypes" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button @click="temporaryOpen = true">创建临时物料</el-button>
        <span class="muted">没有已发布的商品模型。临时物料不会生成正式规划编号，也不会写入属性词典。</span>
      </div>
      <TemporaryMaterialDialog v-if="isNew && !v3Create" :open="temporaryOpen" :category-id="draft.categoryId" :product-type-id="temporaryTypeId" @close="temporaryOpen = false" @open="openTemporary" />
      <el-form v-if="!v3Create" label-width="110px">
        <el-form-item label="商品名称" required>
          <el-input v-model="draft.name" style="width: 320px" @input="nameTouched = true" />
          <el-button link type="primary" @click="fillName">按公共信息生成</el-button>
        </el-form-item>
        <el-form-item label="OA_ProductID">
          <el-input v-model="draft.oaProductId" style="width: 320px" placeholder="可空" />
        </el-form-item>
        <template v-if="showSchemeFields">
        <el-form-item v-for="item in commons" :key="item.paramId" :label="item.param.name" :required="item.required">
          <div :data-field="`common-${item.paramId}`">
            <el-select v-model="draft.commonAttrs[item.param.name]" :disabled="locked" clearable filterable default-first-option style="width: 320px" @change="onCommonChange">
              <el-option v-for="value in fieldChoices(item.param.id, item.param.name)" :key="value" :label="value" :value="value" />
            </el-select>
            <el-button link type="primary" @click="openValue(item.param.id, item.param.name, 'common')">新增</el-button>
            <span v-if="errorText(commonHint(item.param.id))" class="sku-hint issue-error">{{ errorText(commonHint(item.param.id)) }}</span>
          </div>
        </el-form-item>
        </template>
      </el-form>
      <div v-if="!v3Create" class="source-box">
        <p><span>来源模型</span>{{ sourceModel }}</p>
        <p><span>来源规划</span>{{ planSource || '不是由规划生成' }}</p>
        <p><span>SKU数量</span>{{ draftSkus.length }}</p>
      </div>
      <p v-if="modelMode">当前使用模型：{{ modelTitle }}</p>
      <p v-if="modelMode">当前规格来源：商品模型</p>
      <p v-else-if="modelTitle && usingModel">当前商品模型：{{ modelTitle }}</p>
      <p v-if="modelMode" class="path-now">
        <span>当前选择路径：</span>
        <button type="button" @click="resetSelection">{{ schemeName }}</button>
        <template v-for="(item, index) in trail" :key="`${item.nodeId}-${index}`">
          <span>&gt;</span>
          <button type="button" :class="{ 'is-on': index === trail.length - 1 }" @click="truncateSelection(item.nodeId)">{{ item.label }}</button>
        </template>
      </p>
      <p v-else-if="usingModel">创建时结构：{{ modelPath }}</p>
      <p v-else-if="draft.templateId && !isNew">属性路径：{{ modelPath }}</p>
      <p v-if="usingModel && !modelMode" class="muted">编辑时沿用创建时的模型版本，不读取后来发布的新版本。</p>
      <p class="muted">商品状态：{{ shelfLabel }}。已发布后不能改分类。历史规格仍按原来的属性名和值保存。</p>
    </div>

    <div v-if="modelMode && !v3Create" class="panel">
      <h2>规格模型</h2>
      <p>当前商品模型：{{ modelTitle }}</p>
      <p class="muted">公共属性单选，选中后继续展开下一层。规格属性可多选，系统按全部组合自动生成规格。</p>
      <ProductModelSelector :template-id="draft.templateId" :nodes="modelNodes" :model-value="selection" @update:model-value="onSelection" />
    </div>

    <div v-if="spuOnly && !v3Create" class="panel">
      <h2>规格</h2>
      <p>此商品没有规格，只生成商品本身。</p>
    </div>
    <div v-else-if="!v3Create" class="panel">
      <div class="row-actions" style="margin-bottom: 10px">
        <h2 style="margin: 0">规格</h2>
        <el-button v-if="showSchemeFields" type="primary" :disabled="!draft.templateId" @click="addSku">新增规格</el-button>
        <el-button v-if="showSchemeFields" :disabled="!draft.templateId" @click="batchOpen = true">批量添加</el-button>
        <el-checkbox v-if="!usingModel" v-model="showOptional">显示可不填的规格</el-checkbox>
        <span v-if="modelMode" class="muted">规格由商品模型自动生成，不能手动添加。</span>
      </div>
      <div v-if="namedSkus.length" class="sku-lines">
        <div v-for="sku in namedSkus" :key="sku.id" class="sku-line">
          <strong>SKU：{{ sku.skuName }}</strong>
          <p v-for="item in specEntries(sku)" :key="item.name"><span>{{ item.name }}</span>{{ item.value }}</p>
        </div>
      </div>
      <el-table :data="draftSkus" border size="small">
        <el-table-column label="#" width="54" fixed="left">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="规格名称" min-width="160" fixed="left">
          <template #default="{ row }">{{ rowTitle(row) }}</template>
        </el-table-column>
        <el-table-column v-for="item in specColumns" :key="item.paramId" :label="item.required ? item.name + ' *' : item.name" min-width="180">
          <template #default="{ row }">
            <span v-if="modelMode">{{ row.variantAttrs[item.name] }}</span>
            <div v-else :data-field="`${row.id}-${item.paramId}`">
              <el-select v-model="row.variantAttrs[item.name]" clearable filterable default-first-option size="small">
                <el-option v-for="value in columnChoices(item, row)" :key="value" :label="value" :value="value">
                  <span v-if="item.name === '颜色'" class="swatch" :style="{ background: colorOf(value) }" />{{ value }}
                </el-option>
              </el-select>
              <el-button v-if="!usingModel" link type="primary" @click="openValue(item.paramId, item.name, row.id)">新增</el-button>
              <span v-if="errorText(skuHint(row, item.paramId))" class="sku-hint issue-error">{{ errorText(skuHint(row, item.paramId)) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-select v-model="row.status" size="small">
              <el-option label="在售" value="on_sale" />
              <el-option label="停售" value="off_sale" />
              <el-option label="草稿" value="draft" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="OA_SKUID" width="140">
          <template #default="{ row }"><el-input v-model="row.oaSkuId" size="small" /></template>
        </el-table-column>
        <el-table-column v-if="!modelMode" label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link @click="copySku(row)">复制</el-button>
            <el-button link type="danger" @click="draftSkus = draftSkus.filter((item) => item.id !== row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="!v3Create" class="panel">
      <h2>配置预览</h2>
      <p>{{ draft.name || '未命名商品' }} · {{ categoryPath(store.data, draft.categoryId) || '未选分类' }}</p>
      <p class="muted" style="margin: 8px 0">公共信息：{{ commonText }}</p>
      <el-table :data="draftSkus" size="small">
        <el-table-column label="规格" min-width="180">
          <template #default="{ row }">{{ rowTitle(row) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column label="OA_SKUID" prop="oaSkuId" />
      </el-table>
      <div class="issue-list">
        <div v-for="issue in errors" :key="issueKey(issue)">
          <button class="linkish issue-error" @click="toggleIssue(issue)">{{ issue.message }}</button>
          <div v-if="openedKey === issueKey(issue)" class="issue-detail">
            <p><span>字段名称</span>{{ issue.paramName || '规格' }}</p>
            <p><span>当前值</span>{{ issueValue(issue) }}</p>
            <p><span>问题原因</span>{{ issueReason(issue) }}</p>
            <p><span>修改建议</span>{{ issueAdvice(issue) }}</p>
          </div>
        </div>
        <button v-if="warnings.length" class="linkish issue-warn" @click="warnOpen = !warnOpen">{{ warnOpen ? '收起' : '查看' }} {{ warnings.length }} 项未限制</button>
        <template v-if="warnOpen">
          <div v-for="issue in warnings" :key="issueKey(issue)">
            <button class="linkish issue-warn" @click="toggleIssue(issue)">{{ issue.message }}</button>
            <div v-if="openedKey === issueKey(issue)" class="issue-detail">
              <p><span>字段名称</span>{{ issue.paramName || '规格' }}</p>
              <p><span>当前值</span>{{ issueValue(issue) }}</p>
              <p><span>问题原因</span>{{ issueReason(issue) }}</p>
              <p><span>修改建议</span>{{ issueAdvice(issue) }}</p>
            </div>
          </div>
        </template>
        <p v-if="issues.length === 0" class="tag-ok">没有待处理问题。</p>
      </div>
    </div>

    <div v-if="!v3Create" class="footer-bar">
      <div>
        <button class="linkish summary" @click="locate(firstIssue)">{{ summary }}</button>
      </div>
      <div class="row-actions">
        <el-button :disabled="saving" @click="cancel">取消</el-button>
        <el-button v-if="shelf === 'online'" :loading="saving" @click="setShelf('offline')">下架</el-button>
        <el-button :loading="saving" @click="save(false)">保存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="save(true)">{{ shelf === 'online' ? '保存' : '发布商品' }}</el-button>
      </div>
    </div>

    <el-dialog v-model="valueOpen" :title="`新增${valueParamName}`" width="420px" :close-on-press-escape="!saving" :close-on-click-modal="!saving" :show-close="!saving">
      <el-input v-model="valueText" :disabled="saving" :placeholder="`新的${valueParamName}`" />
      <p class="muted" style="margin-top: 8px">确认后写入属性词典，其他用到这个属性的分类也能选到。</p>
      <template #footer>
        <el-button :disabled="saving" @click="valueOpen = false">取消</el-button>
        <el-button type="primary" :disabled="saving" @click="confirmValue">确认并选中</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchOpen" title="批量添加规格" width="560px" :close-on-press-escape="!saving" :close-on-click-modal="!saving" :show-close="!saving">
      <div v-for="item in variants" :key="item.paramId" style="margin-bottom: 10px">
        <div>{{ item.param.name }}</div>
        <el-select v-model="batchPick[item.param.name]" :disabled="saving" multiple style="width: 100%">
          <el-option v-for="value in item.param.values" :key="value" :label="value" :value="value" />
        </el-select>
      </div>
      <template #footer>
        <el-button :disabled="saving" @click="batchOpen = false">取消</el-button>
        <el-button type="primary" :disabled="saving" @click="applyBatch">生成</el-button>
      </template>
    </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import CategoryTreeSelect from '../components/CategoryTreeSelect.vue'
import PageHead from '../components/PageHead.vue'
import ProductModelSelector from '../components/ProductModelSelector.vue'
import TemporaryMaterialDialog from '../components/TemporaryMaterialDialog.vue'
import V3CreateFlow from '../components/V3CreateFlow.vue'
import V3FamilyBoard from '../components/V3FamilyBoard.vue'
import { publishedModelsForCategory } from '../domain/material'
import { blankVariantAttrs, boundParams, categoryPath, collectModelSelections, constraintOf, emptyModelSelection, generateSkuFromModel, inspectFamily, latestPublishedVersion, mappingForCategory, modelPathText, modelSelectionTrail, modelVersionById, paramById, pathVariantColumns, productModelGate, selectedById, shelfOf, shelfText, specCanvasOf, statusText, truncateModelPath, type ModelSelection, type ModelSpecColumn } from '../domain/logic'
import type { ConstraintResult, FieldIssue, ProductFamily, Sku } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const COLORS: Record<string, string> = { 蓝色: '#2f6fed', 白色: '#f4f7fb', 橙色: '#f5a623', 黑色: '#22262e', 银色: '#c5ccd6', 透明: '#d9e7f5' }
const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const saved = ref(false)
const saving = ref(false), saveError = ref('')
const temporaryOpen = ref(false)
const temporaryTypeId = ref('')
const nameTouched = ref(false)
const isNew = computed(() => route.name === 'product-new')
const familyRouteId = computed(() => String(route.params.id || ''))
const skuQuery = computed(() => String(route.query.sku || ''))
const v3View = computed(() => !isNew.value && draft.line === 'v3')
const v3Create = computed(() => isNew.value && !route.query.from && publishedModelsForCategory(store.data, draft.categoryId).length > 0)
const pageTitle = computed(() => {
  if (isNew.value) return '新增商品'
  if (v3View.value) return '商品物料档案'
  return '编辑商品'
})
const pageDesc = computed(() => {
  if (v3View.value) return '这里维护这款商品下的物料。商品名称、分类和规格沿用建档时的记录，此页不修改商品主体。'
  if (v3Create.value) return '先确认分类和规格，再填写这一条物料。已经确定的规格不用重填。'
  return '分类只选一次。上面填这款商品的共同信息，下面直接加规格，不用再进别的页面。'
})
const draft = reactive<ProductFamily>(blankFamily())
watch(pageTitle, (value) => {
  route.meta.title = value
}, { immediate: true })
watch(v3Create, (value) => { if (value) saved.value = true })
const draftSkus = ref<Sku[]>([])
const valueOpen = ref(false)
const valueText = ref('')
const valueParamId = ref('')
const valueParamName = ref('')
const valueTarget = ref('common')
const batchOpen = ref(false)
const selection = ref<ModelSelection>(emptyModelSelection())
const batchPick = reactive<Record<string, string[]>>({})
const showOptional = ref(false)
const warnOpen = ref(false)
const openedKey = ref('')

const modelGate = computed(() => (draft.categoryId ? productModelGate(store.data, draft.templateId) : 'none'))
const modelMode = computed(() => isNew.value && !route.query.from && modelGate.value === 'ready' && !v3Create.value)
const modelNodes = computed(() => (draft.modelVersionId ? modelVersionById(store.data, draft.modelVersionId)?.nodesSnapshot || [] : []))
const usingModel = computed(() => Boolean(draft.modelVersionId) && modelNodes.value.length > 0)
const showSchemeFields = computed(() => !v3Create.value && !modelMode.value && !usingModel.value && Boolean(draft.templateId) && modelGate.value !== 'unpublished' && modelGate.value !== 'invalid')
const commons = computed(() => (draft.templateId ? boundParams(store.data, draft.templateId, 'common') : []))
const variants = computed(() => (draft.templateId ? boundParams(store.data, draft.templateId, 'variant') : []))
const visibleVariants = computed(() => variants.value.filter((item) => item.required || showOptional.value))
const specColumns = computed(() => {
  if (modelMode.value) return pathVariantColumns(store.data, draft.templateId, modelNodes.value, selection.value)
  if (usingModel.value) return savedVariantColumns()
  return visibleVariants.value.map((item) => ({ paramId: item.paramId, name: item.param.name, required: item.required, values: [] as string[], role: 'variant' as const }))
})
const issues = computed(() => {
  if (v3View.value || v3Create.value) return []
  if (!draft.templateId) return []
  if (usingModel.value) {
    return inspectFamily(store.data, draft, draftSkus.value, specColumns.value.map((item) => item.name)).filter((issue) => !(spuOnly.value && issue.message === '至少添加一条规格'))
  }
  return inspectFamily(store.data, draft, draftSkus.value)
})
const errors = computed(() => issues.value.filter((item) => item.level === 'error'))
const warnings = computed(() => issues.value.filter((item) => item.level === 'warn'))
const firstIssue = computed(() => errors.value[0] || issues.value[0])
const summary = computed(() => {
  if (!draft.templateId) return '先选择商品分类。'
  if (errors.value.length === 0) return `${draftSkus.value.length} 条规格，必填项已齐全，没有重复规格。`
  return errors.value[0]?.message || '请处理标红的问题。'
})
const shelf = computed(() => shelfOf(draft))
const shelfLabel = computed(() => shelfText(shelf.value))
const locked = computed(() => !isNew.value && shelf.value === 'online')
const modelPath = computed(() => (draft.templateId ? modelPathText(store.data, draft) : '先选择分类'))
const sourceModel = computed(() => {
  if (!draft.templateId) return '未关联模型'
  return specCanvasOf(store.data, draft.productModelId || draft.templateId)?.name || store.data.templates.find((item) => item.id === draft.templateId)?.name || '商品模型'
})
const planSource = computed(() => {
  if (!draft.productPlanId) return ''
  return store.data.productPlans.find((item) => item.id === draft.productPlanId)?.name || '商品规划'
})
const namedSkus = computed(() => draftSkus.value.filter((item) => item.skuName))
const schemeName = computed(() => store.data.templates.find((item) => item.id === draft.templateId)?.name || '商品')
const trail = computed(() => modelSelectionTrail(store.data, draft.templateId, modelNodes.value, selection.value))
const builtModel = computed(() => (modelMode.value ? modelDraft() : null))
const spuOnly = computed(() => Boolean(builtModel.value?.spuOnly))
const modelTitle = computed(() => {
  if (!draft.templateId) return ''
  const name = store.data.templates.find((item) => item.id === draft.templateId)?.name || '商品'
  const version = (draft.modelVersionId ? modelVersionById(store.data, draft.modelVersionId)?.versionName : '') || latestPublishedVersion(store.data, draft.templateId)?.versionName || 'V1'
  return `${name}模型 ${version}`
})
const commonText = computed(() => {
  if (usingModel.value) return Object.entries(draft.commonAttrs).filter(([, value]) => value).map(([name, value]) => `${name} ${value}`).join('，')
  return commons.value.map((item) => `${item.param.name} ${draft.commonAttrs[item.param.name] || '空'}`).join('，')
})

function colorOf(value: string) {
  return COLORS[value] || '#d0d7e2'
}
function blankFamily(): ProductFamily {
  return {
    id: uid('fam'),
    name: '',
    templateId: '',
    modelVersionId: '',
    categoryId: '',
    oaProductId: '',
    commonAttrs: {},
    productGroupIds: [],
    lifecycle: 'draft',
    shelfStatus: 'draft',
    createdAt: new Date().toISOString(),
    origin: 'created',
    updatedAt: new Date().toISOString(),
  }
}
function cloneSku(source: Sku, familyId: string): Sku {
  const next: Sku = { ...source, id: uid('sku'), familyId, variantAttrs: { ...source.variantAttrs }, projectedAttrs: {} }
  delete next.materialCode
  return next
}
function categoryBlock(id: string) {
  const category = store.data.categories.find((item) => item.id === id)
  if (!category) return '分类已不存在。'
  if (category.enabled === false) return '这个分类已停用，不能用于新增商品。'
  return ''
}
function onCategoryValue(value: string | string[]) {
  if (typeof value !== 'string' || !value) return
  onCategory(value)
}
function onCategory(categoryId: string) {
  const category = store.data.categories.find((item) => item.id === categoryId)
  if (category && category.enabled === false) {
    ElMessage.warning('这个分类已停用，不能用于新增商品。')
    return
  }
  const mapping = mappingForCategory(store.data, categoryId)
  draft.categoryId = categoryId
  if (publishedModelsForCategory(store.data, categoryId).length) {
    draft.templateId = ''
    draft.modelVersionId = ''
    draft.commonAttrs = {}
    draftSkus.value = []
    selection.value = emptyModelSelection()
    return
  }
  if (!mapping) {
    draft.templateId = ''
    if (isNew.value && !route.query.from) draft.modelVersionId = ''
    ElMessage.warning('这个分类还不能录入。请到「商品分类中心」配置属性方案。')
    return
  }
  draft.templateId = mapping.templateId
  selection.value = emptyModelSelection()
  const enteringModel = isNew.value && !route.query.from && productModelGate(store.data, mapping.templateId) === 'ready'
  const version = latestPublishedVersion(store.data, mapping.templateId)
  if (enteringModel && version) {
    draft.modelVersionId = version.id
    selection.value = emptyModelSelection()
    draft.commonAttrs = {}
    draftSkus.value = []
    syncFromModel()
  } else {
    if (isNew.value && !route.query.from) draft.modelVersionId = ''
    const nextCommon: Record<string, string> = {}
    commons.value.forEach((item) => {
      nextCommon[item.param.name] = draft.commonAttrs[item.param.name] || ''
    })
    draft.commonAttrs = nextCommon
    draftSkus.value = draftSkus.value.map((sku) => ({ ...sku, variantAttrs: { ...blankVariantAttrs(variants.value), ...sku.variantAttrs } }))
  }
  if (!nameTouched.value) fillName()
}
function savedVariantColumns(): ModelSpecColumn[] {
  const names: string[] = []
  draftSkus.value.forEach((sku) => {
    Object.entries(sku.variantAttrs).forEach(([name, value]) => {
      if (value && !names.includes(name)) names.push(name)
    })
  })
  return names.map((name) => {
    const param = store.data.params.find((item) => item.name === name)
    const values = draftSkus.value.map((sku) => sku.variantAttrs[name]).filter((value, index, list) => value && list.indexOf(value) === index)
    return { paramId: param?.id || name, name, required: false, values, role: 'variant' as const }
  })
}
function fillName() {
  const names = usingModel.value
    ? Object.values(draft.commonAttrs)
    : commons.value.map((item) => draft.commonAttrs[item.param.name])
  draft.name = names.filter(Boolean).join(' ')
  nameTouched.value = false
}
function onCommonChange() {
  if (!nameTouched.value) fillName()
}
function fieldChoices(paramId: string, name: string) {
  if (name !== '品牌') return choices(paramId, draft.commonAttrs)
  const current = draft.commonAttrs['品牌']
  const enabled = store.data.brands.filter((item) => item.status === 'enabled').map((item) => item.name)
  const base = enabled.length ? enabled : choices(paramId, draft.commonAttrs)
  return current && !base.includes(current) ? [current, ...base] : base
}
function choices(paramId: string, attrs: Record<string, string>) {
  const selected = selectedById(store.data, attrs)
  const result = constraintOf(store.data, draft.templateId, paramId, selected)
  const name = store.data.params.find((item) => item.id === paramId)?.name || ''
  const current = attrs[name]
  if (current && !result.values.includes(current)) return [current, ...result.values]
  return result.values
}
function decorateHint(paramId: string, attrs: Record<string, string>): ConstraintResult {
  const result = constraintOf(store.data, draft.templateId, paramId, selectedById(store.data, attrs))
  const name = store.data.params.find((item) => item.id === paramId)?.name || ''
  const value = attrs[name]
  if (value && result.status === 'hit' && !result.values.includes(value)) {
    return { status: 'empty', values: result.values, message: '当前取值不在允许范围内。' }
  }
  return result
}
function commonHint(paramId: string): ConstraintResult {
  return decorateHint(paramId, draft.commonAttrs)
}
function skuHint(sku: Sku, paramId: string): ConstraintResult {
  return decorateHint(paramId, { ...draft.commonAttrs, ...sku.variantAttrs })
}
function errorText(result: ConstraintResult) {
  if (result.message.includes('不在允许')) return '不在允许范围'
  if (result.status === 'empty') return '没有可选值'
  return ''
}
function issueKey(issue: FieldIssue) {
  return `${issue.kind}|${issue.skuId || ''}|${issue.paramId || ''}|${issue.message}`
}
function issueValue(issue: FieldIssue) {
  if (issue.paramName === '商品名称') return draft.name || '空'
  if (issue.paramName === '商品分类') return categoryPath(store.data, draft.categoryId) || '空'
  if (issue.value) return issue.value
  if (issue.kind === 'duplicate' && issue.skuId) {
    const sku = draftSkus.value.find((item) => item.id === issue.skuId)
    if (!sku) return '空'
    return variants.value.map((item) => `${item.param.name} ${sku.variantAttrs[item.param.name] || '空'}`).join('，')
  }
  if (issue.paramName && issue.skuId) {
    const sku = draftSkus.value.find((item) => item.id === issue.skuId)
    return sku?.variantAttrs[issue.paramName] || '空'
  }
  if (issue.paramName) return draft.commonAttrs[issue.paramName] || '空'
  return '空'
}
function issueReason(issue: FieldIssue) {
  if (!issue.detail) return issue.message
  const plain = issue.detail.replace(/。$/, '')
  if (issue.message.includes(plain)) return issue.message
  return `${issue.message}。${issue.detail}`
}
function issueAdvice(issue: FieldIssue) {
  if (issue.kind === 'required') return issue.paramName ? `请填写${issue.paramName}` : '请至少添加一条规格'
  if (issue.kind === 'duplicate') return '请修改其中一条规格，让组合不再相同'
  if (issue.kind === 'illegal') {
    const allowed = issue.detail?.match(/只能选择：(.+)/)?.[1]
    return allowed ? `请改成：${allowed}` : '请改成规则允许的值'
  }
  return '可以保持当前值。如果需要限制可选范围，请到规格约束里补充规则。'
}
function toggleIssue(issue: FieldIssue) {
  const key = issueKey(issue)
  openedKey.value = openedKey.value === key ? '' : key
  locate(issue)
}
function onSelection(value: ModelSelection) {
  selection.value = value
}
function resetSelection() {
  selection.value = emptyModelSelection()
}
function truncateSelection(nodeId: string) {
  selection.value = truncateModelPath(store.data, draft.templateId, modelNodes.value, selection.value, nodeId)
}
function rowTitle(sku: Sku) {
  if (sku.skuName) return sku.skuName
  const parts = specColumns.value.map((item) => sku.variantAttrs[item.name]).filter(Boolean)
  return parts.join(' / ') || '未填规格'
}
function specEntries(sku: Sku) {
  const fromNodes = (sku.sourceNodeIds || []).flatMap((id) => {
    const node = modelNodes.value.find((item) => item.id === id)
    const name = node ? paramById(store.data, node.attributeId)?.name || '' : ''
    return node && name && node.valueId ? [{ name, value: node.valueId }] : []
  })
  if (fromNodes.length) return fromNodes
  return Object.entries(sku.variantAttrs).filter(([, value]) => value).map(([name, value]) => ({ name, value }))
}
function columnChoices(column: ModelSpecColumn, sku: Sku) {
  if (column.values.length) {
    const current = sku.variantAttrs[column.name]
    return current && !column.values.includes(current) ? [current, ...column.values] : column.values
  }
  return choices(column.paramId, { ...draft.commonAttrs, ...sku.variantAttrs })
}
function variantKey(attrs: Record<string, string>) {
  return Object.keys(attrs).sort().map((key) => `${key}=${attrs[key]}`).join('|')
}
function modelDraft() {
  const collected = collectModelSelections(store.data, draft.templateId, modelNodes.value, selection.value)
  if (!collected.complete) return { complete: false, spuOnly: false, common: collected.commonAttrs, skus: [] as { variant: Record<string, string> }[] }
  const generated = generateSkuFromModel({
    commonAttrs: collected.commonAttrs,
    variantSelections: collected.variantSelections,
    modelSnapshot: modelNodes.value,
  })
  return { complete: true, spuOnly: generated.skus.length === 0, common: generated.commonAttrs, skus: generated.skus }
}
const categoryTypes = computed(() => store.data.productTypes.filter((item) => item.categoryId === draft.categoryId && item.status === 'enabled'))
watch(categoryTypes, (rows) => {
  if (!rows.some((item) => item.id === temporaryTypeId.value)) temporaryTypeId.value = rows[0]?.id || ''
})
function openTemporary(familyId: string, skuId: string) {
  temporaryOpen.value = false
  saved.value = true
  router.push(`/products/${familyId}?sku=${skuId}`)
}
function syncFromModel() {
  if (!modelMode.value || publishedModelsForCategory(store.data, draft.categoryId).length) return
  const built = modelDraft()
  draft.commonAttrs = { ...built.common }
  if (!built.complete) {
    draftSkus.value = []
    if (!nameTouched.value) fillName()
    return
  }
  const previous = new Map(draftSkus.value.map((sku) => [variantKey(sku.variantAttrs), sku]))
  draftSkus.value = built.skus.map((item) => {
    const old = previous.get(variantKey(item.variant))
    return {
      id: old?.id || uid('sku'),
      familyId: draft.id,
      code: old?.code || '',
      oaSkuId: old?.oaSkuId || '',
      status: old?.status || ('on_sale' as const),
      variantAttrs: { ...item.variant },
      projectedAttrs: {},
    }
  })
  if (!nameTouched.value) fillName()
}
watch(selection, () => syncFromModel(), { deep: true })
function addSku() {
  draftSkus.value.push(store.blankSku(draft.id, draft.templateId))
}
function copySku(row: Sku) {
  draftSkus.value.push(cloneSku(row, draft.id))
  ElMessage.info('已复制。如果规格完全一样，检查里会提示重复。')
}
function openValue(paramId: string, name: string, target: string) {
  valueParamId.value = paramId
  valueParamName.value = name
  valueTarget.value = target
  valueText.value = ''
  valueOpen.value = true
}
function confirmValue() {
  const value = valueText.value.trim()
  if (!value) return
  const param = store.data.params.find((item) => item.id === valueParamId.value)
  if (!param) return
  if (!param.values.includes(value)) param.values.push(value)
  if (valueTarget.value === 'common') draft.commonAttrs[param.name] = value
  else {
    const sku = draftSkus.value.find((item) => item.id === valueTarget.value)
    if (sku) sku.variantAttrs[param.name] = value
  }
  valueOpen.value = false
  ElMessage.success('已加入词典并选中')
}
function applyBatch() {
  const fields = variants.value.map((item) => batchPick[item.param.name]?.length ? batchPick[item.param.name] : [''])
  if (fields.every((item) => item.length === 1 && item[0] === '')) {
    ElMessage.warning('先勾选要组合的规格值')
    return
  }
  const combos = fields.reduce<string[][]>((acc, list) => acc.flatMap((row) => list.map((value) => [...row, value])), [[]])
  let added = 0
  combos.slice(0, 40).forEach((combo) => {
    const sku = store.blankSku(draft.id, draft.templateId)
    variants.value.forEach((item, index) => {
      sku.variantAttrs[item.param.name] = combo[index] || ''
    })
    const key = variants.value.map((item) => sku.variantAttrs[item.param.name] || '').join('|')
    const exists = draftSkus.value.some((item) => variants.value.map((param) => item.variantAttrs[param.param.name] || '').join('|') === key)
    if (!exists) {
      draftSkus.value.push(sku)
      added += 1
    }
  })
  batchOpen.value = false
  ElMessage.success(`新增 ${added} 条规格`)
}
function locate(issue?: FieldIssue) {
  if (!issue) return
  const key = issue.skuId ? `${issue.skuId}-${issue.paramId}` : `common-${issue.paramId}`
  requestAnimationFrame(() => document.querySelector(`[data-field="${key}"]`)?.scrollIntoView({ block: 'center' }))
}
async function setShelf(status: 'draft' | 'online' | 'offline') {
  if (saving.value) return
  if (status === 'online') {
    draft.shelfStatus = 'online'
    await save(true)
    return
  }
  draft.shelfStatus = status
  if (status === 'draft') draft.lifecycle = 'draft'
  draft.createdAt = draft.createdAt || new Date().toISOString()
  saving.value = true; saveError.value = ''
  try {
    const result = await store.saveBundle({ ...draft }, draftSkus.value.map((item) => ({ ...item, variantAttrs: { ...item.variantAttrs } })))
    if (!result.ok) { saveError.value = result.message || '保存未完成，当前输入已保留。'; return }
    saved.value = true; saving.value = false
    ElMessage.success(status === 'offline' ? '已下架，原有规格还在' : '已存为草稿')
    await router.push('/products')
  } catch (cause) { saveError.value = cause instanceof Error ? cause.message : '保存未完成，当前输入已保留。' }
  finally { saving.value = false }
}
async function save(formal: boolean) {
  if (saving.value) return
  if (!draft.templateId) {
    ElMessage.error('请先选择可以录入的商品分类')
    return
  }
  if (formal && errors.value.length) {
    ElMessage.error(errors.value[0]?.message || '还有问题')
    locate(errors.value[0])
    return
  }
  draft.createdAt = draft.createdAt || new Date().toISOString()
  if (formal) draft.shelfStatus = 'online'
  else if (draft.shelfStatus !== 'offline') draft.shelfStatus = 'draft'
  draft.lifecycle = formal && errors.value.length === 0 ? 'ready' : 'draft'
  saving.value = true; saveError.value = ''
  try {
    const result = await store.saveBundle({ ...draft }, draftSkus.value.map((item) => ({ ...item, variantAttrs: { ...item.variantAttrs } })))
    if (!result.ok) { saveError.value = result.message || '保存未完成，当前输入已保留。'; return }
    saved.value = true; saving.value = false
    ElMessage.success(formal ? '商品已保存' : '草稿已保存')
    await router.push('/products')
  } catch (cause) { saveError.value = cause instanceof Error ? cause.message : '保存未完成，当前输入已保留。' }
  finally { saving.value = false }
}
async function cancel() {
  if (saving.value) return
  await ElMessageBox.confirm('离开后，这次还没保存的修改会丢掉。', '取消编辑')
  saved.value = true
  router.push('/products')
}

function loadRoutedFamily() {
  const from = String(route.query.from || '')
  const id = String(route.params.id || '')
  const sourceId = from || id
  if (sourceId && sourceId !== 'new') {
    const family = store.data.families.find((item) => item.id === sourceId)
    if (family) {
      Object.assign(draft, JSON.parse(JSON.stringify(family)) as ProductFamily)
      if (family.line === 'v3' && !from) {
        saved.value = true
        return
      }
      if (family.line === 'v3' && from) {
        saved.value = true
        router.replace('/products')
        return
      }
      draftSkus.value = store.skusOf(family.id).map((item) => JSON.parse(JSON.stringify(item)) as Sku)
      nameTouched.value = !from
      if (from) {
        draft.id = uid('fam')
        draft.name = `${family.name} 副本`
        draft.origin = 'created'
        draft.productPlanId = undefined
        draftSkus.value = draftSkus.value.map((item) => cloneSku(item, draft.id))
      }
      const copySkuId = String(route.query.copySku || '')
      if (copySkuId) {
        const source = draftSkus.value.find((item) => item.id === copySkuId)
        if (source) draftSkus.value.push(cloneSku(source, draft.id))
      }
    }
  }
  const category = String(route.query.category || '')
  if (category && isNew.value && !from) onCategory(category)
}
onMounted(loadRoutedFamily)
watch(() => [route.params.id, route.query.from, route.query.sku], loadRoutedFamily)

onBeforeRouteLeave(async () => {
  if (saving.value) return false
  if (saved.value) return true
  try {
    await ElMessageBox.confirm('还有未保存的修改，离开后会丢掉。', '离开编辑')
    return true
  } catch {
    return false
  }
})
onBeforeRouteUpdate(() => !saving.value)
const beforeUnload = (event: BeforeUnloadEvent) => { if (saving.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped>
.path-now { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.path-now button { border: 0; background: transparent; color: #1f3b66; cursor: pointer; padding: 0; }
.path-now button.is-on { color: #2f6fed; font-weight: 650; }
.source-box { margin-top: 12px; padding: 10px 12px; background: #f7faff; border-radius: 8px; }
.source-box p { display: flex; gap: 12px; margin: 4px 0; }
.source-box span { color: #66788a; min-width: 72px; }
.sku-lines { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.sku-line { padding: 10px 12px; background: #f7faff; border-radius: 8px; }
.sku-line p { display: flex; gap: 8px; margin: 4px 0 0; }
.sku-line span { color: #66788a; min-width: 48px; }
</style>
