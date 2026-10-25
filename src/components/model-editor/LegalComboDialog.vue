<template>
  <el-dialog v-model="open" class="combo-manage-dialog" title="合法组合管理" width="82vw" align-center :close-on-click-modal="false">
    <template #header>
      <div class="combo-dialog-title">
        <strong>合法组合管理</strong>
        <p v-if="showDraftList">草稿预览 {{ draftPreview.problems.length ? '暂时无法生成' : draftPreview.rows.length + ' 条 · 尚未发布' }}。已发布组合 {{ rowCount }} 条。</p>
        <p v-else>共 {{ rowCount }} 条，已选 {{ checkedIds.length }} 条，{{ schemeTitle }}<template v-if="comboStatus.versionName"> · {{ comboStatus.versionName }}</template></p>
      </div>
    </template>
    <div class="combo-manage">
      <div v-if="showDraftList" class="draft-preview">
        <strong>草稿预览 · 尚未发布</strong>
        <p v-if="draftPreview.problems.length">{{ draftPreview.problems[0] }}</p>
        <ul v-else>
          <li v-for="item in draftPreview.rows" :key="item.identityKey">{{ item.label }} · {{ item.planningId || '待发布' }}</li>
        </ul>
      </div>
      <div class="combo-toolbar">
        <el-button size="small" @click="emit('selectAll')">全选</el-button>
        <el-button size="small" :disabled="!checkedIds.length" @click="emit('clearSelection')">取消全选</el-button>
        <el-button size="small" @click="emit('invertSelection')">反选</el-button>
        <el-button size="small" :disabled="!checkedIds.length" @click="emit('markGrade', 'core')">标为核心商品</el-button>
        <el-button size="small" :disabled="!checkedIds.length" @click="emit('markGrade', 'general')">标为一般产品</el-button>
        <el-button size="small" :disabled="!checkedIds.length" @click="emit('createMaterials')">批量创建物料</el-button>
        <el-button v-if="allowTemporary" size="small" @click="emit('createTemporary')">创建临时物料</el-button>
        <el-checkbox v-model="comboUnfiledOnly">仅看未建物料</el-checkbox>
        <el-select v-model="comboVersionId" class="combo-version" size="small" placeholder="发布版本" :disabled="!publishedComboVersions.length">
          <el-option v-for="item in publishedComboVersions" :key="item.id" :label="item.versionName" :value="item.id" />
        </el-select>
        <el-input v-model="comboKeyword" class="combo-search" clearable placeholder="搜索规格路径、规划编号、物料名称或编号" />
      </div>
      <p v-if="comboStatus.unmatched.length" class="combo-anomaly">有 {{ comboStatus.unmatched.length }} 条物料对不上本版本的合法组合，没有自动归类。</p>
      <ul v-if="comboStatus.unmatched.length" class="combo-unmatched">
        <li v-for="item in comboStatus.unmatched" :key="item.skuId">
          <strong>{{ item.skuName.trim() || '未填写物料名称' }}</strong>
          <span>{{ item.materialCode.trim() || '未分配物料编号' }}</span>
          <em>{{ item.planningId }} · {{ item.note }}</em>
        </li>
      </ul>
      <p v-if="!rowCount" class="insight-empty">{{ comboStatus.message || '发布模型后，这里会列出可以建档的合法组合。' }}</p>
      <div v-else class="combo-table-wrap">
        <el-table class="combo-table" :data="visibleComboRows" row-key="key" height="100%" border :row-class-name="comboRowClass">
          <el-table-column type="expand" width="48">
            <template #default="{ row }: { row: ComboTableRow }">
              <div class="combo-expand">
                <p>完整规格路径：{{ row.label }}</p>
                <p v-if="!row.materials.length && !row.historicalMaterials.length" class="muted">这条组合还没有物料。</p>
                <p v-else-if="!row.materials.length" class="muted">本版本还没有新建物料。</p>
                <ul v-if="row.materials.length">
                  <li v-for="item in row.materials" :key="item.skuId">
                    <strong>{{ item.skuName.trim() || '未填写物料名称' }}</strong>
                    <span>{{ item.materialCode.trim() || '未分配物料编号' }}</span>
                    <em v-if="originLabel(item.nameSource)">{{ originLabel(item.nameSource) }}</em>
                    <em v-if="item.anomaly">{{ item.anomaly }}</em>
                    <el-button link type="primary" @click="emit('openMaterial', item)">查看</el-button>
                  </li>
                </ul>
                <p v-if="row.historicalMaterials.length" class="muted">历史版本已建，编号和名称保持原样。</p>
                <ul v-if="row.historicalMaterials.length">
                  <li v-for="item in row.historicalMaterials" :key="item.skuId">
                    <strong>{{ item.skuName.trim() || '未填写物料名称' }}</strong>
                    <span>{{ item.materialCode.trim() || '未分配物料编号' }}</span>
                    <em>来源 {{ item.versionName || '未记录版本' }}</em>
                    <em v-if="originLabel(item.nameSource)">{{ originLabel(item.nameSource) }}</em>
                    <el-button link type="primary" @click="emit('openMaterial', item)">查看</el-button>
                  </li>
                </ul>
                <p v-for="(note, index) in row.anomalies" :key="index" class="combo-anomaly">{{ note }}</p>
              </div>
            </template>
          </el-table-column>
          <el-table-column width="52" align="center">
            <template #default="{ row }: { row: ComboTableRow }">
              <el-checkbox :model-value="!!row.planningId && checkedIds.includes(row.planningId)" :disabled="!row.planningId" :title="row.planningId ? '勾选这条组合' : '发布后才能勾选'" @change="row.planningId && emit('toggleSelection', row.planningId)" />
            </template>
          </el-table-column>
          <el-table-column prop="label" label="完整规格路径" min-width="240" show-overflow-tooltip />
          <el-table-column label="规划编号" width="140">
            <template #default="{ row }: { row: ComboTableRow }">{{ row.recordId || '发布后自动编号' }}</template>
          </el-table-column>
          <el-table-column label="商品类型" width="128">
            <template #default="{ row }: { row: ComboTableRow }">
              <span class="combo-grade">{{ row.gradeLabel }}</span>
              <el-tag v-if="row.retired" size="small" type="info">已停用</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="物料状态" width="240">
            <template #default="{ row }: { row: ComboTableRow }">
              <span :class="row.filed ? 'is-filed' : 'is-empty'">{{ row.materialStatus }}</span>
              <el-tag v-if="row.hasAnomaly" size="small" type="warning">需核对</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="物料名称" min-width="180" show-overflow-tooltip>
            <template #default="{ row }: { row: ComboTableRow }">{{ row.materialNames || '—' }}</template>
          </el-table-column>
          <el-table-column label="物料编号" min-width="160" show-overflow-tooltip>
            <template #default="{ row }: { row: ComboTableRow }">{{ row.materialCodes || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="168" fixed="right">
            <template #default="{ row }: { row: ComboTableRow }">
              <el-button link type="primary" :disabled="row.materialCount === 0" @click="emit('openCombo', row, 'list')">查看物料</el-button>
              <el-button link type="primary" :disabled="!row.planningId" @click="emit('openCombo', row, 'create')">单条创建</el-button>
                <el-button link type="primary" :disabled="!row.planningId" @click="emit('openCombo', row, 'link')">关联已有物料</el-button>
            </template>
          </el-table-column>
          <template #empty>没有符合条件的组合。</template>
        </el-table>
      </div>
    </div>
    <slot name="material-actions" />
    <template #footer>
      <el-button @click="open = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { ComboMaterialCard, LegalComboMaterialStatus } from '../../domain/comboMaterialStatus'
