import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, normalizePath } from 'vite'

export const BASELINE = '8721e572e3a2f9010bcd6a6a9f60489733d56904'
export const NOW = '2026-10-22T04:00:00.000Z'
export const outputDir = resolve('work/performance-round1')
export const clone = (value) => structuredClone(value)

export function baselineSources() {
  return Object.fromEntries(['planning', 'draftComboPreview', 'logic'].map((name) => [name,
    execFileSync('git', ['show', `${BASELINE}:src/domain/${name}.ts`], { encoding: 'utf8' }),
  ]))
}

export async function loadImplementations(instrument) {
  const directory = resolve(outputDir, 'baseline')
  mkdirSync(directory, { recursive: true })
  const sources = baselineSources()
  for (const [name, source] of Object.entries(sources)) {
    const rewritten = source.replace(/from '([^']+)'/g, (original, target) => {
      if (!target.startsWith('.')) return original
      const local = target.slice(2)
      const path = local in sources && target.startsWith('./')
        ? resolve(directory, `${local}.ts`)
        : resolve('src/domain', target)
      return `from '${normalizePath(path)}'`
    })
    writeFileSync(resolve(directory, `${name}.ts`), rewritten)
  }
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    plugins: instrument ? [{
      name: 'planning-performance-counters', enforce: 'pre',
      transform(code, id) { if (id.endsWith('/planning.ts')) return instrument(code) },
    }] : [],
  })
  const load = async (directory) => ({
    ...await server.ssrLoadModule(normalizePath(resolve(directory, 'planning.ts'))),
    ...await server.ssrLoadModule(normalizePath(resolve(directory, 'draftComboPreview.ts'))),
    logic: await server.ssrLoadModule(normalizePath(resolve(directory, 'logic.ts'))),
  })
  try {
    return { server, before: await load(directory), after: await load('src/domain') }
  } catch (error) {
    await server.close()
    throw error
  }
}

export function fixture(branches = 2, capacities = 2, colors = 2, packs = 2) {
  const nodes = []
  const params = ['model', 'capacity', 'color', 'pack'].map((id) => ({
    id, name: id, values: [], valueGroups: [], participateInStructure: true,
  }))
  const attribute = (id, parentId, attributeId, sort = 0, role) => nodes.push({
    id, parentId, attributeId, sort, role, templateId: 'm', nodeType: 'ATTRIBUTE', valueId: '',
  })
  const value = (id, parentId, attributeId, valueId, sort = 0) => {
    nodes.push({ id, parentId, attributeId, valueId, sort, templateId: 'm', nodeType: 'VALUE' })
    const param = params.find((item) => item.id === attributeId)
    if (!param.values.includes(valueId)) param.values.push(valueId)
  }
  attribute('model', null, 'model', 0, 'COMMON')
  for (let b = 0; b < branches; b++) {
    value(`b${b}`, 'model', 'model', `Model${b}`, b)
    attribute(`cap${b}`, `b${b}`, 'capacity') // scheme fallback
    for (let c = 0; c < capacities; c++) {
      value(`c${b}-${c}`, `cap${b}`, 'capacity', `Cap${c}`, c)
      attribute(`color${b}-${c}`, `c${b}-${c}`, 'color', 0, b % 2 ? undefined : 'VARIANT')
      for (let d = 0; d < colors; d++) value(`v${b}-${c}-${d}`, `color${b}-${c}`, 'color', `Color${d}`, d)
    }
  }
  attribute('pack', null, 'pack', 1, 'VARIANT')
  for (let p = 0; p < packs; p++) value(`pack${p}`, 'pack', 'pack', `Pack${p}`, p)
  return {
    params, templateParams: [{ templateId: 'm', paramId: 'capacity', role: 'variant', required: false }],
    templates: [{ id: 'm', name: 'Fixture', enabled: true, parentId: null, structureOrder: [] }],
    productSpecNodes: nodes, planningRecords: [], specModelVersions: [], nodeCompatibilityRules: [],
    families: [], skus: [], productPlans: [], specCanvases: [], rules: [], categories: [], mappings: [],
  }
}

export function record(combo, number, overrides = {}) {
  return {
    planningId: `PLN-${String(number).padStart(6, '0')}`, productModelId: 'm',
    originModelVersionId: 'v1', modelVersionId: 'v1', modelVersionIds: ['v0', 'v1'],
    steps: clone(combo.steps), identityKey: combo.identityKey, status: 'active', createdTime: NOW,
    ...overrides,
  }
}

export function version(nodes, id = 'v1', number = 1) {
  return { id, templateId: 'm', version: number, versionName: `V${number}`, status: 'published',
    nodesSnapshot: clone(nodes), createdTime: NOW, publishTime: NOW }
}

export function benchmarkFixture(implementation, dimensions, historyCount) {
  const data = fixture(...dimensions)
  const combos = implementation.legalPlanningCombinations(data, 'm', data.productSpecNodes)
  const reuseCount = Math.floor(combos.length / 2)
  data.planningRecords = Array.from({ length: historyCount }, (_, index) => {
    const matched = index < reuseCount
    return record(combos[index % combos.length], index + 1, {
      identityKey: matched ? combos[index].identityKey : `historical-${index}`,
      productModelId: matched || index % 3 ? 'm' : 'other',
      status: index % 4 === 0 ? 'retired' : 'active',
      ...(index % 4 === 0 ? { retiredTime: NOW } : {}),
    })
  })
  data.specModelVersions = [version(data.productSpecNodes)]
  return data
}

export function reconcileInput(data, nodes = data.productSpecNodes, versionId = 'v2') {
  return { records: data.planningRecords, data, productModelId: 'm', modelVersionId: versionId, nodes, now: NOW }
}
