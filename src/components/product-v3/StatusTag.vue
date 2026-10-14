<template>
  <el-tag :type="tagType" effect="plain">{{ label }}</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { COMPAT_STATUS_LABEL, normalizeCompatStatus } from '../../mock/product-v3/compatibility'
import { MATERIAL_STATUS_LABEL, normalizeMaterialStatus } from '../../mock/product-v3/material'
import { PLAN_STATUS_LABEL, normalizePlanStatus } from '../../mock/product-v3/productPlan'

const props = defineProps<{
  kind: 'plan' | 'material' | 'compat'
  status: string
}>()

const label = computed(() => {
  if (props.kind === 'plan') return PLAN_STATUS_LABEL[normalizePlanStatus(props.status)]
  if (props.kind === 'material') return MATERIAL_STATUS_LABEL[normalizeMaterialStatus(props.status)]
  return COMPAT_STATUS_LABEL[normalizeCompatStatus(props.status)]
})

const tagType = computed(() => {
  const status = props.kind === 'plan' ? normalizePlanStatus(props.status) : props.kind === 'material' ? normalizeMaterialStatus(props.status) : normalizeCompatStatus(props.status)
  if (status === 'ACTIVE' || status === 'CONFIRMED') return 'success'
  if (status === 'DRAFT' || status === 'CREATED') return 'warning'
  return 'info'
})
</script>