import type { DraftComboPreview } from '../../domain/draftComboPreview'
import { materialNameOriginLabel as originLabel } from '../../domain/naming'
import type { ProductGrade, SpecModelVersion } from '../../domain/types'
import type { ComboTableRow, MaterialLaunchMode } from './comboPresentation'

// 版本、过滤条件和勾选状态由页面协调；组件只呈现结果并发出操作意图。
defineProps<{
  rowCount: number
  visibleComboRows: ComboTableRow[]
  checkedIds: readonly string[]
  schemeTitle: string
  showDraftList: boolean
  draftPreview: Readonly<Pick<DraftComboPreview, 'problems' | 'rows'>>
  comboStatus: Readonly<Pick<LegalComboMaterialStatus, 'versionName' | 'message' | 'unmatched'>>
  publishedComboVersions: ReadonlyArray<Readonly<Pick<SpecModelVersion, 'id' | 'versionName'>>>
  allowTemporary: boolean
}>()
const open = defineModel<boolean>({ required: true })
const comboKeyword = defineModel<string>('keyword', { required: true })
const comboUnfiledOnly = defineModel<boolean>('unfiledOnly', { required: true })
const comboVersionId = defineModel<string>('versionId', { required: true })
const emit = defineEmits<{
  selectAll: []
  clearSelection: []
  invertSelection: []
  toggleSelection: [planningId: string]
  markGrade: [grade: ProductGrade]
  createMaterials: []
  createTemporary: []
  openMaterial: [material: Readonly<ComboMaterialCard>]
  openCombo: [row: Pick<ComboTableRow, 'key'>, mode: MaterialLaunchMode]
}>()
defineSlots<{ 'material-actions'(): unknown }>()
function comboRowClass({ row }: { row: ComboTableRow }) {
  return row.filed ? 'is-filed-row' : ''
}
</script>

