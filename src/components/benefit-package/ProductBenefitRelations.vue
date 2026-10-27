<template>
  <section class="product-benefit-relations panel" data-product-benefit-relations>
    <header><h2><el-icon aria-hidden="true"><Connection/></el-icon>关联权益包</h2><span class="muted">按当前真实规格查询，查看不会修改商品或权益包。</span></header>
    <p v-if="!store.can('product:sku:read')" class="muted">当前身份没有销售 SKU 读取权限，不可查看具体规格关联。</p>
    <template v-else>
      <div v-if="familyId" class="sku-choice"><el-select :model-value="selectedId" filterable aria-label="关联权益包规格" @change="selectSku"><el-option v-for="sku in skus" :key="sku.id" :value="sku.id" :label="skuLabel(sku.id)"/></el-select><el-button v-if="skus.length>1" link data-benefit-spec-overview @click="loadOverview">查看各规格关联概览</el-button></div>
      <p v-if="familyId" class="muted">此 SPU 有 {{skus.length}} 条真实销售 SKU。以下仅代表所选规格，不表示整个 SPU 都适用；物料不计入。</p>
      <el-table v-if="overview.length" :data="overview" size="small" data-benefit-spec-overview-table><el-table-column label="具体规格" min-width="180"><template #default="{row}"><el-button link @click="selectSku(row.id)">{{row.spec}}</el-button></template></el-table-column><el-table-column label="可使用配置" min-width="125"><template #default="{row}">{{row.effective}}</template></el-table-column><el-table-column label="候选项目配置" width="125"><template #default="{row}">{{row.candidates??'不可查看'}}</template></el-table-column><el-table-column label="已包含的权益包" width="135"><template #default="{row}">{{row.packages??'不可查看'}}</template></el-table-column></el-table>
      <p v-if="!result.valid" class="muted">{{result.message||'暂无真实 SKU。先在 SKU 管理补齐商品规格，再查看关联。'}}</p>
      <template v-else>
        <p class="current-spec" data-product-benefit-current>{{result.skuLabel}} · {{result.spec||selectedId}}</p>
        <section data-benefit-effective><h3>该商品可使用的权益包配置</h3><p v-if="!result.configurationsReadable" class="muted">当前身份没有权益包配置读取权限，不可查看。</p><template v-else><el-tag :type="effectiveType">{{effectiveLabel}}</el-tag><p v-if="result.effective?.plan"><strong>{{result.effective.plan.name}}</strong> · 已发布 v{{result.effective.plan.version}}</p><p class="muted">{{result.effective?.message||'实际命中范围与发布版本如下。'}}</p><article v-for="range in result.effectiveRanges" :key="range.id" class="relation-row"><span>{{range.label}} · 配置 v{{range.planVersion||'—'}}</span><el-button v-if="range.planId" link @click="viewConfiguration(range.planId,range.id,range.planVersion)">查看配置</el-button></article><el-button v-if="canConfigure&&['unconfigured','invalid','conflict'].includes(result.effective?.state||'')" link @click="configure">进入权益包配置处理</el-button></template><el-button v-if="store.can('product:sales:read')" type="primary" plain data-product-benefit-shopping @click="startShopping">{{canCreate?'进入权益包选购':'查看权益包选购'}}</el-button><p v-else class="muted">当前身份没有权益包选购读取权限。</p></section>
        <section data-benefit-candidate-configurations><h3>将该商品列为可选项目的配置</h3><p class="muted">列为候选不等于已确认适用于所有设备，也不等于已经加入权益包。实际选用仍核对本次设备和正式兼容性依据。</p><p v-if="!result.configurationsReadable" class="muted">当前身份没有权益包配置读取权限，不可查看。</p><template v-else><p v-if="!result.candidates.length" class="muted">尚未被配置项目列为候选。可在权益包配置中选择对应产品类型、SPU 或具体 SKU。</p><article v-for="row in result.candidates" :key="row.key" class="relation-row" :data-benefit-candidate-config="row.key"><div><strong>{{row.planName}}</strong><span> · {{row.version===null?'未发布草稿':`v${row.version}`}} · {{row.itemName}}</span><p>{{row.scopeLabel}} · {{candidateLabels[row.state]}} · {{row.message}}</p></div><el-button v-if="row.state!=='unknown'" link @click="viewConfiguration(row.planId,undefined,row.version)">查看配置</el-button></article></template></section>
        <section data-benefit-member-packages><h3>已经包含该商品的权益包</h3><p v-if="!result.packagesReadable" class="muted">当前身份没有权益包读取权限，不可查看。</p><template v-else><p v-if="!result.packages.length" class="muted">没有已保存权益包包含此规格。进入权益包选购后，由用户明确加入商品和服务并保存。</p><article v-for="pack in result.packages" :key="pack.id" class="relation-row" :data-benefit-member-package="pack.id"><div><strong>{{pack.name}}</strong><span> · {{packageStatus(pack.status)}} · 本规格 {{pack.quantity===null?'数量待核对':`× ${pack.quantity}`}}</span><el-tag v-if="pack.favorite" size="small" type="info">常用</el-tag><p>{{pack.message}}</p></div><div class="relation-actions"><el-button link @click="viewPackage(pack.id)">查看权益包</el-button><el-button v-if="pack.usable&&canCreate&&store.can('product:sales:read')" link type="primary" @click="usePackage(pack.id)">使用此组合</el-button></div></article></template></section>
        <details v-if="result.diagnostics.length"><summary>无法完整反查的记录</summary><p v-for="message in result.diagnostics" :key="message" class="muted">{{message}}</p></details>
        <p class="muted">历史交付清单独立保存，本区查看和配置更新均不会改写历史交付。</p>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {Connection} from '@element-plus/icons-vue'
