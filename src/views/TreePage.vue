<template>
  <div>
    <PageHead title="商品结构视图" desc="只展示已经有的商品。旧模式保留空层级，精简模式只是看得少一些，不改数据。">
      <el-select v-model="templateId" style="width: 180px">
        <el-option v-for="item in store.data.templates.filter((tpl) => tpl.structureOrder.length)" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-switch v-model="compact" active-text="精简" inactive-text="旧层级" />
      <el-input v-model="keyword" placeholder="搜索节点或规格" style="width: 200px" />
    </PageHead>
    <div class="panel">
      <el-tree :data="shown" node-key="key" default-expand-all>
        <template #default="{ data }">
          <span class="tree-node">
            <span>{{ data.levelName }}：{{ data.label }}</span>
            <el-button v-if="data.familyId" link type="primary" @click="router.push(`/products/${data.familyId}`)">查看商品</el-button>
          </span>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { buildProductTree } from '../domain/logic'
import type { TreeNode } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const templateId = ref('t-phone')
const compact = ref(false)
const keyword = ref('')
const tree = computed(() => buildProductTree(store.data, templateId.value, compact.value))
const shown = computed(() => filterTree(tree.value, keyword.value.trim()))

function filterTree(nodes: TreeNode[], text: string): TreeNode[] {
  if (!text) return nodes
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, text)
    if (node.label.includes(text) || node.levelName.includes(text) || children.length) return [{ ...node, children }]
    return []
  })
}
</script>
