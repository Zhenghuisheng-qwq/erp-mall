<template>
  <div v-if="cards.length" class="node-material-summary" :data-node-materials="nodeId" @pointerdown.stop @click.stop>
    <el-popover trigger="click" width="360"><template #reference><button type="button">{{ cards[0]!.sku.materialCode }} · {{ cards[0]!.sku.skuName }} · {{ cards.length }} 条物料 ▾</button></template>
      <div v-for="c in cards" :key="c.sku.id"><el-button link type="primary" @click="router.push(`/products/${c.sku.familyId}?sku=${c.sku.id}`)">{{ c.sku.materialCode }} · {{ c.sku.skuName }}</el-button><p>{{ c.label }} · {{ c.source.source.scope }} · {{ c.source.source.versionId }} / {{ c.source.source.planningId || c.source.source.anchorNodeId }}</p></div>
    </el-popover>
    <small :title="mismatch ? '当前草稿路径已变化，卡片仅展示所选历史快照的关联。请发布新结构后重新预览关联范围。' : ''">{{ mismatch ? '历史关联：当前草稿路径已变化' : cards[0]!.label }} · {{ versionId }} · 按 MAT 去重</small>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { nodeMaterialCards } from '../../domain/materialRelations'
import { businessPath } from '../../domain/nodeBusiness'
const props=defineProps<{modelId:string;versionId:string;nodeId:string}>(),store=useCatalogStore(),router=useRouter()
const cards=computed(()=>nodeMaterialCards(store.data,props.modelId,props.versionId,props.nodeId))
const mismatch=computed(()=>{const snapshot=store.data.specModelVersions.find(v=>v.id===props.versionId)?.nodesSnapshot||[];const shape=(nodes:typeof snapshot)=>businessPath(nodes,props.nodeId).map(n=>[n.id,n.parentId,n.attributeId,n.valueId]);return JSON.stringify(shape(snapshot))!==JSON.stringify(shape(store.data.productSpecNodes.filter(n=>n.templateId===props.modelId)))})
</script>
<style scoped>.node-material-summary{width:220px;max-width:100%;height:52px;box-sizing:border-box;padding:5px 8px;border:1px solid var(--el-border-color);border-radius:6px;background:var(--el-bg-color);margin-top:4px}.node-material-summary button{border:0;background:none;color:var(--el-color-primary);width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:left;cursor:pointer;font-size:12px;padding:0}.node-material-summary small{display:block;font-size:10px;color:var(--el-text-color-secondary);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}</style>
