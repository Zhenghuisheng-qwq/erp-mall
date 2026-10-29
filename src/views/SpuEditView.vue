<template>
  <div>
    <PageHead :title="isNew ? '新建 SPU' : 'SPU 详情'" desc="维护商品主体和公共信息，规格商品在 SKU 管理中维护。"><el-button @click="router.push('/spus')">返回 SPU 管理</el-button></PageHead>
    <el-empty v-if="!initial" description="SPU 不存在或已删除" />
    <template v-else>
      <section v-if="family" class="panel" style="margin-bottom: 16px">
        <h2>{{ family.name }}</h2>
        <p>{{ categoryPath(store.data, family.categoryId) }} · {{ productTypeName(store.data, family) }} · {{ linkedModelName(store.data, family) }}</p>
        <p>绑定版本：{{ version?.versionName || family.modelVersionId || '未绑定发布模型' }} <span v-if="family.productPlanId"> · 历史规划：{{ planName }}</span></p>
        <div class="row-actions">
          <el-button @click="router.push({ path: '/skus', query: { spu: family.id } })">管理 SKU（{{ children.length }}）</el-button>
          <el-button type="primary" @click="router.push({ path: '/skus/new', query: { spu: family.id } })" :disabled="!(store.can('product:sku:create'))">新增 SKU</el-button>
          <el-button v-if="family.line === 'v3'" @click="router.push(`/materials/${family.id}`)">管理物料（{{ materials.length }}）</el-button>
          <el-button v-if="version" @click="historyOpen = true">查看历史快照</el-button>
          <el-button v-if="compatibilityRole === 'host' && children.length" data-spu-compatibility @click="compatibilityOpen = true">适用配件</el-button>
        </div>
        <el-select v-if="compatibilityRole==='host'&&store.canRoute({path:'/benefits/shopping'})" :model-value="undefined" placeholder="选择实际规格，用此设备选配" aria-label="选配设备规格" @change="(id:string)=>router.push({path:'/benefits/shopping',query:{device:`sku:${id}`,returnTo:route.fullPath}})"><el-option v-for="s in children" :key="s.id" :value="s.id" :label="(s.skuName||s.code)+' · '+savedSkuSpec(family,s)"/></el-select>
        <div v-if="compatibilityRole==='accessory'&&store.can('product:compatibility:read')" class="row-actions"><el-select v-model="rangeSkuIds" multiple placeholder="明确选择实际 SKU 批量维护" aria-label="SPU 适用范围 SKU"><el-option v-for="s in children" :key="s.id" :value="s.id" :label="(s.skuName||s.code)+' · '+savedSkuSpec(family,s)"/></el-select><el-button :disabled="!rangeSkuIds.length" data-spu-range @click="router.push({path:'/compatibility',query:{tab:'ranges',targets:JSON.stringify(rangeSkuIds),returnTo:route.fullPath}})">维护所选 SKU 的适用范围</el-button></div>
        <el-table v-if="children.length" :data="children" size="small">
          <el-table-column label="SKU 编码"><template #default="{ row }">{{ row.code || '—' }}</template></el-table-column>
          <el-table-column label="SKU 名称"><template #default="{ row }"><el-button link @click="router.push({ path: `/skus/${row.id}`, query: { spu: family.id } })">{{ row.skuName || '未记录' }}</el-button></template></el-table-column>
          <el-table-column label="规格"><template #default="{ row }">{{ savedSkuSpec(family, row) }}</template></el-table-column>
        </el-table>
        <p v-else class="muted">这个 SPU 暂无 SKU，可以分批追加。物料不计入 SKU 数量。</p>
      </section>

      <section class="panel"><SpuForm :key="String(route.params.id || 'new')" :initial="initial" @dirty="dirty = $event" @cancel="router.push('/spus')" @saved="saved" /></section>
    </template>
    <el-dialog v-model="historyOpen" title="SPU 绑定的历史快照" width="min(900px, 94vw)">
      <p>{{ version?.versionName }} · {{ version?.publishTime }}</p>
      <el-table :data="version?.nodesSnapshot || []" max-height="480"><el-table-column prop="id" label="节点 ID" /><el-table-column prop="attributeId" label="属性 ID" /><el-table-column prop="valueId" label="取值" /><el-table-column prop="parentId" label="父节点" /></el-table>
    </el-dialog>
    <AccessoryCompatibilityDrawer v-model="compatibilityOpen" :family-id="family?.id || ''" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHead from '../components/PageHead.vue'
import SpuForm from '../components/catalog/SpuForm.vue'
import AccessoryCompatibilityDrawer from '../components/compatibility/AccessoryCompatibilityDrawer.vue'
import { compatibilityFamilyRole } from '../domain/deviceResolution'
import { useUnsavedCatalog } from '../components/catalog/useUnsavedCatalog'
import { newSpuDraft } from '../domain/spuDraft'
import { categoryPath } from '../domain/logic'
import { linkedModelName, materialArchivesOf, productTypeName, realSkusOf, savedSkuSpec } from '../domain/productList'
import { useCatalogStore } from '../stores/catalog'
const store = useCatalogStore()
const route = useRoute()
const router = useRouter()
const dirty = ref(false)
const historyOpen = ref(false)
const compatibilityOpen = ref(false)
const rangeSkuIds=ref<string[]>([])
useUnsavedCatalog(dirty)
const isNew = computed(() => route.name === 'spu-new')
const family = computed(() => store.data.families.find(item => item.id === route.params.id))
const compatibilityRole = computed(() => compatibilityFamilyRole(store.data, family.value?.id || ''))
const initial = computed(() => isNew.value ? newSpuDraft(store.data, { fromId: String(route.query.from || ''), templateId: String(route.query.template || ''), categoryId: String(route.query.category || '') }) : family.value)
const version = computed(() => store.data.specModelVersions.find(item => item.id === family.value?.modelVersionId))
const planName = computed(() => store.data.productPlans.find(item => item.id === family.value?.productPlanId)?.name || family.value?.productPlanId)
const children = computed(() => realSkusOf(store.data, family.value?.id || ''))
const materials = computed(() => materialArchivesOf(store.data, family.value?.id || ''))
function saved(id: string, addSku: boolean) {
  dirty.value = false
  ElMessage.success('SPU 已保存，已有 SKU 和物料保持不变')
  router.push(addSku ? { path: '/skus/new', query: { spu: id } } : `/spus/${id}`)
}
</script>
