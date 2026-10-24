<template>
  <section class="structure-materials" data-structure-materials>
    <header><strong>组合—物料</strong><el-select v-model="mode" aria-label="关联物料依据" size="small"><el-option value="published" label="发布快照" /><el-option value="draft" label="当前草稿" /></el-select><el-select v-if="mode === 'published'" :model-value="versionId" aria-label="物料发布版本" size="small" @change="(value: string) => emit('version', value)"><el-option v-for="version in versions" :key="version.id" :value="version.id" :label="version.versionName" /></el-select><el-input v-model="keyword" clearable placeholder="搜索组合、PLN、MAT 或物料名称" aria-label="查找关联物料" size="small" /><el-button link @click="emit('close')">收起</el-button></header>
    <p class="muted">{{ mode === 'draft' ? '当前草稿组合；仅同一完整身份在所选发布版本中有真实关联时展示档案，新增组合未发布、不分配编号。' : `依据 ${status.versionName || '未发布'} 快照；画布仍是当前模型结构，历史节点已变化时不会按名称猜测定位。` }} 名称与编号均取已保存档案。</p>
    <p v-if="!rows.length" class="muted">{{ status.message || '没有匹配的组合。' }}</p>
    <div class="material-rows">
      <article v-for="row in pageRows" :key="row.identityKey" :data-material-combo="row.identityKey">
        <button class="combo-label" :class="{chosen: selected === row.identityKey}" @click="locate(row)">{{ row.label }} <span>{{ row.planningLabel || '未发布 / 未分配 PLN' }}</span></button>
        <small>{{ row.filed ? `本版本已建 ${row.materialCount} 条 MAT` : '本版本未建档' }}</small>
        <div v-for="card in row.materials.slice(((materialPages[row.identityKey] || 1) - 1) * 10, (materialPages[row.identityKey] || 1) * 10)" :key="card.skuId" class="material-card"><el-button link type="primary" :data-material-id="card.skuId" @click="open(card)">{{ card.skuName || '未保存名称' }} · {{ card.materialCode || '无 MAT 编号' }}</el-button><span v-if="card.anomaly" class="warning">{{ card.anomaly }}</span></div>
        <el-pagination v-if="row.materials.length > 10" v-model:current-page="materialPages[row.identityKey]" :page-size="10" :total="row.materials.length" layout="prev, pager, next" size="small" />
        <details v-if="row.historicalMaterials.length"><summary>历史版本物料 {{ row.historicalMaterials.length }} 条（不计入本版本）</summary><div v-for="card in row.historicalMaterials.slice(((historyPages[row.identityKey] || 1) - 1) * 10, (historyPages[row.identityKey] || 1) * 10)" :key="card.skuId"><el-button link :data-material-id="card.skuId" @click="open(card)">{{ card.skuName || '未保存名称' }} · {{ card.materialCode || '无 MAT 编号' }} · {{ card.versionName }}</el-button></div><el-pagination v-if="row.historicalMaterials.length > 10" v-model:current-page="historyPages[row.identityKey]" :page-size="10" :total="row.historicalMaterials.length" layout="prev, pager, next" size="small" /></details>
        <p v-for="note in row.anomalies" :key="note" class="warning">{{ note }}</p>
      </article>
    </div>
    <p v-if="locationNote" role="status">{{ locationNote }}</p>
    <el-pagination v-if="rows.length > 10" v-model:current-page="page" :page-size="10" :total="rows.length" layout="prev, pager, next, total" size="small" />
    <details v-if="status.unmatched.length"><summary>异常关联 {{ status.unmatched.length }} 条</summary><div v-for="card in status.unmatched.slice((anomalyPage - 1) * 10, anomalyPage * 10)" :key="card.skuId"><el-button link @click="open(card)">{{ card.skuName }} · {{ card.materialCode }} · {{ card.planningId }}</el-button><p class="warning">{{ card.note }}</p></div><el-pagination v-if="status.unmatched.length > 10" v-model:current-page="anomalyPage" :page-size="10" :total="status.unmatched.length" layout="prev, pager, next" size="small" /></details>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { legalPlanningCombinations } from '../../domain/planning'
