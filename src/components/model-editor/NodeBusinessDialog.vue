<template>
  <el-dialog :model-value="open" title="节点业务配置" width="760px" class="node-business-dialog" :close-on-click-modal="false" :close-on-press-escape="!busy" :show-close="!busy" @close="emit('close')">
    <div :inert="busy" data-business-panel>
      <p><strong>{{ node?.valueId || '公共配置目录' }}</strong> <span class="muted">{{ node?.id }} · {{ readOnly ? '发布投影 / 只读' : '模型草稿' }}</span></p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-alert v-if="structureProblems.length" :title="structureProblems.join('；')" type="error" :closable="false" />
      <details v-if="structureProblems.length"><summary>结构损坏，已停止编辑；查看保留的原文</summary><pre>{{ JSON.stringify({businessDefinitions:store.data.businessDefinitions,businessConfigs:node?.businessConfigs},null,2) }}</pre></details>
      <el-select v-if="node" v-model="versionId" placeholder="当前草稿" aria-label="业务配置版本" @change="editing=false; error=''">
        <el-option label="当前草稿" value="" /><el-option v-for="v in versions" :key="v.id" :label="`${v.versionName}（只读快照）`" :value="v.id" />
      </el-select>
      <el-tabs v-model="tab">
        <el-tab-pane label="节点配置与生效" name="node" :disabled="!node">
          <p class="muted">配置附属于值节点，不增加规格轴。多条不一致配置显示冲突，不自动覆盖或取交集。</p>
          <section v-for="kind in ['sales-position','material-policy']" :key="kind" class="business-result">
            <strong>{{ kind === 'sales-position' ? '销售定位' : '物料策略' }}：</strong>
            <span>{{ effective(kind).message || businessLabel(effective(kind).parameters?.value) }}</span>
            <div v-for="source in effective(kind).sources" :key="source" class="muted">来源：{{ source }}</div>
          </section>
          <p class="muted">共用策略不指定具体物料。请通过物料建档／关联入口明确选择 MAT，预览并确认作用范围。</p>
          <section v-if="restriction.hits.length" class="business-result"><strong>当前路径允许值：</strong>{{ restriction.message || (restriction.parameters?.values as string[] || []).join('、') }}<div v-for="source in restriction.sources" :key="source" class="muted">来源：{{ source }}</div></section>
          <p>命名规则：{{ namingSource }} <el-button v-if="!versionId" link type="primary" @click="emit('naming')">{{ readOnly ? '查看原命名规则' : '打开原命名编辑器' }}</el-button></p>
          <div v-for="config in records" :key="config.id" class="business-record">
            <div><strong>{{ businessDefinition(store.data,config)?.name || '不支持的配置' }}</strong> · {{ config.enabled ? '启用' : '停用' }} · {{ config.scope === 'current' ? '仅当前值' : config.scope === 'subtree' ? '当前值及其下级' : '范围无效' }}</div>
            <small>{{ configText(config) }}</small>
            <div v-if="!readOnly"><el-button size="small" @click="edit(config)">编辑配置</el-button><el-button size="small" @click="toggle(config)">{{ config.enabled ? '停用配置' : '启用配置' }}</el-button><el-button size="small" type="danger" @click="remove(config.id)">删除配置</el-button></div>
            <details v-if="node && configProblem(store.data,displayNodes,node,config)"><summary>失效 / 不支持配置的原文</summary><pre>{{ JSON.stringify(config,null,2) }}</pre></details>
          </div>
          <el-button v-if="!readOnly && !editing" data-new-business @click="start()">添加业务配置</el-button>
          <el-form v-if="editing && !readOnly" label-position="top" class="business-form" data-business-form>
            <el-form-item label="配置功能"><el-select v-model="form.definitionId" :disabled="Boolean(editingId)" aria-label="配置功能"><el-option v-for="d in definitions.filter(d=>d.kind!=='naming')" :key="d.id" :label="d.name" :value="d.id" :disabled="!d.enabled && d.id!==form.definitionId" /></el-select></el-form-item>
            <el-form-item label="作用范围"><el-select v-model="form.scope" aria-label="作用范围"><el-option label="仅当前值" value="current" :disabled="formKind==='allowed-values'" /><el-option label="当前值及其下级" value="subtree" /></el-select></el-form-item>
            <el-form-item v-if="formKind==='sales-position' || formKind==='material-policy'" label="配置值"><el-select v-model="value" aria-label="配置值"><el-option v-for="v in formKind==='sales-position'?['hot','not-hot']:['independent','shared']" :key="v" :label="businessLabel(v)" :value="v" /></el-select></el-form-item>
            <template v-if="formKind==='allowed-values'">
              <el-form-item label="下级目标属性"><el-select v-model="attributeId" aria-label="下级目标属性" @change="values=[]"><el-option v-for="p in targetParams" :key="p.id" :value="p.id" :label="p.name" /></el-select></el-form-item>
              <el-form-item label="允许词典值"><el-select v-model="values" multiple aria-label="允许词典值"><el-option v-for="v in targetValues" :key="v" :value="v" :label="v" /></el-select></el-form-item>
            </template>
            <el-checkbox v-model="form.enabled">启用此配置</el-checkbox>
            <div class="business-actions"><el-button @click="editing=false">取消编辑</el-button><el-button type="primary" data-save-business @click="saveForm">保存节点配置</el-button></div>
          </el-form>
          <section v-if="issues.length" class="business-issues"><h4>冲突与失效配置</h4><div v-for="(issue,index) in issues" :key="index"><el-button link type="danger" @click="emit('locate',issue.nodeId)">{{ issue.message }} · 定位节点</el-button></div></section>
        </el-tab-pane>
        <el-tab-pane label="公共配置目录" name="catalog">
          <p class="muted">目录跨分类和产品类型复用；停用只禁止新增实例。功能类型固定，不运行脚本。</p>
          <div v-for="d in definitions" :key="d.id" class="business-record">
            <strong>{{ d.name }}</strong> · {{ d.enabled ? '可用' : '已停用' }}<small>{{ d.description }}</small><small>{{ d.id }}</small>
            <el-button v-if="!readOnly" size="small" @click="definitionDraft={...d}">维护目录项</el-button>
          </div>
          <el-form v-if="definitionDraft && !readOnly" label-position="top">
            <el-form-item label="目录名称"><el-input v-model="definitionDraft.name" aria-label="目录名称" /></el-form-item>
            <el-form-item label="说明"><el-input v-model="definitionDraft.description" type="textarea" /></el-form-item>
            <el-checkbox v-model="definitionDraft.enabled">允许新增实例</el-checkbox>
            <div class="business-actions"><el-button @click="definitionDraft=undefined">取消维护</el-button><el-button type="danger" @click="saveDefinition(true)">删除目录项</el-button><el-button type="primary" @click="saveDefinition(false)">保存目录项</el-button></div>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
    <template #footer><el-button :disabled="busy" @click="emit('close')">关闭</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCatalogStore, uid } from '../../stores/catalog'
