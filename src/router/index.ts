import { createRouter, createWebHistory } from 'vue-router'
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
        { path: 'products', name: 'products', component: () => import('../views/ProductListView.vue'), meta: { title: '商品列表', group: '商品工作台', mode: 'daily' } },
        { path: 'import', name: 'import', component: () => import('../views/ProductIoView.vue'), meta: { title: '导入导出', group: '商品中心', mode: 'daily' } },
        { path: 'products/new', name: 'product-new', component: () => import('../views/ProductEditView.vue'), meta: { title: '新增商品', group: '商品工作台', mode: 'daily', hide: true } },
        { path: 'products/:id', name: 'product-edit', component: () => import('../views/ProductEditView.vue'), meta: { title: '编辑商品', group: '商品工作台', mode: 'daily', hide: true } },
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
      ],
    },
  ],
})

router.beforeEach((to) => {
  const store = useCatalogStore()
  if (to.meta.admin && store.data.activeRole !== 'admin') return '/'
  return true
})

export default router
