<template>
  <div>
    <PageHead title="权益包管理" desc="选归属分类与配件类型，明确主机范围，预览后保存；暂时没有商品也可提前配置。">
      <el-button v-if="store.canRoute({path:'/benefits/shopping'})" @click="router.push('/benefits/shopping')">去选购</el-button>
      <el-button v-if="returnTo" @click="router.push(returnTo)">返回来源</el-button>
    </PageHead>
    <section v-if="source.active" class="panel source-context" data-benefit-source>
      <p><strong>来源：{{source.modelName}}</strong> · {{source.versionName}} · {{source.nodeName}}</p>
      <div class="source-controls">
        <el-radio-group :model-value="relatedOnly?'related':'all'" aria-label="权益包查看范围" @change="changeView">
          <el-radio-button value="related">当前范围相关</el-radio-button>
          <el-radio-button value="all">全部权益包</el-radio-button>
        </el-radio-group>
        <el-select v-if="sourceInput.modelId && versions.length" :model-value="sourceInput.versionId" placeholder="选择已发布版本" aria-label="选择已发布版本" @change="chooseVersion">
          <el-option v-for="version in versions" :key="version.id" :value="version.id" :label="version.versionName"/>
        </el-select>
        <el-select v-if="selectedVersion && !sourceInput.hostKey" :model-value="sourceInput.nodePending?undefined:sourceInput.nodeId||'$root'" placeholder="选择此版本内的有效分支" aria-label="来源发布范围" @change="chooseBranch">
          <el-option v-for="branch in branches" :key="branch.id" :value="branch.id" :label="branch.label"/>
        </el-select>
      </div>
      <p v-if="source.issue" class="hint" role="status">{{source.issue}}</p>
      <p v-if="sourceInput.modelId && !versions.length" class="hint">当前模型没有有效已发布版本，请返回来源维护；不会自动套用草稿。</p>
      <p class="hint">{{relatedOnly?'按来源型号范围查找相关配置，包含已停用和暂时没有商品的包。':'当前查看全部配置，可继续按左侧配件目录筛选。'}} 主机分类不限制配件归属分类。</p>
    </section>
    <div class="management-layout">
      <aside class="panel">
        <CatalogScopeTree :categories="store.data.categories" :types="index.typeRows" :category-id="categoryId" :scope-type-id="scopeTypeId" :expanded-ids="expanded" @expand="expanded=$event" @select="selectCategory" @select-type="selectType"/>
      </aside>
      <BenefitGroupManager :category-id="categoryId" :scope-type-id="scopeTypeId" :types="index.typeRows" :source="source" :related-only="relatedOnly"/>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHead from '../components/PageHead.vue';
