<template>
  <div>
    <PageHead title="描述规则" desc="用字段组合拼物料名称。保存的是规则和预览，不会自动改已有物料。">
    </PageHead>
    <div class="rule-layout">
      <div class="panel">
        <el-table :data="rules" empty-text="暂无规则" highlight-current-row :current-row-key="currentId" row-key="id" @row-click="onRow">
          <el-table-column prop="name" label="规则名称" min-width="180" />
          <el-table-column prop="applicableType" label="适用类型" width="110" />
          <el-table-column label="规则内容" min-width="200">
            <template #default="{ row }">{{ row.fields.join(' + ') }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <StatusTag kind="compat" :status="row.status" />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="panel">
        <MaterialRuleEditor v-if="current" :rule="current" @save="save" />
        <p v-else class="muted">请选择一条规则。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import PageHead from '../../components/PageHead.vue'
import MaterialRuleEditor from '../../components/product-v3/MaterialRuleEditor.vue'
import StatusTag from '../../components/product-v3/StatusTag.vue'
import type { MaterialRule } from '../../mock/product-v3/materialRule'
import { useMaterialStore } from '../../stores/material'

const materialStore = useMaterialStore()
const rules = computed(() => materialStore.state.rules)
const currentId = ref(rules.value[0]?.id || '')
const current = computed(() => rules.value.find((item) => item.id === currentId.value) || null)

function onRow(row: MaterialRule) {
  currentId.value = row.id
}

function save(rule: MaterialRule) {
  const error = materialStore.saveRule(rule)
  if (error) {
    ElMessage.warning(error)
    return
  }
  ElMessage.success('已保存描述规则')
}
</script>

<style scoped>
.rule-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr); gap: 14px; }
@media (max-width: 1100px) {
  .rule-layout { grid-template-columns: 1fr; }
}
</style>