import { businessDefinition, businessDefinitions, businessIssues, businessLabel, businessPath, configProblem, resolveNodeBusiness, type BusinessDefinition, type NodeBusinessConfig } from '../../domain/nodeBusiness'
import { nearestNamingRule } from '../../domain/naming'
import { businessRecordProblems, safeBusinessConfigs } from '../../domain/nodeBusinessStructure'
import type { ProductSpecNode } from '../../domain/types'
const props=defineProps<{open:boolean;nodes:ProductSpecNode[];nodeId:string;readonly:boolean;busy:boolean;save:(records:NodeBusinessConfig[],expected:string)=>Promise<{ok:boolean;message?:string}>}>()
const emit=defineEmits<{close:[];naming:[];locate:[id:string];pending:[value:boolean]}>()
const store=useCatalogStore(), tab=ref('node'), error=ref(''), editing=ref(false), editingId=ref(''), expected=ref('')
const form=ref({definitionId:'business:sales',scope:'subtree',enabled:true}),value=ref('hot'),attributeId=ref(''),values=ref<string[]>([]),definitionDraft=ref<BusinessDefinition>()
const versionId=ref('')
const versions=computed(()=>store.data.specModelVersions.filter(v=>v.templateId===props.nodes[0]?.templateId))
const displayNodes=computed(()=>versions.value.find(v=>v.id===versionId.value)?.nodesSnapshot || props.nodes)
const structureProblems=computed(()=>businessRecordProblems(store.data,displayNodes.value,businessDefinitions(store.data)))
const readOnly=computed(()=>props.readonly || Boolean(versionId.value) || Boolean(structureProblems.value.length))
const node=computed(()=>displayNodes.value.find(n=>n.id===props.nodeId)), records=computed(()=>safeBusinessConfigs(node.value?.businessConfigs)),definitions=computed(()=>businessDefinitions(store.data))
const formKind=computed(()=>definitions.value.find(d=>d.id===form.value.definitionId)?.kind)
const targetParams=computed(()=>store.data.params.filter(p=>props.nodes.some(n=>n.nodeType==='ATTRIBUTE'&&n.attributeId===p.id&&businessPath(props.nodes,n.id).some(a=>a.id===props.nodeId))))
const targetValues=computed(()=>store.data.params.find(p=>p.id===attributeId.value)?.values||[])
const issues=computed(()=>businessIssues(store.data,displayNodes.value))
const namingSource=computed(()=>{const own=node.value?.namingRule?.length;const source=nearestNamingRule(displayNodes.value,props.nodeId);return source?`${own?'当前节点自有':'继承祖先'} · ${source.nodeId} · ${source.rule.map(p=>p.kind==='text'?p.text:store.data.params.find(a=>a.id===p.key)?.name||p.key).join(' / ')}`:'未配置'})
const effective=(kind:string)=>resolveNodeBusiness(store.data,displayNodes.value,props.nodeId,kind)
const restriction=computed(()=>resolveNodeBusiness(store.data,displayNodes.value,props.nodeId,'allowed-values',node.value?.attributeId))
function configText(c:NodeBusinessConfig){return businessDefinition(store.data,c)?.kind==='allowed-values'?`${c.dictionarySnapshot?.name||store.data.params.find(p=>p.id===c.parameters?.attributeId)?.name||'目标属性失效'}：${Array.isArray(c.parameters?.values)?c.parameters.values.join('、'):'参数无效'}`:businessLabel(c.parameters?.value)}
watch(()=>[props.open,props.nodeId],()=>{if(props.open){versionId.value='';editing.value=false;error.value='';definitionDraft.value=undefined;tab.value=node.value?'node':'catalog';expected.value=JSON.stringify(node.value)}})
watch(formKind,kind=>{if(!editingId.value){value.value=kind==='material-policy'?'independent':'hot';if(kind==='allowed-values')form.value.scope='subtree'}})
function start(){expected.value=JSON.stringify(node.value);editingId.value='';form.value={definitionId:definitions.value.find(d=>d.enabled&&d.kind!=='naming'&&!records.value.some(c=>c.definitionId===d.id))?.id||'',scope:'subtree',enabled:true};value.value=formKind.value==='material-policy'?'independent':'hot';values.value=[];attributeId.value='';editing.value=true;error.value=''}
function edit(c:NodeBusinessConfig){expected.value=JSON.stringify(node.value);editingId.value=c.id;form.value={definitionId:c.definitionId,scope:c.scope,enabled:c.enabled};value.value=String(c.parameters?.value||'');attributeId.value=String(c.parameters?.attributeId||'');values.value=Array.isArray(c.parameters?.values)?[...c.parameters.values] as string[]:[];editing.value=true;error.value=''}
async function commit(next:NodeBusinessConfig[]){const result=await props.save(next,expected.value);if(result.ok){editing.value=false;expected.value=JSON.stringify(node.value);error.value=''}else error.value=result.message||'保存失败，输入保留。'}
async function saveForm(){if(!node.value)return;const record:NodeBusinessConfig={id:editingId.value||uid('bc'),definitionId:form.value.definitionId,modelId:node.value.templateId,nodeId:node.value.id,enabled:form.value.enabled,scope:form.value.scope,parameters:formKind.value==='allowed-values'?{attributeId:attributeId.value,values:[...values.value]}:{value:value.value}};const problem=configProblem(store.data,props.nodes,node.value,record);if(problem){error.value=problem;return}await commit([...records.value.filter(c=>c.id!==record.id),record])}
async function toggle(c:NodeBusinessConfig){expected.value=JSON.stringify(node.value);await commit(records.value.map(r=>r.id===c.id?{...r,enabled:!r.enabled}:r))}
async function remove(id:string){expected.value=JSON.stringify(node.value);await commit(records.value.filter(c=>c.id!==id))}
async function saveDefinition(remove:boolean){if(!definitionDraft.value)return;emit('pending',true);try{const result=await store.saveBusinessDefinition(definitionDraft.value,remove);if(result.ok){definitionDraft.value=undefined;error.value=''}else error.value=result.message}finally{emit('pending',false)}}
</script>
<style>
.node-business-dialog { max-width:calc(100vw - 24px); }
.node-business-dialog .el-dialog__body { max-height:70vh; overflow:auto; }
.node-business-dialog .business-record,.node-business-dialog .business-result { padding:10px 0; border-bottom:1px solid var(--el-border-color); }
.node-business-dialog small { display:block; overflow-wrap:anywhere; margin:6px 0; }
.node-business-dialog .business-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; margin-top:14px; }
.node-business-dialog .business-form { margin-top:16px; }
.node-business-dialog .el-select { width:100%; }
.node-business-dialog .business-issues .el-button { white-space:normal; height:auto; text-align:left; margin:6px 0; }
.node-business-dialog pre { white-space:pre-wrap; overflow-wrap:anywhere; }
@media (max-height:800px) {
  .node-business-dialog { margin-top:5vh !important; }
  .node-business-dialog .el-dialog__body { max-height:calc(90vh - 120px); }
}
</style>
