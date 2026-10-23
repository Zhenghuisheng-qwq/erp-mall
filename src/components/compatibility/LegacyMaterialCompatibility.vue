<template>
  <div :inert="saving" :aria-busy="saving">
    <PageHead title="适用关系" desc="已建物料适用关系。这里关联的是物料和主机，不是模型节点上的草稿配置。">
      <el-button v-if="store.isAdmin" :loading="saving" @click="loadSamples">放入测试样例</el-button>
    </PageHead>
    <p v-if="sampleNote" class="panel muted">{{ sampleNote }}</p>
    <p v-if="unconfiguredNote" class="panel muted">{{ unconfiguredNote }}</p>
    <div v-if="skuMode" class="layout">
      <section class="panel">
        <h2>适用主机</h2>
        <p><strong>{{ skuMode.materialCode }}</strong> {{ skuMode.skuName }}</p>
        <p class="muted">{{ skuMode.typeName }}。勾选主机后一次保存。已关联的会跳过，不会重复建立。</p>
        <el-input v-model="hostKeyword" placeholder="搜品牌、系列或型号，例如 iPhone 17 Pro Max" clearable />
        <p v-if="hosts.length === 0" class="muted">没有找到已建档的主机型号。可以去商品规划查看，这里不会自动生成主机。</p>
        <label v-for="item in hosts" :key="item.key" class="choice">
          <input type="checkbox" :checked="pickedHosts.includes(item.key) || item.linked" :disabled="item.linked || !store.isAdmin" @change="toggleHost(item.key)" />
          <span>
            <strong>{{ item.label }}</strong>
            <em>{{ item.sample ? '测试样例 · ' : '' }}{{ item.productTypeName }} · 已关联 {{ item.accessoryCount }} 条</em>
          </span>
        </label>
        <div class="row-actions">
          <el-button v-if="store.isAdmin" type="primary" :loading="saving" :disabled="pickedHosts.length === 0" @click="linkHosts">关联到 {{ pickedHosts.length }} 款主机</el-button>
        </div>
        <p v-if="resultText">{{ resultText }}</p>
      </section>
      <section class="panel">
        <h2>已经关联 {{ skuLinks.length }} 款</h2>
        <p v-if="skuLinks.length === 0" class="muted">还没有适用主机。</p>
        <article v-for="item in skuLinks" :key="item.id" class="link-row">
          <div>
            <strong>{{ item.label }}</strong>
            <p class="muted">{{ item.scopeText }}</p>
            <el-input :model-value="noteDrafts[item.id] ?? item.note" :disabled="saving" :readonly="!store.isAdmin" placeholder="补充说明，可留空" @input="noteDrafts[item.id] = String($event)" />
            <el-button v-if="store.isAdmin && Object.hasOwn(noteDrafts, item.id)" size="small" type="primary" :loading="saving" style="margin-top:8px" @click="saveNote(item.id, noteDrafts[item.id] ?? item.note)">保存说明</el-button>
          </div>
          <el-button v-if="store.isAdmin" link type="danger" @click="removeOne(item.id)">取消关联</el-button>
        </article>
      </section>
    </div>
    <div v-else class="layout">
      <section class="panel">
        <h2>主机型号</h2>
        <el-input v-model="hostKeyword" placeholder="搜品牌、系列或型号" clearable />
        <p v-if="hosts.length === 0" class="muted">没有找到已建档的主机型号。系统不会按名称自动新建。</p>
        <button v-for="item in hosts" :key="item.key" type="button" class="host" :class="{ 'is-on': item.key === selectedKey }" @click="selectHost(item)">
          <strong>{{ item.label }}</strong>
          <span>{{ item.sample ? '测试样例 · ' : '' }}{{ item.productTypeName }} · {{ item.specRange }}</span>
          <em>适用配件 {{ item.accessoryCount }} 条<span v-for="type in item.typeCounts" :key="type.productTypeId"> · {{ type.name }} {{ type.count }}</span></em>
        </button>
      </section>
      <section class="panel" v-if="selected">
        <h2>{{ selected.label }} 的适用配件</h2>
        <p class="muted">按型号关联。容量和颜色不写进这条关系；如果只适用于某一个规格，再指定规格。不会自动套用到以后新发布的型号。</p>
        <div class="row-actions">
          <button type="button" @click="typeFilter = ''">全部类型</button>
          <button v-for="item in typeOptions" :key="item.id" type="button" @click="typeFilter = item.id">{{ item.name }}</button>
          <el-input v-model="codeKeyword" placeholder="搜物料编码或名称" clearable style="width: 220px" />
          <el-button v-if="store.isAdmin" type="primary" @click="pickerOpen = true">添加配件</el-button>
          <el-button v-if="store.isAdmin" :disabled="pickedLinks.length === 0" @click="removeMany">取消 {{ pickedLinks.length }} 条关联</el-button>
        </div>
        <p v-if="visibleLinks.length === 0" class="muted">这款主机还没有适用配件。</p>
        <div v-for="item in visibleLinks" :key="item.id" class="choice">
          <label>
            <input type="checkbox" :checked="pickedLinks.includes(item.id)" :disabled="!store.isAdmin" @change="toggleLink(item.id)" />
            <span>
              <strong>{{ item.code }} · {{ item.name }}</strong>
              <em>{{ item.typeName }} · {{ item.spec || '无规格摘要' }}<template v-if="item.supplier"> · 供应商 {{ item.supplier }}</template></em>
            </span>
          </label>
          <button type="button" @click="router.push(`/compatibility?sku=${item.skuId}`)">继续关联其他主机</button>
        </div>
        <p v-if="resultText">{{ resultText }}</p>
      </section>
      <section v-else class="panel"><p class="muted">先在左边选一款主机型号。</p></section>
    </div>
    <el-drawer v-model="pickerOpen" title="添加适用配件" size="460px" :close-on-press-escape="!saving" :close-on-click-modal="!saving" :show-close="!saving">
      <div :inert="saving">
      <p class="muted">当前主机保持为「{{ selected?.label || '未选择' }}」。勾选的是已有物料，不是新建物料。</p>
      <div class="row-actions">
        <button v-for="item in typeOptions" :key="item.id" type="button" @click="pickerType = item.id">{{ item.name }}</button>
      </div>
      <el-input v-model="pickerKeyword" placeholder="搜物料编码、名称或供应商编码" clearable style="margin-top: 8px" />
      <el-select v-model="scopePlanning" placeholder="适用范围：整款型号" clearable style="width: 100%; margin-top: 8px">
        <el-option label="整款型号，不区分容量和颜色" value="" />
        <el-option v-for="item in scopeOptions" :key="item.id" :label="`仅 ${item.label}`" :value="item.id" />
      </el-select>
      <p v-if="candidates.length === 0" class="muted">这个配件类型下没有可选物料。</p>
      <label v-for="item in candidates" :key="item.skuId" class="choice">
        <input type="checkbox" :checked="item.linked || pickedSkus.includes(item.skuId)" :disabled="item.linked" @change="toggleSku(item.skuId)" />
        <span>
          <strong>{{ item.materialCode || '未编号' }} · {{ item.skuName }}</strong>
          <em>{{ item.productTypeName }} · {{ item.spec || '无规格摘要' }} · 已关联 {{ item.hostCount }} 款主机{{ item.linked ? ' · 已经关联' : '' }}<template v-if="item.supplierCode"> · {{ item.supplierCode }}</template></em>
        </span>
      </label>
      <el-button v-if="store.isAdmin" type="primary" :loading="saving" :disabled="pickedSkus.length === 0" @click="linkSkus">确认关联 {{ pickedSkus.length }} 条</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import PageHead from '../PageHead.vue'
