<template>
  <div>
    <PageHead title="商品工作台" desc="先找商品，或直接新增。分类和规则在左侧菜单里。" />
    <div class="panel">
      <div class="filters">
        <el-input v-model="keyword" placeholder="搜商品、品牌、规格" clearable style="width: 320px" @keyup.enter="goSearch" />
        <el-button type="primary" @click="goSearch">搜索</el-button>
        <el-button type="primary" plain @click="router.push('/products/new')" :disabled="!(store.can('product:spu:create'))">新增商品</el-button>
        <el-button @click="router.push('/check')">待处理问题</el-button>
      </div>
    </div>
    <div class="grid-3" style="margin-top: 14px">
      <div class="panel">
        <h2>最近维护</h2>
        <el-empty v-if="recent.length === 0" description="还没有商品" />
        <button v-for="item in recent" :key="item.id" class="linkish" style="display: block; margin: 10px 0" @click="router.push(`/products/${item.id}`)">
          {{ item.name }}
          <span class="muted"> · {{ item.updatedAt.slice(0, 16).replace('T', ' ') }}</span>
        </button>
      </div>
      <div class="panel">
        <h2>待处理</h2>
        <el-empty v-if="problems.length === 0" description="没有必填或重复问题" />
        <button v-for="item in problems" :key="item.key" class="linkish issue-error" style="display: block; text-align: left; margin: 10px 0" @click="router.push(`/products/${item.familyId}`)">
          {{ item.text }}
        </button>
      </div>
      <div class="panel">
        <h2>常用分类</h2>
        <p class="muted">点进去会按这个分类新增商品。</p>
        <div class="row-actions" style="margin-top: 12px">
          <el-button v-for="item in shortcuts" :key="item.categoryId" @click="router.push(`/products/new?category=${item.categoryId}`)" :disabled="!(store.can('product:spu:create'))">{{ item.name }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { inspectFamily } from '../domain/logic'
import { setViewKeyword } from '../domain/productListViews'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const keyword = ref('')
const recent = computed(() => store.data.families.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6))
const shortcutSeed = [
  { name: '手机', categoryId: 'c-phone' },
  { name: '手表', categoryId: 'c-watch' },
  { name: '平板', categoryId: 'c-pad' },
  { name: '电脑', categoryId: 'c-pc' },
]
const shortcuts = computed(() => shortcutSeed.filter((item) => store.data.categories.find((category) => category.id === item.categoryId)?.enabled !== false))
const problems = computed(() => {
  const rows: { key: string; familyId: string; text: string }[] = []
  store.data.families.forEach((family) => {
    inspectFamily(store.data, family, store.skusOf(family.id))
      .filter((issue) => issue.level === 'error')
      .slice(0, 2)
      .forEach((issue, index) => rows.push({ key: family.id + index, familyId: family.id, text: `${family.name}：${issue.message}` }))
  })
  return rows.slice(0, 6)
})
function goSearch() {
  setViewKeyword(store.data, keyword.value)
  router.push('/products')
}
</script>
