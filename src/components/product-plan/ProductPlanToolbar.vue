<template>
  <aside class="toolbar">
    <header class="toolbar-head">
      <strong>规划工具</strong>
      <span>新增节点并指定父节点</span>
    </header>
    <div class="toolbar-body">
      <div class="current">
        <span class="muted">当前节点</span>
        <b>{{ selectedName || '未选择' }}</b>
        <em v-if="selectedType">{{ selectedType }}</em>
      </div>
      <p v-if="readonly" class="readonly">查看模式只浏览结构，不能改节点。</p>
      <div class="add-block">
        <div class="add-title">新增节点</div>
        <button v-for="item in actions" :key="item.type" type="button" class="add-btn" :disabled="readonly" @click="open(item.type)">
          <i :class="item.dot" />
          <span>
            <b>{{ item.label }}</b>
            <small>{{ item.hint }}</small>
          </span>
        </button>
      </div>
      <ol class="legend">
        <li>产品类型挂在分类下面。</li>
        <li>属性描述容量、颜色这类维度。</li>
        <li>属性值是维度上的具体取值。</li>
        <li>走到头的属性值，可以在右侧生成物料档案。</li>
      </ol>
    </div>

    <el-dialog v-model="visible" title="新增节点" width="480px">
      <el-form label-width="88px">
        <el-form-item label="节点类型">
          <el-select v-model="draft.type" placeholder="选择类型" style="width: 100%" @change="onType">
            <el-option v-for="item in actions" :key="item.type" :label="item.label" :value="item.type" />
          </el-select>
        </el-form-item>
        <el-form-item label="节点名称">
          <el-input v-model="draft.name" maxlength="40" placeholder="例如：256G" @keyup.enter="submit" />
        </el-form-item>
        <el-form-item label="父节点">
          <el-select v-model="draft.parentId" filterable placeholder="选择父节点" style="width: 100%" :disabled="!draft.type">
            <el-option v-for="item in parents" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
          <p v-if="draft.type && !parents.length" class="hint">还没有能挂这种节点的父节点。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </aside>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { defaultParentId, parentOptions } from '../../mock/product-v3/productPlanActions'
import type { PlanAddNodeType, ProductPlanNode } from '../../mock/product-v3/productPlan'

const props = defineProps<{
  selectedName: string
  selectedType: string
  readonly: boolean
  nodes: ProductPlanNode[]
  rootId: string
  selectedId: string
  planId: string
}>()

const emit = defineEmits<{
  submit: [payload: { nodeType: PlanAddNodeType; name: string; parentId: string }]
}>()

const actions: { type: PlanAddNodeType; label: string; hint: string; dot: string }[] = [
  { type: 'PRODUCT_TYPE', label: '产品类型', hint: '例如 Apple手机', dot: 'dot type' },
  { type: 'ATTRIBUTE', label: '属性', hint: '例如 容量', dot: 'dot attr' },
  { type: 'VALUE', label: '属性值', hint: '例如 256G', dot: 'dot value' },
  { type: 'MATERIAL', label: '物料', hint: '预留节点，先挂在结构上', dot: 'dot material' },
]

const visible = ref(false)
const draft = reactive({ type: '' as PlanAddNodeType | '', name: '', parentId: '' })
const parents = computed(() => (draft.type ? parentOptions(props.nodes, props.planId, draft.type) : []))

function syncParent(type: PlanAddNodeType) {
  draft.parentId = defaultParentId(props.nodes, props.rootId, props.selectedId, type)
}

function open(type: PlanAddNodeType) {
  if (props.readonly) return
  draft.type = type
  draft.name = ''
  syncParent(type)
  visible.value = true
}

function onType(value: PlanAddNodeType) {
  draft.type = value
  syncParent(value)
}

function submit() {
  if (!draft.type) {
    ElMessage.warning('请选择节点类型')
    return
  }
  const name = draft.name.trim()
  if (!name) {
    ElMessage.warning('请填写节点名称')
    return
  }
  if (!draft.parentId) {
    ElMessage.warning('请选择父节点')
    return
  }
  emit('submit', { nodeType: draft.type, name, parentId: draft.parentId })
  visible.value = false
}
</script>

<style scoped>
.toolbar { background: #fff; border: 1px solid #e6edf5; border-radius: 10px; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.toolbar-head { padding: 14px 14px 10px; border-bottom: 1px solid #eef2f6; }
.toolbar-head strong { display: block; font-size: 14px; }
.toolbar-head span { display: block; margin-top: 4px; color: #66788a; font-size: 12px; }
.toolbar-body { padding: 12px 14px 16px; overflow: auto; }
.current { background: #f7faff; border-radius: 8px; padding: 10px 12px; }
.current b { display: block; margin-top: 4px; font-size: 15px; }
.current em { display: inline-block; margin-top: 4px; font-style: normal; color: #409eff; font-size: 12px; }
.readonly { margin: 10px 0 0; color: #ad7a12; font-size: 12px; line-height: 1.5; }
.add-block { margin-top: 14px; }
.add-title { font-size: 13px; font-weight: 650; margin-bottom: 8px; }
.add-btn { width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; border: 1px solid #e6edf5; background: #fff; border-radius: 8px; padding: 8px 10px; cursor: pointer; margin-bottom: 8px; }
.add-btn:hover:not(:disabled) { border-color: #b9d6fb; background: #f7faff; }
.add-btn:disabled { cursor: not-allowed; opacity: 0.55; }
.add-btn b { display: block; font-size: 13px; color: #1f2a37; font-weight: 650; }
.add-btn small { display: block; margin-top: 2px; color: #66788a; font-size: 12px; line-height: 1.4; }
.dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: none; }
.dot.type { background: #409eff; }
.dot.attr { background: #e6a23c; }
.dot.value { background: #67c23a; }
.dot.material { background: #909399; }
.legend { margin: 12px 0 0; padding-left: 18px; color: #66788a; font-size: 12px; line-height: 1.7; }
.hint { margin: 6px 0 0; color: #ad7a12; font-size: 12px; }
</style>
