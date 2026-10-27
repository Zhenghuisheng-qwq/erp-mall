<template>
  <el-drawer :model-value="open" title="编辑产品类型业务用途" size="min(500px,96vw)" :before-close="close" :close-on-click-modal="false" data-type-purpose-editor>
    <template v-if="original">
      <p>{{original.name}} · {{original.id}}</p>
      <el-form label-position="top"><el-form-item label="业务用途"><el-select v-model="purpose" aria-label="产品类型业务用途" :disabled="saving||!allowed"><el-option v-for="item in productTypePurposes" :key="item.value" :value="item.value" :label="item.label"/></el-select></el-form-item></el-form>
      <p>主机／设备反查适配配件，配件配置适用机型。其他不使用这两种入口；未指定可稍后维护。</p>
      <p>保存后返回原模型、版本和规格范围。</p>
    </template>
    <el-alert v-if="error||!allowed" :title="error||'当前身份缺少产品类型读取或修改权限，请联系有权限的人员维护。'" type="error" :closable="false"/>
    <template #footer><el-button :disabled="saving" @click="close()">返回搭配与适用</el-button><el-button type="primary" :loading="saving" :disabled="!allowed" @click="save">{{error?'重试保存':'保存并返回'}}</el-button></template>
  </el-drawer>
</template>
<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {ElMessageBox} from 'element-plus'
import {useCatalogStore} from '../../stores/catalog'
import {productTypePurposes} from '../../domain/productTypePurpose'
import type {ProductType} from '../../domain/types'
const props=defineProps<{open:boolean;typeId:string}>(),emit=defineEmits<{'update:open':[boolean]}>()
const store=useCatalogStore(),original=ref<ProductType>(),purpose=ref<NonNullable<ProductType['catalogRole']>|''>(''),saving=ref(false),error=ref('')
let expected='',epoch=0,alive=true
const allowed=computed(()=>!!original.value&&store.can('product:type:read')&&store.can('product:type:update'))
watch([()=>props.open,()=>props.typeId,()=>store.activeUserId,()=>store.previewUserId],()=>{epoch++;if(!props.open)return;const row=store.can('product:type:read')?store.data.productTypes.find(item=>item.id===props.typeId):undefined;original.value=row?JSON.parse(JSON.stringify(row)):undefined;expected=row?JSON.stringify(row):'';purpose.value=row?.catalogRole||'';error.value=row?'':'产品类型不存在或当前身份不可读取。'},{immediate:true})
async function canLeave(){if(!props.open)return true;if(saving.value)return false;if(original.value&&(purpose.value!==(original.value.catalogRole||'')||error.value)){try{await ElMessageBox.confirm('业务用途还有未保存输入，放弃后返回？','未保存产品类型',{confirmButtonText:'放弃输入',cancelButtonText:'继续编辑'})}catch{return false}}return true}
async function close(done?:()=>void){if(!await canLeave())return;emit('update:open',false);done?.()}
async function save(){if(saving.value||!allowed.value||!original.value)return;const ticket=epoch,actor=store.activeUserId,preview=store.previewUserId,current=()=>alive&&props.open&&ticket===epoch&&actor===store.activeUserId&&preview===store.previewUserId;saving.value=true;error.value='';try{const result=await store.commitProductType({...original.value,catalogRole:purpose.value||undefined},expected,current);if(!current())return;if(!result.ok){error.value=result.message||'保存失败，输入保留。';return}emit('update:open',false)}catch(e){if(current())error.value=e instanceof Error?e.message:'保存失败，输入保留。'}finally{saving.value=false}}
onBeforeUnmount(()=>{alive=false})
defineExpose({canLeave})
</script>
