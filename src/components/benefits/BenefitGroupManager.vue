<template>
  <section class="panel" data-benefit-manager>
    <div class="list-head">
      <h2>{{caption}}</h2>
      <el-button v-if="store.can('product:benefit-group:create')" data-new-benefit-group type="primary" @click="start()">新建权益包</el-button>
    </div>
    <p v-if="scopeTypeId">按包含类型筛选；权益包仍归属于分类。</p>
    <p v-if="modelId" class="hint">主机模型上下文：{{modelName}}。配件归属分类需单独选择，不会自动使用主机分类。</p>
    <el-table :data="groups" empty-text="当前范围没有权益包，点击新建开始配置。">
      <el-table-column label="权益包名称" min-width="150">
        <template #default="{row}">
          <strong>{{row.name}}</strong>
          <p v-for="issue in problems(row)" :key="issue" class="issue">{{issue}}</p>
        </template>
      </el-table-column>
      <el-table-column label="归属分类路径" min-width="140">
        <template #default="{row}">{{categoryLabel(row.categoryId)}}</template>
      </el-table-column>
      <el-table-column label="包含配件类型" min-width="130">
        <template #default="{row}">{{typeNames(row.productTypeIds)}}</template>
      </el-table-column>
      <el-table-column label="适用主机范围" min-width="180">
        <template #default="{row}">{{scopeLabel(row)}}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{row}">{{row.enabled?'启用':'停用'}}</template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{row}">
          <el-button link :data-benefit-group-record="row.id" @click="start(row)">查看／编辑</el-button>
          <el-button v-if="row.enabled&&problems(row).length&&store.can('product:benefit-group:update')" link @click="disable(row)">停用</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-drawer v-model="open" title="配置权益包" size="min(1160px,96vw)" :before-close="closeDrawer" :close-on-click-modal="false" data-benefit-editor>
      <template v-if="draft">
        <el-alert v-if="contextNotice" :title="contextNotice" type="info" :closable="false"/>
        <div class="editor-top">
          <label>权益包名称
            <el-input v-model="draft.name" maxlength="80" aria-label="权益包名称" :disabled="!editable||busy"/>
          </label>
          <label>归属分类
            <CategoryTreeSelect :categories="store.data.categories" :model-value="draft.categoryId||''" :disabled="!editable||busy" placeholder="选择真实配件归属分类" @update:model-value="changeCategory"/>
          </label>
        </div>
        <p class="hint">配件须在归属分类及其后代分类中；适用主机可以在其他分类。没有共同业务父分类时请分别建包或先整理目录。</p>
        <BenefitConfigTrees :data="store.data" :types="types" :category-id="draft.categoryId||''" :type-ids="draft.productTypeIds" :ranges="draft.hostRanges||[]" :disabled="!editable||busy" :availability="availability" @types="draft.productTypeIds=$event" @ranges="setRanges"/>
        <section class="summary">
          <h3>已选内容</h3>
          <p>{{categoryLabel(draft.categoryId)}} · {{draft.productTypeIds.length}} 个配件类型</p>
          <el-tag v-for="id in draft.productTypeIds" :key="id" :closable="editable&&!busy" @close="draft.productTypeIds=draft.productTypeIds.filter(t=>t!==id)">{{typeNames([id])}}</el-tag>
          <p v-if="!draft.hostRanges?.length">尚未选择适用主机范围。</p>
          <div v-for="(range,i) in draft.hostRanges" :key="JSON.stringify(range)">{{rangeLabel(range)}}
            <el-button v-if="editable" link @click="setRanges((draft.hostRanges||[]).filter((_,index)=>index!==i))">移除范围</el-button>
          </div>
          <p v-for="issue in draftProblems" :key="issue" class="issue">{{issue}}</p>
        </section>
        <section class="preview">
          <h3>实际设备预览</h3>
          <p>当前有效范围覆盖 {{coveredCount}} 个型号。仅提供范围内身份明确的设备。</p>
          <el-select v-model="previewKey" filterable clearable aria-label="权益包预览设备" placeholder="选择范围内实际手机或型号" :disabled="!!draftProblems.length">
            <el-option-group label="实际 SKU · 规格级预览">
              <el-option v-for="d in previewOptions.devices" :key="d.id" :value="'sku:'+d.id" :label="d.name+' · '+d.spec"/>
            </el-option-group>
            <el-option-group label="型号级预览">
              <el-option v-for="o in previewOptions.models" :key="o.key" :value="'model:'+o.key" :label="o.label"/>
            </el-option-group>
          </el-select>
          <template v-if="preview">
            <p>{{previewKey.startsWith('sku:')?'实际 SKU 规格级预览':'型号级预览，不替代具体规格条件核验'}} · {{previewRows.length}} 个真实可选 SKU</p>
            <p v-if="!previewRows.length">{{preview.issue|| (preview.candidates.length?'当前包选定类型对该设备没有匹配商品；请核对范围内其他设备。':emptyReason(preview))}}</p>
            <div v-for="item in previewRows" :key="item.sku.id" :data-benefit-preview-sku="item.sku.id">{{item.name}} · {{item.spec}} · 基本使用已确认适用</div>
            <details v-if="canDiagnose" class="diagnostics">
              <summary>核对未出现的配件</summary>
              <el-select v-model="diagnosticId" filterable clearable placeholder="选择真实配件" aria-label="配置核对配件">
                <el-option v-for="sku in diagnosticAccessories" :key="sku.id" :value="sku.id" :label="benefitSkuLabel(store.data,sku.id).name+' · '+sku.code"/>
              </el-select>
              <p v-if="diagnosticId">{{benefitAccessoryReason(store.data,preview,diagnosticId)}}
                <el-button link @click="diagnose">查看／维护适用依据</el-button>
              </p>
            </details>
          </template>
        </section>
        <details class="secondary">
          <summary>启用与排序</summary>
          <el-switch v-model="draft.enabled" active-text="启用" :disabled="!editable||busy"/>
          <el-input-number v-model="draft.sort" :min="0" :max="9999" :precision="0" aria-label="权益包排序" :disabled="!editable||busy"/>
        </details>
        <el-alert v-if="error" :title="error" type="error" :closable="false"/>
      </template>
      <template #footer>
        <el-button @click="closeDrawer()">取消／关闭</el-button>
        <el-button v-if="editable" type="primary" :loading="busy" :disabled="!!draftProblems.length || !draft?.name.trim()" data-save-benefit-group @click="save">保存权益包</el-button>
      </template>
    </el-drawer>
  </section>

