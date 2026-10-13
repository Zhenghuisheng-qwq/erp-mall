<template>
  <div>
    <PageHead title="运营分组" desc="用来做活动、推荐和筛选。不改变商品分类，也不改变规格。">
      <el-button type="primary" @click="create(null)">新建分组</el-button>
    </PageHead>
    <div class="grid-2">
      <div class="panel">
        <el-tree :data="tree" node-key="id" default-expand-all @node-click="onPick">
          <template #default="{ data }">
            <span>{{ data.label }}</span>
          </template>
        </el-tree>
      </div>
      <div class="panel" v-if="current">
        <el-input v-model="current.name" style="width: 240px" />
        <div class="row-actions" style="margin: 12px 0">
          <el-button @click="create(current.id)">新增子组</el-button>
          <el-button type="danger" @click="store.removeGroup(current.id)">删除</el-button>
        </div>
        <el-select v-model="picked" multiple placeholder="关联商品" style="width: 100%">
          <el-option v-for="item in store.data.families" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-button type="primary" style="margin-top: 8px" @click="link">保存关联</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const selected = ref('g-phone')
const current = computed(() => store.data.productGroups.find((item) => item.id === selected.value))
const picked = ref<string[]>([])
const tree = computed(() => walk(null))
function walk(parent: string | null): { id: string; label: string; children: ReturnType<typeof walk> }[] {
  return store.data.productGroups.filter((item) => item.parentId === parent).map((item) => ({ id: item.id, label: item.name, children: walk(item.id) }))
}
function onPick(node: { id: string }) {
  selected.value = node.id
  picked.value = store.data.families.filter((item) => item.productGroupIds.includes(node.id)).map((item) => item.id)
}
onMounted(() => {
  picked.value = store.data.families.filter((item) => item.productGroupIds.includes(selected.value)).map((item) => item.id)
})
function create(parentId: string | null) {
  const id = uid('grp')
  store.data.productGroups.push({ id, name: '新分组', parentId })
  selected.value = id
  picked.value = []
}
function link() {
  store.data.families.forEach((family) => {
    const has = family.productGroupIds.includes(selected.value)
    const want = picked.value.includes(family.id)
    if (want && !has) family.productGroupIds.push(selected.value)
    if (!want && has) family.productGroupIds = family.productGroupIds.filter((item) => item !== selected.value)
  })
}
</script>
