<template>
  <el-dialog v-model="open" title="节点适用配置" width="480px">
    <p class="dict-empty">这是模型节点上的草稿配置。保存后只留在当前草稿，发布时冻结到新版本。不会自动建立现有物料的适用关系，也不会改已发布版本。</p>
    <p class="dict-empty">要给已经建档的物料建立正式关系，请到<el-button link type="primary" @click="emit('openCompatibility')">适用关系</el-button>。继承、冲突和排除还没有确认，这里不会自动套用到物料。</p>
    <p v-if="draftHostRows.length === 0" class="dict-empty">这个节点还没有适用主机。</p>
    <p v-for="item in draftHostRows" :key="item.identityKey" class="dict-empty">
      {{ item.label }}
      <el-button link type="danger" @click="emit('removeHost', item.identityKey)">移除</el-button>
    </p>
    <el-input v-model="keyword" placeholder="搜已建档的主机型号" clearable />
    <p v-if="hostChoices.length === 0" class="dict-empty">没有找到已建档的主机型号。不会按中文名自动新建。</p>
    <label v-for="item in hostChoices" :key="item.key" class="dict-empty">
      <input type="checkbox" :checked="hostPicks.includes(item.key) || item.already" :disabled="item.already" @change="emit('toggleHost', item.key)" />
      {{ item.label }}
    </label>
    <template #footer>
      <el-button @click="open = false">关闭</el-button>
      <el-button type="primary" :disabled="hostPicks.length === 0" @click="emit('save')">保存到草稿</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { HostModelOption } from '../../domain/compatibility'

// 草稿与写入入口仍由页面维护；这里只呈现已选关系和候选主机。
defineProps<{
  draftHostRows: ReadonlyArray<{ identityKey: string; label: string }>
  hostChoices: ReadonlyArray<Readonly<Pick<HostModelOption, 'key' | 'label'> & { already: boolean }>>
  hostPicks: readonly string[]
}>()
const open = defineModel<boolean>({ required: true })
const keyword = defineModel<string>('keyword', { required: true })
const emit = defineEmits<{
  toggleHost: [key: string]
  removeHost: [identityKey: string]
  save: []
  openCompatibility: []
}>()
</script>

<style scoped>
.dict-empty { margin: 0 0 8px; color: #909399; font-size: 13px; line-height: 1.45; }
</style>
