function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
const string = (value: unknown): value is string => typeof value === 'string'
const oneOf = (value: unknown, options: string[]) => string(value) && options.includes(value)

/** Shared by formal declarations and model drafts; validation never changes its input. */
export function conditionProblem(value: unknown): string {
  if (!object(value) || !oneOf(value.kind, ['attribute', 'equipment', 'capability', 'manual'])) return '条件类型无效。'
  if (value.kind === 'attribute') {
    if (!string(value.attributeId) || !value.attributeId.trim() || !oneOf(value.operator, ['eq', 'in', 'gte'])) return '设备属性条件不完整。'
    if (value.operator === 'in' ? !Array.isArray(value.value) || !value.value.length || !value.value.every(item => string(item) && item.trim()) : !string(value.value) || !value.value.trim()) return '设备属性条件的值无效。'
    if (value.operator === 'gte' && !Number.isFinite(Number(value.value))) return '数值条件必须填写有效数字。'
    if (value.text !== undefined && !string(value.text)) return '条件说明无效。'
  } else {
    if (!string(value.text) || !value.text.trim()) return '请填写配套条件或使用前提。'
    if (value.kind === 'capability' && (value.protocol !== undefined && !string(value.protocol) || value.powerWatts !== undefined && (typeof value.powerWatts !== 'number' || !Number.isFinite(value.powerWatts) || value.powerWatts <= 0))) return '协议或功率要求无效。'
  }
  return ''
}
