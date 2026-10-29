<template>
  <div class="benefit-shopping" data-benefit-shopping>
    <PageHead title="权益包选购" desc="选择使用设备，直接添加已确认可用的配件。无需先配置权益包。">
      <el-button @click="recordsOpen=true">已保存清单</el-button>
      <el-button @click="newList">新建清单</el-button>
      <el-button v-if="store.canRoute({path:'/benefits/manage'})" @click="router.push('/benefits/manage')">权益包管理</el-button>
    </PageHead>
    <el-alert v-if="error" :title="error" type="error" :closable="false" data-benefit-error/>
    <template v-if="state.confirmed?.snapshot">
      <section class="panel" data-benefit-confirmed>
        <h2>已确认清单 · 只读快照</h2>
        <p>{{state.confirmed.snapshot.device.label}} · {{state.confirmed.snapshot.device.spec}}</p>
        <p>{{state.confirmed.snapshot.confirmedAt}} · 确认内容不代表付款、扣库存或发货。</p>
        <article v-for="l in state.confirmed.snapshot.lines" :key="l.skuId" class="selected-row">
          <strong>{{l.name}}</strong>
          <p>{{l.spec}}</p>
          <p>{{l.quantity}} 件 × {{money(l.unitPriceCents)}} = {{money(l.quantity*(l.unitPriceCents||0))}}</p>
          <details v-if="l.declarations.length">
            <summary>确认时的适用依据</summary>
            <p v-for="d in l.declarations" :key="d.id">{{d.source||d.note}} · {{d.capability==='fast-charge'?'快充':'基本使用'}} · {{d.verification==='pending'?'待核验':'已核验'}}</p>
          </details>
        </article>
        <h3>报价合计 {{money(state.confirmed.snapshot.totalCents)}}</h3>
        <el-button v-if="canCreate" data-copy-benefit-selection @click="copyConfirmed">复制为新草稿</el-button>
      </section>
    </template>
    <template v-else>
      <section class="panel device-panel">
        <h2>本次使用设备</h2>
        <el-select :model-value="deviceKey" filterable clearable placeholder="搜索手机、规格、分类或产品类型" aria-label="选购使用设备" data-benefit-device @change="requestDevice">
          <el-option-group label="实际手机（含客户自有、停售设备）">
            <el-option v-for="d in devices" :key="d.id" :value="'sku:'+d.id" :label="`${d.name} · ${d.spec} · ${d.typeName} · ${d.categoryName}${d.offSale?' · 仅作使用设备':''}`"/>
          </el-option-group>
          <el-option-group label="客户自有型号（型号级依据）">
            <el-option v-for="o in models" :key="o.key" :value="'model:'+o.key" :label="o.label+' · '+o.productTypeName"/>
          </el-option-group>
        </el-select>
        <template v-if="context">
          <p>{{context.label.name}} · {{context.label.spec}}</p>
          <p v-if="state.draft?.device.kind==='model'" class="muted">仅按型号级依据查询；涉及容量、颜色或其他具体规格条件时，请选择实际手机 SKU。</p>
          <p v-if="context.issue" role="alert">{{context.issue}}</p>
          <el-button v-if="state.draft?.device.kind==='sku'&&canEdit" :disabled="!!phoneProblem" data-benefit-add-phone @click="add(state.draft.device.skuId)">加入手机</el-button>
          <span v-if="phoneProblem" class="muted"> {{phoneProblem}}，仍可作为客户自有使用设备。</span>
          <el-button v-if="canDiagnose" link @click="diagnose()">查看适用依据／维护设备身份</el-button>
        </template>
      </section>
      <div v-if="context" class="shopping-columns">
        <section class="panel candidates">
          <h2>可选商品</h2>
          <div class="group-tabs">
            <el-button :type="!state.groupId?'primary':'default'" @click="state.groupId=''">全部可选商品</el-button>
            <el-button v-for="g in groups" :key="g.id" :data-benefit-group="g.id" :type="state.groupId===g.id?'primary':'default'" @click="state.groupId=g.id">{{g.name}}</el-button>
          </div>
          <el-input v-model="state.search" placeholder="搜索可选配件" clearable aria-label="搜索可选配件"/>
          <p v-if="!rows.length">{{emptyMessage}}
            <el-button v-if="state.search.trim()" link @click="state.search=''">清空搜索</el-button>
            <el-button v-if="canDiagnose" link @click="diagnose()">查看原因</el-button>
          </p>
          <section v-for="g in candidateGroups" :key="g.id">
            <h3>{{g.name}}
              <small>{{g.rows.length}}</small>
            </h3>
            <article v-for="item in g.rows" :key="item.sku.id" class="candidate-row" :data-benefit-candidate="item.sku.id">
              <div>
                <strong>{{item.name}}</strong>
                <p>{{item.spec}}</p>
                <el-tag type="success" size="small">基本使用已确认适用</el-tag>
                <small v-if="fastLabel(item)" class="fast">{{fastLabel(item)}}</small>
              </div>
              <el-button v-if="canEdit" type="primary" plain :data-benefit-add="item.sku.id" @click="add(item.sku.id)">添加</el-button>
            </article>
          </section>
          <details v-if="canDiagnose" class="diagnostics">
            <summary>管理侧核对原因</summary>
            <el-select v-model="diagnosticId" filterable clearable placeholder="选择真实配件，核对未出现的原因" aria-label="核对配件">
              <el-option v-for="sku in diagnosticAccessories" :key="sku.id" :value="sku.id" :label="label(sku.id).name+' · '+sku.code"/>
            </el-select>
            <p v-if="diagnosticReason">{{diagnosticReason}}
              <el-button link @click="diagnose(diagnosticId)">查看该配件依据</el-button>
            </p>
            <p>下列是当前设备实际查询到的记录，分开列出，不代表全部商品数量。</p>
            <p v-for="item in diagnostics" :key="item.id">{{item.name}}：{{item.reason}}
              <el-button link @click="diagnose(item.id)">查看依据</el-button>
            </p>
            <p v-for="issue in context.query.issues" :key="issue.declarationId||issue.message">{{issue.message}}</p>
          </details>
        </section>
        <section class="panel selection">
          <h2>本次已选 {{state.draft?.lines.length||0}} 款</h2>
          <p class="muted">选择设备不会自动购买手机；报价为本次单件报价。</p>
          <p v-if="!state.draft?.lines.length">从左侧添加商品。</p>
          <article v-for="l in state.draft?.lines||[]" :key="l.skuId" class="selected-row" :data-benefit-line="l.skuId">
            <strong>{{label(l.skuId).name}}</strong>
            <p>{{label(l.skuId).spec}}</p>
            <p v-if="lineIssue(l.skuId)" class="error">{{lineIssue(l.skuId)}}</p>
            <div class="line-controls">
              <label>数量
                <el-input-number :model-value="l.quantity" :min="1" :max="9999" :precision="0" :disabled="!canEdit||busy" :aria-label="'数量 '+label(l.skuId).name" @change="(q:number|undefined)=>quantity(l.skuId,q)"/>
              </label>
              <label>单价（元）
                <el-input :model-value="state.prices[l.skuId]??priceText(l.unitPriceCents)" :disabled="!canEdit||busy" :aria-label="'报价 '+label(l.skuId).name" placeholder="待报价" @update:model-value="(v:string)=>price(l.skuId,String(v))"/>
              </label>
            </div>
            <p>行金额：{{l.unitPriceCents===null?'待报价':money(l.quantity*l.unitPriceCents)}}</p>
            <el-button v-if="canEdit" link type="danger" @click="remove(l.skuId)">移除</el-button>
          </article>
          <h3>{{invalidPrices?'报价有待修正':total.complete?'报价合计 '+money(total.cents):'待报价（部分商品尚未报价）'}}</h3>
          <p v-if="!total.complete">已报价部分 {{money(total.cents)}}，不作为完整应付金额。</p>
          <p v-if="review?.issues.length" class="error">{{review.issues.length}} 项需要处理，原数量和报价已保留。</p>
          <div class="actions">
            <el-button v-if="canEdit" :loading="busy" data-benefit-save-draft @click="save('draft')">保存草稿</el-button>
            <el-button v-if="canEdit&&store.can('product:benefit-selection:confirm')" type="primary" :loading="busy" :disabled="invalidPrices||!total.complete||!!review?.issues.length||!state.draft?.lines.length" data-benefit-confirm @click="save('confirmed')">确认清单</el-button>
          </div>
        </section>
      </div>
    </template>
    <el-dialog v-model="changeOpen" title="更换使用设备" width="min(620px,94vw)" :close-on-click-modal="false" data-benefit-device-change>
      <template v-if="change">
        <p>可保留 {{change.keep.length}} 款，保留原数量和报价。</p>
        <p v-for="l in change.keep" :key="l.skuId">保留：{{label(l.skuId).name}} · {{l.quantity}} 件</p>
        <p v-for="r in change.remove" :key="r.line.skuId">移除：{{r.name}} · {{r.line.quantity}} 件 — {{r.reason}}</p>
        <p v-if="change.issue" class="error">{{change.issue}}</p>
      </template>
      <template #footer>
        <el-button @click="changeOpen=false">取消更换</el-button>
        <el-button type="primary" :disabled="!!change?.issue" data-apply-benefit-device @click="applyDevice">确认更换</el-button>
      </template>
    </el-dialog>
    <el-drawer v-model="recordsOpen" title="已保存清单" size="min(680px,96vw)">
      <p v-if="!saved.length">还没有保存的清单。</p>
      <article v-for="r in saved" :key="r.id" class="selected-row">
        <strong>{{r.snapshot?.device.label||deviceName(r.device)}}</strong>
        <p>{{r.status==='confirmed'?'已确认':'草稿'}} · {{r.lines.length}} 款 · {{r.updatedAt}}</p>
        <el-button :data-open-benefit-selection="r.id" @click="openRecord(r)">查看{{r.status==='draft'?'／继续编辑':''}}</el-button>
      </article>
    </el-drawer>
  </div>

