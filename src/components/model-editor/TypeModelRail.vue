<template>
  <aside class="rail" :class="{ 'is-fold': folded }">
    <div class="rail-head">
      <strong v-show="!folded">模型</strong>
      <button type="button" @click="emit('update:folded', !folded)">{{ folded ? '展开' : '收起' }}</button>
    </div>
    <template v-if="!folded">
    <p class="current" :title="path">{{ path || '未选择分类' }}</p>
    <section v-if="groups.length" class="type-zone">
      <div class="relate">
        <span>产品类型</span>
        <el-popover placement="bottom-start" :width="300" trigger="click">
          <template #reference>
            <button type="button" class="relate-link">查看关联关系</button>
          </template>
          <div class="relate-body">
            <p><span>当前分类</span>{{ categoryName }}</p>
            <p v-for="group in groups" :key="'rel-' + group.id"><span>关联产品类型</span><em>🔗 {{ group.name }}</em></p>
            <p><span>关联方式</span>分类关联</p>
            <p class="relate-note">分类不是产品类型。产品类型写在分类关联配置里，不是分类的子节点。一个分类可以关联多个产品类型。</p>
          </div>
        </el-popover>
      </div>
      <section v-for="group in groups" :key="group.id" class="type-block">
        <button type="button" class="type-card" :class="{ 'is-on': group.id === activeId }" @click="emit('focus-type', group.id)">
          <el-icon class="link-mark"><Link /></el-icon>
          <span>{{ group.name }}</span>
        </button>
        <p class="label sub">商品模型</p>
        <button
          v-for="item in group.models"
          :key="item.templateId"
          type="button"
          class="model-line"
          :class="{ 'is-on': item.templateId === templateId }"
          @click="emit('open', item.templateId)"
        >
          <span class="model-name">{{ item.name }}</span>
          <span v-if="item.published" class="pub">已发布</span>
        </button>
        <p v-if="group.models.length === 0" class="none">还没有模型</p>
      </section>
      <div v-if="!viewing" class="rail-actions">
        <el-button v-if="activeId" link type="primary" :disabled="!store.can('product:model:create')" @click="emit('create', activeId)">新建模型</el-button>
        <el-button v-if="templateId" link :disabled="!store.can('product:model:create')" @click="emit('copy')">复制模型</el-button>
      </div>
    </section>
    <p v-else class="none">{{ path ? '这个分类还没有关联产品类型。' : '先在左侧选择分类。' }}</p>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCatalogStore } from '../../stores/catalog'
const store = useCatalogStore()
import { Link } from '@element-plus/icons-vue'

export interface RailModel {
  templateId: string
  name: string
  published: boolean
}

export interface TypeGroup {
  id: string
  name: string
  models: RailModel[]
}

const props = defineProps<{
  path: string
  groups: TypeGroup[]
  activeTypeId: string
  templateId: string
  viewing: boolean
  folded: boolean
}>()

const emit = defineEmits<{
  open: [templateId: string]
  'focus-type': [typeId: string]
  create: [typeId: string]
  copy: []
  'update:folded': [value: boolean]
}>()

const activeId = computed(() => props.activeTypeId || props.groups[0]?.id || '')
const categoryName = computed(() => {
  const parts = props.path.split(' / ').map((item) => item.trim()).filter(Boolean)
  return parts.at(-1) || '未选择分类'
})
</script>

<style scoped>
.rail { min-height: 0; overflow: auto; background: transparent; border: 0; border-left: 1px solid var(--border-subtle, #eef2f6); border-radius: 0; padding: 12px 12px 16px; }
.rail.is-fold { padding: 12px 4px; }
.rail-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-muted, #8b98a8); }
.rail.is-fold .rail-head { justify-content: center; }
.rail-head strong { font-size: 12px; font-weight: 600; }
.rail-head button { border: 0; background: none; color: var(--text-muted, #8b98a8); cursor: pointer; padding: 0; font-size: 12px; }
.label { margin: 12px 0 6px; color: var(--text-muted, #8b98a8); font-size: 12px; line-height: 1.4; }
.current { display: block; margin-top: 10px; color: var(--text-primary, #253044); font-size: 13px; font-weight: 650; line-height: 1.45; }
.type-zone { margin-top: 12px; padding: 8px 8px 6px; border: 1px solid var(--border-subtle, #eef2f6); border-radius: 8px; background: var(--surface-muted, #f7f8fa); }
.type-zone > .label { margin-top: 0; }
.hint { margin: 0 0 8px; color: #909399; font-size: 12px; line-height: 1.45; }
.relate { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 10px; color: #606266; font-size: 12px; line-height: 1.4; }
.relate-link { border: 0; background: none; padding: 0; color: #409eff; font-size: 12px; line-height: 1.4; cursor: pointer; }
.relate-body p { display: flex; gap: 8px; margin: 0 0 8px; color: #303133; font-size: 13px; line-height: 1.45; }
.relate-body span { flex: none; width: 84px; color: #909399; }
.relate-body em { font-style: normal; }
.relate-body .relate-note { display: block; margin: 4px 0 0; color: #606266; font-size: 12px; line-height: 1.5; }
.type-block { margin-top: 0; }
.type-block + .type-block { margin-top: 14px; }
.type-card { display: flex; align-items: center; gap: 8px; width: 100%; border: 1px solid var(--border-default, #e4e8ef); background: var(--surface-bg, #fff); text-align: left; padding: 7px 8px; color: var(--text-primary, #253044); font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 6px; }
.type-card.is-on { border-color: #c6e2ff; box-shadow: inset 2px 0 0 #409eff; }
.link-mark { flex: none; color: #409eff; font-size: 14px; }
.label.sub { margin-top: 12px; }
.model-line { width: 100%; display: flex; gap: 8px; align-items: center; border: 0; background: transparent; text-align: left; min-height: 32px; padding: 0 8px; color: #606266; cursor: pointer; border-radius: 4px; }
.model-line.is-on { background: #f4f7fb; color: #303133; font-weight: 650; box-shadow: inset 3px 0 0 #409eff; }
.model-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.model-line.is-on .model-name { font-weight: 650; }
.pub { flex: none; margin-left: auto; color: #67c23a; font-size: 12px; font-weight: 400; }
.none { margin: 4px 0 4px 8px; color: #c0c4cc; font-size: 12px; }
.rail-actions { display: flex; gap: 8px; margin-top: 14px; }
</style>
