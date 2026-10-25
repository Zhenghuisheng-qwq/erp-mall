import type { GuidePage } from '../types'

export const guidePages: GuidePage[] = [
  {
    "id": "page-home",
    "title": "商品工作台",
    "patterns": [
      "/"
    ],
    "articleId": "manual-home",
    "actionIds": [
      "action-workbench-search",
      "action-workbench-issues"
    ],
    "source": [
      "src/views/WorkbenchView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-categories",
    "title": "商品分类中心",
    "patterns": [
      "/categories"
    ],
    "articleId": "manual-categories",
    "actionIds": [
      "action-category-create",
      "action-category-rename",
      "action-category-move",
      "action-category-copy",
      "action-category-delete",
      "action-business-save"
    ],
    "source": [
      "src/views/CategoryView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-product-types",
    "title": "产品类型",
    "patterns": [
      "/product-types"
    ],
    "articleId": "manual-product-types",
    "actionIds": [
      "action-type-save",
      "action-type-models",
      "action-type-delete",
      "action-business-save"
    ],
    "source": [
      "src/views/ProductTypeView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-params",
    "title": "属性词典",
    "patterns": [
      "/params"
    ],
    "articleId": "manual-params",
    "actionIds": [
      "action-dictionary-save",
      "action-dictionary-value-remove",
      "action-business-save"
    ],
    "source": [
      "src/views/ParamView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-templates",
    "title": "属性方案",
    "patterns": [
      "/templates"
    ],
    "articleId": "manual-templates",
    "actionIds": [
      "action-template-create",
      "action-template-save",
      "action-template-copy",
      "action-template-delete",
      "action-business-save"
    ],
    "source": [
      "src/views/TemplateView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-models",
    "title": "商品模型列表",
    "patterns": [
      "/models"
    ],
    "articleId": "manual-models",
    "actionIds": [
      "action-model-create",
      "action-model-copy",
      "action-model-publish",
      "action-model-offline"
    ],
    "source": [
      "src/views/ModelListView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-specs",
    "title": "商品模型设计",
    "patterns": [
      "/specs"
    ],
    "articleId": "manual-specs",
    "actionIds": [
      "action-model-edit",
      "action-model-publish",
      "action-node-business-save",
      "action-node-naming-save",
      "action-material-relation"
    ],
    "source": [
      "src/views/SpecConfigView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-plans",
    "title": "商品规划（保留入口）",
    "patterns": [
      "/plans"
    ],
    "articleId": "manual-plans",
    "actionIds": [
      "action-planning-save",
      "action-planning-create-sku",
      "action-planning-delete"
    ],
    "source": [
      "src/views/ProductPlanView.vue"
    ],
    "formal": true,
    "historical": true
  },
  {
    "id": "page-tree",
    "title": "商品结构视图",
    "patterns": [
      "/tree"
    ],
    "articleId": "manual-tree",
    "actionIds": [
      "action-tree-query"
    ],
    "source": [
      "src/views/TreePage.vue"
    ],
    "formal": true,
    "historical": true
  },
  {
    "id": "page-spus",
    "title": "SPU 管理",
    "patterns": [
      "/spus"
    ],
    "articleId": "manual-spus",
    "actionIds": [
      "action-spu-query",
      "action-spu-view",
      "action-spu-delete"
    ],
    "source": [
      "src/views/ProductListView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-spu-create",
    "title": "新建 SPU",
    "patterns": [
      "/spus/new"
    ],
    "articleId": "manual-spu-create",
    "actionIds": [
      "action-spu-save",
      "action-business-save"
    ],
    "source": [
      "src/views/SpuEditView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-spu-edit",
    "title": "SPU 详情",
    "patterns": [
      "/spus/:id"
    ],
    "articleId": "manual-spu-edit",
    "actionIds": [
      "action-spu-save",
      "action-spu-history",
      "action-business-save"
    ],
    "source": [
      "src/views/SpuEditView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-skus",
    "title": "SKU 管理",
    "patterns": [
      "/skus"
    ],
    "articleId": "manual-skus",
    "actionIds": [
      "action-sku-query",
      "action-view-save",
      "action-view-restore",
      "action-sku-manual-order",
      "action-business-save"
    ],
    "source": [
      "src/views/SkuWorkbenchView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-sku-create",
    "title": "新增 SKU",
    "patterns": [
      "/skus/new"
    ],
    "articleId": "manual-sku-create",
    "actionIds": [
      "action-sku-preview",
      "action-sku-save"
    ],
    "source": [
      "src/views/SkuCreateView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-sku-edit",
    "title": "编辑 SKU",
    "patterns": [
      "/skus/:id"
    ],
    "articleId": "manual-sku-edit",
    "actionIds": [
      "action-sku-save",
      "action-business-save"
    ],
    "source": [
      "src/views/SkuEditView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-material-create",
    "title": "物料建档",
    "patterns": [
      "/materials/new"
    ],
    "articleId": "manual-material-create",
    "actionIds": [
      "action-material-create",
      "action-material-temporary",
      "action-business-save"
    ],
    "source": [
      "src/views/MaterialCreateView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-material-edit",
    "title": "物料档案",
    "patterns": [
      "/materials/:id"
    ],
    "articleId": "manual-material-edit",
    "actionIds": [
      "action-material-edit",
      "action-material-relation",
      "action-material-unlink"
    ],
    "source": [
      "src/views/ProductEditView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-compatibility",
    "title": "适用关系",
    "patterns": [
      "/compatibility"
    ],
    "articleId": "manual-compatibility",
    "actionIds": [
      "action-compatibility-bind",
      "action-compatibility-declare",
      "action-compatibility-sync",
      "action-compatibility-cancel"
    ],
    "source": [
      "src/views/CompatibilityView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-benefits",
    "title": "权益包与框架",
    "patterns": [
      "/benefit-packages"
    ],
    "articleId": "manual-benefits",
    "actionIds": [
      "action-framework-save",
      "action-benefit-copy",
      "action-benefit-query"
    ],
    "source": [
      "src/views/BenefitPackageListView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-benefit-create",
    "title": "新建权益包",
    "patterns": [
      "/benefit-packages/new"
    ],
    "articleId": "manual-benefit-create",
    "actionIds": [
      "action-benefit-save",
      "action-benefit-select",
      "action-benefit-quote"
    ],
    "source": [
      "src/views/BenefitPackageEditView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-benefit-edit",
    "title": "权益包详情",
    "patterns": [
      "/benefit-packages/:id"
    ],
    "articleId": "manual-benefit-edit",
    "actionIds": [
      "action-benefit-save",
      "action-benefit-deliver",
      "action-benefit-quote",
      "action-business-save"
    ],
    "source": [
      "src/views/BenefitPackageEditView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-benefit-delivery",
    "title": "交付清单",
    "patterns": [
      "/benefit-packages/deliveries/:id"
    ],
    "articleId": "manual-benefit-delivery",
    "actionIds": [
      "action-delivery-export"
    ],
    "source": [
      "src/views/BenefitDeliveryView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-brands",
    "title": "品牌中心",
    "patterns": [
      "/brands"
    ],
    "articleId": "manual-brands",
    "actionIds": [
      "action-brand-save",
      "action-business-save"
    ],
    "source": [
      "src/views/BrandView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-groups",
    "title": "运营分组",
    "patterns": [
      "/groups"
    ],
    "articleId": "manual-groups",
    "actionIds": [
      "action-group-link",
      "action-group-create",
      "action-business-save"
    ],
    "source": [
      "src/views/GroupView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-rules",
    "title": "规格约束",
    "patterns": [
      "/rules"
    ],
    "articleId": "manual-rules",
    "actionIds": [
      "action-constraint-save",
      "action-constraint-test",
      "action-business-save"
    ],
    "source": [
      "src/views/RuleView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-mappings",
    "title": "属性方案绑定（历史入口）",
    "patterns": [
      "/mappings"
    ],
    "articleId": "manual-mappings",
    "actionIds": [
      "action-mapping-save"
    ],
    "source": [
      "src/views/MappingView.vue"
    ],
    "formal": true,
    "historical": true
  },
  {
    "id": "page-overview",
    "title": "商品总览",
    "patterns": [
      "/overview"
    ],
    "articleId": "manual-overview",
    "actionIds": [
      "action-overview-query"
    ],
    "source": [
      "src/views/OverviewView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-check",
    "title": "商品质量检查",
    "patterns": [
      "/check"
    ],
    "articleId": "manual-check",
    "actionIds": [
      "action-check-locate"
    ],
    "source": [
      "src/views/CheckView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-import",
    "title": "商品导入导出",
    "patterns": [
      "/import"
    ],
    "articleId": "manual-import",
    "actionIds": [
      "action-json-import",
      "action-table-import",
      "action-backup-export",
      "action-business-save"
    ],
    "source": [
      "src/views/ProductIoView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-columns-spu",
    "title": "SPU 列配置与视图",
    "patterns": [
      "/spus?panel=columns"
    ],
    "articleId": "manual-columns-spu",
    "actionIds": [
      "action-spu-view"
    ],
    "source": [
      "src/views/ProductListView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-columns-sku",
    "title": "SKU 字段与视图设置",
    "patterns": [
      "/skus?panel=columns"
    ],
    "articleId": "manual-columns-sku",
    "actionIds": [
      "action-view-save",
      "action-view-restore"
    ],
    "source": [
      "src/views/SkuWorkbenchView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-menus",
    "title": "菜单配置",
    "patterns": [
      "/menus"
    ],
    "articleId": "manual-menus",
    "actionIds": [
      "action-menu-save",
      "action-menu-restore",
      "action-business-save"
    ],
    "source": [
      "src/views/MenuConfigView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-roles",
    "title": "角色管理",
    "patterns": [
      "/roles"
    ],
    "articleId": "manual-roles",
    "actionIds": [
      "action-role-save",
      "action-rbac-authorize",
      "action-role-delete",
      "action-rbac-recover",
      "action-business-save"
    ],
    "source": [
      "src/views/RoleView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-permissions",
    "title": "权限目录",
    "patterns": [
      "/permissions"
    ],
    "articleId": "manual-permissions",
    "actionIds": [
      "action-permission-save",
      "action-permission-reference",
      "action-business-save"
    ],
    "source": [
      "src/views/PermissionView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-users",
    "title": "用户管理",
    "patterns": [
      "/users"
    ],
    "articleId": "manual-users",
    "actionIds": [
      "action-user-save",
      "action-user-bind",
      "action-user-preview",
      "action-business-save"
    ],
    "source": [
      "src/views/UserView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-account",
    "title": "账号设置",
    "patterns": [
      "/account"
    ],
    "articleId": "manual-account",
    "actionIds": [
      "action-account-save",
      "action-account-password",
      "action-business-save"
    ],
    "source": [
      "src/views/AccountView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-feedback",
    "title": "反馈管理",
    "patterns": [
      "/feedback"
    ],
    "articleId": "manual-feedback",
    "actionIds": [
      "action-feedback-save",
      "action-feedback-export",
      "action-feedback-import",
      "action-business-save"
    ],
    "source": [
      "src/views/FeedbackView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-forbidden",
    "title": "无访问权限",
    "patterns": [
      "/forbidden"
    ],
    "articleId": "manual-forbidden",
    "actionIds": [
      "action-access-explain"
    ],
    "source": [
      "src/views/ForbiddenView.vue"
    ],
    "formal": false
  },
  {
    "id": "page-guide",
    "title": "业务指南首页",
    "patterns": [
      "/guide"
    ],
    "articleId": "manual-guide",
    "actionIds": [
      "action-guide-search",
      "action-guide-progress"
    ],
    "source": [
      "src/views/guide/GuideHomeView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-guide-article",
    "title": "指南文章",
    "patterns": [
      "/guide/articles/:articleId"
    ],
    "articleId": "manual-guide-article",
    "actionIds": [
      "action-guide-read",
      "action-guide-progress"
    ],
    "source": [
      "src/views/guide/GuideArticleView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-guide-learn",
    "title": "新人学习路线",
    "patterns": [
      "/guide/learn/:flowId"
    ],
    "articleId": "manual-guide-learn",
    "actionIds": [
      "action-guide-learn",
      "action-guide-progress"
    ],
    "source": [
      "src/views/guide/GuideLearnView.vue"
    ],
    "formal": true
  },
  {
    "id": "page-guide-manage",
    "title": "指南内容维护",
    "patterns": [
      "/guide/manage"
    ],
    "articleId": "manual-guide-manage",
    "actionIds": [
      "action-guide-draft",
      "action-guide-publish",
      "action-guide-import",
      "action-guide-maintain",
      "action-business-save"
    ],
    "source": [
      "src/views/guide/GuideManageView.vue"
    ],
    "formal": true
  }
]
