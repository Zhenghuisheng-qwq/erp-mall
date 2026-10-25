<template>
  <div class="rbac-page">
    <PageHead title="菜单管理" desc="维护导航结构和页面访问权限绑定；隐藏菜单不会撤销访问权限。">
      <el-button @click="previewOpen = true">预览菜单</el-button><el-button :disabled="!canEdit" @click="restore">恢复默认结构</el-button><el-button type="primary" :disabled="!canEdit" @click="open()">新增菜单</el-button>
    </PageHead>
    <section class="panel">
      <div class="rbac-toolbar"><el-input v-model="search" clearable placeholder="搜索菜单名称或路由" aria-label="搜索菜单"/><el-select v-model="kindFilter" clearable placeholder="全部类型" aria-label="菜单类型"><el-option label="业务中心" value="center"/><el-option label="分组" value="group"/><el-option label="页面" value="page"/></el-select><el-select v-model="visibility" clearable placeholder="全部显示状态" aria-label="菜单显示状态"><el-option label="显示" value="shown"/><el-option label="隐藏" value="hidden"/></el-select><el-button @click="setExpanded(true)">展开全部</el-button><el-button @click="setExpanded(false)">收起全部</el-button><span class="rbac-count">{{ nodeCount }} 个菜单节点</span></div>
      <el-alert v-if="pageError" :title="pageError" type="error" :closable="false" class="rbac-error"/>
      <el-table :key="treeKey" class="rbac-table" :data="tree" row-key="id" :default-expand-all="expanded" highlight-current-row @current-change="currentId = $event?.id || ''" empty-text="没有匹配菜单，试试清除筛选">
        <el-table-column label="菜单名称" min-width="240"><template #default="{ row }"><div class="rbac-name" :data-menu-id="row.id"><el-icon><component :is="row.kind === 'center' ? Grid : row.kind === 'group' ? FolderOpened : menuRouteIcon(row.route)"/></el-icon><span>{{ row.title }}</span></div><div v-if="currentId === row.id" class="technical">{{ parentPath(row) }}</div></template></el-table-column>
        <el-table-column label="类型" width="90"><template #default="{ row }"><el-tag size="small" :type="row.kind === 'page' ? 'info' : 'primary'">{{ kindText(row.kind) }}</el-tag></template></el-table-column>
        <el-table-column label="路由" min-width="160"><template #default="{ row }"><span class="technical">{{ row.route || '—' }}</span></template></el-table-column>
        <el-table-column prop="sort" label="顺序" width="72" align="right"/>
        <el-table-column label="显示状态" width="90"><template #default="{ row }"><el-tag :type="row.hidden ? 'info' : 'success'" size="small">{{ row.hidden ? '隐藏' : '显示' }}</el-tag></template></el-table-column>
        <el-table-column label="访问权限" min-width="180"><template #default="{ row }"><span class="technical">{{ row.kind === 'page' ? permissionFor(row) || '未登记权限' : '按下级页面授权' }}</span></template></el-table-column>
        <el-table-column label="操作" width="180"><template #default="{ row }"><div class="rbac-actions"><el-button link type="primary" :disabled="!canEdit" @click="open(row)">编辑</el-button><el-button v-if="row.kind !== 'page'" link :disabled="!canEdit" @click="open(undefined,row.id)">添加下级</el-button><el-dropdown trigger="click"><el-button link>更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item :disabled="!canEdit || !canMove(row,-1)" @click="shift(row,-1)">同级上移</el-dropdown-item><el-dropdown-item :disabled="!canEdit || !canMove(row,1)" @click="shift(row,1)">同级下移</el-dropdown-item><el-dropdown-item v-if="row.custom" :disabled="!canEdit" @click="remove(row)">删除空容器</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></template></el-table-column>
      </el-table>
    </section>
    <el-drawer v-model="drawer" :title="editingId ? '编辑菜单' : '新增菜单'" size="min(520px, 95vw)" :before-close="closeDrawer" :close-on-click-modal="false">
      <el-alert v-if="error" :title="error" type="error" :closable="false" class="rbac-error"/>
      <el-form label-position="top" :disabled="busy || !canEdit">
        <el-form-item label="节点类型" required><el-radio-group v-model="form.kind" :disabled="!!editingId"><el-radio-button value="center">业务中心</el-radio-button><el-radio-button value="group">分组</el-radio-button><el-radio-button value="page">页面</el-radio-button></el-radio-group></el-form-item>
        <el-form-item v-if="form.kind === 'page'" label="正式页面" required><el-select v-model="form.route" :disabled="!!editingId" filterable placeholder="选择已登记页面" aria-label="正式页面" @change="onRoute"><el-option v-for="p in menuPageRegistry()" :key="p.id" :label="p.title" :value="p.route"/></el-select><p class="rbac-help">每个正式页面只有一个入口，新增已有页面会恢复显示并移动它的导航位置。</p></el-form-item>
        <el-form-item label="菜单名称" required><el-input v-model="form.title" maxlength="100" aria-label="菜单名称"/></el-form-item>
        <el-form-item v-if="form.kind !== 'center'" label="父级" required><el-select v-model="form.parentId" filterable aria-label="菜单父级"><el-option v-for="parent in parents" :key="parent.id" :label="parentPath(parent,true)" :value="parent.id"/></el-select></el-form-item>
        <el-form-item label="同级排序" required><el-input-number v-model="form.sort" :min="0" :max="100000"/></el-form-item>
        <el-form-item label="导航显示"><el-switch v-model="form.hidden" active-text="隐藏" inactive-text="显示"/><p class="rbac-help">只影响导航展示。直接访问仍由角色权限控制。</p></el-form-item>
        <el-form-item v-if="form.kind === 'page'" label="关联访问权限" required><el-select v-model="form.permissionCode" aria-label="关联访问权限"><el-option v-for="p in pagePermissions" :key="p.code" :value="p.code" :label="`${p.name} · ${p.code}`"/></el-select><p class="rbac-help">仅可绑定该正式页面登记的访问权限。角色授权请前往角色管理。</p></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="busy" @click="closeDrawer()">取消</el-button><el-button type="primary" :loading="busy" :disabled="!canEdit" @click="save">保存菜单</el-button></template>
    </el-drawer>
    <el-drawer v-model="previewOpen" title="导航预览" size="min(440px, 95vw)"><el-select v-model="previewId" placeholder="选择预览用户" aria-label="预览用户"><el-option v-for="u in store.data.users" :key="u.id" :value="u.id" :label="`${u.displayName}${u.enabled ? '' : '（停用）'}`"/></el-select><p class="rbac-help">只读取所选用户的有效授权，不改变当前模拟身份或角色绑定。</p><ul class="preview-tree"><li v-for="line in preview" :key="line.id" :style="{paddingLeft: `${line.depth*18}px`}">{{ line.title }}</li></ul><el-empty v-if="!preview.length" description="该用户没有可见菜单"/></el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Grid, FolderOpened } from '@element-plus/icons-vue'
