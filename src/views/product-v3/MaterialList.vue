<template>
  <div>
    <PageHead title="物料档案" desc="物料来源于规划节点。这里只做演示档案，不连接库存和采购。">
    </PageHead>
    <div class="panel">
      <el-table :data="rows" empty-text="暂无物料">
        <el-table-column prop="materialCode" label="物料编码" width="140" />
        <el-table-column prop="name" label="物料名称" min-width="220" />
        <el-table-column prop="sourcePath" label="完整路径" min-width="260" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag kind="material" :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="170" />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/material/${row.id}`)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import { formatPlanTime } from '../../mock/product-v3/productPlan'
import { useMaterialStore } from '../../stores/material'

const router = useRouter()
const materialStore = useMaterialStore()
const rows = computed(() =>
  materialStore.state.materials.map((item) => ({
    ...item,
    createTime: formatPlanTime(item.createTime),
  })),
)
</script>
