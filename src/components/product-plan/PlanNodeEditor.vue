<template>
  <el-form label-width="88px" @submit.prevent>
    <el-form-item label="名称">
      <el-input v-model="draft.name" :disabled="readonly" maxlength="40" />
    </el-form-item>
    <el-form-item label="描述">
      <el-input v-model="draft.description" :disabled="readonly" type="textarea" :rows="2" maxlength="120" placeholder="这个节点在规划里是什么" />
    </el-form-item>
    <h3 class="section">业务配置</h3>
    <el-form-item label="生成物料">
      <el-switch v-model="draft.isMaterialNode" :disabled="readonly" active-text="是" inactive-text="否" />
    </el-form-item>
    <el-form-item label="是否必填">
      <el-switch v-model="draft.required" :disabled="readonly" active-text="是" inactive-text="否" />
    </el-form-item>
    <PlanRuleConfig v-model:description-rule="draft.descriptionRule" v-model:code-rule="draft.codeRule" :readonly="readonly" />
    <div v-if="!readonly" class="editor-actions">
      <el-button type="primary" @click="save">保存节点</el-button>
      <el-button type="danger" plain @click="emit('remove')">删除节点</el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ProductPlanNode } from '../../mock/product-v3/productPlan'
import type { PlanNodePatch } from '../../mock/product-v3/productPlanActions'
import PlanRuleConfig from './PlanRuleConfig.vue'

const props = defineProps<{
  node: ProductPlanNode
  readonly: boolean
}>()

const emit = defineEmits<{
  save: [patch: PlanNodePatch]
  remove: []
}>()

const draft = reactive<PlanNodePatch>({
  name: '',
  description: '',
  isMaterialNode: false,
  required: false,
  descriptionRule: '',
  codeRule: '',
})

function readNode(node: ProductPlanNode): PlanNodePatch {
  return {
    name: node.name,
    description: node.description || '',
    isMaterialNode: node.config.isMaterialNode,
    required: node.config.required,
    descriptionRule: node.config.descriptionRule,
    codeRule: node.config.codeRule,
  }
}

watch(
  () => [props.node.id, props.node.name, props.node.description, props.node.config.isMaterialNode, props.node.config.required, props.node.config.descriptionRule, props.node.config.codeRule].join('|'),
  () => Object.assign(draft, readNode(props.node)),
  { immediate: true },
)

function save() {
  draft.name = draft.name.trim()
  draft.description = draft.description.trim()
  draft.descriptionRule = draft.descriptionRule.trim()
  draft.codeRule = draft.codeRule.trim()
  emit('save', { ...draft })
}
</script>

<style scoped>
.editor-actions { display: flex; gap: 8px; padding-left: 88px; }
.section { margin: 4px 0 10px; font-size: 13px; font-weight: 650; }
</style>
