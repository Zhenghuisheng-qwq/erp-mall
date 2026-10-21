import { createSeed } from './seed'
import type { OverviewGraphNode, OverviewKind } from './overviewGraph'
import {
  OVERVIEW_MIN_ZOOM,
  buildOverviewCatalog,
  buildOverviewForest,
  defaultExpandedIds,
  defaultOverviewCategoryId,
  overviewFitViewport,
  overviewLayoutIssues,
  readOverviewModel,
  visibleOverviewNodes,
} from './overviewGraph'
import type { AppData, ProductSpecNode } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}

function spec(partial: Partial<ProductSpecNode> & Pick<ProductSpecNode, 'id' | 'parentId' | 'nodeType'>): ProductSpecNode {
  return { templateId: 't-phone', attributeId: '', valueId: '', sort: 1, ...partial }
}

function node(partial: Partial<OverviewGraphNode> & Pick<OverviewGraphNode, 'id' | 'parentId' | 'kind'>): OverviewGraphNode {
  return {
    sort: 1,
    label: partial.label || partial.id,
    meta: partial.meta || '',
    entityId: partial.entityId || partial.id,
    categoryId: 'c',
    typeId: 'pt',
    templateId: partial.templateId || '',
    nodeId: partial.nodeId || '',
    draft: false,
    source: '',
    childCount: 0,
    expandable: false,
    head: false,
    bound: true,
    ...partial,
  }
}

function fingerprint(data: AppData) {
  return JSON.stringify({
    categories: data.categories,
    productTypes: data.productTypes,
    specCanvases: data.specCanvases,
    specModelVersions: data.specModelVersions,
    productSpecNodes: data.productSpecNodes,
    skus: data.skus,
    planningRecords: data.planningRecords,
    templates: data.templates,
  })
}

function expandModel(catalog: OverviewGraphNode[], templateId: string, categoryId = '') {
  const open = new Set(defaultExpandedIds(catalog))
  catalog.filter((item) => item.kind === 'model' && item.templateId === templateId && (!categoryId || item.categoryId === categoryId)).forEach((item) => open.add(item.id))
  return visibleOverviewNodes(catalog, open, new Set())
}

function dense(kind: OverviewKind, id: string, parentId: string | null, sort: number, label: string): OverviewGraphNode {
  return node({ id, parentId, kind, sort, label, templateId: id.startsWith('m') ? id : 'm1', nodeId: id })
}

