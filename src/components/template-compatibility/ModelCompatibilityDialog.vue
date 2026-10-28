<template>
  <el-dialog :model-value="modelValue" title="模型适用关系" width="min(1400px,96vw)" :before-close="close" :close-on-click-modal="false" destroy-on-close>
    <template v-if="store.can('product:compatibility:read')&&store.can('product:type:read')">
      <HostTemplateCompatibility v-if="role==='host'" ref="host" :model-id="modelId" :version-id="versionId" :node-id="nodeId" :readonly="readonly"/>
      <TemplateCompatibilityDialog v-else-if="role==='accessory'" ref="accessory" :model-value="modelValue" :model-id="modelId" :version-id="versionId||undefined" :initial-node-id="nodeId" :readonly="readonly" embedded @update:model-value="value=>{if(!value)close()}"/>
      <p v-else>此模型的产品类型用途未指定或为其他。请在商品资料管理核对真实产品类型，不根据名称推测适用方向。</p>
    </template><p v-else>当前身份没有查看模型适用关系所需的权限。</p>
    <template #footer><el-button @click="close()">关闭</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {onBeforeRouteLeave,onBeforeRouteUpdate} from 'vue-router'
import {useCatalogStore} from '../../stores/catalog'
import {templateBusinessRole} from '../../domain/templateHostCompatibility'
import HostTemplateCompatibility from './HostTemplateCompatibility.vue'
import TemplateCompatibilityDialog from './TemplateCompatibilityDialog.vue'
const props=defineProps<{modelValue:boolean;modelId:string;versionId?:string|null;nodeId?:string;readonly?:boolean}>()
const emit=defineEmits<{'update:modelValue':[boolean]}>(),store=useCatalogStore()
const host=ref<InstanceType<typeof HostTemplateCompatibility>>(),accessory=ref<InstanceType<typeof TemplateCompatibilityDialog>>()
const role=computed(()=>store.can('product:type:read')?templateBusinessRole(store.data,props.modelId):'unknown')
async function canLeave(){return !props.modelValue||(!host.value||await host.value.canDiscard())&&(!accessory.value||await accessory.value.canDiscard())}
function acceptContextChange(){host.value?.acceptContextChange();accessory.value?.acceptContextChange()}
async function close(done?:()=>void){if(!await canLeave())return;acceptContextChange();emit('update:modelValue',false);done?.()}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(async()=>{if(!await canLeave())return false;acceptContextChange();emit('update:modelValue',false);return true})
watch(()=>[store.activeUserId,store.previewUserId,store.can('product:compatibility:read'),store.can('product:type:read')],()=>{acceptContextChange();emit('update:modelValue',false)})
defineExpose({canLeave,acceptContextChange})
</script>
