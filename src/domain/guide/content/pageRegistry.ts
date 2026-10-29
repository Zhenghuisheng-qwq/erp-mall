import type { GuidePage } from '../types'
import { catalogPages } from './manuals-catalog'

export const guidePages: GuidePage[] = [
  ...catalogPages,
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
    "formal": true
  },
  {
    "id": "page-categories",
    "title": "整理分类",
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
    "formal": true
  },
  {
    "id": "page-compatibility",
    "title": "兼容性查询",
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
    "formal": false
  },
  {
    "id": "page-guide",
    "title": "系统功能说明",
    "patterns": [
      "/guide"
    ],
    "articleId": "manual-guide",
    "actionIds": [
      "action-guide-search"
    ],
    "formal": true
  },
  {
    "id": "page-guide-article",
    "title": "页面功能说明",
    "patterns": [
      "/guide/articles/:articleId"
    ],
    "articleId": "manual-guide-article",
    "actionIds": [
      "action-guide-read"
    ],
    "formal": true
  }
]