import { accessoryCandidates, accessoryTypes, hostFrom, hostLabel, linksOfSku, listHostModels, unconfiguredHostPlans, type HostModelOption } from '../../domain/compatibility'
import { installCompatibilitySamples } from '../../domain/compatibilitySamples'
import { uid, useCatalogStore } from '../../stores/catalog'
import { cloneCompatibility, declarationDraft } from '../../domain/accessoryCompatibilityCommands'
import type { CompatibilityChange, CompatibilityCommandResult } from '../../domain/accessoryCompatibilityCommands'
import type { CompatibilityHost } from '../../domain/types'
import { DATA_VERSION } from '../../domain/types'
import { isMaterialArchive } from '../../domain/catalogIdentity'

const store = useCatalogStore()
const saving = ref(false)
const unconfiguredNote = computed(() => {
  const rows = unconfiguredHostPlans(store.data)
  if (!rows.length) return ''
  return `有 ${rows.length} 条主机规划还没有型号身份。${rows[0]?.reason || ''}`
})
const route = useRoute()
const router = useRouter()
const hostKeyword = ref(String(route.query.q || ''))
const codeKeyword = ref('')
const typeFilter = ref('')
const pickerOpen = ref(false)
const pickerType = ref('')
const pickerKeyword = ref('')
const scopePlanning = ref('')
const pickedSkus = ref<string[]>([])
const pickedHosts = ref<string[]>([])
const pickedLinks = ref<string[]>([])
const resultText = ref('')
const sampleNote = ref('')
const noteDrafts = ref<Record<string, string>>({})
const selectedKey = ref('')

