import { createRouter, createWebHistory } from 'vue-router'
import { isMaterialArchive } from '../domain/catalogIdentity'
import AdminLayout from '../layouts/AdminLayout.vue'
import { useCatalogStore } from '../stores/catalog'
import {routePermissions} from '../domain/rbac'
import {createFailure} from '../domain/guide/failure'
import {guideRouteFailure} from '../domain/guide/routeFailure'
import { legacyCatalogLocation } from '../domain/catalogWorkspaceNavigation'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: 'guide', name: 'guide', component: () => import('../views/guide/GuideHomeView.vue'), meta: { title: '系统功能说明' } },
        { path: 'guide/manage', name: 'guide-manage', redirect: '/guide' },
        { path: 'guide/articles/:articleId', name: 'guide-article', component: () => import('../views/guide/GuideArticleView.vue'), meta: { title: '系统功能说明' } },
        { path: 'guide/learn/:flowId?', name: 'guide-learn', redirect: '/guide' },
        { path: '', name: 'home', component: () => import('../views/WorkbenchView.vue'), meta: { title: '商品工作台', group: '商品工作台', mode: 'daily' } },
        { path: 'products', redirect: to => ({ path: '/spus', query: to.query }) },
        { path: 'spus', name: 'spus', component: () => import('../views/ProductListView.vue'), props: { mode: 'spu' }, meta: { title: 'SPU 管理' } },
        { path: 'skus', name: 'skus', component: () => import('../views/SkuWorkbenchView.vue'), meta: { title: 'SKU 管理' } },
        { path: 'spus/new', name: 'spu-new', component: () => import('../views/SpuEditView.vue'), meta: { title: '新建 SPU' } },
        { path: 'spus/:id', name: 'spu-edit', component: () => import('../views/SpuEditView.vue'), meta: { title: 'SPU 详情' } },
        { path: 'skus/new', name: 'sku-new', component: () => import('../views/SkuCreateView.vue'), meta: { title: '新增 SKU' } },
        { path: 'skus/:id', name: 'sku-edit', component: () => import('../views/SkuEditView.vue'), meta: { title: '编辑 SKU' } },
        { path: 'materials/new', name: 'material-new', component: () => import('../views/MaterialCreateView.vue'), meta: { title: '物料建档' } },
        { path: 'materials/:id', name: 'material-edit', component: () => import('../views/ProductEditView.vue'), beforeEnter: to => useCatalogStore().data.families.some(item => item.id === to.params.id && item.line === 'v3') || `/spus/${to.params.id}`, meta: { title: '物料管理' } },
        { path: 'import', name: 'import', component: () => import('../views/ProductIoView.vue'), meta: { title: '导入导出', group: '商品中心', mode: 'daily' } },
        { path: 'compatibility', name: 'compatibility', component: () => import('../views/CompatibilityView.vue'), meta: { title: '兼容性查询', group: '商品中心', mode: 'daily' } },
        { path: 'products/new', redirect: to => ({ path: '/spus/new', query: to.query }) },
        { path: 'products/:id', redirect: to => {
          const data = useCatalogStore().data
          const sku = data.skus.find(item => item.id === to.query.sku && item.familyId === to.params.id)
          if (sku) return { path: isMaterialArchive(data, sku) ? `/materials/${sku.familyId}` : `/skus/${sku.id}`, query: isMaterialArchive(data, sku) ? to.query : { spu: sku.familyId } }
          if (to.query.add || to.query.copySku) return { path: '/skus/new', query: { spu: String(to.params.id), copy: to.query.copySku } }
          return { path: `/spus/${to.params.id}`, query: to.query }
        } },
        { path: 'check', name: 'check', component: () => import('../views/CheckView.vue'), meta: { title: '商品质量检查', group: '商品分析', mode: 'daily' } },
        { path: 'overview', name: 'overview', component: () => import('../views/OverviewView.vue'), meta: { title: '商品总览', group: '商品工作台', mode: 'daily' } },
        { path: 'catalog', name: 'catalog', component: () => import('../views/CatalogWorkspaceView.vue'), meta: { title: '商品资料管理', group: '商品中心', mode: 'daily' } },
        { path: 'categories', name: 'categories', component: () => import('../views/CategoryView.vue'), meta: { title: '整理分类', group: '商品中心', mode: 'advanced' } },
        { path: 'product-types', name: 'product-types', component: () => import('../views/ProductTypeView.vue'), meta: { title: '产品类型', group: '商品中心', mode: 'advanced' } },
        { path: 'templates', name: 'templates', component: () => import('../views/TemplateView.vue'), meta: { title: '属性方案', group: '商品中心', mode: 'advanced' } },
        { path: 'models', name: 'models', component: () => import('../views/ModelListView.vue'), meta: { title: '商品模型', group: '商品中心', mode: 'advanced' } },
        { path: 'plans', name: 'plans', component: () => import('../views/ProductPlanView.vue'), meta: { title: '商品规划', group: '商品中心', mode: 'advanced' } },
        { path: 'specs', name: 'specs', component: () => import('../views/SpecConfigView.vue'), meta: { title: '商品模型设计', group: '商品中心', mode: 'advanced', hide: true } },
        { path: 'params', name: 'params', component: () => import('../views/ParamView.vue'), meta: { title: '属性词典', group: '商品中心', mode: 'advanced' } },
        { path: 'brands', name: 'brands', component: () => import('../views/BrandView.vue'), meta: { title: '品牌中心', group: '商品中心', mode: 'advanced' } },
        { path: 'groups', name: 'groups', component: () => import('../views/GroupView.vue'), meta: { title: '运营分组', group: '商品中心', mode: 'advanced' } },
        { path: 'rules', name: 'rules', component: () => import('../views/RuleView.vue'), meta: { title: '规格约束', group: '高级配置', mode: 'advanced' } },
        { path: 'mappings', name: 'mappings', component: () => import('../views/MappingView.vue'), meta: { title: '属性方案绑定', group: '高级配置', mode: 'advanced', hide: true } },
        { path: 'tree', name: 'tree', component: () => import('../views/TreePage.vue'), meta: { title: '商品结构视图', group: '开发工具', mode: 'advanced' } },
        { path: 'columns', redirect: { path: '/products', query: { panel: 'columns' } }, meta: { title: '列配置与视图', group: '高级配置', mode: 'advanced' } },
        { path: 'users', name: 'users', component: () => import('../views/UserView.vue'), meta: { title: '用户管理', group: '系统管理', mode: 'advanced' } },
        { path: 'feedback', name: 'feedback', component: () => import('../views/FeedbackView.vue'), meta: { title: '反馈管理', group: '系统管理', mode: 'advanced' } },
        { path: 'account', name: 'account', component: () => import('../views/AccountView.vue'), meta: { title: '账号设置', group: '系统管理', mode: 'advanced' } },
        { path: 'roles', name: 'roles', component: () => import('../views/RoleView.vue'), meta: { title: '角色管理' } },
        { path: 'permissions', name: 'permissions', component: () => import('../views/PermissionView.vue'), meta: { title: '权限管理' } },
        { path: 'forbidden', name: 'forbidden', component: () => import('../views/ForbiddenView.vue'), meta: { title: '无访问权限' } },
        { path: 'menus', name: 'menus', component: () => import('../views/MenuConfigView.vue'), meta: { title: '菜单配置', group: '系统管理', mode: 'advanced' } },
      ],
    },
  ],
})

