import { createRouter, createWebHistory } from 'vue-router'
import { canAccessLocation } from '../domain/menuConfig'
import { isMaterialArchive } from '../domain/catalogIdentity'
import AdminLayout from '../layouts/AdminLayout.vue'
import { useCatalogStore } from '../stores/catalog'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: '', name: 'home', component: () => import('../views/WorkbenchView.vue'), meta: { title: '商品工作台', group: '商品工作台', mode: 'daily' } },
        { path: 'products', redirect: to => ({ path: '/spus', query: to.query }) },
        { path: 'spus', name: 'spus', component: () => import('../views/ProductListView.vue'), props: { mode: 'spu' }, meta: { title: 'SPU 管理' } },
        { path: 'skus', name: 'skus', component: () => import('../views/ProductListView.vue'), props: { mode: 'sku' }, meta: { title: 'SKU 管理' } },
        { path: 'spus/new', name: 'spu-new', component: () => import('../views/SpuEditView.vue'), meta: { title: '新建 SPU' } },
        { path: 'spus/:id', name: 'spu-edit', component: () => import('../views/SpuEditView.vue'), meta: { title: 'SPU 详情' } },
        { path: 'skus/new', name: 'sku-new', component: () => import('../views/SkuCreateView.vue'), meta: { title: '新增 SKU' } },
        { path: 'skus/:id', name: 'sku-edit', component: () => import('../views/SkuEditView.vue'), meta: { title: '编辑 SKU' } },
        { path: 'materials/new', name: 'material-new', component: () => import('../views/MaterialCreateView.vue'), meta: { title: '物料建档' } },
        { path: 'materials/:id', name: 'material-edit', component: () => import('../views/ProductEditView.vue'), beforeEnter: to => useCatalogStore().data.families.some(item => item.id === to.params.id && item.line === 'v3') || `/spus/${to.params.id}`, meta: { title: '物料管理' } },
        { path: 'import', name: 'import', component: () => import('../views/ProductIoView.vue'), meta: { title: '导入导出', group: '商品中心', mode: 'daily' } },
        { path: 'compatibility', name: 'compatibility', component: () => import('../views/CompatibilityView.vue'), meta: { title: '适用关系', group: '商品中心', mode: 'daily' } },
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
        { path: 'categories', name: 'categories', component: () => import('../views/CategoryView.vue'), meta: { title: '商品分类中心', group: '商品中心', mode: 'advanced' } },
        { path: 'product-types', name: 'product-types', component: () => import('../views/ProductTypeView.vue'), meta: { title: '产品类型', group: '商品中心', mode: 'advanced' } },
        { path: 'templates', name: 'templates', component: () => import('../views/TemplateView.vue'), meta: { title: '属性方案', group: '商品中心', mode: 'advanced', admin: true } },
        { path: 'models', name: 'models', component: () => import('../views/ModelListView.vue'), meta: { title: '商品模型', group: '商品中心', mode: 'advanced' } },
        { path: 'plans', name: 'plans', component: () => import('../views/ProductPlanView.vue'), meta: { title: '商品规划', group: '商品中心', mode: 'advanced' } },
        { path: 'specs', name: 'specs', component: () => import('../views/SpecConfigView.vue'), meta: { title: '商品模型设计', group: '商品中心', mode: 'advanced', hide: true } },
        { path: 'params', name: 'params', component: () => import('../views/ParamView.vue'), meta: { title: '属性词典', group: '商品中心', mode: 'advanced' } },
        { path: 'brands', name: 'brands', component: () => import('../views/BrandView.vue'), meta: { title: '品牌中心', group: '商品中心', mode: 'advanced' } },
        { path: 'groups', name: 'groups', component: () => import('../views/GroupView.vue'), meta: { title: '运营分组', group: '商品中心', mode: 'advanced' } },
        { path: 'rules', name: 'rules', component: () => import('../views/RuleView.vue'), meta: { title: '规格约束', group: '高级配置', mode: 'advanced', admin: true } },
        { path: 'mappings', name: 'mappings', component: () => import('../views/MappingView.vue'), meta: { title: '属性方案绑定', group: '高级配置', mode: 'advanced', admin: true, hide: true } },
        { path: 'tree', name: 'tree', component: () => import('../views/TreePage.vue'), meta: { title: '商品结构视图', group: '开发工具', mode: 'advanced' } },
        { path: 'columns', redirect: { path: '/products', query: { panel: 'columns' } }, meta: { title: '列配置与视图', group: '高级配置', mode: 'advanced' } },
        { path: 'users', name: 'users', component: () => import('../views/UserView.vue'), meta: { title: '用户管理', group: '系统管理', mode: 'advanced', admin: true } },
        { path: 'feedback', name: 'feedback', component: () => import('../views/FeedbackView.vue'), meta: { title: '反馈管理', group: '系统管理', mode: 'advanced' } },
        { path: 'account', name: 'account', component: () => import('../views/AccountView.vue'), meta: { title: '账号设置', group: '系统管理', mode: 'advanced' } },
        { path: 'menus', name: 'menus', component: () => import('../views/MenuConfigView.vue'), meta: { title: '菜单配置', group: '系统管理', mode: 'advanced', admin: true } },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const store = useCatalogStore()
  const role = store.data.activeRole
  if (to.meta.admin && role !== 'admin') return to.path === '/' ? true : '/'
  if (!canAccessLocation(role, to.path, to.query) && to.path !== '/') return '/'
  return true
})

export default router
