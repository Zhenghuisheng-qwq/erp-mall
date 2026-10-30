<template>
  <div :inert="saving" :aria-busy="saving">
    <PageHead title="新增 SKU" desc="先确定所属 SPU，再填写或批量生成规格。预览和取消都不会写入业务数据。"><el-button @click="back">返回 SKU 管理</el-button></PageHead>
    <p v-if="copy" class="muted" data-sku-copy-policy>已复制所选 SKU 的规格草稿。请核对目标 SPU 的模型版本与规格来源后创建。</p>
    <section class="panel" style="margin-bottom: 16px">
      <h2>1. 选择 SPU</h2>
      <SpuPicker :model-value="familyId" :plan-id="planId" :template-id="templateId" @change="selectFamily" />
      <el-button style="margin-top: 12px" @click="openSpu" :disabled="!(store.can('product:spu:create'))">新建 SPU</el-button>
      <template v-if="family">
        <p data-selected-spu>所属 SPU：<el-button link type="primary" @click="router.push(`/spus/${family.id}`)">{{ family.name }}</el-button> · {{ categoryPath(store.data, family.categoryId) }} · {{ productTypeName(store.data, family) }}</p>
        <p>公共属性：{{ attrsText(family.commonAttrs) || '未填写' }} · 版本：{{ versionName }}</p>
      </template>
      <p v-if="problem" class="issue-error" role="alert">{{ problem }} <el-button v-if="family" link @click="router.push(`/spus/${family.id}`)">补全 SPU 配置</el-button></p>
    </section>
    <section v-if="family && !problem" class="panel" style="margin-bottom: 16px">
      <h2>2. 填写或生成规格</h2>
      <el-radio-group v-if="!planId" v-model="kind" style="margin-bottom: 16px">
        <el-radio-button value="manual">单个规格</el-radio-button>
        <el-radio-button :value="family.modelVersionId ? 'model' : 'template'">{{ family.modelVersionId ? '模型批量生成' : '模板批量生成' }}</el-radio-button>
      </el-radio-group>
      <p v-else>规划：{{ plan?.name || planId }}。生成后，每条 SKU 都会保留规划和模型版本来源。</p>
      <SkuFields :disabled="!(store.can('product:sku:create'))" v-if="kind === 'manual'" v-model="draft" :family="family" />
      <el-form v-else-if="kind === 'template'" label-width="110px">
        <el-form-item v-for="field in fields" :key="field.name" :label="field.name"><el-select v-model="selections[field.name]" multiple filterable allow-create default-first-option :placeholder="`选择${field.name}范围`"><el-option v-for="value in field.values" :key="value" :label="value" :value="value" /></el-select></el-form-item>
      </el-form>
      <p v-else-if="kind === 'model'" class="muted">按这个 SPU 的公共属性及绑定版本展开合法组合，可在预览中勾选本次新增范围。</p>
      <el-button type="primary" @click="preview">预览规格</el-button>
    </section>
    <section v-if="previewed" class="panel">
      <h2>3. 确认新增</h2>
      <p data-candidate-count>候选 {{ candidates.length }} 条，可新增 {{ count('new') }} 条，已存在 {{ count('existing') }} 条，无效 {{ count('invalid') }} 条。</p>


      <RuleExplanation v-if="guideFailure" :failure="guideFailure" :supported-recovery="['edit-input']" @recover="recoverGuide" />
      <p v-else-if="error" class="issue-error" role="alert">{{ error }}</p>
      <p v-if="candidates.length && !count('new')" class="muted">没有可新增规格；已存在的记录不会重复创建。</p>
      <el-table :data="candidates" row-key="key" max-height="500">
        <el-table-column width="55"><template #header><el-checkbox :model-value="allSelected" @change="toggleAll(Boolean($event))" /></template><template #default="{ row }"><el-checkbox :model-value="selected.includes(row.key)" :disabled="row.state !== 'new'" @change="toggle(row.key, Boolean($event))" /></template></el-table-column>
        <el-table-column label="规格"><template #default="{ row }">{{ attrsText(row.draft.variantAttrs) || '无规格属性' }}</template></el-table-column>
        <el-table-column label="SKU 名称"><template #default="{ row }">{{ row.draft.skuName || '未记录' }}</template></el-table-column>
        <el-table-column label="结果" width="110"><template #default="{ row }">{{ { new: '可新增', existing: '已存在', invalid: '无效' }[row.state as SkuCandidate['state']] }}</template></el-table-column>
        <el-table-column label="说明"><template #default="{ row }">{{ row.reason }} <el-button v-if="row.existingId" link @click="router.push({ path: `/skus/${row.existingId}`, query: { spu: familyId } })">查看已有 SKU</el-button></template></el-table-column>
      </el-table>
      <div class="row-actions" style="margin-top: 16px"><el-button @click="back">取消</el-button><el-button type="primary" :loading="saving" :disabled="!selected.length || !store.can('product:sku:create')" @click="submit">确认新增 {{ selected.length }} 条 SKU</el-button></div>
    </section>
    <el-dialog v-model="spuOpen" title="新建 SPU 并继续" width="min(820px, 94vw)" destroy-on-close :close-on-click-modal="false">
      <SpuForm v-if="spuInitial" :initial="spuInitial" inline @dirty="inlineDirty = $event" @cancel="spuOpen = false" @saved="spuSaved" />
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import RuleExplanation from '../components/guide/RuleExplanation.vue'
import { getFailure } from '../domain/guide/failure'
import type { GuideFailure } from '../domain/guide/types'
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import SpuForm from '../components/catalog/SpuForm.vue'
import SpuPicker from '../components/catalog/SpuPicker.vue'
import SkuFields from '../components/catalog/SkuFields.vue'
import { useUnsavedCatalog } from '../components/catalog/useUnsavedCatalog'
import { categoryPath } from '../domain/logic'
import { productTypeName } from '../domain/productList'
import { newSpuDraft } from '../domain/spuDraft'
import { planSpuSourceProblem, previewSkuAppend, skuConfigurationProblem, skuFields, type SkuCandidate, type SkuDraft, type SkuGeneration } from '../domain/spuSku'
import type { ProductFamily } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'
const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const planId = String(route.query.plan || '')
const templateId = String(route.query.template || '')
const plan = computed(() => store.data.productPlans.find(item => item.id === planId))
const familyId = ref(String(route.query.spu || ''))
const family = computed(() => store.data.families.find(item => item.id === familyId.value))
const kind = ref<SkuGeneration['kind']>(planId ? 'plan' : templateId ? (family.value?.modelVersionId ? 'model' : 'template') : 'manual')
const empty = (): SkuDraft => ({ code: '', skuName: '', oaSkuId: '', status: 'draft', variantAttrs: {} })
const copy = store.data.skus.find(item => item.id === route.query.copy && item.familyId === familyId.value)
const draft = ref<SkuDraft>(copy ? { ...empty(), variantAttrs: { ...copy.variantAttrs } } : empty())
const selections = ref<Record<string, string[]>>({})
const fields = computed(() => family.value ? skuFields(store.data, family.value) : [])
const dirty = ref(Boolean(copy))
const previewed = ref(false)
const candidates = ref<SkuCandidate[]>([])
const selected = ref<string[]>([])
const error = ref('')
const guideFailure = ref<GuideFailure>()
watch(error, value => { if (!value) guideFailure.value=undefined })
const saving = ref(false)
const spuOpen = ref(false)
const inlineDirty = ref(false)
const spuInitial = ref<ProductFamily>()
let submitted: SkuGeneration | undefined
const unsaved = computed({ get: () => dirty.value || inlineDirty.value, set: value => { if (!value) { dirty.value = false; inlineDirty.value = false } } })
useUnsavedCatalog(unsaved)
watch(spuOpen, open => { if (!open) inlineDirty.value = false })
const problem = computed(() => {
  if (planId && !plan.value) return '规划已不存在，请返回规划页面重新选择。'
  if (!family.value) return familyId.value ? '预选 SPU 已不存在，请重新选择。' : ''
  return skuConfigurationProblem(store.data, family.value) || (planId ? planSpuSourceProblem(store.data, family.value, planId) : templateId && family.value.templateId !== templateId ? 'SPU 的模型或方案与当前来源不一致。' : '')
})
const versionName = computed(() => store.data.specModelVersions.find(item => item.id === family.value?.modelVersionId)?.versionName || family.value?.modelVersionId || '未绑定发布模型')
const attrsText = (attrs: Record<string, string>) => Object.entries(attrs).filter(([, value]) => value).map(([name, value]) => `${name}：${value}`).join(' / ')
const count = (state: SkuCandidate['state']) => candidates.value.filter(row => row.state === state).length
const allSelected = computed(() => count('new') > 0 && selected.value.length === count('new'))
watch([draft, selections, kind], () => { dirty.value = true; previewed.value = false; submitted = undefined; selected.value = [] }, { deep: true, flush: 'sync' })
async function selectFamily(id: string) {
  if (id === familyId.value) return
  if (dirty.value || previewed.value) {
    try { await ElMessageBox.confirm('切换 SPU 会清除当前未保存的规格和候选。', '切换 SPU', { confirmButtonText: '切换', cancelButtonText: '保留当前输入' }) }
    catch { return }
  }
  setFamily(id)
}
function setFamily(id: string) {
  familyId.value = id
  draft.value = empty(); selections.value = {}; candidates.value = []; selected.value = []
  kind.value = planId ? 'plan' : templateId ? family.value?.modelVersionId ? 'model' : 'template' : 'manual'
  previewed.value = false; submitted = undefined; dirty.value = false; error.value = ''
}
function preview() {
  if (!family.value || problem.value) return
  submitted = JSON.parse(JSON.stringify({ kind: kind.value, rows: kind.value === 'manual' ? [draft.value] : undefined, selections: selections.value, planId: planId || undefined })) as SkuGeneration
  const result = previewSkuAppend(store.data, familyId.value, submitted)
  candidates.value = result.rows; error.value = result.problem; selected.value = result.rows.filter(row => row.state === 'new').map(row => row.key)
  previewed.value = true
}
function toggle(key: string, checked: boolean) { selected.value = checked ? [...new Set([...selected.value, key])] : selected.value.filter(item => item !== key) }
function toggleAll(checked: boolean) { selected.value = checked ? candidates.value.filter(row => row.state === 'new').map(row => row.key) : [] }
async function submit() {
  if (saving.value || !submitted || !selected.value.length) return
  saving.value = true
  const result = (await store.appendSkus(familyId.value, submitted, selected.value))
  if (!result.ok) { guideFailure.value=getFailure(result); error.value = result.message; saving.value = false; return }
  if (!result.ids.length) { error.value = '所选规格已经存在，没有新增记录。请重新预览。'; saving.value = false; return }
  dirty.value = false
  ElMessage.success(`已新增 ${result.ids.length} 条 SKU${result.skipped ? `，跳过 ${result.skipped} 条已存在规格` : ''}`)
  await router.push({ path: '/skus', query: { spu: familyId.value } })
  saving.value = false
}
function openSpu() { spuInitial.value = newSpuDraft(store.data, { templateId, planId }); spuOpen.value = true }
async function spuSaved(id: string) {
  spuOpen.value = false
  ElMessage.success('SPU 已创建')
  // Saving the inline form must still confirm before discarding an earlier SKU draft.
  await selectFamily(id)
}
function back() { router.push({ path: '/skus', query: familyId.value ? { spu: familyId.value } : {} }) }
function recoverGuide(action:string) { if(action==='edit-input') requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.spu-form input, .el-dialog.is-in-viewport input, .el-dialog input, .panel input')?.focus()) }
</script>