</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHead from '../components/PageHead.vue';
import { useCatalogStore } from '../stores/catalog';
import { benefitShoppingState as state, clearBenefitShopping } from '../components/benefits/shoppingState';
import { benefitCandidates, benefitDevices, benefitSkuLabel, applicableBenefitGroups, sellableSkuProblem, benefitGroupCandidates, benefitAccessoryReason, benefitEmptyReason } from '../domain/benefits/query';
import { benefitClone, addBenefitLine, benefitAdmission, previewBenefitDeviceChange, reviewBenefitSelection, benefitTotal, parseBenefitPrice } from '../domain/benefits/selection';
import { accessoryUseEvaluation } from '../domain/accessoryCompatibilityQuery';
import { isRealSku } from '../domain/catalogIdentity';
import { compatibilityRecordRole } from '../domain/deviceResolution';
import { listDeviceModels } from '../domain/deviceResolution';
import type { AccessoryMatch } from '../domain/accessoryCompatibilityTypes';
import type { BenefitDevice, BenefitSelection } from '../domain/benefits/types';
const store = useCatalogStore(), route = useRoute(), router = useRouter(), error = ref(''), busy = ref(false), recordsOpen = ref(false), changeOpen = ref(false), pendingDevice = ref<BenefitDevice>(), change = ref<ReturnType<typeof previewBenefitDeviceChange>>();
const owner = () => `${store.activeUserId}/${store.previewUserId}`, signature = () => JSON.stringify([state.draft, state.prices]), dirty = computed(() => !!state.draft && signature() !== state.initial);
const canCreate = computed(() => store.can('product:benefit-selection:create')), canEdit = computed(() => !state.confirmed && store.can(state.draft?.id ? 'product:benefit-selection:update' : 'product:benefit-selection:create'));
const canDiagnose = computed(() => store.can('product:compatibility:read') && (store.can('product:compatibility:update') || store.can('product:benefit-group:update')));
const devices = computed(() => benefitDevices(store.data)), models = computed(() => listDeviceModels(store.data)), context = computed(() => state.draft ? benefitCandidates(store.data, state.draft.device) : undefined);
const review = computed(() => state.draft ? reviewBenefitSelection(store.data, state.draft) : undefined);
const groups = computed(() => context.value ? applicableBenefitGroups(store.data, context.value) : []), selectedGroup = computed(() => groups.value.find(g => g.id === state.groupId));
const unsearchedRows = computed(() => !context.value ? [] : selectedGroup.value ? benefitGroupCandidates(store.data, selectedGroup.value, context.value) : context.value.candidates);
const rows = computed(() => unsearchedRows.value.filter(c => !state.search.trim() || `${c.name} ${c.spec} ${c.code}`.toLowerCase().includes(state.search.trim().toLowerCase())));
const emptyMessage = computed(() => context.value?.issue || (state.search.trim() && unsearchedRows.value.length ? '搜索没有匹配结果。' : selectedGroup.value ? '当前权益包选定类型没有匹配商品；可查看全部可选商品。' : context.value ? benefitEmptyReason(store.data, context.value) : ''));
const candidateGroups = computed(() => [...new Set(rows.value.map(c => c.productTypeId))].map(id => ({ id, name: rows.value.find(c => c.productTypeId === id)!.productTypeName, rows: rows.value.filter(c => c.productTypeId === id) })));
const diagnosticId = ref('');
const diagnosticAccessories = computed(() => store.data.skus.filter(s => isRealSku(store.data, s) && compatibilityRecordRole(store.data, s.id) === 'accessory'));
const diagnosticReason = computed(() => context.value && diagnosticId.value ? benefitAccessoryReason(store.data, context.value, diagnosticId.value) : '');
const diagnostics = computed(() => context.value ? [...context.value.query.sales, ...context.value.query.materials, ...context.value.query.pending, ...context.value.query.excluded, ...context.value.query.unavailable].filter(c => !context.value!.candidates.some(s => s.sku.id === c.sku.id)).map(c => ({ id: c.sku.id, name: c.name, reason: benefitAccessoryReason(store.data, context.value!, c.sku.id) })) : []);
const invalidPrices = computed(() => Object.values(state.prices).some(v => parseBenefitPrice(v) === undefined));
const total = computed(() => benefitTotal(state.draft?.lines || [])), saved = computed(() => (store.data.benefitSelections || []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const phoneProblem = computed(() => state.draft?.device.kind === 'sku' ? sellableSkuProblem(store.data, state.draft.device.skuId, 'host') : '');
const deviceKey = computed(() => !state.draft ? '' : state.draft.device.kind === 'sku' ? 'sku:' + state.draft.device.skuId : 'model:' + state.draft.device.hostKey);
const label = (id: string) => benefitSkuLabel(store.data, id), priceText = (c: number | null) => c === null ? '' : (c / 100).toFixed(2), money = (c: number | null) => c === null ? '待报价' : '¥' + (c / 100).toFixed(2), lineIssue = (id: string) => review.value?.issues.find(i => i.skuId === id)?.message;
const deviceName = (d: BenefitDevice) => d.kind === 'sku' ? label(d.skuId).name : models.value.find(o => o.key === d.hostKey)?.label || '设备已失效';
function fastLabel(m: AccessoryMatch) {
    const f = accessoryUseEvaluation(m).fastCharge;
    return !f.declarations.length ? '' : f.conflict ? '快充存在冲突' : f.status === 'compatible' ? '快充已确认' : f.status === 'incompatible' ? '不支持快充' : '快充需核验';
}
function add(id: string) {
    if (!state.draft || !canEdit.value || busy.value)
        return;
    const r = addBenefitLine(store.data, state.draft.device, state.draft.lines, id);
    if (!r.ok) {
        error.value = r.message || '不能添加';
        return;
    }
    state.draft.lines = r.lines;
    error.value = '';
}
function quantity(id: string, q: number | undefined) {
    const l = state.draft?.lines.find(l => l.skuId === id);
    if (!l || q === undefined || !canEdit.value)
        return;
    if (q > l.quantity) {
        const problem = benefitAdmission(store.data, state.draft!.device, id);
        if (problem) {
            error.value = problem;
            return;
        }
    }
    l.quantity = q;
}
function price(id: string, text: string) {
    const l = state.draft?.lines.find(l => l.skuId === id), c = parseBenefitPrice(text);
    if (!l || !canEdit.value)
        return;
    state.prices[id] = text;
    if (c === undefined) {
        error.value = '报价须为非负金额，最多两位小数；请修正后再保存';
        return;
    }
    l.unitPriceCents = c;
    error.value = '';
}
function remove(id: string) {
    if (state.draft && canEdit.value) {
        state.draft.lines = state.draft.lines.filter(l => l.skuId !== id);
        delete state.prices[id];
    }
}
let navigationDecision: ((accept: boolean) => void) | undefined;
function parseDevice(key: string): BenefitDevice {
    return key.startsWith('sku:') ? { kind: 'sku', skuId: key.slice(4) } : { kind: 'model', hostKey: key.slice(6) };
}
function stageDevice(next: BenefitDevice) {
    pendingDevice.value = next;
    change.value = previewBenefitDeviceChange(store.data, state.draft!.device, next, state.draft!.lines);
    changeOpen.value = true;
}
function syncDeviceUrl() {
    if (!state.draft)
        return;
    const query = { ...route.query };
    delete query.device;
    if (state.draft.device.kind === 'sku')
        query.device = state.draft.device.skuId;
    state.routeToken = typeof query.device === 'string' ? query.device : '';
    void router.replace({ path: route.path, query });
}
function requestDevice(key: string, sync = true) {
    if (busy.value)
        return;
    if (!key) {
        if (state.draft?.lines.length) {
            error.value = '请更换为明确设备，或新建清单';
            return;
        }
        state.draft = undefined;
        return;
    }
    const next = parseDevice(key);
    if (JSON.stringify(next) === JSON.stringify(state.draft?.device))
        return;
    if (state.draft?.lines.length) {
        stageDevice(next);
        return;
    }
    state.draft = { id: '', device: next, lines: [], status: 'draft' };
    state.prices = {};
    state.revision = 0;
    state.groupId = '';
    error.value = '';
    if (sync)
        syncDeviceUrl();
}
function applyDevice() {
    if (!state.draft || !pendingDevice.value)
        return;
    const current = previewBenefitDeviceChange(store.data, state.draft.device, pendingDevice.value, state.draft.lines);
    if (current.issue)
        return;
    if (JSON.stringify(current) !== JSON.stringify(change.value)) {
        change.value = current;
        error.value = '数据已变化，请重新核对更换影响';
        return;
    }
    state.draft.device = benefitClone(pendingDevice.value);
    state.draft.lines = current.keep;
    for (const r of current.remove)
        delete state.prices[r.line.skuId];
    state.groupId = '';
    error.value = '';
    const decision = navigationDecision;
    navigationDecision = undefined;
    if (decision)
        decision(true);
    else
        syncDeviceUrl();
    changeOpen.value = false;
}
watch(changeOpen, value => {
    if (!value && navigationDecision) {
        navigationDecision(false);
        navigationDecision = undefined;
    }
});
async function discard() {
    if (!dirty.value)
        return true;
    try {
        await ElMessageBox.confirm('放弃当前未保存的清单输入？', '未保存清单', { confirmButtonText: '放弃输入', cancelButtonText: '继续编辑' });
        return true;
    }
    catch {
        return false;
    }
}
async function newList() {
    if (busy.value || !await discard())
        return;
    clearBenefitShopping(owner());
    error.value = '';
    void router.replace('/benefits/shopping');
}
async function openRecord(r: BenefitSelection) {
    if (!await discard())
        return;
    const current = store.data.benefitSelections?.find(s => s.id === r.id);
    if (!current) {
        error.value = '记录已不存在';
        return;
    }
    state.confirmed = current.status === 'confirmed' ? benefitClone(current) : undefined;
    state.draft = current.status === 'draft' ? benefitClone(current) : undefined;
    state.revision = current.revision;
    state.prices = {};
    state.initial = signature();
    state.groupId = '';
    recordsOpen.value = false;
    error.value = '';
}
function copyConfirmed() {
    if (!state.confirmed || !canCreate.value)
        return;
    state.draft = { id: '', device: benefitClone(state.confirmed.device), lines: benefitClone(state.confirmed.lines), status: 'draft' };
    state.confirmed = undefined;
    state.prices = {};
    state.revision = 0;
    state.initial = '';
    error.value = '';
    state.groupId = '';
}
async function save(status: 'draft' | 'confirmed') {
    if (!state.draft || busy.value || !canEdit.value)
        return;
    if (invalidPrices.value) {
        error.value = '请修正无效报价后再保存';
        return;
    }
    busy.value = true;
    error.value = '';
    const stamp = signature();
    try {
        const r = await store.saveBenefitSelection({ ...benefitClone(state.draft), status }, state.revision, () => signature() === stamp);
        if (!r.ok) {
            error.value = r.message || '保存失败，输入保留';
            return;
        }
        if ('record' in r && r.record) {
            state.revision = r.record.revision;
            if (status === 'confirmed') {
                state.confirmed = benefitClone(r.record);
                state.draft = undefined;
            }
            else
                state.draft = benefitClone(r.record);
            state.initial = signature();
            ElMessage.success(status === 'confirmed' ? '清单已确认' : '草稿已保存');
        }
    }
    catch (e) {
        error.value = String(e);
    }
    finally {
        busy.value = false;
    }
}
function diagnose(id?: string) {
    if (!state.draft || !canDiagnose.value)
        return;
    router.push({ path: '/compatibility', query: { tab: 'results', ...(state.draft.device.kind === 'sku' ? { device: state.draft.device.skuId } : { deviceModel: state.draft.device.hostKey }), ...(id ? { targetId: id } : {}), returnTo: route.fullPath } });
}
watch(() => [store.activeUserId, store.previewUserId], () => {
    if (state.owner !== owner())
        clearBenefitShopping(owner());
    error.value = '';
    changeOpen.value = false;
}, { immediate: true });
watch(() => route.query.device, async (value) => {
    if (route.path !== '/benefits/shopping')
        return;
    const token = typeof value === 'string' ? value : '';
    if (token && token !== state.routeToken) {
        if (state.draft && state.draft.device.kind === 'sku' && state.draft.device.skuId === token) {
            state.routeToken = token;
            return;
        }
        requestDevice('sku:' + token, false);
        state.routeToken = token;
    }
}, { immediate: true });
watch(groups, () => {
    if (state.groupId && !groups.value.some(g => g.id === state.groupId))
        state.groupId = '';
});
onBeforeRouteLeave(async (to) => {
    if (busy.value)
        return false;
    if (to.path === '/compatibility')
        return true;
    if (!await discard())
        return false;
    clearBenefitShopping(owner());
    return true;
});
onBeforeRouteUpdate(async (to, from) => {
    if (busy.value)
        return false;
    const token = typeof to.query.device === 'string' ? to.query.device : '';
    if (token === from.query.device || !token)
        return true;
    const next: BenefitDevice = { kind: 'sku', skuId: token };
    if (JSON.stringify(next) === JSON.stringify(state.draft?.device))
        return true;
    if (state.draft?.lines.length) {
        if (navigationDecision)
            navigationDecision(false);
        stageDevice(next);
        return await new Promise<boolean>(resolve => {
            navigationDecision = resolve;
        });
    }
    return true;
});
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
.device-panel{margin:16px 0}.device-panel>.el-select{width:min(100%,850px)}.shopping-columns{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(330px,1fr);gap:20px;align-items:start}.group-tabs,.actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.group-tabs .el-button{margin:0}.candidate-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--el-border-color-lighter)}.candidate-row p,.selected-row p{font-size:13px;line-height:1.65;overflow-wrap:anywhere}.selected-row{padding:16px 0;border-bottom:1px solid var(--el-border-color-lighter)}.line-controls{display:flex;gap:12px;flex-wrap:wrap}.line-controls label{display:grid;gap:8px;max-width:180px}.fast{display:block;margin-top:8px;color:var(--el-text-color-secondary)}.muted{color:var(--el-text-color-secondary);font-size:13px;line-height:1.7}.error{color:var(--el-color-danger)}.diagnostics{margin-top:24px;font-size:13px}.selection{position:sticky;top:12px;max-height:calc(100vh - 60px);overflow:auto}h2{font-size:18px}h3{font-size:15px}@media(max-width:900px){.shopping-columns{grid-template-columns:1fr}.selection{position:static;max-height:none}}
</style>
