<template>
  <el-form label-width="110px" @submit.prevent>
    <el-form-item label="SKU 编码"><el-input v-model="draft.code" placeholder="可空，不自动编造编号" /></el-form-item>
    <el-form-item label="SKU 名称"><el-input v-model="draft.skuName" placeholder="可空" data-sku-name /></el-form-item>
    <el-form-item label="OA_SKUID"><el-input v-model="draft.oaSkuId" placeholder="可空" /></el-form-item>
    <el-form-item label="状态"><el-select v-model="draft.status"><el-option label="草稿" value="draft" /><el-option label="在售" value="on_sale" /><el-option label="停售" value="off_sale" /></el-select></el-form-item>
    <el-form-item v-for="field in fields" :key="field.name" :label="field.name" :required="field.required">
      <el-select v-model="draft.variantAttrs[field.name]" :disabled="specLocked" filterable :allow-create="!family.modelVersionId" default-first-option clearable :placeholder="`选择${field.name}`" :data-sku-field="field.name"><el-option v-for="value in field.values" :key="value" :value="value" :label="value" /></el-select>
    </el-form-item>
    <p v-if="specLocked" class="muted">这条 SKU 有模型或规划来源，规格身份保留。需要其他规格时请追加 SKU。</p>
  </el-form>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { skuFields, type SkuDraft } from '../../domain/spuSku'
import type { ProductFamily } from '../../domain/types'
import { useCatalogStore } from '../../stores/catalog'
const props = defineProps<{ family: ProductFamily; specLocked?: boolean }>()
const draft = defineModel<SkuDraft>({ required: true })
const store = useCatalogStore()
const fields = computed(() => skuFields(store.data, props.family))
</script>