import CatalogScopeTree from '../components/catalog-workspace/CatalogScopeTree.vue';
import BenefitGroupManager from '../components/benefits/BenefitGroupManager.vue';
import { useCatalogStore } from '../stores/catalog';
import { compatibilityReturnLocation } from '../domain/compatibilityNavigation';
import { buildCatalogWorkspaceIndex } from '../domain/catalogWorkspaceQuery';
import { categoryContains, benefitSourceContext, benefitSnapshotHosts } from '../domain/benefits/scope';
import type {ProductSpecNode} from '../domain/types';
const route = useRoute(), router = useRouter(), store = useCatalogStore(), expanded = ref<string[]>([]);
const queryText = (key: string) => typeof route.query[key] === 'string' ? route.query[key] as string : '';
const sourceInput = computed(() => ({modelId:queryText('model'), versionId:queryText('version'), nodeId:queryText('node'), hostKey:queryText('host'), nodePending:queryText('chooseBranch')==='1'}));
const source = computed(() => benefitSourceContext(store.data, sourceInput.value));
const relatedOnly = computed(() => source.value.active && queryText('view')!=='all');
const index = computed(() => buildCatalogWorkspaceIndex(store.data, store.can));
// Source host context and accessory directory filters have separate meanings.
const categoryId = computed(() => relatedOnly.value?'':queryText('category'));
const scopeTypeId = computed(() => relatedOnly.value?'':queryText('type'));
const returnTo = computed(() => compatibilityReturnLocation(route.query.returnTo));
const versions = computed(() => store.data.specModelVersions.filter(v=>v.templateId===sourceInput.value.modelId && v.status==='published').sort((a,b)=>b.version-a.version));
const selectedVersion = computed(() => versions.value.find(v=>v.id===sourceInput.value.versionId));
const branches = computed(() => {
    const version=selectedVersion.value;
    if(!version)return [];
    const snapshot=benefitSnapshotHosts(store.data,version.templateId,version.id);
    if(snapshot.issue)return [];
    const allowed=new Set(snapshot.entries.flatMap(e=>e.nodeIds));
    return [{id:'$root',label:'模型完整范围'},...version.nodesSnapshot.filter(n=>n.nodeType==='VALUE'&&allowed.has(n.id)).map(n=>({id:n.id,label:nodePath(version.nodesSnapshot,n.id).filter(p=>p.nodeType==='VALUE').map(p=>p.valueId).join(' / ')}))];
});
function nodePath(nodes:ProductSpecNode[],id:string){
    const path:ProductSpecNode[]=[],seen=new Set<string>();
    let node=nodes.find(n=>n.id===id);
    while(node&&!seen.has(node.id)){seen.add(node.id);path.unshift(node);node=nodes.find(n=>n.id===node!.parentId)}
    return path;
}
function sourceQuery(){
    return {model:queryText('model')||undefined,version:queryText('version')||undefined,node:queryText('node')||undefined,host:queryText('host')||undefined,chooseBranch:queryText('chooseBranch')||undefined,...(returnTo.value?{returnTo:returnTo.value}:{})};
}
function changeView(value:string|number|boolean|undefined){
    router.push({path:'/benefits/manage',query:{...sourceQuery(),view:value==='all'?'all':undefined}});
}
function selectCategory(category: string) {
    router.push({path:'/benefits/manage',query:{...sourceQuery(),view:source.value.active?'all':undefined,category:category||undefined}});
}
function selectType(type: string) {
    const row = index.value.typeRows.find(t => t.id === type);
    const category = !categoryId.value || categoryContains(store.data, categoryId.value, row?.categoryIds[0] || '') ? categoryId.value : row?.categoryIds[0] || '';
    router.push({path:'/benefits/manage',query:{...sourceQuery(),view:source.value.active?'all':undefined,category:category||undefined,type}});
}
function chooseVersion(versionId:string){
    const next=versions.value.find(v=>v.id===versionId);
    if(!next)return;
    const oldNodes=sourceInput.value.versionId?selectedVersion.value?.nodesSnapshot||[]:store.data.productSpecNodes.filter(n=>n.templateId===sourceInput.value.modelId);
    const id=sourceInput.value.nodeId;
    const identityPath=(nodes:ProductSpecNode[])=>nodePath(nodes,id).map(n=>[n.id,n.parentId,n.nodeType,n.attributeId,n.valueId]);
    const matches=!id || (oldNodes.some(n=>n.id===id)&&next.nodesSnapshot.some(n=>n.id===id)&&JSON.stringify(identityPath(oldNodes))===JSON.stringify(identityPath(next.nodesSnapshot)));
    router.push({path:'/benefits/manage',query:{...sourceQuery(),version:versionId,chooseBranch:matches?undefined:'1',view:undefined}});
}
function chooseBranch(id:string){
    if(!branches.value.some(b=>b.id===id))return;
    router.push({path:'/benefits/manage',query:{...sourceQuery(),node:id==='$root'?undefined:id,host:undefined,chooseBranch:undefined,view:undefined}});
}
</script>
<style scoped>
.management-layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px;margin-top:16px;align-items:start}.source-context{margin-top:16px}.source-controls{display:flex;gap:12px;flex-wrap:wrap}.source-controls .el-select{width:260px}.hint{color:var(--el-text-color-secondary);font-size:13px;line-height:1.7}@media(max-width:900px){.management-layout{grid-template-columns:1fr}}
</style>
