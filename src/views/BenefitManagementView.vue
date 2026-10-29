<template>
  <div>
    <PageHead title="权益包管理" desc="选归属分类 → 确定主机范围 → 勾合法配件类型 → 预览实际商品 → 保存。">
      <el-button v-if="store.canRoute({path:'/benefits/shopping'})" @click="router.push('/benefits/shopping')">去选购</el-button>
      <el-button v-if="returnTo" @click="router.push(returnTo)">返回来源</el-button>
    </PageHead>
    <div class="management-layout">
      <aside class="panel">
        <CatalogScopeTree :categories="store.data.categories" :types="index.typeRows" :category-id="categoryId" :scope-type-id="scopeTypeId" :expanded-ids="expanded" @expand="expanded=$event" @select="selectCategory" @select-type="selectType"/>
      </aside>
      <BenefitGroupManager :category-id="categoryId" :scope-type-id="scopeTypeId" :types="index.typeRows" :model-id="queryText('model')" :version-id="queryText('version')" :node-id="queryText('node')" :initial-host-key="queryText('host')"/>
    </div>
  </div>

</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHead from '../components/PageHead.vue';
import CatalogScopeTree from '../components/catalog-workspace/CatalogScopeTree.vue';
import BenefitGroupManager from '../components/benefits/BenefitGroupManager.vue';
import { useCatalogStore } from '../stores/catalog';
import { compatibilityReturnLocation } from '../domain/compatibilityNavigation';
import { buildCatalogWorkspaceIndex } from '../domain/catalogWorkspaceQuery';
import { categoryContains } from '../domain/benefits/scope';
const route = useRoute(), router = useRouter(), store = useCatalogStore(), expanded = ref<string[]>([]);
const queryText = (key: string) => typeof route.query[key] === 'string' ? route.query[key] as string : '';
const index = computed(() => buildCatalogWorkspaceIndex(store.data, store.can));
const categoryId = computed(() => queryText('category')), scopeTypeId = computed(() => queryText('type'));
const returnTo = computed(() => compatibilityReturnLocation(route.query.returnTo));
function selectCategory(category: string) {
    router.push({ path: '/benefits/manage', query: { ...(returnTo.value ? { returnTo: returnTo.value } : {}), ...(category ? { category } : {}) } });
}
function selectType(type: string) {
    const row = index.value.typeRows.find(t => t.id === type);
    // Keep the current directory scope, so a parent-owned package remains visible
    // when its contained type is selected underneath that parent.
    const category = !categoryId.value || categoryContains(store.data, categoryId.value, row?.categoryIds[0] || '') ? categoryId.value : row?.categoryIds[0] || '';
    router.push({ path: '/benefits/manage', query: { ...(returnTo.value ? { returnTo: returnTo.value } : {}), category, type } });
}
</script>
<style scoped>
.management-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px;margin-top:16px;align-items:start}@media(max-width:900px){.management-layout{grid-template-columns:1fr}}
</style>
