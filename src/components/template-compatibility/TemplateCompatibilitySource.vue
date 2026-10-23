<template>
  <div v-if="source" class="template-source" data-template-source>
    <p>模板来源：{{ modelName }} · {{ versionName }} <el-tag size="small" :type="state === 'managed' ? 'info' : 'warning'">{{ stateLabels[state] }}</el-tag></p>
    <p class="muted">来源规则：{{ ruleNames.join('、') || '来源信息缺失' }}</p>
    <p v-if="state === 'deleted'" class="muted">用户已取消此声明。后续模板更新默认保留取消状态；恢复需要预览并明确确认。</p>
    <p v-if="state === 'modified' || state === 'kept'" class="muted">当前结果已人工维护，模板更新默认保留。</p>
    <p v-if="state === 'stale'" class="muted">商品规格已修改，原来源需要重新核对，不自动刷新关系。</p>
    <details><summary>查看来源追溯</summary><p class="muted">模型 {{ source.modelId }} · 版本 {{ source.sourceVersionId }}</p><p class="muted">规则 {{ source.ruleIds.join('、') }} · 声明 {{ source.claimIds.join('、') }}</p></details>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useCatalogStore } from '../../stores/catalog'
import type { CompatibilityLink } from '../../domain/types'
import type { TemplateCompatibilityOrigin } from '../../domain/templateCompatibilitySync'
const props=defineProps<{link?:CompatibilityLink;origin?:TemplateCompatibilityOrigin}>()
const store=useCatalogStore()
const origin=computed(()=>props.origin || store.data.templateCompatibilityOrigins?.find(item=>item.key===props.link?.provenance?.template?.originKey || !!props.link && item.declarationId===props.link.id))
const source=computed(()=>origin.value || props.link?.provenance?.template)
const state=computed(()=>origin.value?.state || props.link?.provenance?.template?.state || 'managed')
const version=computed(()=>store.data.specModelVersions.find(item=>item.id===source.value?.sourceVersionId))
const modelName=computed(()=>store.data.specCanvases.find(item=>item.templateId===source.value?.modelId)?.name || store.data.templates.find(item=>item.id===source.value?.modelId)?.name || source.value?.modelId)
const versionName=computed(()=>version.value?.versionName || source.value?.sourceVersionId)
const ruleNames=computed(()=>source.value?.ruleIds.map(id=>id===version.value?.templateCompatibilitySnapshot?.config.defaultRule.id?'默认配置':version.value?.templateCompatibilitySnapshot?.config.exceptions.find(item=>item.id===id)?.name || '来源例外') || [])
const stateLabels={managed:'模板管理中',modified:'已人工修改',deleted:'已取消，保护中',kept:'已选择保留',stale:'规格变化待核对',obsolete:'模板已移除'}
</script>
<style scoped>
.template-source {padding:10px 12px;border-left:3px solid var(--el-color-primary-light-5);background:var(--el-fill-color-extra-light);border-radius:4px;margin:10px 0;font-size:13px;overflow-wrap:anywhere;}.template-source p {margin:5px 0;line-height:1.65;}.muted {color:var(--el-text-color-secondary);}.template-source summary {color:var(--el-color-primary);cursor:pointer;margin-top:7px;}.el-tag {margin-left:6px;}
</style>