<style scoped>
.draft-preview { margin-bottom: 12px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
.draft-preview ul { margin: 6px 0 0; padding-left: 18px; }
.draft-preview li { margin: 2px 0; }
.insight-empty { margin: 0; padding: 0 12px 10px; color: var(--text-muted, #98a4b3); font-size: 12px; }
.combo-dialog-title strong { display: block; color: var(--el-text-color-primary, #253044); font-size: 16px; line-height: 1.4; }
.combo-dialog-title p { margin: 4px 0 0; color: var(--el-text-color-secondary, #66758b); font-size: 13px; font-weight: 400; }
.combo-manage { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.combo-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
.combo-version { width: 112px; }
.combo-search { width: 320px; margin-left: auto; }
.combo-expand { padding: 4px 12px 8px 36px; }
.combo-expand p { margin: 0 0 6px; color: var(--text-secondary, #66758b); font-size: 13px; }
.combo-expand ul { margin: 0; padding: 0; list-style: none; }
.combo-expand li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 6px 0; border-top: 1px solid var(--border-subtle, #eef2f6); }
.combo-expand strong { color: var(--text-primary, #253044); }
.combo-expand span, .combo-expand em { color: var(--text-secondary, #66758b); font-style: normal; font-size: 13px; }
.combo-anomaly { margin: 0 0 8px; color: var(--el-color-warning, #b88230); font-size: 12px; }
.combo-unmatched { margin: 0 0 8px; padding: 0; list-style: none; }
.combo-unmatched li { display: flex; flex-wrap: wrap; gap: 8px 12px; padding: 4px 0; font-size: 13px; }
.combo-unmatched em { color: var(--text-muted, #8b98a8); font-style: normal; }
.combo-table-wrap { flex: 1; min-height: 0; overflow: hidden; }
.combo-table :deep(.el-table__header th) { background: var(--el-fill-color-light, #f7f8fa); color: var(--el-text-color-primary, #253044); }
.combo-table :deep(.el-table__cell) { border-color: var(--el-border-color, #e4e8ef); }
.combo-grade { margin-right: 6px; }
.is-filed { color: var(--status-success, #137333); }
.is-empty { color: var(--text-muted, #8b98a8); }
.combo-table :deep(.el-table__body tr.is-filed-row) {
  --el-table-tr-bg-color: var(--combo-filed-bg, #b7ebc8);
  --el-table-row-hover-bg-color: var(--combo-filed-bg-hover, #9fe3b6);
  background-color: var(--combo-filed-bg, #b7ebc8);
}
.combo-table :deep(.el-table__body tr.is-filed-row > td.el-table__cell) {
  background-color: var(--combo-filed-bg, #b7ebc8) !important;
}
.combo-table :deep(.el-table__body tr.is-filed-row:hover > td.el-table__cell),
.combo-table :deep(.el-table__body tr.is-filed-row.hover-row > td.el-table__cell) {
  background-color: var(--combo-filed-bg-hover, #9fe3b6) !important;
}
</style>