const hosts = computed(() => {
  const rows = listHostModels(store.data, hostKeyword.value).map((item) => ({
    ...item,
    linked: skuId.value ? linksOfSku(store.data, skuId.value).some((link) => link.host.productModelId === item.host.productModelId && link.host.identityKey === item.host.identityKey && link.host.scope === 'model') : false,
  }))
  const familyId = String(route.query.family || '')
  if (!familyId || skuId.value) return rows
  const family = store.data.families.find((item) => item.id === familyId)
  const plans = new Set(store.data.skus.filter((item) => item.familyId === familyId).map((item) => item.planningId))
  if (family && plans.size) return rows.filter((item) => item.planningIds.some((id) => plans.has(id)))
  return rows
})
const selected = computed(() => hosts.value.find((item) => item.key === selectedKey.value) || null)
const skuId = computed(() => String(route.query.sku || ''))
const skuMode = computed(() => {
  const sku = store.data.skus.find((item) => item.id === skuId.value)
  if (!sku || !isMaterialArchive(store.data, sku)) return null
  const family = store.data.families.find((item) => item.id === sku.familyId)
  const typeName = store.data.productTypes.find((item) => item.id === family?.productTypeId)?.name || ''
  return { id: sku.id, materialCode: sku.materialCode || '', skuName: sku.skuName || '', typeName }
})
const skuLinks = computed(() => linksOfSku(store.data, skuId.value).map((item) => ({ id: item.id, label: hostLabel(item.host), note: item.note, host: item.host, scopeText: item.host.scope === 'planning' ? `仅规格 ${item.host.planningId}` : '整款型号' })))
const typeOptions = computed(() => accessoryTypes(store.data))
const hostLinks = computed(() => {
  if (!selected.value) return []
  return (store.data.compatibilities || []).filter((item) => (item.targetKind || 'material') === 'material' && item.host.productModelId === selected.value?.host.productModelId && item.host.identityKey === selected.value?.host.identityKey)
})
const visibleLinks = computed(() => hostLinks.value.flatMap((item) => {
  const sku = store.data.skus.find((row) => row.id === item.accessorySkuId)
  const family = sku && store.data.families.find((row) => row.id === sku.familyId)
  const typeName = store.data.productTypes.find((row) => row.id === family?.productTypeId)?.name || ''
  if (typeFilter.value && family?.productTypeId !== typeFilter.value) return []
  const spec = sku ? Object.entries(sku.variantAttrs).map(([name, value]) => `${name} ${value}`).join(' · ') : ''
  const hay = `${sku?.materialCode || ''} ${sku?.skuName || ''} ${typeName}`.toLowerCase()
  if (codeKeyword.value.trim() && !hay.includes(codeKeyword.value.trim().toLowerCase())) return []
  return [{ id: item.id, skuId: item.accessorySkuId, code: sku?.materialCode || '物料已不在', name: sku?.skuName || '', typeName, spec, supplier: sku?.supplierCode || '' }]
}))
const candidates = computed(() => pickerType.value && selected.value ? accessoryCandidates(store.data, pickerType.value, pickerKeyword.value, currentHost()) : [])
const scopeOptions = computed(() => {
  if (!selected.value) return []
  return selected.value.planningIds.flatMap((id) => {
    const record = store.data.planningRecords.find((item) => item.planningId === id)
    if (!record) return []
    const label = record.steps.filter((step) => !selected.value?.host.steps.some((item) => item.attributeId === step.attributeId)).map((step) => `${step.attributeName} ${step.valueId}`).join(' · ')
    return [{ id, label: label || id }]
  })
})