import PageHead from '../components/PageHead.vue'
import { useRbacDraftGuard } from '../components/rbac/useRbacDraftGuard'
import '../components/rbac/admin.css'
import { useCatalogStore } from '../stores/catalog'
import { addCenter, addGroup, changeParent, childrenOf, descendantIds, loadMenu, menuPageRegistry, moveSibling, placePage, removeGroup, type MenuNode, type MenuKind } from '../domain/menuConfig'
import { effectivePermissions, routePermissions } from '../domain/rbac'
import { menuRouteIcon } from '../layouts/navigationIcons'
const store=useCatalogStore(), nodes=ref<MenuNode[]>(loadMenu()), search=ref(''),kindFilter=ref(''),visibility=ref(''),expanded=ref(true),treeKey=ref(0),currentId=ref(''),pageError=ref('')
const drawer=ref(false),editingId=ref(''),error=ref(''),busy=ref(false),initial=ref(''),previewOpen=ref(false),previewId=ref('')
const form=reactive({kind:'center' as MenuKind,title:'',route:'',parentId:'product',sort:1,hidden:false,permissionCode:''})
const canEdit=computed(()=>store.can('system:menu:update'))
const dirty=computed(()=>drawer.value && JSON.stringify(form)!==initial.value)
const {confirmDiscard}=useRbacDraftGuard(dirty)
function required(route:string){const u=new URL(route,'http://mock');return routePermissions(u.pathname,Object.fromEntries(u.searchParams)) || []}
function permissionFor(node:MenuNode){return node.permissionCode || required(node.route)[0] || ''}
const nodeCount=computed(()=>nodes.value.length)
const tree=computed(()=>{const visit=(parent:string|null):(MenuNode&{children?:unknown[]})[]=>childrenOf(nodes.value,parent).flatMap(n=>{const children=visit(n.id);const own=(!search.value||`${n.title} ${n.route}`.toLowerCase().includes(search.value.toLowerCase()))&&(!kindFilter.value||n.kind===kindFilter.value)&&(!visibility.value||(n.hidden?'hidden':'shown')===visibility.value);return own||children.length?[{...n,children}]:[]});return visit(null)})
const parents=computed(()=>{const blocked=new Set([editingId.value,...descendantIds(nodes.value,editingId.value)]);return nodes.value.filter(n=>!blocked.has(n.id)&&(form.kind==='group'?n.kind==='center':n.kind!=='page'))})
const pagePermissions=computed(()=>store.data.rbac?.permissions.filter(p=>p.kind==='page' && required(form.route).includes(p.code)) || [])
function parentPath(node:MenuNode,include=false){const names=include?[node.title]:[];let id=node.parentId;const seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);const p=nodes.value.find(n=>n.id===id);if(!p)break;names.unshift(p.title);id=p.parentId}return names.join(' / ')||'顶级中心'}
function kindText(kind:MenuKind){return kind==='center'?'中心':kind==='group'?'分组':'页面'}
function setExpanded(value:boolean){expanded.value=value;treeKey.value++}
function open(node?:MenuNode,parent?:string){editingId.value=node?.id||'';error.value='';const p=nodes.value.find(n=>n.id===parent);Object.assign(form,node?{...node,parentId:node.parentId||'',permissionCode:permissionFor(node)}:{kind:parent?(p?.kind==='group'?'page':'group'):'center',title:'',route:'',parentId:parent||'product',sort:childrenOf(nodes.value,parent||null).length+1,hidden:false,permissionCode:''});initial.value=JSON.stringify(form);drawer.value=true}
function onRoute(route:string){const p=menuPageRegistry().find(p=>p.route===route);if(p&&!editingId.value)form.title=nodes.value.find(n=>n.route===route)?.title||p.title;form.permissionCode=required(route)[0]||''}
async function closeDrawer(done?:()=>void){if(busy.value)return;if(await confirmDiscard()){drawer.value=false;done?.()}}
async function commit(next:MenuNode[]){busy.value=true;try{const result=await store.saveMenuStructure(next);if(!result.ok){error.value=result.message||'保存失败，草稿保留';return false}nodes.value=loadMenu();pageError.value='';ElMessage.success('菜单结构已保存');return true}catch(e){error.value=e instanceof Error?e.message:'保存失败';return false}finally{busy.value=false}}
async function save(){error.value='';if(!form.title.trim()){error.value='请填写菜单名称';return}let next=JSON.parse(JSON.stringify(nodes.value)) as MenuNode[];if(editingId.value){if(form.kind!=='center'){const r=changeParent(next,editingId.value,form.parentId);if(!r.ok){error.value=r.message;return}next=r.nodes;}Object.assign(next.find(n=>n.id===editingId.value)!,{title:form.title.trim(),sort:form.sort,hidden:form.hidden,permissionCode:form.kind==='page'?form.permissionCode:undefined})}else{const r=form.kind==='center'?addCenter(next,form.title):form.kind==='group'?addGroup(next,form.parentId,form.title):placePage(next,form.route,form.parentId);if(!r.ok){error.value=r.message;return}next=r.nodes;const target=form.kind==='page'?next.find(n=>n.route===form.route):next.find(n=>!nodes.value.some(old=>old.id===n.id));if(target)Object.assign(target,{title:form.title.trim(),sort:form.sort,hidden:form.hidden,permissionCode:form.kind==='page'?form.permissionCode:undefined})}if(form.kind==='page'&&!form.permissionCode){error.value='请选择该页面的正式访问权限';return}if(await commit(next)){initial.value=JSON.stringify(form);drawer.value=false}}
function canMove(node:MenuNode,direction:number){const siblings=childrenOf(nodes.value,node.parentId),i=siblings.findIndex(n=>n.id===node.id);return i+direction>=0&&i+direction<siblings.length}
async function shift(node:MenuNode,direction:-1|1){if(!await commit(moveSibling(nodes.value,node.id,direction)))pageError.value=error.value}
async function remove(node:MenuNode){const r=removeGroup(nodes.value,node.id);if(!r.ok){ElMessage.warning(r.message);return}try{await ElMessageBox.confirm(`删除空容器「${node.title}」？`,'删除菜单容器')}catch{return}if(!await commit(r.nodes))pageError.value=error.value}
async function restore(){try{await ElMessageBox.confirm('只恢复菜单结构；角色、授权、用户和导航偏好保持。','恢复默认菜单')}catch{return}busy.value=true;try{const r=await store.resetMenuStructure();if(!r.ok){pageError.value=r.message||'恢复失败';return}nodes.value=loadMenu();ElMessage.success('已恢复默认菜单结构')}finally{busy.value=false}}
const preview=computed(()=>{const codes=effectivePermissions(store.data,previewId.value);const walk=(parent:string|null,depth:number):{id:string;title:string;depth:number}[]=>childrenOf(nodes.value,parent).filter(n=>!n.hidden).flatMap(n=>{if(n.kind==='page')return required(n.route).length&&required(n.route).every(c=>codes.has(c))?[{id:n.id,title:n.title,depth}]:[];const child=walk(n.id,depth+1);return child.length?[{id:n.id,title:n.title,depth},...child]:[]});return walk(null,0)})
</script>
<style scoped>.preview-tree{list-style:none;padding:0}.preview-tree li{line-height:1.6;margin:10px 0;overflow-wrap:anywhere}</style>
