import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { createCompatibilitySeed, normalizeCompatStatus, type Compatibility } from '../mock/product-v3/compatibility'
import { composeMaterialName, createMaterialSeed, MATERIAL_DATA_VERSION, MATERIAL_STORAGE_KEY, normalizeMaterialStatus, type Material } from '../mock/product-v3/material'
import { createMaterialRuleSeed, normalizeRuleStatus, type MaterialRule } from '../mock/product-v3/materialRule'
import type { ProductPlanNode } from '../mock/product-v3/productPlan'
import { useActivityStore } from './product-v3/activity'

interface MaterialState {
  materials: Material[]
  rules: MaterialRule[]
  compatibilities: Compatibility[]
}

type StoredPayload = { version?: number; materials?: Material[]; rules?: MaterialRule[]; compatibilities?: Compatibility[] }

let seq = 1
function uid(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

function loadState(): MaterialState {
  const seed = {
    materials: createMaterialSeed(),
    rules: createMaterialRuleSeed(),
    compatibilities: createCompatibilitySeed(),
  }
  try {
    const raw = localStorage.getItem(MATERIAL_STORAGE_KEY)
    if (!raw) return seed
    const parsed = JSON.parse(raw) as StoredPayload
    if (parsed.version !== MATERIAL_DATA_VERSION || !Array.isArray(parsed.materials) || !Array.isArray(parsed.rules) || !Array.isArray(parsed.compatibilities)) return seed
    return {
      materials: parsed.materials.map((item) => ({ ...item, status: normalizeMaterialStatus(item.status) })),
      rules: parsed.rules.map((item) => ({ ...item, status: normalizeRuleStatus(item.status) })),
      compatibilities: parsed.compatibilities.map((item) => ({ ...item, status: normalizeCompatStatus(item.status) })),
    }
  } catch {
    return seed
  }
}

export const useMaterialStore = defineStore('material-archive', () => {
  const state = reactive<MaterialState>(loadState())

  watch(
    state,
    () => {
      localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify({ version: MATERIAL_DATA_VERSION, ...state }))
    },
    { deep: true },
  )

  function materialById(id: string) {
    return state.materials.find((item) => item.id === id)
  }

  function materialsBySource(sourceNodeId: string) {
    return state.materials.filter((item) => item.sourceNodeId === sourceNodeId)
  }

  function ruleForType(applicableType: string) {
    return state.rules.find((item) => item.status === 'ACTIVE' && item.applicableType === applicableType) || state.rules.find((item) => item.status === 'ACTIVE')
  }

  function createFromNode(input: { planId: string; planName: string; applicableType: string; chain: ProductPlanNode[] }) {
    const leaf = input.chain[input.chain.length - 1]
    if (!leaf) return { id: '', created: false, error: '没有选中节点' }
    const existing = materialsBySource(leaf.id)[0]
    if (existing) return { id: existing.id, created: false, error: '' }
    const rule = ruleForType(input.applicableType)
    const name = (rule ? composeMaterialName(input.chain, rule.fields) : '') || leaf.name
    const id = uid('mat')
    state.materials.unshift({
      id,
      materialCode: `M${String(state.materials.length + 1).padStart(4, '0')}`,
      name,
      sourceNodeId: leaf.id,
      sourcePath: leaf.path,
      planId: input.planId,
      planName: input.planName,
      status: 'CREATED',
      description: rule ? `按「${rule.name}」拼出的名称。` : '没有启用的描述规则，先用节点名称。',
      createTime: new Date().toISOString(),
    })
    useActivityStore().add('创建物料', `从「${leaf.path}」生成 ${name}`)
    return { id, created: true, error: '' }
  }

  function saveRule(patch: MaterialRule) {
    const rule = state.rules.find((item) => item.id === patch.id)
    if (!rule) return '规则不存在'
    if (!patch.name.trim()) return '请填写规则名称'
    rule.name = patch.name.trim()
    rule.applicableType = patch.applicableType.trim() || rule.applicableType
    rule.fields = patch.fields.slice()
    rule.preview = patch.preview
    rule.status = patch.status
    return ''
  }

  function resetAll() {
    const seed = {
      materials: createMaterialSeed(),
      rules: createMaterialRuleSeed(),
      compatibilities: createCompatibilitySeed(),
    }
    state.materials = seed.materials
    state.rules = seed.rules
    state.compatibilities = seed.compatibilities
  }

  return { state, materialById, materialsBySource, ruleForType, createFromNode, saveRule, resetAll }
})
