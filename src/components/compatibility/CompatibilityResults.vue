<template>
  <section class="compatibility-results" data-compatibility-results>
    <div class="result-tools">
      <el-radio-group v-if="!fixedContext" v-model="perspective" aria-label="适用关系查看视角"><el-radio-button value="phone">看手机</el-radio-button><el-radio-button value="accessory">看配件</el-radio-button></el-radio-group>
      <el-select v-if="!fixedContext && perspective==='phone'" v-model="deviceKey" filterable clearable placeholder="选择实际手机 SKU 或设备型号" aria-label="选择手机或型号" data-result-device>
        <el-option-group label="实际手机 SKU"><el-option v-for="item in phones" :key="item.id" :value="`sku:${item.id}`" :label="`${item.code} · ${item.skuName || item.id}`" /></el-option-group>
        <el-option-group label="设备型号"><el-option v-for="item in models" :key="item.key" :value="`model:${item.key}`" :label="item.label" /></el-option-group>
      </el-select>
      <el-select v-else-if="!fixedContext" v-model="accessoryId" filterable clearable placeholder="选择实际配件" aria-label="选择配件" data-result-accessory><el-option v-for="item in accessories" :key="item.id" :value="item.id" :label="`${item.materialCode || item.code} · ${item.skuName || item.id}`" /></el-select>
      <el-checkbox v-model="requireFastCharge" data-require-fast-charge>要求快充</el-checkbox><el-button v-if="!readonly" @click="maintain()">维护当前范围</el-button>
    </div>
    <template v-if="hasSelection">
      <el-alert v-if="perspective==='phone' && forward.device.status!=='resolved'" :title="forward.device.message || '需要先确认此手机的实际设备型号。'" type="warning" :closable="false"><template #default><el-button v-if="deviceKey.startsWith('sku:')" link type="primary" @click="emit('bind',deviceKey.slice(4))">配置设备型号</el-button></template></el-alert>
      <div class="result-filters"><el-input v-model="keyword" clearable placeholder="搜索当前结果" aria-label="搜索适用结果" /><el-radio-group v-model="bucket" aria-label="适用结果状态"><el-radio-button value="available">可用 {{ counts.available }}</el-radio-button><el-radio-button value="review">需核对 {{ counts.review }}</el-radio-button><el-radio-button value="blocked">不可选 {{ counts.blocked }}</el-radio-button></el-radio-group></div>
      <template v-if="perspective==='phone'">
        <section v-for="group in groups" :key="group.id"><h3>{{ group.name }} <small>{{ group.rows.length }}</small></h3>
          <article v-for="item in group.rows" :key="`${item.target.kind}:${item.target.id}`" class="result-card" :data-result-accessory-id="item.target.id">
            <div class="result-heading"><div><strong>{{ item.name }}</strong><p class="muted">{{ item.spec || item.code }}<span v-if="item.target.kind==='material'"> · 物料</span></p></div><el-tag :type="statusType(matchBucket(item))">{{ matchLabel(item) }}</el-tag><el-tag v-if="forward.unavailable.includes(item)" type="info">当前非在售</el-tag><el-button v-if="!readonly" @click="maintain(item.target)">查看与维护</el-button></div>
            <details><summary>依据与详情</summary><CompatibilityEvidence :evidence="item.evidence?.filter(e=>e.kind==='general')"/><p v-for="reason in item.reasons" :key="reason">{{ reason }}</p><div v-for="cap in item.capabilities" :key="cap.capability"><p>{{ capabilityLabels[cap.capability] }} · {{ stateLabels[cap.status] }}<span v-if="cap.conflict"> · 规则冲突</span></p><p v-for="(condition,index) in cap.conditions" :key="index">{{ condition.state==='met'?'已满足':condition.state==='unmet'?'不满足':'需核对' }} · {{ condition.label }}</p></div><div v-for="link in item.declarations" :key="link.id"><p>{{ scopeText(link.host) }} · {{ capabilityLabels[declarationDefaults(link).capability] }} · {{ verificationLabels[declarationDefaults(link).verification] }}{{ conclusionLabels[declarationDefaults(link).conclusion] }} · {{ declarationDefaults(link).source }}</p><TemplateCompatibilitySource :link="link" /><p class="muted">{{ link.id }}</p></div></details>
          </article>
        </section>
      </template>
      <template v-else>
        <section v-if="reverse.generalDeclarations?.length" data-reverse-general><h3>通用条件范围（不代表范围内全部型号已适用）</h3><article v-for="c in reverse.generalDeclarations" :key="c.id"><p>{{c.deviceTypeIds.map(id=>store.data.productTypes.find(t=>t.id===id)?.name||'类型已失效').join('、')}} · {{capabilityLabels[c.capability]}} · {{verificationLabels[c.verification]}}</p><p>{{c.conditions.map(x=>conditionText(store.data,x)).join('；')||'必要条件待完善'}} · {{c.source}}</p></article><h4>已登记实际设备试算</h4><p v-for="d in reverse.generalDevices||[]" :key="d.skuId">{{d.name}} · {{compatibilityUseLabel(accessoryUseEvaluation(d))}} <el-button link @click="deviceKey=`sku:${d.skuId}`;perspective='phone'">查看当前设备结果</el-button></p></section>
        <article v-for="item in visibleHosts" :key="item.key" class="result-card" :data-result-host="item.key">
          <div class="result-heading"><strong>{{ item.label }}</strong><el-tag :type="statusType(hostBucket(item))">{{ hostLabel(item) }}</el-tag><el-button v-if="!readonly" @click="maintain(target,item.host)">查看与维护</el-button></div>
          <p v-if="hostUse(item).hasSpecDifferences" class="muted">当前要求的能力包含规格例外，请逐规格核对，不代表全型号适用。</p><p class="muted">{{ item.devices.length }} 条实际设备 SKU · {{ item.declarations.length }} 条声明</p>
          <details><summary>规格例外与依据</summary><p>{{ item.scopeSummary }}</p><div v-for="link in item.declarations" :key="link.id"><p>{{ scopeText(link.host) }} · {{ capabilityLabels[declarationDefaults(link).capability] }} · {{ verificationLabels[declarationDefaults(link).verification] }}{{ conclusionLabels[declarationDefaults(link).conclusion] }} · {{ declarationDefaults(link).source }}</p><ul><li v-for="(condition,index) in declarationDefaults(link).conditions" :key="index">{{ conditionText(store.data,condition) }}</li></ul><TemplateCompatibilitySource :link="link" /></div><el-button v-for="device in item.devices" :key="device.skuId" link type="primary" @click="deviceKey=`sku:${device.skuId}`;perspective='phone'">{{ device.name }} · {{ compatibilityUseLabel(accessoryUseEvaluation(device,{requireFastCharge})) }}</el-button></details>
        </article>
      </template>
      <article v-for="(issue,index) in visibleIssues" :key="index" class="result-card"><el-tag type="danger">引用失效或规则冲突</el-tag><p>{{ issue.message }}</p><el-button v-if="!readonly" @click="maintain()">处理声明</el-button></article>
      <el-empty v-if="!(perspective==='phone'?visibleMatches.length:visibleHosts.length) && !visibleIssues.length" :description="keyword?'当前状态中没有匹配结果。':'当前状态没有结果，可查看其他状态或维护适用声明。'" :image-size="70" />
    </template>
    <details v-if="includeUndeclared && perspective==='phone' && forward.device.status==='resolved'" class="unrecorded" data-undeclared-accessories><summary>尚无适用依据 {{ undeclared.length }} 个配件规格</summary><article v-for="item in undeclared" :key="item.id" class="result-card"><strong>{{ item.skuName || item.code }}</strong><el-tag type="warning">依据待确认</el-tag><el-button v-if="!readonly" @click="maintain({kind:isMaterialArchive(store.data,item)?'material':'sku',id:item.id})">维护此配件</el-button></article></details>
    <el-empty v-if="!hasSelection" :description="perspective==='phone'?'选择手机，查看可用配件及需要核对的项目。':'选择配件，查看适用机型和规格例外。'" :image-size="80" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCatalogStore } from '../../stores/catalog'
