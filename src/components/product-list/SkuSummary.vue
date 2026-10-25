<template>
  <button v-bind="$attrs" class="sku-summary" :class="{ 'is-name': name }" :data-spec-open="name ? undefined : skuId" :aria-label="name ? '查看 SKU 名称和完整规格' : '查看完整规格'" @click="open = true"><span class="summary-text">{{ text }}</span><span v-if="!name" class="summary-action">查看完整规格</span></button>
  <el-dialog v-model="open" title="完整规格" width="min(640px, 94vw)" append-to-body>
    <template v-if="sku && family"><p class="full-name">{{ savedSkuName(sku) }}</p><p class="muted">{{ sku.code }} · {{ family.name }}</p><dl class="spec-pairs"><template v-for="(value, key) in attrs" :key="key"><dt>{{ key }}</dt><dd>{{ value || '—' }}</dd></template></dl><el-input :model-value="complete" type="textarea" readonly :rows="4" aria-label="完整内容，可选择复制" /></template>
    <template #footer><el-button @click="open = false" aria-label="关闭完整规格">关闭</el-button><el-button type="primary" @click="copy">复制完整内容</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useCatalogStore } from '../../stores/catalog'
import { projectAttrs } from '../../domain/logic'
import { savedSkuName, savedSkuSpec } from '../../domain/productList'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ skuId: string; text: string; name?: boolean }>()
const store = useCatalogStore(), open = ref(false)
const sku = computed(() => store.data.skus.find(item => item.id === props.skuId))
const family = computed(() => store.data.families.find(item => item.id === sku.value?.familyId))
const attrs = computed(() => sku.value && family.value ? projectAttrs(family.value, sku.value) : {})
const complete = computed(() => sku.value && family.value ? `${savedSkuName(sku.value)}\n${savedSkuSpec(family.value, sku.value)}` : '')
async function copy() { try { await navigator.clipboard.writeText(complete.value); ElMessage.success('已复制完整内容') } catch { ElMessage.warning('自动复制不可用，请在下方完整内容框选择复制') } }
</script>
<style scoped>
.sku-summary{display:block;width:100%;padding:0;border:0;background:none;text-align:left;color:inherit;font:inherit;cursor:pointer}.summary-text{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:20px;max-height:40px}.is-name{font-weight:600}.summary-action{display:block;color:var(--el-color-primary);font-size:12px;line-height:20px}.sku-summary:focus-visible{outline:2px solid var(--el-color-primary)}.full-name{font-weight:600;overflow-wrap:anywhere}.spec-pairs{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,3fr);gap:8px 16px}.spec-pairs dt{color:var(--el-text-color-secondary)}.spec-pairs dd{margin:0;overflow-wrap:anywhere}
</style>
