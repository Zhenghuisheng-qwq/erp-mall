import { isRealSku } from '../catalogIdentity';
import { projectAttrs, shelfOf } from '../logic';
import { compatibilityFamilyTypeId, compatibilityRecordRole, deviceHostKey, listDeviceModels, resolveDeviceSku, createDeviceResolutionContext } from '../deviceResolution';
import { queryDeviceAccessories, queryModelAccessories, queryDeviceContextAccessories, accessoryUseEvaluation } from '../accessoryCompatibilityQuery';
import { benefitGroupProblems, benefitRangeMatches, benefitTypeProblem } from './scope';
import type { AppData } from '../types';
import type { BenefitDevice, BenefitGroup, BenefitHostRange } from './types';
import type { AccessoryQueryResult } from '../accessoryCompatibilityTypes';
import { resolveBenefitRange } from './scope';
export function sellableSkuProblem(data: AppData, id: string, role: 'host' | 'accessory') {
    const sku = data.skus.find(s => s.id === id), family = data.families.find(f => f.id === sku?.familyId);
    if (!sku || !family || !isRealSku(data, sku))
        return '不是有效的真实销售商品';
    const type = data.productTypes.find(t => t.id === compatibilityFamilyTypeId(data, family.id));
    if (!type || type.status !== 'enabled' || type.catalogRole !== role)
        return '产品类型已停用或身份不符';
    if (sku.status !== 'on_sale' || shelfOf(family) !== 'online')
        return '商品当前不在售';
    return '';
}
export function benefitSkuLabel(data: AppData, id: string) {
    const sku = data.skus.find(s => s.id === id), family = data.families.find(f => f.id === sku?.familyId);
    return { name: sku?.skuName || family?.name || '商品已不存在', code: sku?.code || '', spec: sku && family ? Object.entries(projectAttrs(family, sku)).map(([k, v]) => `${data.params.find(p => p.id === k)?.name || k} ${v}`).join(' · ') : '' };
}
export function benefitDevices(data: AppData) {
    return data.skus.filter(s => isRealSku(data, s) && compatibilityRecordRole(data, s.id) === 'host').map(s => {
        const family = data.families.find(f => f.id === s.familyId)!, type = data.productTypes.find(t => t.id === compatibilityFamilyTypeId(data, family.id));
        return { id: s.id, ...benefitSkuLabel(data, s.id), typeName: type?.name || '', categoryName: data.categories.find(c => c.id === (family.categoryId || type?.categoryId))?.name || '', offSale: !!sellableSkuProblem(data, s.id, 'host') };
    });
}
export function benefitCandidates(data: AppData, device: BenefitDevice, resolvedQuery?: AccessoryQueryResult) {
    const option = device.kind === 'model' ? listDeviceModels(data).find(o => o.key === device.hostKey) : undefined;
    const query = resolvedQuery || (device.kind === 'sku' ? queryDeviceAccessories(data, device.skuId) : queryModelAccessories(data, option?.host));
    const host = query.device.host, sku = device.kind === 'sku' ? data.skus.find(s => s.id === device.skuId) : undefined, family = data.families.find(f => f.id === sku?.familyId);
    const modelId = sku ? (sku.creationSource?.templateId || family?.productModelId || family?.templateId || '') : host?.productModelId || '';
    const validType = host && data.productTypes.some(t => t.id === host.productTypeId && t.catalogRole === 'host' && t.status === 'enabled');
    const issue = query.device.status !== 'resolved' || !host ? query.device.message || '当前设备型号尚未明确，需要先维护设备身份' : !validType ? '设备产品类型已停用或身份不符' : '';
    const invalidTargets = new Set(query.issues.flatMap(i => {
        const l = data.compatibilities.find(l => l.id === i.declarationId);
        return l ? [l.targetId || l.accessorySkuId] : [];
    }));
    const candidates = issue ? [] : query.sales.filter(match => {
        const use = accessoryUseEvaluation(match);
        return match.target.kind === 'sku' && !sellableSkuProblem(data, match.sku.id, 'accessory') && !invalidTargets.has(match.sku.id) && use.status === 'compatible' && !use.conflict && use.conditions.every(c => c.state === 'met');
    });
    const label = sku ? benefitSkuLabel(data, sku.id) : { name: option?.label || '型号已失效', spec: '客户自有设备 · 型号级依据', code: '' };
    return { query, candidates, issue, modelId, hostKey: host ? deviceHostKey(host) : '', label };
}
export function benefitGroupMatches(data: AppData, group: BenefitGroup, context: ReturnType<typeof benefitCandidates>) {
    // Structural scope validity is independent of each type's current sale candidates.
    // Configuration admission remains in benefitConfigurationImpact / saveBenefitGroup.
    return !context.issue && !!context.query.device.host && !benefitGroupProblems(data, group).length && benefitRangeMatches(data, group.hostRanges || [], context.query.device.host);
}
export function applicableBenefitGroups(data: AppData, context: ReturnType<typeof benefitCandidates>) {
    return (data.benefitGroups || []).filter(g => g.enabled && benefitGroupCandidates(data, g, context).length > 0).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh'));
}
export function benefitGroupCandidates(data: AppData, group: BenefitGroup, context: ReturnType<typeof benefitCandidates>) {
    if (!benefitGroupMatches(data, group, context))
        return [];
    return context.candidates.filter(c => group.productTypeIds.includes(c.productTypeId) && !benefitTypeProblem(data, group.categoryId || '', c.productTypeId));
}
export function benefitPreviewDevices(data: AppData, group: BenefitGroup) {
    if (benefitGroupProblems(data, group).length)
        return { models: [], devices: [] };
    const ranges = group.hostRanges || [], resolution = createDeviceResolutionContext(data);
    const models = resolution.hostOptions.filter(o => benefitRangeMatches(data, ranges, o.host));
    const devices = benefitDevices(data).filter(d => {
        const r = resolveDeviceSku(data, d.id, resolution);
        return r.status === 'resolved' && !!r.host && benefitRangeMatches(data, ranges, r.host);
    });
    return { models, devices };
}
/** Explain one actual query result; absence of a result is not an incompatibility claim. */
export function benefitAccessoryReason(data: AppData, context: ReturnType<typeof benefitCandidates>, id: string) {
    if (context.issue)
        return context.issue;
    const q = context.query, match = [...q.sales, ...q.pending, ...q.excluded, ...q.unavailable, ...q.materials].find(m => m.sku.id === id);
    if (q.issues.some(i => {
        const l = data.compatibilities.find(l => l.id === i.declarationId);
        return l && (l.targetId || l.accessorySkuId) === id;
    }))
        return '商品身份或适用依据引用失效，请核对';
    if (match?.target.kind === 'material')
        return '仅有 MAT 声明，没有可选销售 SKU';
    if (!match)
        return sellableSkuProblem(data, id, 'accessory') || '当前设备与该配件尚未建立有效的基本使用依据';
    const use = accessoryUseEvaluation(match);
    if (use.conflict)
        return '基本使用适用依据冲突';
    if (use.status === 'incompatible')
        return '明确不适用';
    if (use.missingBasic)
        return '基本使用依据尚未建立';
    if (use.status === 'pending')
        return '适用依据待确认';
    if (use.conditions.some(c => c.state === 'unmet'))
        return '使用条件不满足';
    if (use.status === 'conditional' || use.conditions.some(c => c.state === 'unknown'))
        return '使用条件待核验';
    return sellableSkuProblem(data, id, 'accessory') ? '已确认适用；' + sellableSkuProblem(data, id, 'accessory') : '基本使用已确认可用';
}
export function benefitEmptyReason(data: AppData, context: ReturnType<typeof benefitCandidates>) {
    if (context.issue)
        return context.issue;
    const q = context.query, matches = [...q.sales, ...q.pending, ...q.excluded, ...q.unavailable];
    if (!matches.length)
        return q.issues.length ? '适用依据存在失效引用，请核对。' : '当前设备尚未建立有效的配件基本使用依据。';
    return [...new Set(matches.map(m => benefitAccessoryReason(data, context, m.sku.id)))].join('；') + '。';
}
export interface BenefitTypeAvailability {
    typeId: string;
    candidates: {
        id: string;
        name: string;
        spec: string;
        devices: string[];
    }[];
    reason: string;
}
/** Visit only declared hosts in the selected union. Resolve actual devices only for
 * declarations with specification conditions; never expand model combinations for preview. */
