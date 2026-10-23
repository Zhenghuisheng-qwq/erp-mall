import { hostLabel } from '../../domain/compatibility'
import type { EffectiveTemplateCompatibility } from '../../domain/templateCompatibilityTypes'

type Preview = Pick<EffectiveTemplateCompatibility, 'state' | 'claims' | 'message'>
/** Presentation only: creation and preview both obtain their facts from the domain resolver. */
export function templateCreationSummary(results: Preview[], versionName: string, noun: string) {
  if (!results.length) return ''
  const devices = new Map<string, { label: string; count: number }>()
  let empty = 0, unconfigured = 0, problems = 0
  for (const result of results) {
    if (result.state === 'invalid' || result.state === 'conflict') { problems++; continue }
    if (result.state === 'empty') empty++
    if (result.state === 'unconfigured') unconfigured++
    const seen = new Set<string>()
    for (const { claim } of result.claims) {
      const key = `${claim.host.productModelId}\u001f${claim.host.identityKey}\u001f${claim.host.scope}\u001f${claim.host.planningId || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      const prior = devices.get(key)
      if (prior) prior.count++
      else devices.set(key, { label: hostLabel(claim.host), count: 1 })
    }
  }
  const detail = [...devices.values()].map(item => `${item.count} 个${noun}对应 ${item.label}`).join('；')
  return [versionName ? `适用设备读取绑定的 ${versionName}` : '尚无已发布兼容配置来源', `本次 ${results.length} 个${noun}`, detail, empty ? `${empty} 个明确为空配置` : '', unconfigured ? `${unconfigured} 个尚无可带入配置，仍可正常创建` : '', problems ? `${problems} 个需处理，请查看具体规格和配置问题` : ''].filter(Boolean).join(' · ')
}