export function runOverviewGraphChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const data = createSeed()
  results.push(check('root', defaultOverviewCategoryId(data) === 'c-host', defaultOverviewCategoryId(data)))

  const host = buildOverviewCatalog(data, 'c-host')
  const phone = host.find((item) => item.kind === 'category' && item.entityId === 'c-phone')
  const phoneType = host.find((item) => item.kind === 'type' && item.entityId === 'pt-phone' && item.categoryId === 'c-phone')
  const partType = host.find((item) => item.kind === 'type' && item.entityId === 'pt-phone-part')
  const phoneModel = host.find((item) => item.kind === 'model' && item.templateId === 't-phone')
  const padModels = host.filter((item) => item.categoryId === 'c-pad' && item.kind === 'model')
  results.push(check('chain', Boolean(phone && phoneType && phone.parentId === 'category:c-host' && phoneType.parentId === phone.id && phoneModel?.parentId === phoneType.id), `${phone?.label || ''} / ${phoneType?.label || ''} / ${phoneModel?.label || ''}`))
  results.push(check('part-type', Boolean(partType && partType.categoryId === 'c-phone' && !host.some((item) => item.parentId === partType.id && item.kind === 'model')), partType?.meta || '缺少维修零件类型'))
  results.push(check('no-name-model', padModels.length === 0 && !host.some((item) => item.templateId === 't-pad'), `平板模型 ${padModels.length}`))
  results.push(check('model-id', phoneModel?.templateId === 't-phone' && phoneModel.label === '手机模型 V1' && phoneModel.source === 'snapshot' && !phoneModel.draft && phoneModel.meta.includes('已发布'), phoneModel?.meta || '没有手机模型'))

  const closed = visibleOverviewNodes(host, new Set(defaultExpandedIds(host)), new Set())
  results.push(check('closed-model', closed.some((item) => item.templateId === 't-phone') && !closed.some((item) => item.nodeId === 'sn-brand-apple'), `可见 ${closed.length}`))

  const opened = expandModel(host, 't-phone', 'c-phone')
  const apple = opened.find((item) => item.nodeId === 'sn-brand-apple')
  const huawei = opened.find((item) => item.nodeId === 'sn-brand-huawei')
  const appleSeries = opened.find((item) => item.nodeId === 'sn-apple-series')
  const huaweiSeries = opened.find((item) => item.nodeId === 'sn-huawei-series')
  const brand = opened.find((item) => item.nodeId === 'sn-brand')
  const snapshot = data.specModelVersions.find((item) => item.templateId === 't-phone' && item.status === 'published')
  const shownIds = opened.filter((item) => item.templateId === 't-phone' && item.nodeId).map((item) => item.nodeId).sort()
  const snapIds = (snapshot?.nodesSnapshot || []).map((item) => item.id).sort()
  results.push(check('snapshot-nodes', shownIds.join() === snapIds.join() && shownIds.includes('sn-brand-apple') && shownIds.includes('sn-brand-huawei'), `${shownIds.length}/${snapIds.length}`))
  results.push(check('branches', Boolean(apple && huawei && appleSeries && huaweiSeries && brand && apple.parentId === brand.id && huawei.parentId === brand.id && appleSeries.parentId === apple.id && huaweiSeries.parentId === huawei.id && appleSeries.parentId !== huawei.id), `${appleSeries?.parentId || ''} / ${huaweiSeries?.parentId || ''}`))
  const laid = overviewLayoutIssues(opened)
  const appleFrame = apple ? laid.frames.get(apple.id) : undefined
  const huaweiFrame = huawei ? laid.frames.get(huawei.id) : undefined
  const seriesFrame = appleSeries ? laid.frames.get(appleSeries.id) : undefined
  results.push(check('phone-layout', laid.overlap.length === 0 && laid.crossings.length === 0 && laid.missing.length === 0 && Boolean(appleFrame && huaweiFrame && seriesFrame && appleFrame.bottom <= huaweiFrame.top && seriesFrame.x > appleFrame.x && seriesFrame.top >= appleFrame.top && seriesFrame.bottom <= appleFrame.bottom), `重叠 ${laid.overlap.length} 穿越 ${laid.crossings.length} 缺失 ${laid.missing.length}`))

  const collapsed = visibleOverviewNodes(host, new Set([...defaultExpandedIds(host), phoneModel?.id || '']), new Set(apple ? [apple.id] : []))
  const collapsedLayout = overviewLayoutIssues(collapsed)
  results.push(check('collapse-branch', !collapsed.some((item) => item.nodeId === 'sn-apple-series') && collapsed.some((item) => item.nodeId === 'sn-huawei-series') && collapsedLayout.overlap.length === 0 && collapsedLayout.missing.length === 0, `收起后 Apple 下级 ${collapsed.some((item) => item.nodeId === 'sn-apple-series')}`))

  data.productSpecNodes.push(spec({ id: 'extra-draft', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-brand', sort: 50 }))
  const publishedRead = readOverviewModel(data, 't-phone')
  const afterDraftNoise = buildOverviewCatalog(data, 'c-host')
  results.push(check('ignore-draft-on-published', publishedRead.source === 'snapshot' && !publishedRead.nodes.some((item) => item.id === 'extra-draft') && !afterDraftNoise.some((item) => item.nodeId === 'extra-draft'), publishedRead.statusText))

  data.productSpecNodes.push(spec({ id: 'case-color', templateId: 't-case-model', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color' }))
  const caseCatalog = buildOverviewCatalog(data, 'c-phone-acc')
  const caseModel = caseCatalog.find((item) => item.templateId === 't-case-model' && item.kind === 'model')
  const caseOpen = expandModel(caseCatalog, 't-case-model', 'c-case')
  results.push(check('draft-mark', Boolean(caseModel?.draft && caseModel.source === 'draft' && caseModel.meta.includes('草稿') && caseOpen.some((item) => item.nodeId === 'case-color')), caseModel?.meta || '没有保护壳模型'))

  const film = buildOverviewCatalog(data, 'c-film')
  const acc = buildOverviewCatalog(data, 'c-phone-acc')
  results.push(check('explicit-type', !film.some((item) => item.entityId === 'pt-film') && acc.some((item) => item.kind === 'type' && item.entityId === 'pt-film' && item.categoryId === 'c-phone-acc'), `保护膜类型 ${film.some((item) => item.entityId === 'pt-film')}`))

  const phoneCanvas = data.specCanvases.find((item) => item.templateId === 't-phone')
  if (phoneCanvas) data.specCanvases.push({ ...phoneCanvas, productTypeId: 'pt-phone-part' })
  const duplicated = buildOverviewCatalog(data, 'c-host')
  const copies = duplicated.filter((item) => item.kind === 'model' && item.templateId === 't-phone')
  const both = expandModel(duplicated, 't-phone')
  const apples = both.filter((item) => item.nodeId === 'sn-brand-apple')
  results.push(check('shared-identity', copies.length === 2 && new Set(copies.map((item) => item.id)).size === 2 && apples.length === 2 && apples[0].id !== apples[1].id && apples[0].templateId === 't-phone' && apples[1].nodeId === 'sn-brand-apple', `入口 ${copies.length} 节点 ${apples.length}`))

  const crowd: OverviewGraphNode[] = [
    dense('category', 'c', null, 1, '出行'),
    dense('type', 'pt', 'c', 1, '电助力车'),
    dense('model', 'm1', 'pt', 1, '大模型'),
    dense('model', 'm2', 'pt', 2, '对照模型'),
  ]
  crowd.push(dense('attribute', 'a0', 'm1', 1, '车型'))
  for (let index = 0; index < 8; index += 1) {
    const valueId = `v${index}`
    crowd.push(dense('value', valueId, 'a0', index + 1, `分支${index}`))
    const attrId = `va${index}`
    crowd.push(dense('attribute', attrId, valueId, 1, `条件${index}`))
    for (let child = 0; child < 4; child += 1) crowd.push(dense('value', `${attrId}-${child}`, attrId, child + 1, `值${index}-${child}`))
  }
  crowd.push(dense('attribute', 'b-root', 'm2', 1, '电池'))
  for (let index = 0; index < 6; index += 1) {
    const valueId = `bv${index}`
    crowd.push(dense('value', valueId, 'b-root', index + 1, `规格${index}`))
    for (let child = 0; child < 3; child += 1) crowd.push(dense('attribute', `${valueId}-a${child}`, valueId, child + 1, `下级${index}-${child}`))
  }
  const forest = buildOverviewForest(data)
  const rootsOnly = visibleOverviewNodes(forest, new Set(), new Set())
  results.push(check('forest-roots', rootsOnly.length > 1 && rootsOnly.every((item) => item.kind === 'category' && !item.parentId) && rootsOnly.some((item) => item.entityId === 'c-host'), `根 ${rootsOnly.map((item) => item.label).join('、')}`))

  const wide: OverviewGraphNode[] = [dense('category', 'root', null, 1, '总类')]
  for (let branch = 0; branch < 10; branch += 1) {
    const categoryId = `c${branch}`
    wide.push(dense('category', categoryId, 'root', branch + 1, `分类${branch}`))
    for (let typeIndex = 0; typeIndex < 2; typeIndex += 1) {
      const typeId = `${categoryId}-t${typeIndex}`
      wide.push(dense('type', typeId, categoryId, typeIndex + 1, `类型${branch}-${typeIndex}`))
      for (let modelIndex = 0; modelIndex < 2; modelIndex += 1) {
        const modelId = `${typeId}-m${modelIndex}`
        wide.push(dense('model', modelId, typeId, modelIndex + 1, `模型${branch}-${typeIndex}-${modelIndex}`))
        const attrId = `${modelId}-a`
        wide.push(dense('attribute', attrId, modelId, 1, `属性${branch}`))
        for (let valueIndex = 0; valueIndex < 4; valueIndex += 1) wide.push(dense('value', `${attrId}-v${valueIndex}`, attrId, valueIndex + 1, `值${valueIndex}`))
      }
    }
  }
  const wideLayout = overviewLayoutIssues(wide)
  results.push(check('scale', wide.length >= 200 && wideLayout.overlap.length === 0 && wideLayout.crossings.length === 0 && wideLayout.missing.length === 0, `节点 ${wide.length} 重叠 ${wideLayout.overlap.length} 穿越 ${wideLayout.crossings.length}`))

  const crowdLayout = overviewLayoutIssues(crowd)
  const left = crowdLayout.frames.get('m1')
  const right = crowdLayout.frames.get('m2')
  results.push(check('crowd', crowd.length > 70 && crowdLayout.overlap.length === 0 && crowdLayout.crossings.length === 0 && crowdLayout.missing.length === 0 && Boolean(left && right && left.bottom <= right.top), `节点 ${crowd.length} 重叠 ${crowdLayout.overlap.length} 缺失 ${crowdLayout.missing.length}`))

  const huge = overviewFitViewport({ minX: 0, minY: 0, width: 9000, height: 7000 }, { width: 1280, height: 800 })
  const small = overviewFitViewport({ minX: 20, minY: 16, width: 360, height: 180 }, { width: 1280, height: 800 })
  results.push(check('zoom-floor', huge.zoom === OVERVIEW_MIN_ZOOM && huge.zoom >= 0.65 && small.zoom === 1 && Number.isFinite(huge.x) && Number.isFinite(huge.y), `大图 ${huge.zoom} 小图 ${small.zoom}`))

  const clean = createSeed()
  const signed = fingerprint(clean)
  buildOverviewCatalog(clean, 'c-host')
  readOverviewModel(clean, 't-phone')
  readOverviewModel(clean, 't-case-model')
  const stable = fingerprint(clean) === signed && !readOverviewModel(clean, 't-phone').nodes.some((item) => item.id === 'extra-draft')
  results.push(check('untouched', stable, stable ? '业务数据保持原样' : '读图改写了业务数据'))
  return results
}
