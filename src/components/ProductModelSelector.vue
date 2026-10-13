<template>
  <div class="model-form">
    <div v-for="row in rows" :key="row.id" class="model-row">
      <label>{{ row.label }}</label>
      <el-select
        v-if="row.multiple"
        :model-value="row.selectedIds"
        multiple
        clearable
        placeholder="请选择"
        style="width: 320px"
        @change="onPick(row.id, $event)"
      >
        <el-option v-for="item in row.options" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-else :model-value="row.selectedId" clearable placeholder="请选择" style="width: 320px" @change="onPick(row.id, $event)">
        <el-option v-for="item in row.options" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { chooseModelNode, modelFormRows, publishedSpecNodes, type ModelSelection } from '../domain/logic'
import type { ProductSpecNode } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const props = defineProps<{ templateId: string; modelValue: ModelSelection; nodes?: ProductSpecNode[] }>()
const emit = defineEmits<{ 'update:modelValue': [ModelSelection] }>()
const store = useCatalogStore()

const tree = computed(() => (props.nodes && props.nodes.length ? props.nodes : publishedSpecNodes(store.data, props.templateId)))
const rows = computed(() => modelFormRows(store.data, props.templateId, tree.value, props.modelValue))

function onPick(attributeId: string, value: string | number | boolean | Array<string | number | boolean> | undefined) {
  const values = Array.isArray(value) ? value.map((item) => String(item)) : value ? [String(value)] : []
  emit('update:modelValue', chooseModelNode(store.data, props.templateId, tree.value, props.modelValue, attributeId, values))
}
</script>

<style scoped>
.model-form { display: flex; flex-direction: column; gap: 14px; max-width: 640px; }
.model-row { display: flex; flex-direction: column; gap: 6px; }
.model-row label { font-weight: 650; }
</style>
