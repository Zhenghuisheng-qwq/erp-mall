<template>
  <section data-material-sources><h3>规划与节点范围来源</h3><p>本档案 1 条 MAT · 有效来源 {{ sources.length }} 处。原始建档事实不可解除。</p>
    <article v-for="r in sources" :key="r.id"><strong>{{ r.label }}</strong> · {{ r.source.modelId }} / {{ r.source.versionId }} / {{ r.source.planningId || r.source.anchorNodeId }} · {{ r.source.scope }}
      <p>{{ r.prefix.map(s=>`${s.attributeName} ${s.valueId}`).join(' · ') }} · 覆盖 {{ r.coverage.length }} 条 PLN</p>
      <el-button link @click="router.push({path:'/specs',query:{template:r.source.modelId,materialVersion:r.source.versionId,materialNode:r.source.anchorNodeId || r.prefix.at(-1)?.valueNodeId}})">定位来源</el-button>
      <el-button v-if="!r.original && store.can('product:material:delete')" link type="danger" :disabled="busy" @click="unlink(r.id)">解除本条关联</el-button>
    </article>
    <p v-if="unknown">另有 {{ unknown }} 条不支持的未来关系，原文保留，不参与当前范围执行。</p>

    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useCatalogStore } from '../stores/catalog'
import { materialSources } from '../domain/materialRelations'
import { materialRelationBasis } from '../domain/materialRelationCommands'
const props=defineProps<{materialId:string}>(),store=useCatalogStore(),router=useRouter(),busy=ref(false),error=ref('')
const sources=computed(()=>materialSources(store.data,props.materialId)),unknown=computed(()=>(store.data.materialRelations||[]).filter(r=>r.materialId===props.materialId&&r.kind!=='scope-v1').length)
async function unlink(id:string){const basis=materialRelationBasis(store.data);try{await ElMessageBox.confirm('仅解除此新增关联；物料、其他关系及人工维护声明保留。','解除物料关联')}catch{return}busy.value=true;try{const r=await store.unlinkMaterialRelation(id,basis);error.value=r.ok?'':r.message}finally{busy.value=false}}
</script>
<style scoped>article{padding:10px 0;border-bottom:1px solid var(--el-border-color);overflow-wrap:anywhere}p{font-size:12px;color:var(--el-text-color-secondary)}</style>
