<template>
  <div>
    <PageHead title="规格约束" desc="只有这一份规则。列表、链式、树形和总览看到的是同一套数据。">
      <el-button type="primary" @click="create">新增规则</el-button>
    </PageHead>
    <div class="panel">
      <el-radio-group v-model="view" style="margin-bottom: 12px">
        <el-radio-button value="list">规则列表</el-radio-button>
        <el-radio-button value="chain">链式</el-radio-button>
        <el-radio-button value="tree">树形</el-radio-button>
        <el-radio-button value="board">总览</el-radio-button>
      </el-radio-group>
      <p v-for="item in conflicts" :key="item" class="issue-error">{{ item }}</p>
      <el-table v-if="view === 'list'" :data="activeRules">
        <el-table-column label="属性方案" width="120">
          <template #default="{ row }">{{ templateName(row.templateId) }}</template>
        </el-table-column>
        <el-table-column label="规则" min-width="320">
          <template #default="{ row }">当 {{ conditionText(row) }}，则 {{ paramName(row.targetParamId) }} 可选 {{ row.options.join('、') || '无' }}</template>
        </el-table-column>
        <el-table-column label="启用" width="80">
          <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row)">编辑</el-button>
            <el-button link @click="copy(row)">复制</el-button>
            <el-button link type="danger" @click="store.data.rules = store.data.rules.filter((item) => item.id !== row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-else-if="view === 'chain'">
        <div v-for="rule in activeRules" :key="rule.id" class="rule-card">{{ conditionText(rule) }} → {{ paramName(rule.targetParamId) }}：{{ rule.options.join('、') }}</div>
      </div>
      <div v-else-if="view === 'tree'">
        <div v-for="group in treeGroups" :key="group.title" class="rule-card">
          <strong>{{ group.title }}</strong>
          <p v-for="line in group.lines" :key="line">{{ line }}</p>
        </div>
      </div>
      <div v-else class="grid-3">
        <div v-for="rule in activeRules" :key="rule.id" class="stat">{{ templateName(rule.templateId) }}<b>{{ paramName(rule.targetParamId) }}</b><span class="muted">{{ rule.options.length }} 个允许值</span></div>
      </div>
      <h2 style="margin-top: 18px">旧规则参考</h2>
      <p class="muted">这些规则无法无损转成现行条件，只保留原文，不参与商品校验。</p>
      <div v-for="rule in legacy" :key="rule.id" class="rule-card">{{ rule.note }} 条件：{{ JSON.stringify(rule.conditions) }} 允许：{{ rule.options.join('、') }}</div>
    </div>
    <div class="panel">
      <h2>规则测试</h2>
      <el-select v-model="testTemplate" style="width: 180px; margin-bottom: 8px">
        <el-option v-for="item in store.data.templates" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <div class="filters">
        <el-select v-for="param in testParams" :key="param.id" v-model="testAttrs[param.name]" clearable :placeholder="param.name" style="width: 160px">
          <el-option v-for="value in param.values" :key="value" :label="value" :value="value" />
        </el-select>
      </div>
      <p v-for="line in testLines" :key="line.name" :class="line.status === 'uncovered' ? 'issue-warn' : line.status === 'empty' ? 'issue-error' : 'muted'">{{ line.name }}：{{ line.message }}</p>
    </div>
    <el-drawer v-model="open" title="编辑规则" size="480px">
      <el-select v-model="form.templateId" placeholder="属性方案" style="width: 100%; margin-bottom: 8px">
        <el-option v-for="item in store.data.templates" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <div v-for="(sourceId, index) in form.sourceParamIds" :key="sourceId + index" class="row-actions" style="margin-bottom: 8px">
        <span>当</span>
        <el-select v-model="form.sourceParamIds[index]" style="width: 120px">
          <el-option v-for="item in store.data.params" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <span>等于</span>
        <el-select v-model="form.conditions[form.sourceParamIds[index]]" style="width: 140px">
          <el-option v-for="value in valuesOf(form.sourceParamIds[index])" :key="value" :label="value" :value="value" />
        </el-select>
        <el-button link type="danger" @click="form.sourceParamIds.splice(index, 1)">删除</el-button>
      </div>
      <el-button @click="form.sourceParamIds.push('')">增加条件</el-button>
      <div style="margin: 12px 0">则
        <el-select v-model="form.targetParamId" style="width: 140px">
          <el-option v-for="item in store.data.params" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        允许
      </div>
      <el-select v-model="form.options" multiple style="width: 100%">
        <el-option v-for="value in valuesOf(form.targetParamId)" :key="value" :label="value" :value="value" />
      </el-select>
      <el-input v-model="form.note" placeholder="规则说明" style="margin-top: 8px" />
      <el-button type="primary" style="margin-top: 12px" @click="save">保存</el-button>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { constraintOf, ruleConflicts, selectedById } from '../domain/logic'