import { isMaterialArchive, isRealSku } from '../../domain/catalogIdentity'
import { compatibilityRecordRole, listDeviceModels } from '../../domain/deviceResolution'
import { declarationDefaults, queryAccessoryDevices, queryDeviceAccessories, queryModelAccessories, queryDeviceContextAccessories, accessoryUseEvaluation, reverseAccessoryUseEvaluation } from '../../domain/accessoryCompatibilityQuery'
import type { AccessoryMatch, AccessoryTarget, ReverseCompatibilityResult } from '../../domain/accessoryCompatibilityTypes'
import type { CompatibilityHost } from '../../domain/types'
import { capabilityLabels, conclusionLabels, verificationLabels, conditionText, scopeText, compatibilityUseBucket, compatibilityUseLabel } from './compatibilityPresentation'
import CompatibilityEvidence from './CompatibilityEvidence.vue'
import TemplateCompatibilitySource from '../template-compatibility/TemplateCompatibilitySource.vue'
const props=defineProps<{target?:AccessoryTarget;host?:CompatibilityHost;deviceSkuId?:string;readonly?:boolean;fixedContext?:boolean;includeUndeclared?:boolean;deviceContext?:import('../../domain/accessoryCompatibilityTypes').DeviceResolution}>()
const emit=defineEmits<{maintain:[target:AccessoryTarget|undefined,host:CompatibilityHost|undefined];bind:[skuId:string]}>()
const requireFastCharge=ref(false)
const store=useCatalogStore(),perspective=ref<'phone'|'accessory'>('phone'),deviceKey=ref(''),accessoryId=ref(''),keyword=ref(''),bucket=ref<'available'|'review'|'blocked'>('available')
const models=computed(()=>listDeviceModels(store.data))
const phones=computed(()=>store.data.skus.filter(item=>isRealSku(store.data,item)&&compatibilityRecordRole(store.data,item.id)==='host'))
const accessories=computed(()=>store.data.skus.filter(item=>(isRealSku(store.data,item)||isMaterialArchive(store.data,item))&&compatibilityRecordRole(store.data,item.id)==='accessory'))
const target=computed<AccessoryTarget>(()=>({kind:accessories.value.some(item=>item.id===accessoryId.value&&isMaterialArchive(store.data,item))?'material':'sku',id:accessoryId.value}))
// Query facts depend on catalogue and selected identity only. Local text filtering never rebuilds them.
const forward=computed(()=>props.deviceContext?queryDeviceContextAccessories(store.data,props.deviceContext):deviceKey.value.startsWith('sku:')?queryDeviceAccessories(store.data,deviceKey.value.slice(4)):queryModelAccessories(store.data,models.value.find(item=>`model:${item.key}`===deviceKey.value)?.host))
const reverse=computed(()=>queryAccessoryDevices(store.data,target.value))
const matches=computed(()=>[...forward.value.sales,...forward.value.materials,...forward.value.pending,...forward.value.excluded,...forward.value.unavailable])
const undeclared=computed(()=>{if(!props.includeUndeclared)return [];const known=new Set(matches.value.map(item=>item.target.id));for(const issue of forward.value.issues){const link=store.data.compatibilities.find(item=>item.id===issue.declarationId);if(link)known.add(link.targetId||link.accessorySkuId)}return accessories.value.filter(item=>!known.has(item.id)&&(!keyword.value.trim()||`${item.skuName} ${item.code}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())))})
const issues=computed(()=>perspective.value==='phone'?forward.value.issues:reverse.value.issues)
const hasSelection=computed(()=>props.deviceContext?true:perspective.value==='phone'?!!deviceKey.value:!!accessoryId.value)
const stateLabels={compatible:'已确认适用',conditional:'需核对条件',pending:'依据待确认',incompatible:'明确不适用'}
function matchUse(item:AccessoryMatch){return accessoryUseEvaluation(item,{requireFastCharge:requireFastCharge.value})}
function matchBucket(item:AccessoryMatch){return forward.value.unavailable.includes(item)?'blocked':compatibilityUseBucket(matchUse(item))}
function matchLabel(item:AccessoryMatch){return compatibilityUseLabel(matchUse(item))}
type Host=ReverseCompatibilityResult['hosts'][number]
function hostUse(item:Host){return reverseAccessoryUseEvaluation(item,{requireFastCharge:requireFastCharge.value})}
function hostBucket(item:Host){return compatibilityUseBucket(hostUse(item))}
function hostLabel(item:Host){const use=hostUse(item);return use.hasSpecDifferences&&use.status==='conditional'?'包含规格例外，需逐项核对':compatibilityUseLabel(use)}
function statusType(state:string){return state==='available'?'success':state==='blocked'?'danger':'warning'}
const counts=computed(()=>{const result={available:0,review:0,blocked:issues.value.length};if(perspective.value==='phone')for(const item of matches.value)result[matchBucket(item)]++;else for(const item of reverse.value.hosts)result[hostBucket(item)]++;return result})
function textMatches(value:string){return !keyword.value.trim()||value.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())}
const visibleMatches=computed(()=>matches.value.filter(item=>matchBucket(item)===bucket.value&&textMatches(`${item.name} ${item.spec} ${item.code} ${item.productTypeName}`)))
const visibleHosts=computed(()=>reverse.value.hosts.filter(item=>hostBucket(item)===bucket.value&&textMatches(item.label)))
const visibleIssues=computed(()=>bucket.value==='blocked'?issues.value.filter(item=>textMatches(item.message)):[])
const groups=computed(()=>{const result=new Map<string,{id:string;name:string;rows:AccessoryMatch[]}>();for(const row of visibleMatches.value){const group=result.get(row.productTypeId)||{id:row.productTypeId,name:row.productTypeName,rows:[]};group.rows.push(row);result.set(group.id,group)}return [...result.values()]})
function maintain(selected?:AccessoryTarget,host?:CompatibilityHost){emit('maintain',selected||(perspective.value==='accessory'&&accessoryId.value?target.value:undefined),host||(perspective.value==='phone'?forward.value.device.host:undefined))}
watch(()=>[props.target,props.host,props.deviceSkuId] as const,()=>{if(props.target){accessoryId.value=props.target.id;perspective.value='accessory'}else if(props.deviceSkuId){deviceKey.value=`sku:${props.deviceSkuId}`;perspective.value='phone'}else if(props.host){const host=props.host;const option=models.value.find(item=>item.host.productModelId===host.productModelId&&item.host.identityKey===host.identityKey);deviceKey.value=option?`model:${option.key}`:''}},{immediate:true})
watch([perspective,deviceKey,accessoryId,requireFastCharge],()=>{bucket.value='available';keyword.value=''})
</script>
<style scoped>
.result-tools,.result-filters,.result-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.result-tools>.el-select{min-width:250px;flex:1}.result-filters{margin:20px 0}.result-filters>.el-input{width:260px}.result-card{border:1px solid var(--el-border-color-lighter);border-radius:10px;padding:16px;margin:12px 0}.result-heading>div:first-child,.result-heading>strong:first-child{flex:1;min-width:160px}.muted,small{color:var(--el-text-color-secondary)}p{line-height:1.6;margin:8px 0;overflow-wrap:anywhere}h3{font-size:15px}details{margin-top:12px;font-size:13px}summary{cursor:pointer;color:var(--el-color-primary)}@media(max-width:600px){.result-tools>.el-select,.result-filters>.el-input{width:100%;min-width:0}.result-card{padding:12px}}
</style>
