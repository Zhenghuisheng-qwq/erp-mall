<template><div><PageHead title="权益包管理" desc="为明确模型或型号组织配件类型。无需发布，不限制全部可选商品。"><el-button @click="router.push('/benefits/shopping')" v-if="store.canRoute({path:'/benefits/shopping'})">去选购</el-button><el-button v-if="returnTo" @click="router.push(returnTo)">返回模型</el-button></PageHead><section class="panel" style="margin-bottom:16px"><el-select :model-value="modelId" filterable aria-label="权益包主机模型" placeholder="选择主机商品模型" @change="choose"><el-option v-for="m in models" :key="m.templateId" :value="m.templateId" :label="m.name||m.templateId"/></el-select><p>从商品模型的“权益包”入口进入时，所属模型或型号会自动带入。</p></section><BenefitGroupManager v-if="modelId" :key="route.fullPath" :model-id="modelId" :version-id="String(route.query.version||'')" :node-id="String(route.query.node||'')" :initial-host-key="String(route.query.host||'')"/></div></template>
<script setup lang="ts">
import {computed} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import PageHead from '../components/PageHead.vue'
import BenefitGroupManager from '../components/benefits/BenefitGroupManager.vue'
import {useCatalogStore} from '../stores/catalog'
import {compatibilityReturnLocation} from '../domain/compatibilityNavigation'
const route=useRoute(),router=useRouter(),store=useCatalogStore()
const modelId=computed(()=>typeof route.query.model==='string'?route.query.model:'')
const models=computed(()=>store.data.specCanvases.filter(m=>store.data.productTypes.some(t=>t.id===m.productTypeId&&t.catalogRole==='host'&&t.status==='enabled')))
const returnTo=computed(()=>compatibilityReturnLocation(route.query.returnTo))
function choose(model:string){router.push({path:'/benefits/manage',query:{model}})}
</script>
