import { categoryPathLabel } from '../categoryTree';
import { hostFrom } from '../compatibility';
import { deviceHostKey, listDeviceModels } from '../deviceResolution';
import type { AppData, CompatibilityHost } from '../types';
import type { BenefitGroup, BenefitHostRange } from './types';
export function validBenefitCategory(data: AppData, id: string) {
    const seen = new Set<string>();
    let current = id;
    while (current) {
        if (seen.has(current))
            return false;
        seen.add(current);
        const rows = data.categories.filter(c => c.id === current);
        if (rows.length !== 1)
            return false;
        current = rows[0]!.parentId || '';
    }
    return !!id;
}
export function categoryContains(data: AppData, parent: string, child: string) {
    if (!validBenefitCategory(data, parent) || !validBenefitCategory(data, child))
        return false;
    let current = child;
    while (current) {
        if (current === parent)
            return true;
        current = data.categories.find(c => c.id === current)?.parentId || '';
    }
    return false;
}
export function benefitTypeProblem(data: AppData, categoryId: string, typeId: string) {
    const rows = data.productTypes.filter(t => t.id === typeId), type = rows[0];
    if (rows.length !== 1 || !type)
        return '产品类型不存在或身份重复';
    if (type.status !== 'enabled' || type.catalogRole !== 'accessory')
        return '类型已停用或不是配件';
    if (!categoryContains(data, categoryId, type.categoryId))
        return '超出归属分类范围或分类引用失效';
    return '';
}
export function benefitCategoryImpact(data: AppData, categoryId: string, ids: string[]) {
    return { keep: ids.filter(id => !benefitTypeProblem(data, categoryId, id)), remove: ids.filter(id => !!benefitTypeProblem(data, categoryId, id)) };
}
function validHostType(data: AppData, id: string) {
    const types = data.productTypes.filter(t => t.id === id);
    return types.length === 1 && types[0]!.catalogRole === 'host' && types[0]!.status === 'enabled' && validBenefitCategory(data, types[0]!.categoryId);
}
/** Follow identity ancestry only: no capacity/color Cartesian expansion. */
export function benefitSnapshotHosts(data: AppData, modelId: string, versionId: string) {
    const version = data.specModelVersions.find(v => v.id === versionId && v.templateId === modelId && v.status === 'published');
    const models = data.specCanvases.filter(m => m.templateId === modelId);
    const typeId = models.length === 1 ? models[0]!.productTypeId || '' : '';
    if (!version || !validHostType(data, typeId))
        return { issue: '发布快照或主机模型引用失效', entries: [] };
    const nodes = version.nodesSnapshot, byId = new Map(nodes.map(n => [n.id, n]));
    if (byId.size !== nodes.length)
        return { issue: '发布快照节点身份重复', entries: [] };
    const identityIds = new Set(data.params.filter(p => p.identityRole === 'host-model').map(p => p.id));
    const entries: {
        host: CompatibilityHost;
        key: string;
        nodeIds: string[];
        label: string;
    }[] = [];
    for (const leaf of nodes.filter(n => n.nodeType === 'VALUE' && identityIds.has(byId.get(n.parentId || '')?.attributeId || n.attributeId))) {
        const nodeIds: string[] = [], steps: CompatibilityHost['steps'] = [], seen = new Set<string>();
        let node: typeof leaf | undefined = leaf;
        while (node) {
            if (seen.has(node.id) || (node.parentId && !byId.has(node.parentId)))
                return { issue: '型号路径引用失效', entries: [] };
            seen.add(node.id);
            nodeIds.unshift(node.id);
            if (node.nodeType === 'VALUE') {
                const attribute = byId.get(node.parentId || '');
                if (!attribute || attribute.nodeType !== 'ATTRIBUTE' || !node.valueId)
                    return { issue: '型号属性身份不明确', entries: [] };
                const param = data.params.find(p => p.id === attribute.attributeId);
                if (!param || (attribute.role === 'VARIANT' && !identityIds.has(param.id)))
                    return { issue: '型号路径包含规格分歧，需先核对主机身份', entries: [] };
                steps.unshift({ attributeId: param.id, attributeName: param.name, valueId: node.valueId });
            }
            node = byId.get(node.parentId || '');
        }
        const host = hostFrom(typeId, modelId, steps);
        entries.push({ host, key: deviceHostKey(host), nodeIds, label: steps.map(s => s.valueId).join(' / ') });
    }
    return { issue: entries.length ? '' : '此发布快照尚无可准确识别的型号', entries };
}
export function resolveBenefitRange(data: AppData, range: BenefitHostRange) {
    const options = listDeviceModels(data);
    if (range.kind === 'type') {
        const issue = validHostType(data, range.productTypeId) ? '' : '主机类型已停用或引用失效';
        return { issue, keys: issue ? [] : options.filter(o => o.host.productTypeId === range.productTypeId).map(o => o.key), typeId: range.productTypeId };
    }
    if (range.kind === 'host') {
        const host = options.find(o => o.key === range.hostKey)?.host;
        const issue = host && validHostType(data, host.productTypeId) ? '' : '明确型号引用已失效';
        return { issue, keys: issue ? [] : [range.hostKey], typeId: host?.productTypeId || '' };
    }
    const result = benefitSnapshotHosts(data, range.modelId, range.versionId);
    if (result.issue)
        return { issue: result.issue, keys: [], typeId: '' };
    const entries = range.nodeId ? result.entries.filter(e => e.nodeIds.includes(range.nodeId!)) : result.entries;
    const node = range.nodeId ? data.specModelVersions.find(v => v.id === range.versionId)!.nodesSnapshot.find(n => n.id === range.nodeId) : undefined;
    const issue = range.nodeId && (!node || node.nodeType !== 'VALUE' || !entries.length) ? '该节点不是有效型号范围；容量、颜色或属性名称不能作为范围' : '';
    return { issue, keys: issue ? [] : [...new Set(entries.map(e => e.key))], typeId: entries[0]?.host.productTypeId || '' };
}
export function compactBenefitRanges(data: AppData, ranges: BenefitHostRange[]) {
    const unique = ranges.filter((r, i) => ranges.findIndex(v => JSON.stringify(v) === JSON.stringify(r)) === i);
    const resolved = unique.map(r => resolveBenefitRange(data, r));
    return unique.filter((r, i) => !unique.some((parent, j) => {
        if (i === j || resolved[i]!.issue || resolved[j]!.issue)
            return false;
        if (parent.kind === 'type')
            return resolved[j]!.typeId === resolved[i]!.typeId && r.kind !== 'type';
        if (r.kind === 'type' || !resolved[i]!.keys.length)
            return false;
        const covered = resolved[i]!.keys.every(key => resolved[j]!.keys.includes(key));
        return covered && (resolved[j]!.keys.length > resolved[i]!.keys.length || (parent.kind === 'snapshot' && r.kind === 'host') || (parent.kind === r.kind && j < i));
    }));
}
export function benefitGroupProblems(data: AppData, group: Pick<BenefitGroup, 'categoryId' | 'productTypeIds' | 'hostRanges'>) {
    const issues: string[] = [];
    if (!group.categoryId)
        issues.push('待补充配置：请选择配件归属分类');
    else if (!validBenefitCategory(data, group.categoryId))
        issues.push('归属分类引用失效');
    for (const id of group.productTypeIds) {
        const problem = benefitTypeProblem(data, group.categoryId || '', id);
        if (problem)
            issues.push(`${data.productTypes.find(t => t.id === id)?.name || id}：${problem}`);
    }
    if (!group.productTypeIds.length)
        issues.push('请选择包内配件类型');
    if (!group.hostRanges?.length)
        issues.push('待补充配置：请选择适用主机范围');
    for (const range of group.hostRanges || []) {
        const issue = resolveBenefitRange(data, range).issue;
        if (issue)
            issues.push(issue);
    }
    return [...new Set(issues)];
}
export function benefitRangeMatches(data: AppData, ranges: BenefitHostRange[], host: CompatibilityHost) {
    const results = ranges.map(r => resolveBenefitRange(data, r));
    return !results.some(r => r.issue) && results.some((r, i) => ranges[i]!.kind === 'type' ? r.typeId === host.productTypeId : r.keys.includes(deviceHostKey(host)));
}
export function benefitRangeLabel(data: AppData, range: BenefitHostRange) {
    if (range.kind === 'type')
        return `${data.productTypes.find(t => t.id === range.productTypeId)?.name || range.productTypeId} · 当前及未来全部型号`;
    if (range.kind === 'host')
        return listDeviceModels(data).find(o => o.key === range.hostKey)?.label || '失效型号';
    const model = data.specCanvases.find(m => m.templateId === range.modelId), version = data.specModelVersions.find(v => v.id === range.versionId);
    const node = version?.nodesSnapshot.find(n => n.id === range.nodeId);
    return `${model?.name || range.modelId} / ${node?.valueId || (range.nodeId ? '失效节点' : '完整范围')} · ${version?.versionName || '失效版本'}`;
}
/** Only prefill explicit old identities; an old model scope has no frozen version to guess. */
export function benefitLegacyRanges(group: BenefitGroup): BenefitHostRange[] {
    return group.hostRanges || (group.scope?.hostKey ? [{ kind: 'host', hostKey: group.scope.hostKey }] : []);
}
export const benefitCategoryLabel = (data: AppData, id?: string) => id ? categoryPathLabel(data.categories, id) || `失效分类 ${id}` : '待补充归属分类';
