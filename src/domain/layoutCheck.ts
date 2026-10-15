import { layoutSpecTree } from './logic'

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
  return results
}