import {useCatalogStore} from '../../stores/catalog'
import {isRealSku} from '../../domain/catalogIdentity'
import {savedSkuName,savedSkuSpec} from '../../domain/productList'
import {queryProductBenefitRelations} from '../../domain/productBenefitRelations'
const props=defineProps<{skuId?:string;familyId?:string}>(),store=useCatalogStore(),route=useRoute(),router=useRouter(),selectedId=ref('')
const overview=ref<{id:string;spec:string;effective:string;candidates:number|null;packages:number|null}[]>([])
const owner=computed(()=>JSON.stringify([store.activeUserId,store.previewUserId]))
const skus=computed(()=>store.can('product:sku:read')?store.data.skus.filter(sku=>isRealSku(store.data,sku)&&(props.familyId?sku.familyId===props.familyId:sku.id===props.skuId)):[])
const canCreate=computed(()=>store.can('product:benefit:create')),canConfigure=computed(()=>store.can('product:sales-config:read')&&store.can('product:sales-config:update'))
watch([()=>props.skuId,()=>props.familyId,owner,()=>store.can('product:sku:read')],()=>{overview.value=[];selectedId.value=props.skuId||(typeof route.query.relatedSku==='string'?route.query.relatedSku:skus.value[0]?.id)||''},{immediate:true})
watch(()=>[store.data.salesOptionPlans,store.data.salesOptionBindings,store.data.benefitPackages,store.can('product:sales-config:read'),store.can('product:benefit:read')],()=>{overview.value=[]})
const result=computed(()=>{const value=queryProductBenefitRelations(store.data,selectedId.value,store.can);return props.familyId&&!skus.value.some(sku=>sku.id===selectedId.value)?{...value,valid:false,message:selectedId.value?'指定规格不属于当前 SPU，请重新选择。':'此 SPU 尚无可查看的真实销售 SKU。'}:value})
const stateLabels:Record<string,string>={matched:'已生效',none:'本范围不显示权益包选项',unconfigured:'未配置',conflict:'范围冲突',invalid:'引用失效'}
const effectiveLabel=computed(()=>stateLabels[result.value.effective?.state||'unconfigured'])
const effectiveType=computed(()=>result.value.effective?.state==='matched'?'success':result.value.effective?.state==='invalid'||result.value.effective?.state==='conflict'?'warning':'info')
const candidateLabels={published:'已发布',draft:'未生效',disabled:'已停用',invalid:'引用待处理',unknown:'未知版本'}
function skuLabel(id:string){const sku=store.data.skus.find(item=>item.id===id),family=store.data.families.find(item=>item.id===sku?.familyId);return sku?`${family?savedSkuSpec(family,sku):savedSkuName(sku)} · ${sku.code||sku.id}`:id}
function selectSku(id:string){selectedId.value=id}
function loadOverview(){overview.value=skus.value.map(sku=>{const value=queryProductBenefitRelations(store.data,sku.id,store.can);return {id:sku.id,spec:skuLabel(sku.id),effective:value.configurationsReadable?stateLabels[value.effective?.state||'unconfigured']!:'不可查看',candidates:value.configurationsReadable?value.candidates.length:null,packages:value.packagesReadable?value.packages.length:null}})}
function returnTo(){if(!props.familyId)return route.fullPath;return router.resolve({path:route.path,query:{...route.query,relatedSku:selectedId.value},hash:route.hash}).fullPath}
function startShopping(){void router.push({path:'/sales-shopping',query:{sku:selectedId.value,sourceContext:'1',returnTo:returnTo()}})}
function viewConfiguration(planId:string,bindingId?:string,version?:number|null){void router.push({path:'/sales-configurations',query:{configure:'1',readonly:'1',planId,bindingId,planVersion:version===undefined||version===null?undefined:String(version),returnTo:returnTo()}})}
function configure(){void router.push({path:'/sales-configurations',query:{configure:'1',returnTo:returnTo()}})}
function viewPackage(id:string){void router.push({path:`/benefit-packages/${encodeURIComponent(id)}`,query:{returnTo:returnTo()}})}
function usePackage(id:string){void router.push({path:'/sales-shopping',query:{scheme:id,copy:'1',sku:selectedId.value,sourceContext:'1',returnTo:returnTo()}})}
const packageStatus=(value:string)=>({available:'可用',draft:'草稿',disabled:'停用'} as Record<string,string>)[value]||'未知状态'
</script>
<style scoped>
.product-benefit-relations{margin-top:16px}.product-benefit-relations header{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.product-benefit-relations h2{display:flex;align-items:center;gap:7px;font-size:16px;margin:0}.product-benefit-relations h2 .el-icon{font-size:16px;color:var(--el-text-color-secondary)}.product-benefit-relations h3{font-size:14px;margin:0 0 10px}.product-benefit-relations section{padding:16px 0;border-top:1px solid var(--el-border-color-lighter);margin-top:12px}.sku-choice{display:flex;gap:12px;align-items:center;margin-top:14px;flex-wrap:wrap}.sku-choice .el-select{width:min(560px,100%)}.current-spec{font-size:13px;font-weight:600}.relation-row{display:flex;justify-content:space-between;gap:14px;align-items:center;font-size:13px;padding:9px 0}.relation-row p{font-size:12px;margin:5px 0;color:var(--el-text-color-secondary);line-height:1.6}.relation-actions{display:flex;flex-wrap:wrap;justify-content:flex-end}.muted{font-size:12px;line-height:1.6;color:var(--el-text-color-secondary)}summary{cursor:pointer;font-size:13px}@media(max-width:700px){.relation-row{align-items:flex-start;flex-direction:column}.relation-actions{justify-content:flex-start}.product-benefit-relations header{gap:8px}}
</style>
