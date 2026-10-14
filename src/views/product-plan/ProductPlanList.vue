<template>
  <div>
    <PageHead title="商品规划" desc="第一步：建立产品规划结构。导图和竖向表看的是同一棵树。">
      <el-button type="primary" @click="openCreate">新增规划</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="rows" empty-text="暂无规划">
        <el-table-column prop="name" label="规划名称" min-width="180" />
        <el-table-column prop="category" label="所属分类" min-width="160" />
        <el-table-column prop="nodeCount" label="节点数量" width="110" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag kind="plan" :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updated" label="更新时间" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row.id, true)">查看规划</el-button>
            <el-button link type="primary" @click="open(row.id, false)">编辑规划</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="createOpen" title="新增规划" width="480px">
      <el-form label-width="88px">
        <el-form-item label="规划名称">
          <el-input v-model="draft.name" maxlength="40" placeholder="例如：手机商品规划" @keyup.enter="save" />
        </el-form-item>
        <el-form-item label="所属分类">
          <el-select v-model="draft.categoryId" filterable placeholder="选择分类" style="width: 100%">
            <el-option v-for="item in categoryOptions" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="draft.description" type="textarea" :rows="3" maxlength="120" placeholder="这棵规划要解决什么品类结构" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import { categoryChain } from '../../domain/categoryTree'
import { formatPlanTime } from '../../mock/product-v3/productPlan'
import { useCatalogStore } from '../../stores/catalog'
import { useProductPlanStore } from '../../stores/productPlan'

const router = useRouter()
const catalog = useCatalogStore()
const planStore = useProductPlanStore()
const createOpen = ref(false)
const draft = reactive({ name: '', categoryId: '', description: '' })

const categoryOptions = computed(() =>
  catalog.data.categories
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      id: item.id,
      name: item.name,
      label: categoryChain(catalog.data.categories, item.id).map((node) => node.name).join(' / '),
    })),
)

function categoryName(id: string) {
  return categoryOptions.value.find((item) => item.id === id)?.label || '未找到分类'
}

const rows = computed(() =>
  planStore.state.plans
    .slice()
    .sort((a, b) => b.updatedTime.localeCompare(a.updatedTime))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      category: categoryName(plan.categoryId),
      nodeCount: planStore.nodesOf(plan.id).length,
      status: plan.status,
      updated: formatPlanTime(plan.updatedTime),
    })),
)

function openCreate() {
  draft.name = ''
  draft.categoryId = ''
  draft.description = ''
  createOpen.value = true
}

function open(id: string, view: boolean) {
  router.push(view ? { path: `/product-plan/${id}`, query: { mode: 'view' } } : `/product-plan/${id}`)
}

function save() {
  const name = draft.name.trim()
  if (!name) {
    ElMessage.warning('请填写规划名称')
    return
  }
  if (!draft.categoryId) {
    ElMessage.warning('请选择所属分类')
    return
  }
  const category = categoryOptions.value.find((item) => item.id === draft.categoryId)
  const id = planStore.createPlan({
    name,
    categoryId: draft.categoryId,
    description: draft.description,
    rootName: category?.name || name,
  })
  createOpen.value = false
  router.push(`/product-plan/${id}`)
}
</script>
