import { catalogScopeNodes } from '../catalogScopeTree';
import type { CatalogTypeRow } from '../catalogWorkspaceQuery';
import { categoryDisplayParents } from '../categoryTree';
import { listDeviceModels } from '../deviceResolution';
import type { AppData } from '../types';
import type { BenefitHostRange } from './types';
import { benefitSnapshotHosts, benefitTypeProblem, categoryContains } from './scope';
import type { BenefitTypeAvailability } from './query';
export interface BenefitChoiceNode {
    key: string;
    label: string;
    kind: string;
    children: BenefitChoiceNode[];
    typeIds?: string[];
    range?: BenefitHostRange;
    reason?: string;
    hint?: string;
}
export const rangeKey = (r: BenefitHostRange) => JSON.stringify(r);
export function benefitAccessoryTree(data: AppData, types: CatalogTypeRow[], categoryId: string, availability: Map<string, BenefitTypeAvailability>) {
    const flat = catalogScopeNodes(data.categories, types);
    const problem = (id: string) => benefitTypeProblem(data, categoryId, id);
    const map = new Map(flat.map(n => [n.key, {
            key: n.key, label: n.name, kind: n.kind, children: [] as BenefitChoiceNode[],
            typeIds: n.kind === 'product-type' ? problem(n.id) ? [] : [n.id] : data.productTypes.filter(t => categoryContains(data, n.id, t.categoryId) && !problem(t.id)).map(t => t.id),
            reason: n.kind === 'product-type' ? problem(n.id) : categoryContains(data, categoryId, n.id) ? '' : '归属分类范围外',
            hint: n.kind === 'product-type' && !problem(n.id) ?
                `当前 ${availability.get(n.id)?.candidates.length || 0} 个可选商品${availability.get(n.id)?.reason ? ' · ' + availability.get(n.id)!.reason : ''}` : '',
        }]));
    const roots: BenefitChoiceNode[] = [];
    for (const n of flat) {
        const row = map.get(n.key)!;
        const parent = n.parentKey ? map.get(n.parentKey) : undefined;
        if (parent)
            parent.children.push(row);
        else
            roots.push(row);
    }
    for (const n of flat.filter(n => n.kind === 'product-type')) {
        if (problem(n.id))
            continue;
        map.get(n.key)!.children.push(...(availability.get(n.id)?.candidates || []).map(s => ({ key: 'sku:' + s.id, label: s.name + ' · ' + s.spec, kind: 'sku', reason: '适用于范围内：' + s.devices.join('；'), children: [] })));
    }
    return roots;
}
export function benefitHostTree(data: AppData) {
    const parents = categoryDisplayParents(data.categories), roots: BenefitChoiceNode[] = [];
    const categories = new Map(data.categories.map(c => [c.id, { key: 'category:' + c.id, label: c.name, kind: 'category', children: [] as BenefitChoiceNode[] }]));
    for (const c of data.categories) {
        const row = categories.get(c.id)!, parent = categories.get(parents.get(c.id) || '');
        if (parent)
            parent.children.push(row);
        else
            roots.push(row);
    }
    const options = listDeviceModels(data);
    for (const type of data.productTypes.filter(t => t.catalogRole === 'host')) {
        const row: BenefitChoiceNode = { key: rangeKey({ kind: 'type', productTypeId: type.id }), label: type.name + ' · 全部型号', kind: 'type', children: [], range: { kind: 'type', productTypeId: type.id }, reason: type.status === 'enabled' ? '' : '主机类型已停用' };
        const category = categories.get(type.categoryId);
        if (!category)
            continue;
        category.children.push(row);
        for (const model of data.specCanvases.filter(m => m.productTypeId === type.id)) {
            const modelRow: BenefitChoiceNode = { key: 'model:' + model.templateId, label: model.name || model.templateId, kind: 'model', children: [] };
            row.children.push(modelRow);
            const versions = data.specModelVersions.filter(v => v.templateId === model.templateId && v.status === 'published').sort((a, b) => b.version - a.version);
            if (!versions.length)
                modelRow.reason = '仅有草稿或无有效发布快照，请先发布商品模型';
            for (const version of versions) {
                const range: BenefitHostRange = { kind: 'snapshot', modelId: model.templateId, versionId: version.id };
                const result = benefitSnapshotHosts(data, model.templateId, version.id);
                const versionRow: BenefitChoiceNode = { key: rangeKey(range), label: version.versionName + ' · 完整范围', kind: 'snapshot', range, reason: result.issue, children: [] };
                modelRow.children.push(versionRow);
                const allowed = new Set(result.entries.flatMap(e => e.nodeIds));
                const nodes = new Map<string, BenefitChoiceNode>();
                for (const n of version.nodesSnapshot.filter(n => allowed.has(n.id))) {
                    const ref: BenefitHostRange = { ...range, nodeId: n.id };
                    nodes.set(n.id, { key: rangeKey(ref), label: n.nodeType === 'VALUE' ? n.valueId : data.params.find(p => p.id === n.attributeId)?.name || n.attributeId, kind: n.nodeType, children: [], ...(n.nodeType === 'VALUE' ? { range: ref } : { reason: '属性名称用于定位，请选择下面的范围' }) });
                }
                for (const n of version.nodesSnapshot) {
                    const child = nodes.get(n.id);
                    if (!child)
                        continue;
                    const parent = nodes.get(n.parentId || '');
                    (parent || versionRow).children.push(child);
                }
            }
        }
        for (const option of options.filter(o => o.host.productTypeId === type.id && !data.specCanvases.some(m => m.templateId === o.host.productModelId))) {
            const range: BenefitHostRange = { kind: 'host', hostKey: option.key };
            row.children.push({ key: rangeKey(range), label: option.label, kind: 'host', range, children: [] });
        }
    }
    const prune = (rows: BenefitChoiceNode[]): BenefitChoiceNode[] => rows.flatMap(r => {
        const children = prune(r.children);
        return r.kind === 'category' && !children.length ? [] : [{ ...r, children }];
    });
    return prune(roots);
}