import type { LegalComboMaterialRow, LegalComboMaterialStatus } from '../../domain/comboMaterialStatus'
import type { AppData, ProductSpecNode, SpecModelVersion } from '../../domain/types'
const props = defineProps<{ data: AppData; modelId: string; nodes: ProductSpecNode[]; status: LegalComboMaterialStatus; versions: SpecModelVersion[]; versionId: string }>()
const emit = defineEmits<{ close: []; version: [id: string]; locate: [ids: string[]] }>()
const materialPages = reactive<Record<string, number>>({}), historyPages = reactive<Record<string, number>>({})
const router = useRouter(), mode = ref('published'), keyword = ref(''), page = ref(1), anomalyPage = ref(1), selected = ref(''), locationNote = ref('')
const currentCombinations = computed(() => legalPlanningCombinations(props.data, props.modelId, props.nodes))
const draftRows = computed<LegalComboMaterialRow[]>(() => {
  if (mode.value !== 'draft') return []
  const published = new Map(props.status.rows.map(row => [row.identityKey, row]))
  return currentCombinations.value.map(combo => ({
    ...(published.get(combo.identityKey) || { planningLabel: '', actionPlanningId: '', retired: false, modelVersionId: '', materials: [], historicalMaterials: [], materialCount: 0, filed: false, anomalies: [] }),
    identityKey: combo.identityKey, label: combo.label, valueNodeIds: combo.steps.map(step => step.valueNodeId),
  }))
})
const rows = computed(() => (mode.value === 'draft' ? draftRows.value : props.status.rows).filter(row => `${row.label} ${row.planningLabel} ${[...row.materials, ...row.historicalMaterials].map(card => `${card.skuName} ${card.materialCode}`).join(' ')}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())))
const pageRows = computed(() => rows.value.slice((page.value - 1) * 10, page.value * 10))
watch([() => props.modelId, () => props.versionId, mode, keyword], () => { page.value = 1; anomalyPage.value = 1; for (const key of Object.keys(materialPages)) delete materialPages[key]; for (const key of Object.keys(historyPages)) delete historyPages[key]; selected.value = ''; locationNote.value = ''; emit('locate', []) })
watch(() => rows.value.length, count => { page.value = Math.min(page.value, Math.max(1, Math.ceil(count / 10))) })
function locate(row: LegalComboMaterialRow) {
  selected.value = row.identityKey
  const current = new Map(props.nodes.map(node => [node.id, node]))
  const snapshot = new Map((props.versions.find(version => version.id === props.versionId)?.nodesSnapshot || []).map(node => [node.id, node]))
  const exactCombination = currentCombinations.value.some(combo => combo.identityKey === row.identityKey)
  const ids = row.valueNodeIds.filter(id => exactCombination && current.get(id)?.nodeType === 'VALUE' && (mode.value === 'draft' || current.get(id)?.valueId === snapshot.get(id)?.valueId && current.get(id)?.attributeId === snapshot.get(id)?.attributeId))
  emit('locate', ids)
  locationNote.value = ids.length === row.valueNodeIds.length ? `已高亮此组合的 ${ids.length} 个取值节点；折叠分支可使用原展开操作查看。` : '部分历史节点已移除或改变，仅高亮仍与快照一致的节点；完整组合以上方快照摘要为准。'
}
function open(card: {familyId: string; skuId: string}) { void router.push({ path: `/materials/${card.familyId}`, query: { sku: card.skuId } }) }
</script>
<style scoped>
.structure-materials { flex: 0 0 auto; max-height: 290px; overflow: auto; border:1px solid var(--el-border-color); border-radius:6px; padding:12px; margin:8px 0; min-width:0; }
header { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }header .el-select { width:135px; }header .el-input { flex:1; min-width:180px; }header strong { font-size:14px; }
.material-rows { max-height:260px; overflow:auto; }article { border-bottom:1px solid var(--el-border-color-lighter); padding:8px 0; }article small { color:var(--el-text-color-secondary); }
.combo-label { display:block; text-align:left; white-space:normal; overflow-wrap:anywhere; border:0; color:var(--el-text-color-primary); background:transparent; padding:4px 0; cursor:pointer; }.combo-label span { margin-left:8px; color:var(--el-color-primary); }.chosen { color:var(--el-color-primary); }
.material-card { display:flex; flex-wrap:wrap; gap:6px; }.structure-materials :deep(.el-button) { white-space:normal; height:auto; min-height:24px; text-align:left; overflow-wrap:anywhere; }.warning { color:var(--el-color-warning-dark-2); font-size:12px; margin:4px 0; }.muted { font-size:12px; margin:6px 0; }
</style>