watch(() => route.query.sku, () => { hostKeyword.value = '' })
watch(hosts, (rows) => {
  const model = String(route.query.model || '')
  const key = String(route.query.key || '')
  const preset = rows.find((item) => item.host.productModelId === model && item.host.identityKey === key)
  if (preset) selectedKey.value = preset.key
  else if (!rows.some((item) => item.key === selectedKey.value)) selectedKey.value = rows[0]?.key || ''
}, { immediate: true })

function selectHost(item: HostModelOption) {
  if (saving.value) return
  selectedKey.value = item.key
  pickedLinks.value = []
  resultText.value = ''
}
function currentHost() {
  if (!selected.value) return undefined
  if (!scopePlanning.value) return selected.value.host
  return hostFrom(selected.value.host.productTypeId, selected.value.host.productModelId, selected.value.host.steps, scopePlanning.value)
}
function toggleSku(id: string) {
  if (saving.value) return
  pickedSkus.value = pickedSkus.value.includes(id) ? pickedSkus.value.filter((item) => item !== id) : pickedSkus.value.concat(id)
}
function toggleHost(key: string) {
  if (saving.value) return
  pickedHosts.value = pickedHosts.value.includes(key) ? pickedHosts.value.filter((item) => item !== key) : pickedHosts.value.concat(key)
}
function toggleLink(id: string) {
  if (saving.value) return
  pickedLinks.value = pickedLinks.value.includes(id) ? pickedLinks.value.filter((item) => item !== id) : pickedLinks.value.concat(id)
}
function report(result: CompatibilityCommandResult) {
  if (!result.ok) { resultText.value = result.message || '没有保存，已保留选择，请重试。'; ElMessage.error(resultText.value); return false }
  resultText.value = `新增 ${result.preview?.added || 0} 条，已存在 ${result.preview?.skipped || 0} 条物料适用关系，可在主机及配件两侧查询。`
  ElMessage.success(resultText.value)
  return true
}
function additions(ids: string[], hosts: CompatibilityHost[]): CompatibilityChange[] {
  return ids.flatMap(id => hosts.map(host => ({ kind: 'add' as const, draft: { target: { kind: 'material' as const, id }, host, conclusion: 'compatible' as const, verification: 'confirmed' as const, capability: 'basic' as const, conditions: [], source: '人工维护的物料适用关系；核验资料未记录', note: '' } })))
}
async function linkSkus() {
  if (!store.isAdmin || saving.value) return
  const host = currentHost()
  if (!host) return
  saving.value = true
  try {
    const result = await store.commitCompatibilityChanges(additions([...pickedSkus.value], [host]))
    if (!report(result)) return
    pickedSkus.value = []; pickerOpen.value = false
  } catch (cause) { resultText.value = cause instanceof Error ? cause.message : '关联未完成，当前选择已保留。' }
  finally { saving.value = false }
}
async function linkHosts() {
  if (!store.isAdmin || !skuMode.value || saving.value) return
  const chosen = hosts.value.filter((item) => pickedHosts.value.includes(item.key)).map((item) => item.host)
  saving.value = true
  try {
    const result = await store.commitCompatibilityChanges(additions([skuMode.value.id], chosen))
    if (!report(result)) return
    pickedHosts.value = []
  } catch (cause) { resultText.value = cause instanceof Error ? cause.message : '关联未完成，当前选择已保留。' }
  finally { saving.value = false }
}
async function cancel(ids: string[]) {
  if (!store.isAdmin || saving.value) return false
  saving.value = true
  try {
    try { await ElMessageBox.confirm(`取消 ${ids.length} 条物料适用声明？物料和主机仍保留。`, '取消关联', { confirmButtonText: '确认取消声明', cancelButtonText: '保留' }) } catch { return false }
    const result = await store.commitCompatibilityChanges(ids.map(id => ({ kind: 'remove', id })))
    if (!result.ok) { resultText.value = result.message || '取消失败，选择已保留，请重试。'; return false }
    resultText.value = `取消了 ${result.preview?.removed || 0} 条关联，物料和主机都还在。`
    return true
  } catch (cause) { resultText.value = cause instanceof Error ? cause.message : '取消未完成，当前选择已保留。'; return false }
  finally { saving.value = false }
}
async function removeOne(id: string) { await cancel([id]) }
async function removeMany() {
  if (await cancel([...pickedLinks.value])) pickedLinks.value = []
}
async function saveNote(id: string, note: string) {
  if (!store.isAdmin || saving.value) return
  const link = store.data.compatibilities.find(item => item.id === id)
  if (!link) return
  saving.value = true
  try {
    const result = await store.commitCompatibilityChanges([{ kind: 'edit', id, draft: { ...declarationDraft(link), note } }])
    if (!result.ok) resultText.value = result.message || '备注没有保存，请重试。'
    else delete noteDrafts.value[id]
  } catch (cause) { resultText.value = cause instanceof Error ? cause.message : '备注未保存，当前输入已保留。' }
  finally { saving.value = false }
}
async function loadSamples() {
  if (!store.isAdmin || saving.value) return
  const candidate = cloneCompatibility(store.data)
  const result = installCompatibilitySamples(candidate, uid)
  if (!result.filmA) { sampleNote.value = '测试样例没有放进去。请先确认手机分类还在。'; return }
  saving.value = true
  try {
    ;(await store.importJson(JSON.stringify({ version: DATA_VERSION, data: candidate })))
    sampleNote.value = '已放入测试样例主机和屏幕膜。它们不是 Excel 里已经正式导入的物料。'
    ElMessage.success(sampleNote.value)
  } catch (error) { sampleNote.value = `测试样例未保存：${error instanceof Error ? error.message : String(error)}。原数据保留，可重试。` }
  finally { saving.value = false }
}
onBeforeRouteLeave(() => !saving.value)
onBeforeRouteUpdate(() => !saving.value)
const beforeUnload = (event: BeforeUnloadEvent) => { if (saving.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 16px; align-items: start; }
.host, .choice { display: flex; gap: 8px; width: 100%; text-align: left; margin: 8px 0; padding: 8px; border: 1px solid transparent; background: transparent; }
.host { flex-direction: column; }
.host.is-on { border-color: #8eb4e8; background: #f4f8fd; }
.host span, .choice em, .link-row .muted { color: #607089; font-style: normal; }
.link-row { display: flex; justify-content: space-between; gap: 12px; margin: 10px 0; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
</style>