router.beforeEach(async (to, from) => {
  const store = useCatalogStore()
  // Changing the temporary SKU scope is local navigation. Its working drafts
  // already have isolated keys; an ordinary config write must not hold it up.
  // Initial authorization migration and all route permission checks still apply.
  const localBrowseNavigation = to.name === from.name && ['skus','catalog'].includes(String(to.name)) && store.authorizationReady
  if (!localBrowseNavigation) await store.waitForPersistence()
  const legacyCatalog = legacyCatalogLocation(to.path, to.query)
  if(legacyCatalog)return {path:legacyCatalog.path,query:legacyCatalog.query as typeof to.query,hash:to.hash,replace:true}
  if(store.canRoute({path:to.path,query:to.query}))return true
  guideRouteFailure.value=createFailure({kind:'permission',ruleId:'rule-permission',actionId:'action-rbac-authorize',message:store.rbacEnforced?'当前身份没有此页面的有效访问授权。':'此地址不是已登记的正式页面；当前统一管理员模式仍保留路由登记保护。',savedState:'unchanged',context:{requiredPermissions:(routePermissions(to.path,to.query)||[]).join('、'),mode:store.rbacEnforced?'严格授权':'统一管理员'},recovery:['feedback']})
  return {path:'/forbidden',query:{from:to.fullPath}}
})

export default router
