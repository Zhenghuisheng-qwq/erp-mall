<template>
  <div>
    <PageHead title="属性方案绑定" desc="旧入口，菜单已关闭。请到商品分类中心绑定。这里仍读写同一份 mappings。">
    </PageHead>
    <div class="panel">
      <el-table :data="store.data.categories">
        <el-table-column prop="name" label="商品分类" />
        <el-table-column label="属性方案">
          <template #default="{ row }">
            <el-select :model-value="mapping(row.id)" clearable placeholder="未配置" style="width: 220px" @change="onMap(row.id, $event)">
              <el-option v-for="item in store.data.templates.filter((tpl) => tpl.structureOrder.length)" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import PageHead from '../components/PageHead.vue'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
function mapping(categoryId: string) {
  return store.data.mappings.find((item) => item.categoryId === categoryId)?.templateId || ''
}
function onMap(categoryId: string, value: string) {
  store.setCategoryMapping(categoryId, value || '')
}
</script>
