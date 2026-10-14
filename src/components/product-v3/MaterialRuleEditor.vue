<template>
  <section class="rule-editor">
    <h2>{{ draft.name || '规则详情' }}</h2>
    <el-form label-width="88px">
      <el-form-item label="规则名称">
        <el-input v-model="draft.name" maxlength="40" />
      </el-form-item>
      <el-form-item label="适用类型">
        <el-select v-model="draft.applicableType" style="width: 100%">
          <el-option label="手机" value="手机" />
          <el-option label="平板" value="平板" />
          <el-option label="配件" value="配件" />
        </el-select>
      </el-form-item>
      <el-form-item label="组合字段">
        <el-checkbox-group v-model="draft.fields">
          <el-checkbox v-for="field in fields" :key="field" :value="field">{{ field }}</el-checkbox>
        </el-checkbox-group>
        <p class="formula">{{ formula }}</p>
      </el-form-item>
      <el-form-item label="预览">
        <div class="preview">{{ preview }}</div>
      </el-form-item>
      <el-form-item label="状态">
        <el-switch v-model="enabled" active-text="启用" inactive-text="停用" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="save">保存规则</el-button>
      </el-form-item>
    </el-form>
    <p class="muted">预览按适用类型取一条演示路径试拼。保存规则不会批量改已有物料。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { composeMaterialName, RULE_FIELDS } from '../../mock/product-v3/material'
import type { MaterialRule } from '../../mock/product-v3/materialRule'
import { buildPlanTree, nodeChain } from '../../mock/product-v3/productPlan'
import { useProductPlanStore } from '../../stores/productPlan'

const props = defineProps<{ rule: MaterialRule }>()
const emit = defineEmits<{ save: [rule: MaterialRule] }>()

const fields = RULE_FIELDS
const planStore = useProductPlanStore()
const draft = reactive({ name: '', applicableType: '手机', fields: [] as string[], status: 'ACTIVE' as 'ACTIVE' | 'DISABLED' })

watch(
  () => props.rule.id,
  () => {
    draft.name = props.rule.name
    draft.applicableType = props.rule.applicableType
    draft.fields = props.rule.fields.slice()
    draft.status = props.rule.status
  },
  { immediate: true },
)

const enabled = computed({
  get: () => draft.status === 'ACTIVE',
  set: (value: boolean) => {
    draft.status = value ? 'ACTIVE' : 'DISABLED'
  },
})

const orderedFields = computed(() => fields.filter((field) => draft.fields.includes(field)))
const formula = computed(() => (orderedFields.value.length ? orderedFields.value.join(' + ') : '还没有选择字段'))

const samplePlanId = computed(() => (draft.applicableType === '平板' ? 'plan-pad' : 'plan-phone'))
const sampleNodeId = computed(() => (draft.applicableType === '平板' ? 'ppn-gray' : 'ppn-black'))
const sampleChain = computed(() => {
  const plan = planStore.planById(samplePlanId.value)
  if (!plan) return []
  const tree = buildPlanTree(planStore.nodesOf(plan.id), plan.rootNodeId)
  if (!tree) return []
  return nodeChain(tree, sampleNodeId.value)
})

const preview = computed(() => composeMaterialName(sampleChain.value, orderedFields.value) || props.rule.preview || '暂无预览')

function save() {
  emit('save', {
    ...props.rule,
    name: draft.name,
    applicableType: draft.applicableType,
    fields: orderedFields.value,
    preview: preview.value,
    status: draft.status,
  })
}
</script>

<style scoped>
.rule-editor h2 { font-size: 16px; margin-bottom: 12px; }
.formula { margin: 8px 0 0; color: #66788a; font-size: 13px; }
.preview { min-height: 36px; padding: 8px 10px; background: #f7faff; border-radius: 6px; font-weight: 650; }
</style>