import type { SpecRule } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const view = ref('list')
const open = ref(false)
const testTemplate = ref('t-phone')
const testAttrs = reactive<Record<string, string>>({ 品牌: 'Apple', 系列: 'iPhone 17', 型号: 'iPhone 17', 容量: '256G' })
const form = reactive<SpecRule>(blank())
const activeRules = computed(() => store.data.rules.filter((item) => !item.legacy))
const legacy = computed(() => store.data.rules.filter((item) => item.legacy))
const conflicts = computed(() => ruleConflicts(store.data))
const testParams = computed(() => store.data.params.filter((item) => ['品牌', '系列', '型号', '容量', '颜色'].includes(item.name)))
const testLines = computed(() =>
  testParams.value.map((param) => {
    const result = constraintOf(store.data, testTemplate.value, param.id, selectedById(store.data, testAttrs))
    return { name: param.name, status: result.status, message: result.message }
  }),
)
const treeGroups = computed(() => {
  const map = new Map<string, string[]>()
  activeRules.value.forEach((rule) => {
    const title = conditionText(rule).split('，')[0] || '条件'
    const lines = map.get(title) ?? []
    lines.push(`${paramName(rule.targetParamId)}：${rule.options.join('、')}`)
    map.set(title, lines)
  })
  return Array.from(map.entries()).map(([title, lines]) => ({ title, lines }))
})

function blank(): SpecRule {
  return { id: '', templateId: 't-phone', targetParamId: 'p-series', sourceParamIds: ['p-brand'], conditions: { 'p-brand': 'Apple' }, options: [], enabled: true, note: '', legacy: false }
}
function paramName(id: string) {
  return store.data.params.find((item) => item.id === id)?.name || id
}
function templateName(id: string) {
  return store.data.templates.find((item) => item.id === id)?.name || id
}
function valuesOf(id: string) {
  return store.data.params.find((item) => item.id === id)?.values ?? []
}
function conditionText(rule: SpecRule) {
  return rule.sourceParamIds.map((id) => `${paramName(id)}等于${rule.conditions[id] || '未选'}`).join('，且')
}
function edit(rule: SpecRule) {
  Object.assign(form, JSON.parse(JSON.stringify(rule)) as SpecRule)
  open.value = true
}
function create() {
  Object.assign(form, blank(), { id: uid('rule') })
  open.value = true
}
function copy(rule: SpecRule) {
  store.data.rules.push({ ...JSON.parse(JSON.stringify(rule)), id: uid('rule'), note: `${rule.note} 副本` })
}
function save() {
  form.sourceParamIds = form.sourceParamIds.filter(Boolean)
  const index = store.data.rules.findIndex((item) => item.id === form.id)
  const copyRule = JSON.parse(JSON.stringify(form)) as SpecRule
  if (index >= 0) store.data.rules[index] = copyRule
  else store.data.rules.push(copyRule)
  open.value = false
}
</script>