export function benefitRangeAvailability(data: AppData, categoryId: string, ranges: BenefitHostRange[]) {
    const result = new Map<string, BenefitTypeAvailability>();
    const rangeIssue = !ranges.length ? '请先确定适用主机范围' : ranges.map(r => resolveBenefitRange(data, r).issue).find(Boolean) || '';
    for (const type of data.productTypes)
        result.set(type.id, { typeId: type.id, candidates: [], reason: benefitTypeProblem(data, categoryId, type.id) || rangeIssue });
    if (rangeIssue)
        return result;
    const options = listDeviceModels(data);
    const declaredKeys = new Set(data.compatibilities.filter(l => l?.host).map(l => deviceHostKey(l.host)));
    const covered = options.filter(o => declaredKeys.has(o.key) && benefitRangeMatches(data, ranges, o.host));
    const reasons = new Map<string, Set<string>>();
    function collect(context: ReturnType<typeof benefitCandidates>, deviceLabel: string) {
        const q = context.query;
        for (const match of [...q.sales, ...q.pending, ...q.excluded, ...q.unavailable, ...q.materials]) {
            const entry = result.get(match.productTypeId);
            if (!entry || entry.reason)
                continue;
            if (context.candidates.some(c => c.sku.id === match.sku.id)) {
                const existing = entry.candidates.find(c => c.id === match.sku.id);
                if (existing) {
                    if (!existing.devices.includes(deviceLabel))
                        existing.devices.push(deviceLabel);
                }
                else
                    entry.candidates.push({ id: match.sku.id, name: match.name, spec: match.spec, devices: [deviceLabel] });
            }
            else {
                const set = reasons.get(match.productTypeId) || new Set<string>();
                set.add(benefitAccessoryReason(data, context, match.sku.id));
                reasons.set(match.productTypeId, set);
            }
        }
    }
    for (const option of covered)
        collect(benefitCandidates(data, { kind: 'model', hostKey: option.key }), option.label + '（型号级）');
    const specKeys = new Set(data.compatibilities.filter(l => l?.host && covered.some(o => o.key === deviceHostKey(l.host)) && (l.host.scope === 'planning' || l.conditions?.length)).map(l => deviceHostKey(l.host)));
    if (specKeys.size) {
        const resolution = createDeviceResolutionContext(data);
        for (const sku of data.skus) {
            if (!resolution.realSkuIds.has(sku.id) || compatibilityRecordRole(data, sku.id) !== 'host')
                continue;
            const device = resolveDeviceSku(data, sku.id, resolution);
            if (device.status !== 'resolved' || !device.host || !specKeys.has(deviceHostKey(device.host)))
                continue;
            const label = benefitSkuLabel(data, sku.id);
            collect(benefitCandidates(data, { kind: 'sku', skuId: sku.id }, queryDeviceContextAccessories(data, device)), label.name + ' · ' + label.spec);
        }
    }
    for (const entry of result.values())
        if (!entry.reason && !entry.candidates.length)
            entry.reason = [...(reasons.get(entry.typeId) || [])].join('；') || '当前主机范围内尚无已确认基本使用依据的在售 SKU';
    return result;
}
export function benefitConfigurationImpact(data: AppData, categoryId: string, ranges: BenefitHostRange[], ids: string[]) {
    const availability = benefitRangeAvailability(data, categoryId, ranges);
    return { availability, keep: ids.filter(id => !!availability.get(id)?.candidates.length && !availability.get(id)?.reason), remove: ids.filter(id => !availability.get(id)?.candidates.length || !!availability.get(id)?.reason) };
}
/** Walk the selected branch to its real identity attribute; never expand the model Cartesian product. */
export function benefitNodeHosts(data: AppData, modelId: string, nodeId: string, versionId?: string) {
    const options = listDeviceModels(data).filter(o => o.host.productModelId === modelId && (!versionId || o.versionIds.includes(versionId)));
    if (!nodeId)
        return options;
    const nodes = versionId ? data.specModelVersions.find(v => v.id === versionId && v.templateId === modelId)?.nodesSnapshot || [] : data.productSpecNodes.filter(n => n.templateId === modelId);
    const byId = new Map(nodes.map(n => [n.id, n])), chain: {
        attributeId: string;
        valueId: string;
    }[] = [], seen = new Set<string>();
    let node = byId.get(nodeId);
    while (node && !seen.has(node.id)) {
        seen.add(node.id);
        if (node.nodeType === 'VALUE')
            chain.push({ attributeId: byId.get(node.parentId || '')?.attributeId || node.attributeId, valueId: node.valueId });
        node = byId.get(node.parentId || '');
    }
    const ids = new Set(data.params.filter(p => p.identityRole === 'host-model').map(p => p.id)), identity = chain.find(s => ids.has(s.attributeId));
    return identity ? options.filter(o => o.host.steps.some(s => s.attributeId === identity.attributeId && s.valueId === identity.valueId) && o.host.steps.every(s => !chain.some(c => c.attributeId === s.attributeId && c.valueId !== s.valueId))) : [];
}