</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import CategoryTreeSelect from '../CategoryTreeSelect.vue';
import BenefitConfigTrees from './BenefitConfigTrees.vue';
import { useCatalogStore } from '../../stores/catalog';
import type { CatalogTypeRow } from '../../domain/catalogWorkspaceQuery';
import type { BenefitGroup, BenefitGroupInput, BenefitHostRange } from '../../domain/benefits/types';
import { benefitCandidates, benefitGroupCandidates, benefitPreviewDevices, benefitEmptyReason, benefitNodeHosts, benefitRangeAvailability, benefitConfigurationImpact, benefitSkuLabel, benefitAccessoryReason } from '../../domain/benefits/query';
import { benefitCategoryLabel, categoryContains, benefitGroupProblems, benefitLegacyRanges, benefitRangeLabel, compactBenefitRanges, resolveBenefitRange } from '../../domain/benefits/scope';
import { managementDraft } from './managementDraft';
import { isRealSku } from '../../domain/catalogIdentity';
import { compatibilityRecordRole } from '../../domain/deviceResolution';
import { benefitClone } from '../../domain/benefits/selection';
const props = defineProps<{
    categoryId: string;
    scopeTypeId: string;
    types: CatalogTypeRow[];
    modelId: string;
    versionId: string;
    nodeId: string;
    initialHostKey: string;
}>();
const store = useCatalogStore(), route = useRoute(), router = useRouter();
const owner = () => store.activeUserId + '/' + store.previewUserId;
const diagnosticId = ref('');
const canDiagnose = computed(() => store.can('product:compatibility:read') && (store.can('product:compatibility:update') || store.can('product:benefit-group:update')));
const diagnosticAccessories = computed(() => store.data.skus.filter(s => isRealSku(store.data, s) && compatibilityRecordRole(store.data, s.id) === 'accessory'));
const draft = ref<BenefitGroupInput>(), open = ref(false), revision = ref(0), initial = ref(''), busy = ref(false), error = ref(''), contextNotice = ref(''), previewKey = ref('');
const signature = () => JSON.stringify(draft.value), dirty = computed(() => open.value && signature() !== initial.value);
const editable = computed(() => store.can(draft.value?.id ? 'product:benefit-group:update' : 'product:benefit-group:create'));
const categoryLabel = (id?: string) => benefitCategoryLabel(store.data, id);
const typeNames = (ids: string[]) => ids.map(id => store.data.productTypes.find(t => t.id === id)?.name || `失效类型 ${id}`).join('、');
const rangeLabel = (r: BenefitHostRange) => benefitRangeLabel(store.data, r);
const problems = (g: BenefitGroup) => [...benefitGroupProblems(store.data, g), ...benefitConfigurationImpact(store.data, g.categoryId || '', g.hostRanges || [], g.productTypeIds).remove.map(id => typeNames([id]) + '：当前范围没有合法候选')];
const scopeLabel = (g: BenefitGroup) => g.hostRanges?.map(rangeLabel).join('；') || (g.scope ? `待补充配置 · 原模型 ${store.data.specCanvases.find(m => m.templateId === g.scope?.modelId)?.name || g.scope.modelId}${g.scope.hostKey ? '（明确型号）' : ''}` : '待补充配置');
const modelName = computed(() => store.data.specCanvases.find(m => m.templateId === props.modelId)?.name || props.modelId);
const caption = computed(() => props.scopeTypeId ? `${categoryLabel(store.data.productTypes.find(t => t.id === props.scopeTypeId)?.categoryId)} / ${typeNames([props.scopeTypeId])} · 按包含类型筛选` : props.categoryId ? `${categoryLabel(props.categoryId)} · 本分类及后代分类` : '全部分类 · 权益包');
const groups = computed(() => (store.data.benefitGroups || []).filter(g => (!props.categoryId || !!g.categoryId && categoryContains(store.data, props.categoryId, g.categoryId)) && (!props.scopeTypeId || g.productTypeIds.includes(props.scopeTypeId))).sort((a, b) => a.sort - b.sort));
const current = computed<BenefitGroup>(() => ({ ...draft.value!, revision: revision.value, createdAt: '', updatedAt: '' }));
const availability = computed(() => benefitRangeAvailability(store.data, draft.value?.categoryId || '', draft.value?.hostRanges || []));
const draftProblems = computed(() => draft.value ? [...benefitGroupProblems(store.data, draft.value), ...draft.value.productTypeIds.filter(id => !!availability.value.get(id)?.reason || !availability.value.get(id)?.candidates.length).map(id => typeNames([id]) + '：' + (availability.value.get(id)?.reason || '没有合法候选'))] : []);
const coveredCount = computed(() => new Set((draft.value?.hostRanges || []).flatMap(r => resolveBenefitRange(store.data, r).keys)).size);
const previewOptions = computed(() => draft.value ? benefitPreviewDevices(store.data, current.value) : { models: [], devices: [] });
const preview = computed(() => previewKey.value ? benefitCandidates(store.data, previewKey.value.startsWith('sku:') ? { kind: 'sku', skuId: previewKey.value.slice(4) } : { kind: 'model', hostKey: previewKey.value.slice(6) }) : undefined);
const previewRows = computed(() => preview.value ? benefitGroupCandidates(store.data, current.value, preview.value) : []);
const emptyReason = (c: ReturnType<typeof benefitCandidates>) => benefitEmptyReason(store.data, c);
async function discard() {
    if (!dirty.value)
        return true;
    try {
        await ElMessageBox.confirm('放弃未保存的权益包输入？', '未保存权益包', { confirmButtonText: '放弃输入', cancelButtonText: '继续编辑' });
        return true;
    }
    catch {
        return false;
    }
}
async function closeDrawer(done?: () => void) {
    if (busy.value || !await discard())
        return;
    open.value = false;
    done?.();
}
function contextRanges(): BenefitHostRange[] {
    if (props.initialHostKey)
        return [{ kind: 'host', hostKey: props.initialHostKey }];
    if (!props.modelId)
        return [];
    if (!props.versionId) {
        contextNotice.value = '入口是模型草稿。请在主机树中明确选择已发布范围，不会自动使用最新版本。';
        return [];
    }
    const version = store.data.specModelVersions.find(v => v.id === props.versionId && v.templateId === props.modelId && v.status === 'published');
    if (!version || (props.nodeId && !version.nodesSnapshot.some(n => n.id === props.nodeId))) {
        contextNotice.value = '入口版本或节点已失效，请重新选择有效发布范围；不会回退到其他版本。';
        return [];
    }
    const range: BenefitHostRange = { kind: 'snapshot', modelId: props.modelId, versionId: props.versionId, ...(props.nodeId ? { nodeId: props.nodeId } : {}) };
    if (!resolveBenefitRange(store.data, range).issue)
        return [range];
    const hosts = benefitNodeHosts(store.data, props.modelId, props.nodeId, props.versionId);
    if (hosts.length === 1) {
        contextNotice.value = '当前规格节点已定位到明确型号；容量、颜色不建立独立范围。';
        return [{ kind: 'host', hostKey: hosts[0]!.key }];
    }
    contextNotice.value = '入口无法确定有效的已发布型号范围，请在主机树中明确选择。';
    return [];
}
async function start(g?: BenefitGroup) {
    if (!await discard())
        return;
    contextNotice.value = '';
    error.value = '';
    previewKey.value = '';
    const type = store.data.productTypes.find(t => t.id === props.scopeTypeId);
    draft.value = g ? benefitClone({ ...g, hostRanges: benefitLegacyRanges(g) }) : { id: '', name: '', categoryId: type?.categoryId || props.categoryId || '', productTypeIds: [], hostRanges: contextRanges(), enabled: true, sort: 0 };
    if (g?.scope && !g.hostRanges)
        contextNotice.value = `原范围：${scopeLabel(g)}。原名称和类型已保留；请补齐归属分类${g.scope.hostKey ? '' : '，并明确选择发布范围'}后保存。`;
    if (!g && type?.catalogRole === 'accessory') {
        if (availability.value.get(type.id)?.candidates.length && !availability.value.get(type.id)?.reason)
            draft.value.productTypeIds = [type.id];
        else
            contextNotice.value += ' 请先确定主机范围，再选择该目录类型。';
    }
    revision.value = g?.revision || 0;
    initial.value = signature();
    open.value = true;
}
async function changeCategory(value: string | string[]) {
    if (!draft.value || busy.value || !editable.value)
        return;
    const id = String(value), stamp = signature(), impact = benefitConfigurationImpact(store.data, id, draft.value.hostRanges || [], draft.value.productTypeIds);
    if (impact.remove.length) {
        try {
            await ElMessageBox.confirm(`保留：${typeNames(impact.keep) || '无'}。将移除超出范围或已无合法候选的类型：${typeNames(impact.remove)}。`, '变更归属分类', { confirmButtonText: '确认变更', cancelButtonText: '保持原分类' });
        }
        catch {
            return;
        }
    }
    if (signature() !== stamp)
        return;
    draft.value.categoryId = id;
    draft.value.productTypeIds = impact.keep;
}
async function setRanges(ranges: BenefitHostRange[]) {
    if (!draft.value || busy.value || !editable.value)
        return;
    const stamp = signature(), old = draft.value.hostRanges || [];
    const oldKeys = new Set(old.flatMap(r => resolveBenefitRange(store.data, r).keys)), newKeys = new Set(ranges.flatMap(r => resolveBenefitRange(store.data, r).keys));
    const impact = benefitConfigurationImpact(store.data, draft.value.categoryId || '', ranges, draft.value.productTypeIds);
    const refreshing = old.some(r => r.kind === 'snapshot' && ranges.some(n => n.kind === 'snapshot' && n.modelId === r.modelId && n.versionId !== r.versionId));
    if (impact.remove.length || refreshing) {
        try {
            await ElMessageBox.confirm(`范围将新增 ${[...newKeys].filter(k => !oldKeys.has(k)).length} 个型号，移出 ${[...oldKeys].filter(k => !newKeys.has(k)).length} 个型号。保留类型：${typeNames(impact.keep) || '无'}；移除不再有合法候选的类型：${typeNames(impact.remove) || '无'}。`, '变更主机范围', { confirmButtonText: '确认范围并移除失效类型', cancelButtonText: '保持原范围' });
        }
        catch {
            return;
        }
    }
    if (signature() !== stamp)
        return;
    draft.value.hostRanges = compactBenefitRanges(store.data, ranges);
    draft.value.productTypeIds = impact.keep;
}
async function save() {
    if (!draft.value || busy.value || !editable.value)
        return;
    busy.value = true;
    error.value = '';
    const stamp = signature();
    try {
        const result = await store.saveBenefitGroup(benefitClone(draft.value), revision.value, () => signature() === stamp);
        if (!result.ok) {
            error.value = result.message || '保存失败，输入保留';
            return;
        }
        if (result.record) {
            draft.value = benefitClone(result.record);
            revision.value = result.record.revision;
            initial.value = signature();
            ElMessage.success('权益包已保存');
        }
    }
    catch (e) {
        error.value = String(e);
    }
    finally {
        busy.value = false;
    }
}
async function disable(g: BenefitGroup) {
    const result = await store.saveBenefitGroup({ ...benefitClone(g), enabled: false }, g.revision);
    if (result.ok)
        ElMessage.success('已停用');
    else
        ElMessage.error(result.message || '停用失败');
}
watch(previewOptions, options => {
    const valid = previewKey.value.startsWith('sku:') ? options.devices.some(d => 'sku:' + d.id === previewKey.value) : options.models.some(m => 'model:' + m.key === previewKey.value);
    if (!valid)
        previewKey.value = '';
});
watch(() => [store.activeUserId, store.previewUserId], () => {
    open.value = false;
    draft.value = undefined;
    managementDraft.current = undefined;
});
function diagnose() {
    if (!canDiagnose.value || !previewKey.value)
        return;
    router.push({ path: '/compatibility', query: { ...(previewKey.value.startsWith('sku:') ? { device: previewKey.value.slice(4) } : { deviceModel: previewKey.value.slice(6) }), targetId: diagnosticId.value, returnTo: route.fullPath } });
}
onBeforeRouteLeave(async (to) => {
    if (busy.value)
        return false;
    if (to.path === '/compatibility' && draft.value && canDiagnose.value) {
        managementDraft.current = { owner: owner(), route: route.fullPath, draft: benefitClone(draft.value), revision: revision.value, initial: initial.value, previewKey: previewKey.value, notice: contextNotice.value, diagnosticId: diagnosticId.value };
        return true;
    }
    if (!await discard())
        return false;
    managementDraft.current = undefined;
    return true;
});
onBeforeRouteUpdate(async () => {
    if (busy.value || !await discard())
        return false;
    open.value = false;
    draft.value = undefined;
    return true;
});
const restored = managementDraft.current;
if (restored && restored.owner === owner() && restored.route === route.fullPath) {
    draft.value = benefitClone(restored.draft);
    revision.value = restored.revision;
    initial.value = restored.initial;
    previewKey.value = restored.previewKey;
    contextNotice.value = restored.notice;
    diagnosticId.value = restored.diagnosticId;
    open.value = true;
}
managementDraft.current = undefined;
function beforeUnload(e: BeforeUnloadEvent) {
    if (dirty.value) {
        e.preventDefault();
        e.returnValue = '';
    }
}
window.addEventListener('beforeunload', beforeUnload);
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
</script>
<style scoped>
.list-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.editor-top{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:16px 0}.editor-top label{display:grid;gap:8px}.hint{font-size:13px;color:var(--el-text-color-secondary);line-height:1.7}.issue{font-size:12px;color:var(--el-color-warning-dark-2);line-height:1.6}.summary,.preview,.secondary{margin:20px 0;padding-top:12px;border-top:1px solid var(--el-border-color-light)}.summary .el-tag{margin:4px}.preview>.el-select{width:100%}.preview>div{padding:8px 0}.secondary .el-switch{margin-right:24px}h2{font-size:18px}h3{font-size:16px}@media(max-width:850px){.editor-top{grid-template-columns:1fr}}
</style>
