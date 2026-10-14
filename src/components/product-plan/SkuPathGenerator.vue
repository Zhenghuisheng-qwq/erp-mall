<template>
  <div class="generator">
    <el-form label-width="88px">
      <div class="fields">
        <el-form-item label="商品规划">
          <el-select :model-value="planId" filterable style="width: 100%" @change="onPlan">
            <el-option v-for="item in plans" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="生成范围">
          <el-select :model-value="scopeId" filterable style="width: 100%" @change="onScope">
            <el-option v-for="item in scopes" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
      </div>
      <p class="hint">同一父节点下的多个属性会相乘。属性挂在某个取值下面时，只和这条路径组合，不会跟旁边的取值乘开。</p>
      <el-button type="primary" @click="emit('generate')">生成预览</el-button>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getNodePath } from '../../mock/product-v3/productPlanActions'
import { PLAN_NODE_TYPE_LABEL } from '../../mock/product-v3/productPlan'
import { useProductPlanStore } from '../../stores/productPlan'

const planId = defineModel<string>('planId', { required: true })
const scopeId = defineModel<string>('scopeId', { required: true })

const emit = defineEmits<{
  generate: []
}>()

const planStore = useProductPlanStore()
const plans = computed(() => planStore.state.plans)
const scopes = computed(() => {
  const nodes = planStore.nodesOf(planId.value)
  return nodes
    .map((node) => ({
      id: node.id,
      label: `${PLAN_NODE_TYPE_LABEL[node.nodeType]} · ${getNodePath(nodes, node.id)}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

function onPlan(value: string) {
  planId.value = value
  const plan = planStore.planById(value)
  scopeId.value = plan?.rootNodeId || ''
}

function onScope(value: string) {
  scopeId.value = value
}
</script>

<style scoped>
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.hint { margin: 0 0 12px; color: #66788a; font-size: 13px; }
@media (max-width: 900px) {
  .fields { grid-template-columns: 1fr; }
}
</style>
