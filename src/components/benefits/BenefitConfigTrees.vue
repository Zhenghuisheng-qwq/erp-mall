<template>
  <div class="config-trees">
    <section>
      <h3>2. 从合法候选中选择配件类型</h3>
      <el-input v-model="accessorySearch" placeholder="搜索配件分类或类型" clearable />
      <el-tree ref="accessoryTree" :data="accessories" node-key="key" default-expand-all :expand-on-click-node="false" :filter-node-method="filter" class="picker-tree">
        <template #default="{data:node}">
          <span v-if="node.kind==='sku'" :data-benefit-range-sku="node.key.slice(4)">{{node.label}}</span>
          <el-checkbox v-else :model-value="checked(node)" :indeterminate="partial(node)" :disabled="disabled || !node.typeIds?.length || !!node.reason" :data-benefit-type-choice="node.key" @change="toggleTypes(node)">
            <el-icon>
              <Folder v-if="node.kind==='category'"/>
              <CollectionTag v-else/>
            </el-icon>
            {{node.label}}
            <small v-if="node.kind==='product-type'">类型</small>
          </el-checkbox>
          <span v-if="node.reason" class="reason" :title="node.reason">{{node.reason}}</span>
        </template>
      </el-tree>
      <p class="hint">先确定主机范围，才能勾选有合法 SKU 的类型。分类批量勾选只选择当前合法类型。新增 SKU 可动态出现，后建产品类型不会自动加入。</p>
    </section>
    <section class="host-picker">
      <h3>1. 确定适用主机范围</h3>
      <el-input v-model="hostSearch" placeholder="搜索主机类型、模型或分支" clearable />
      <el-tree ref="hostTree" :data="hosts" node-key="key" default-expand-all :expand-on-click-node="false" :filter-node-method="filter" class="picker-tree">
        <template #default="{data:node}">
          <el-checkbox v-if="node.range" :model-value="rangeChecked(node)" :indeterminate="rangePartial(node)" :disabled="disabled || !!node.reason || covered(node)" :data-benefit-host-choice="node.key" @change="toggleRange(node)">{{node.label}}</el-checkbox>
          <span v-else>{{node.label}}</span>
          <span v-if="node.reason" class="reason" :title="node.reason">{{node.reason}}</span>
          <small v-else-if="covered(node)">已由父范围覆盖</small>
        </template>
      </el-tree>
      <p class="hint">多个范围取并集。类型包含未来型号；模型／分支只覆盖选定发布快照的型号。容量、颜色不作为范围。</p>
    </section>
  </div>

</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElTree } from 'element-plus';
import { Folder, CollectionTag } from '@element-plus/icons-vue';
import type { BenefitTypeAvailability } from '../../domain/benefits/query';
import type { AppData } from '../../domain/types';
import type { CatalogTypeRow } from '../../domain/catalogWorkspaceQuery';
import type { BenefitHostRange } from '../../domain/benefits/types';
import { benefitAccessoryTree, benefitHostTree, rangeKey, type BenefitChoiceNode } from '../../domain/benefits/trees';
import { compactBenefitRanges, resolveBenefitRange } from '../../domain/benefits/scope';
const props = defineProps<{
    data: AppData;
    types: CatalogTypeRow[];
    categoryId: string;
    typeIds: string[];
    ranges: BenefitHostRange[];
    disabled: boolean;
    availability: Map<string, BenefitTypeAvailability>;
}>();
const emit = defineEmits<{
    types: [
        ids: string[]
    ];
    ranges: [
        ranges: BenefitHostRange[]
    ];
}>();
const accessorySearch = ref(''), hostSearch = ref(''), accessoryTree = ref<InstanceType<typeof ElTree>>(), hostTree = ref<InstanceType<typeof ElTree>>();
const accessories = computed(() => benefitAccessoryTree(props.data, props.types, props.categoryId, props.availability)), hosts = computed(() => benefitHostTree(props.data));
const filter = (text: string, node: Record<string, unknown>) => !text || `${node.label} ${node.key}`.toLowerCase().includes(text.toLowerCase());
// Search expansion runs only when the query changes; it doesn't override manual collapse.
watch(accessorySearch, text => accessoryTree.value?.filter(text));
watch(hostSearch, text => hostTree.value?.filter(text));
const checked = (n: BenefitChoiceNode) => !!n.typeIds?.length && n.typeIds.every(id => props.typeIds.includes(id));
const partial = (n: BenefitChoiceNode) => !checked(n) && !!n.typeIds?.some(id => props.typeIds.includes(id));
function toggleTypes(n: BenefitChoiceNode) {
    const ids = n.typeIds || [];
    emit('types', checked(n) ? props.typeIds.filter(id => !ids.includes(id)) : [...new Set([...props.typeIds, ...ids])]);
}
const exact = (n: BenefitChoiceNode) => !!n.range && props.ranges.some(r => rangeKey(r) === rangeKey(n.range!));
function covered(n: BenefitChoiceNode) {
    if (!n.range || exact(n))
        return false;
    const target = resolveBenefitRange(props.data, n.range);
    return props.ranges.some(r => {
        const parent = resolveBenefitRange(props.data, r);
        return !parent.issue && !target.issue && (r.kind === 'type' ? parent.typeId === target.typeId : n.range!.kind !== 'type' && target.keys.length > 0 && target.keys.every(k => parent.keys.includes(k)));
    });
}
const rangeChecked = (n: BenefitChoiceNode) => exact(n) || covered(n);
function rangePartial(n: BenefitChoiceNode) {
    if (!n.range || rangeChecked(n))
        return false;
    const target = resolveBenefitRange(props.data, n.range);
    return props.ranges.some(r => {
        const selected = resolveBenefitRange(props.data, r);
        return n.range!.kind === 'type' ? selected.typeId === target.typeId : selected.keys.some(k => target.keys.includes(k));
    });
}
function toggleRange(n: BenefitChoiceNode) {
    if (!n.range)
        return;
    emit('ranges', compactBenefitRanges(props.data, exact(n) ? props.ranges.filter(r => rangeKey(r) !== rangeKey(n.range!)) : [n.range, ...props.ranges]));
}
</script>
<style scoped>
.config-trees{display:grid;grid-template-columns:1fr 1fr;gap:24px}.host-picker{order:-1}.config-trees section{min-width:0}.picker-tree{height:330px;overflow:auto;margin-top:12px;border:1px solid var(--el-border-color-light);padding:8px}.reason,.hint,small{color:var(--el-text-color-secondary);font-size:12px}.reason{margin-left:12px}.hint{line-height:1.7}.el-checkbox{height:auto;min-height:30px}.el-icon{vertical-align:middle}.picker-tree :deep(.el-tree-node__content){width:max-content;min-width:100%}@media(max-width:850px){.config-trees{grid-template-columns:1fr}}
</style>
