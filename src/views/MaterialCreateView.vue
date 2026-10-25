<template>
  <div>
    <PageHead title="物料建档" desc="从已发布规划创建物料；同一 PLN 可以建立多条 MAT。"><el-button @click="router.push('/spus')">返回 SPU 管理</el-button></PageHead>
    <div class="panel">
      <el-form label-width="110px"><el-form-item label="商品分类"><CategoryTreeSelect v-model="categoryId" :categories="store.data.categories" /></el-form-item></el-form>
      <V3CreateFlow v-if="models.length" :key="categoryId" :category-id="categoryId" />
      <template v-else>
        <p class="muted">当前分类没有已发布模型。可选择其他分类，或在产品类型下创建临时物料。</p>
        <div class="row-actions"><el-select v-model="typeId" placeholder="选择产品类型"><el-option v-for="item in types" :key="item.id" :value="item.id" :label="item.name" /></el-select><el-button :disabled="!typeId || !store.can('product:material:create')" @click="temporaryOpen = true">创建临时物料</el-button></div>
      </template>
      <TemporaryMaterialDialog :open="temporaryOpen" :category-id="categoryId" :product-type-id="typeId" @close="temporaryOpen = false" @open="openMaterial" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import CategoryTreeSelect from '../components/CategoryTreeSelect.vue'
import V3CreateFlow from '../components/V3CreateFlow.vue'
import TemporaryMaterialDialog from '../components/TemporaryMaterialDialog.vue'
import { publishedModelsForCategory } from '../domain/material'
import { useCatalogStore } from '../stores/catalog'
const store = useCatalogStore()
const router = useRouter()
const route = useRoute()
const categoryId = ref(String(route.query.category || ''))
const typeId = ref('')
const temporaryOpen = ref(false)
const models = computed(() => publishedModelsForCategory(store.data, categoryId.value))
const types = computed(() => store.productTypesOf(categoryId.value))
watch(categoryId, () => { typeId.value = types.value[0]?.id || '' }, { immediate: true })
function openMaterial(familyId: string, skuId: string) { temporaryOpen.value = false; router.push({ path: `/materials/${familyId}`, query: { sku: skuId } }) }
</script>
