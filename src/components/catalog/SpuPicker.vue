<template>
  <div>
    <el-input v-model="keyword" placeholder="搜索 SPU 名称、OA 编号、分类、类型或公共属性" clearable data-spu-search />
    <el-select :model-value="modelValue" placeholder="先选择所属 SPU" style="width: 100%; margin-top: 8px" @change="emit('change', $event)" data-spu-picker>
      <el-option v-for="row in rows" :key="row.family.id" :value="row.family.id" :label="row.family.name" :disabled="Boolean(row.reason)">
        <span>{{ row.family.name }} · {{ row.family.oaProductId || '无 OA 编号' }} · {{ row.count }} SKU</span>
        <small class="picker-detail">{{ row.description }}{{ row.reason ? ` · 不兼容：${row.reason}` : '' }}</small>
      </el-option>
    </el-select>
    <p v-if="rows.length === 0" class="muted">没有匹配的 SPU，可以清除搜索或新建 SPU。</p>
    <p v-if="planId" class="muted">按规划的分类、产品类型、模型版本和公共属性匹配；不兼容的 SPU 会说明原因。</p>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { categoryPath } from '../../domain/logic'
import { productTypeName, realSkusOf } from '../../domain/productList'
import { planSpuCompatibility } from '../../domain/spuSku'
import { useCatalogStore } from '../../stores/catalog'
const props = defineProps<{ modelValue: string; templateId?: string; planId?: string }>()
const emit = defineEmits<{ change: [id: string] }>()
const store = useCatalogStore()
const keyword = ref('')
const rows = computed(() => store.data.families.map(family => {
  const description = [categoryPath(store.data, family.categoryId), productTypeName(store.data, family), Object.entries(family.commonAttrs).map(([name, value]) => `${name}：${value}`).join(' / ')].filter(Boolean).join(' · ')
  const reason = props.planId ? planSpuCompatibility(store.data, family, props.planId) : props.templateId && family.templateId !== props.templateId ? '所属模型或属性方案不同' : ''
  return { family, description, reason, count: realSkusOf(store.data, family.id).length }
}).filter(row => `${row.family.name} ${row.family.oaProductId} ${row.description}`.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase())).sort((a, b) => Number(Boolean(a.reason)) - Number(Boolean(b.reason))))
</script>
<style scoped>
.picker-detail { display: block; color: var(--el-text-color-secondary); }
:global(.el-select-dropdown__item:has(.picker-detail)) { height: auto; min-height: 56px; line-height: 24px; white-space: normal; max-width: min(800px, 90vw); }
</style>
