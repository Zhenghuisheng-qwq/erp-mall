<template>
  <el-dialog class="catalog-metric-dialog" :model-value="!!request" :title="request?.title || '记录明细'" width="min(960px, calc(100vw - 32px))" align-center append-to-body destroy-on-close @close="emit('close')">
    <template v-if="request">
      <p class="detail-count" data-catalog-detail-count>来源范围 {{request.ids.length}} 条 · 当前显示 {{filtered.length}} 条<template v-if="request.kind==='pending'">受影响记录，共 {{issueCount}} 个事项</template></p>
      <p v-if="request.kind==='spus'" class="muted">{{CATALOG_SPU_DEFINITION}}</p>
      <el-alert v-if="missing" :title="`${missing} 条来源记录已变化或当前不可查看，请关闭后重新查看汇总。此处不会扩大为全部记录。`" type="warning" :closable="false" />
      <el-input v-model="keyword" clearable placeholder="在本次来源范围内搜索名称或编号" aria-label="搜索范围明细" />
      <el-table :data="paged" :row-key="rowKey" data-catalog-details>
        <el-table-column label="记录" min-width="180"><template #default="{row}"><div :data-catalog-detail-id="row.id" :data-catalog-detail-kind="row.kind">{{row.name}}<small class="record-code">{{row.code}}</small></div></template></el-table-column>
        <el-table-column label="分类" min-width="170"><template #default="{row}">{{row.categoryPaths.join('；') || '未归属'}}</template></el-table-column>
        <el-table-column label="状态／来源" min-width="200"><template #default="{row}"><span>{{row.status}}</span><p class="muted">{{row.sourceText || '未记录'}}</p><ul v-if="row.issues.length" class="issues"><li v-for="issue in row.issues" :key="issue.id" :class="issue.level"><span>{{issue.level==='error'?'错误':'待完善'}}：</span>{{issue.message}}</li></ul></template></el-table-column>
        <el-table-column label="操作" width="170"><template #default="{row}"><el-button v-if="row.route || ['models','types','categories'].includes(row.kind)" link type="primary" @click="emit('record',row)">{{row.kind==='models'||row.kind==='types'?'查看资料详情':row.kind==='categories'?'查看分类范围':'进入完整管理页面'}}</el-button><span v-else class="muted">{{row.routeUnavailableReason || '当前明细保留完整身份，暂无可直接承接的管理入口。'}}</span></template></el-table-column>
      </el-table>
      <el-pagination small layout="prev,pager,next" :total="filtered.length" :page-size="40" :current-page="page" @current-change="page=$event" />
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {CATALOG_SPU_DEFINITION,type CatalogDetailRow,type CatalogMetricKind,type CatalogWorkspaceIndex} from '../../domain/catalogWorkspaceQuery'
export interface CatalogDetailRequest {kind:CatalogMetricKind;ids:string[];title:string}
const props=defineProps<{index:CatalogWorkspaceIndex;request:CatalogDetailRequest|null}>()
const emit=defineEmits<{close:[];record:[row:CatalogDetailRow]}>()
const rowKey=(row:CatalogDetailRow)=>`${row.kind}:${row.id}`
const keyword=ref(''),page=ref(1)
watch(()=>props.request,()=>{keyword.value='';page.value=1})
watch(keyword,()=>{page.value=1})
const rows=computed(()=>props.request?props.index.details(props.request.kind,props.request.ids):[])
const missing=computed(()=>Math.max(0,(props.request?.ids.length||0)-rows.value.length))
const issueCount=computed(()=>rows.value.reduce((count,row)=>count+row.issues.length,0))
const filtered=computed(()=>{const key=keyword.value.trim().toLocaleLowerCase();return rows.value.filter(row=>!key||`${row.name} ${row.code} ${row.id}`.toLocaleLowerCase().includes(key))})
const paged=computed(()=>filtered.value.slice((page.value-1)*40,page.value*40))
</script>
<style scoped>
.detail-count{margin-top:0}.muted{color:var(--el-text-color-secondary);font-size:12px}.record-code{display:block;color:var(--el-text-color-secondary);overflow-wrap:anywhere}.issues{padding-left:14px;font-size:12px;margin:4px 0}.issues .error{color:var(--el-color-danger)}.issues .incomplete{color:var(--el-text-color-secondary)}:deep(.el-pagination){margin-top:14px}
</style>
<style>
.catalog-metric-dialog.el-dialog{max-height:min(760px,calc(100vh - 48px));display:flex;flex-direction:column}
.catalog-metric-dialog .el-dialog__body{overflow:auto}
</style>
