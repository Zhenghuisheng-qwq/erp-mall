import { SPEC_LINK_GAP, SPEC_TREE_GAP, layoutSpecFrames, layoutSpecTree, siblingSubtreeCrossings, specFramesOverlap, specNodeSize, type SpecTreeFrame } from './logic'

export interface CheckResult { id: string; ok: boolean; detail: string }

export function runLayoutChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const nodes = [
    { id: 'size', parentId: null, sort: 1, nodeType: 'ATTRIBUTE' as const },
    { id: 'sm', parentId: 'size', sort: 1, nodeType: 'VALUE' as const },
    { id: 'ml', parentId: 'size', sort: 2, nodeType: 'VALUE' as const },
    { id: 'kind', parentId: null, sort: 2, nodeType: 'ATTRIBUTE' as const },
    { id: 'sport', parentId: 'kind', sort: 1, nodeType: 'VALUE' as const },
    { id: 'leather', parentId: 'kind', sort: 2, nodeType: 'VALUE' as const },
    { id: 'color', parentId: 'sport', sort: 1, nodeType: 'ATTRIBUTE' as const },
    { id: 'black', parentId: 'color', sort: 1, nodeType: 'VALUE' as const },
    { id: 'white', parentId: 'color', sort: 2, nodeType: 'VALUE' as const },
  ]
  const placed = layoutSpecTree(nodes)
  const size = placed.get('size')
  const sm = placed.get('sm')
  const ml = placed.get('ml')
  const kind = placed.get('kind')
  const sport = placed.get('sport')
  const leather = placed.get('leather')
  const color = placed.get('color')
  const black = placed.get('black')
  check('near-parent', Boolean(size && sm && ml && sm.x > size.x && ml.x > size.x && sm.y !== 0 && ml.y !== sm.y), `尺码 ${size?.y} S/M ${sm?.x},${sm?.y} M/L ${ml?.x},${ml?.y}`)
  check('separate', Boolean(kind && sport && leather && sport.x > kind.x && Math.abs((sport.y || 0) - (sm?.y || 0)) > 20), `运动表带 ${sport?.x},${sport?.y}`)
  check('branch', Boolean(color && black && sport && color.x > sport.x && black.x > color.x), `颜色 ${color?.x} 黑色 ${black?.x}`)
  const gap = color && sport ? color.x - sport.x : 0
  check('attached', Boolean(color && sport && gap >= 90 && gap <= 150), `条件属性距取值 ${gap}`)
  const fan = [
    { id: 'band', parentId: null, sort: 1, nodeType: 'VALUE' as const, label: 'M/L' },
    ...Array.from({ length: 6 }, (_, index) => ({ id: `a${index}`, parentId: 'band', sort: index + 1, nodeType: 'ATTRIBUTE' as const, label: `条件${index + 1}` })),
  ]
  const fanPlaced = layoutSpecTree(fan)
  const band = fanPlaced.get('band')
  const branches = fan.slice(1).map((item) => fanPlaced.get(item.id)).filter((item): item is { x: number; y: number } => Boolean(item))
  const top = branches[0]
  const bottom = branches[branches.length - 1]
  const mid = top && bottom ? (top.y + bottom.y) / 2 : 0
  const step = band && top ? top.x - band.x : 999
  check('fan', Boolean(band && top && bottom && Math.abs((band.y || 0) - mid) <= 28 && step >= 90 && step <= 150 && bottom.y - top.y > 80), `M/L ${band?.y} 中线 ${mid} 步距 ${step}`)

  const chain = Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, parentId: index ? `c${index - 1}` : null, sort: 1, nodeType: (index % 2 ? 'VALUE' : 'ATTRIBUTE') as 'ATTRIBUTE' | 'VALUE', label: `层${index}` }))
  const wide = [
    { id: 'root', parentId: null, sort: 1, nodeType: 'ATTRIBUTE' as const, label: '容量' },
    ...Array.from({ length: 10 }, (_, index) => ({ id: `v${index}`, parentId: 'root', sort: index + 1, nodeType: 'VALUE' as const, label: `${index + 1}TB` })),
  ]
  const uneven = [
    { id: 'short', parentId: null, sort: 1, nodeType: 'VALUE' as const, label: '短分支' },
    { id: 'tall', parentId: null, sort: 2, nodeType: 'VALUE' as const, label: '长分支' },
    ...Array.from({ length: 6 }, (_, index) => ({ id: `t${index}`, parentId: 'tall', sort: index + 1, nodeType: 'ATTRIBUTE' as const, label: `下级${index}` })),
  ]
  const many = Array.from({ length: 12 }, (_, index) => ({ id: `m${index}`, parentId: index ? `m${Math.floor((index - 1) / 2)}` : null, sort: index, nodeType: (index % 2 ? 'VALUE' : 'ATTRIBUTE') as 'ATTRIBUTE' | 'VALUE', label: `节点${index}号` }))
  const collapsed = [
    { id: 'open', parentId: null, sort: 1, nodeType: 'ATTRIBUTE' as const, label: '展开', expanded: true },
    { id: 'kid', parentId: 'open', sort: 1, nodeType: 'VALUE' as const, label: '子节点' },
    { id: 'shut', parentId: null, sort: 2, nodeType: 'ATTRIBUTE' as const, label: '收起', expanded: false },
    { id: 'hidden', parentId: 'shut', sort: 1, nodeType: 'VALUE' as const, label: '隐藏子节点' },
  ]
  const samples = [chain, wide, uneven, many, collapsed, nodes, fan]
  const overlap = samples.flatMap((sample) => specFramesOverlap(sample))
  check('no-overlap', overlap.length === 0, overlap.join(',') || '可见节点包围盒没有相交')
  const frames = layoutSpecFrames(uneven)
  const shortBand = frames.get('short')
  const tallBand = frames.get('tall')
  check('bands', Boolean(shortBand && tallBand && shortBand.bottom <= tallBand.top), `短 ${shortBand?.top}-${shortBand?.bottom} 长 ${tallBand?.top}-${tallBand?.bottom}`)
  const closed = layoutSpecFrames(collapsed)
  check('collapse', Boolean(closed.get('kid') && !closed.get('hidden') && (closed.get('shut')?.top || 0) >= (closed.get('open')?.bottom || 0)), `收起后隐藏节点 ${closed.has('hidden') ? '仍占位' : '不占位'}`)
  const wideFrames = layoutSpecFrames(wide)
  const values = wide.slice(1).map((item) => wideFrames.get(item.id)).filter((item): item is SpecTreeFrame => Boolean(item))
  check('ten-values', values.length === 10 && values.every((item, index) => index === 0 || item.y >= values[index - 1].y + values[index - 1].height), values.map((item) => item.y).join(','))
  check('deep-chain', chain.every((item, index) => { const pos = layoutSpecTree(chain).get(item.id); const prev = index ? layoutSpecTree(chain).get(chain[index - 1].id) : undefined; return Boolean(pos && (index === 0 || (prev && pos.x > prev.x))) }), `链长 ${chain.length}`)
  const crowd = Array.from({ length: 54 }, (_, index) => ({ id: `k${index}`, parentId: index === 0 ? null : `k${index % 7 === 0 ? 0 : index - 1}`, sort: index, nodeType: (index % 2 ? 'VALUE' : 'ATTRIBUTE') as 'ATTRIBUTE' | 'VALUE', label: `复杂${index}` }))
  check('fifty', crowd.length > 50 && specFramesOverlap(crowd).length === 0, `节点 ${crowd.length}，重叠 ${specFramesOverlap(crowd).length}`)
  const moved = uneven.map((item) => item.id === 't0' ? { ...item, parentId: 'short' } : item)
  const movedFrames = layoutSpecFrames(moved)
  check('reparent', specFramesOverlap(moved).length === 0 && (movedFrames.get('t0')?.x || 0) > (movedFrames.get('short')?.x || 0), `拖到短分支后 x=${movedFrames.get('t0')?.x}`)

  const shell = [
    { id: 'model', parentId: null, sort: 1, nodeType: 'ATTRIBUTE' as const, label: '型号' },
    { id: 'series', parentId: null, sort: 2, nodeType: 'ATTRIBUTE' as const, label: '系列' },
    { id: 'color', parentId: null, sort: 3, nodeType: 'ATTRIBUTE' as const, label: '颜色' },
    { id: 'capacity', parentId: null, sort: 4, nodeType: 'ATTRIBUTE' as const, label: '容量' },
  ]
  const beforeAdd = layoutSpecFrames(shell)
  const added = [
    ...shell,
    { id: 'm1', parentId: 'model', sort: 1, nodeType: 'VALUE' as const, label: 'iPhone 17' },
    { id: 'm2', parentId: 'model', sort: 2, nodeType: 'VALUE' as const, label: 'iPhone 17 Pro' },
    { id: 'm3', parentId: 'model', sort: 3, nodeType: 'VALUE' as const, label: 'iPhone 17 Pro Max' },
  ]
  const afterAdd = layoutSpecFrames(added)
  const seriesMoved = (afterAdd.get('series')?.y || 0) > (beforeAdd.get('series')?.y || 0)
  const modelBand = afterAdd.get('model')
  const seriesBand = afterAdd.get('series')
  check('add-dodge', Boolean(seriesMoved && modelBand && seriesBand && modelBand.bottom + SPEC_TREE_GAP <= seriesBand.top && siblingSubtreeCrossings(added).length === 0), `系列 ${beforeAdd.get('series')?.y} -> ${afterAdd.get('series')?.y}，型号带子 ${modelBand?.top}-${modelBand?.bottom}`)
  check('sibling-bands', siblingSubtreeCrossings(added).length === 0 && siblingSubtreeCrossings(uneven).length === 0 && siblingSubtreeCrossings(wide).length === 0, siblingSubtreeCrossings(added).join(',') || '兄弟子树没有交错')

  const longLabel = 'iPhone 17 Pro Max 远峰蓝'
  const longNodes = [
    { id: 'wide', parentId: null, sort: 1, nodeType: 'ATTRIBUTE' as const, label: '型号' },
    { id: 'long', parentId: 'wide', sort: 1, nodeType: 'VALUE' as const, label: longLabel },
    { id: 'next', parentId: 'long', sort: 1, nodeType: 'ATTRIBUTE' as const, label: '颜色' },
    { id: 'peer', parentId: null, sort: 2, nodeType: 'ATTRIBUTE' as const, label: '系列' },
  ]
  const longFrames = layoutSpecFrames(longNodes)
  const longValue = longFrames.get('long')
  const nextCol = longFrames.get('next')
  check('column-gap', Boolean(longValue && nextCol && nextCol.x >= longValue.x + longValue.width + SPEC_LINK_GAP && (longFrames.get('peer')?.top || 0) >= (longFrames.get('wide')?.bottom || 0)), `长文本右 ${longValue ? longValue.x + longValue.width : 0} 下一列 ${nextCol?.x}`)

  const deep = Array.from({ length: 5 }, (_, index) => ({ id: `d${index}`, parentId: index ? `d${index - 1}` : 'deep', sort: 1, nodeType: (index % 2 ? 'VALUE' : 'ATTRIBUTE') as 'ATTRIBUTE' | 'VALUE', label: `嵌套${index}` }))
  const unevenBranches = [
    { id: 'many', parentId: null, sort: 1, nodeType: 'ATTRIBUTE' as const, label: '十个值' },
    ...Array.from({ length: 10 }, (_, index) => ({ id: `n${index}`, parentId: 'many', sort: index + 1, nodeType: 'VALUE' as const, label: `值${index + 1}` })),
    { id: 'pair', parentId: null, sort: 2, nodeType: 'ATTRIBUTE' as const, label: '两个值' },
    { id: 'p1', parentId: 'pair', sort: 1, nodeType: 'VALUE' as const, label: '甲' },
    { id: 'p2', parentId: 'pair', sort: 2, nodeType: 'VALUE' as const, label: '乙' },
    { id: 'deep', parentId: null, sort: 3, nodeType: 'ATTRIBUTE' as const, label: '五层' },
    ...deep,
    { id: 'leaf', parentId: null, sort: 4, nodeType: 'VALUE' as const, label: '单叶' },
  ]
  const unevenBands = layoutSpecFrames(unevenBranches)
  const branchIds = ['many', 'pair', 'deep', 'leaf']
  const separated = branchIds.every((id, index) => index === 0 || (unevenBands.get(branchIds[index - 1])?.bottom || 0) + SPEC_TREE_GAP <= (unevenBands.get(id)?.top || 0))
  check('uneven-branches', separated && siblingSubtreeCrossings(unevenBranches).length === 0 && specFramesOverlap(unevenBranches).length === 0, branchIds.map((id) => `${id}:${unevenBands.get(id)?.top}-${unevenBands.get(id)?.bottom}`).join(' '))

  const identity = added.map((item) => ({ ...item, attributeId: item.id, valueId: item.nodeType === 'VALUE' ? item.label : '' }))
  const identityBefore = identity.map((item) => `${item.id}:${item.attributeId}:${item.valueId}`).join('|')
  const positioned = identity.map((item) => ({ ...item, templateId: 't', parentId: item.parentId, positionX: 1, positionY: 1, sort: item.sort, nodeType: item.nodeType, attributeId: item.attributeId, valueId: item.valueId }))
  layoutSpecTree(positioned)
  check('identity', identityBefore === identity.map((item) => `${item.id}:${item.attributeId}:${item.valueId}`).join('|') && specNodeSize('VALUE', longLabel).width >= 76, '布局没有改节点身份')
  return results
}
