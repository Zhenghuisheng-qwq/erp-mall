<template>
  <div>
    <PageHead title="商品质量检查" desc="只看必填、重复和取值不合法。非必填空着不会算问题。">
      <el-radio-group v-model="level">
        <el-radio-button value="error">必须处理</el-radio-button>
        <el-radio-button value="warn">规则未覆盖</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
    </PageHead>
    <div class="panel">
      <el-table :data="rows">
        <el-table-column prop="name" label="商品" min-width="180" />
        <el-table-column prop="message" label="问题" min-width="280" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">{{ row.kind === 'uncovered' ? '未限制' : row.kind === 'duplicate' ? '重复' : row.kind === 'illegal' ? '取值不合法' : '未填写' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }"><el-button link type="primary" @click="router.push(`/products/${row.familyId}`)">去修改</el-button></template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { inspectFamily } from '../domain/logic'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const level = ref<'error' | 'warn' | 'all'>('error')
const rows = computed(() => {
  const list: { name: string; message: string; kind: string; familyId: string }[] = []
  store.data.families.forEach((family) => {
    inspectFamily(store.data, family, store.skusOf(family.id)).forEach((issue) => {
      if (level.value !== 'all' && issue.level !== level.value) return
      list.push({ name: family.name, message: issue.message, kind: issue.kind, familyId: family.id })
    })
  })
  return list
})
</script>
