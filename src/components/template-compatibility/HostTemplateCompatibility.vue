<template>
  <section data-host-template-compatibility>
    <div class="context-head"><strong>适配配件</strong><span v-if="store.can('product:compatibility:read')">{{ groups.length }} 款明确机型 · {{ choices.legalCount }} 个合法组合 · {{ choices.skuCount }} 条实际销售 SKU</span></div>
    <el-alert v-for="issue in choices.issues" :key="issue" :title="issue" type="warning" :closable="false" />
    <el-select v-if="choices.choices.length" :model-value="selectedKey" filterable placeholder="选择当前范围内的设备规格" aria-label="模板反查设备规格" data-host-template-device @update:model-value="selectDevice">
      <el-option-group v-for="group in groups" :key="group.key" :label="`${group.label} · ${group.items.length} 个设备规格`"><el-option v-for="item in group.items" :key="item.key" :value="item.key" :label="item.label" /></el-option-group>
    </el-select>
    <p v-if="selected" class="muted">{{ selected.label }} · {{ selected.skuId?'使用实际商品的来源、属性及规划规格':'仅查询此合法规格，不代表已创建 SKU' }}</p>
    <CompatibilityResults v-if="selected" :key="selected.key" :device-context="selected.device" fixed-context include-undeclared :readonly="readonly || !store.can('product:compatibility:read')" @maintain="maintain" />
    <el-empty v-else-if="store.can('product:compatibility:read')" description="选择明确设备规格后查看适配配件；身份不明确的范围继续保留待核对。" :image-size="60" />
    <details v-if="selected" class="context-detail"><summary>方向与来源详情</summary><p>此处反查配件适用于当前设备的正式声明。商品名称或分类不会自动建立兼容声明。</p><p>{{ modelId }} · {{ versionId || '模型草稿' }} · {{ selected.identityKey }}</p><p v-if="!selected.device.planningId">当前设备未唯一对应 PLN，指定 PLN 的声明仍须单独核对。</p></details>
    <section v-if="maintenanceOpen && !readonly" class="maintenance"><div class="context-head"><strong>维护当前设备的配件声明</strong><el-button @click="closeMaintenance">返回适配结果</el-button></div><CompatibilityManager ref="manager" :target="maintenanceTarget" :host="maintenanceHost" :device-sku-id="selected?.skuId" managed-navigation /></section>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useCatalogStore} from '../../stores/catalog'
import {templateHostChoices} from '../../domain/templateHostCompatibility'
import type {TemplateSpecSelector} from '../../domain/templateCompatibilityTypes'
import type {AccessoryTarget} from '../../domain/accessoryCompatibilityTypes'
import type {CompatibilityHost} from '../../domain/types'
import CompatibilityResults from '../compatibility/CompatibilityResults.vue'
import CompatibilityManager from '../compatibility/CompatibilityManager.vue'
const props=defineProps<{modelId:string;versionId?:string|null;nodeId?:string;scopeSelector?:TemplateSpecSelector;readonly?:boolean}>()
const store=useCatalogStore(),selectedKey=ref(''),maintenanceOpen=ref(false),maintenanceTarget=ref<AccessoryTarget>(),maintenanceHost=ref<CompatibilityHost>(),manager=ref<InstanceType<typeof CompatibilityManager>>()
const choices=computed(()=>store.can('product:compatibility:read')?templateHostChoices(store.data,{modelId:props.modelId,versionId:props.versionId,nodeId:props.nodeId,selector:props.scopeSelector}):{choices:[] as ReturnType<typeof templateHostChoices>['choices'],issues:['当前角色尚无适用关系查看权限。'],legalCount:0,skuCount:0})
const groups=computed(()=>{const result=new Map<string,{key:string;label:string;items:typeof choices.value.choices}>();for(const choice of choices.value.choices){const group=result.get(choice.groupKey)||{key:choice.groupKey,label:choice.groupLabel,items:[]};group.items.push(choice);result.set(choice.groupKey,group)}return [...result.values()]})
const selected=computed(()=>choices.value.choices.find(item=>item.key===selectedKey.value))
watch(()=>choices.value.choices.map(item=>item.key).join('\n'),()=>{if(!choices.value.choices.some(item=>item.key===selectedKey.value))selectedKey.value=choices.value.choices.length===1?choices.value.choices[0]!.key:''},{immediate:true})
async function canDiscard(){return manager.value?await manager.value.canDiscard():true}
function acceptContextChange(){manager.value?.acceptContextChange();maintenanceOpen.value=false}
async function selectDevice(value:string){if(!await canDiscard())return;acceptContextChange();selectedKey.value=value}
async function maintain(target?:AccessoryTarget,host?:CompatibilityHost){if(props.readonly||!store.can('product:compatibility:read')||!await canDiscard())return;acceptContextChange();maintenanceTarget.value=target;maintenanceHost.value=host||selected.value?.device.host;maintenanceOpen.value=true}
async function closeMaintenance(){if(await canDiscard())acceptContextChange()}
watch(()=>[store.activeUserId,store.previewUserId],acceptContextChange)
defineExpose({canDiscard,acceptContextChange})
</script>
<style scoped>
.context-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.context-head span,.muted{font-size:13px;color:var(--el-text-color-secondary)}.el-select{width:100%;margin:12px 0}.context-detail{margin-top:14px;font-size:13px}.context-detail p{overflow-wrap:anywhere}.context-detail summary{cursor:pointer;color:var(--el-color-primary)}.maintenance{margin-top:24px;border-top:1px solid var(--el-border-color-lighter);padding-top:18px}
</style>
