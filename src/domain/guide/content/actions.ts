import type { GuideArticle } from '../types'

export const guideActionArticles: GuideArticle[] = [
  {
    "id": "action-workbench-search",
    "title": "从工作台查商品",
    "kind": "action",
    "summary": "完成从工作台查商品，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "从工作台查商品",
      "workbench-search"
    ],
    "pageIds": [
      "page-home"
    ],
    "actionIds": [],
    "ruleIds": [],
    "related": [
      "manual-home"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/WorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#action-workbench-search"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "从工作台查商品：展示已有主体结果，不创建商品"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可读取工作台；严格模式下目标页面还需独立查看权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品工作台中的“从工作台查商品”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "输入关键词",
          "进入商品列表并核对筛选范围"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "展示已有主体结果，不创建商品"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "从工作台查商品只改变查询条件或跳转，不提交商品变更。目标入口仍检查访问权限；无结果先清除关键词核对范围。"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无结果清词并核对分类"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-workbench-issues",
    "title": "从工作台定位问题",
    "kind": "action",
    "summary": "完成从工作台定位问题，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "从工作台定位问题",
      "workbench-issues"
    ],
    "pageIds": [
      "page-home"
    ],
    "actionIds": [],
    "ruleIds": [],
    "related": [
      "manual-home"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/WorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#action-workbench-issues"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "从工作台定位问题：进入真实问题列表"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可读取工作台；严格模式下目标页面还需独立查看权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品工作台中的“从工作台定位问题”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "查看问题统计",
          "打开商品质量检查"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "进入真实问题列表"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "从工作台定位问题只改变查询条件或跳转，不提交商品变更。目标入口仍检查访问权限；无结果先清除关键词核对范围。"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "问题对象失效时回商品列表查询"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-category-create",
    "title": "新建分类",
    "kind": "action",
    "summary": "完成新建分类，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "新建分类",
      "category-create"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-category-typed-target",
      "rule-persistence"
    ],
    "related": [
      "manual-categories"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "docs/business-guide/content-source-audit.md#action-category-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "新建分类：分类加入指定层级并持久化"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品分类中心中的“新建分类”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "切换编辑模式",
          "选上级或新增根分类，填写名称后保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "分类加入指定层级并持久化"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "绑定类型的目标不接收子分类",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "名称为空修正；目标绑定类型改选上级"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-category-rename",
    "title": "改分类名",
    "kind": "action",
    "summary": "完成改分类名，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "改分类名",
      "category-rename"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-category-input",
      "rule-persistence"
    ],
    "related": [
      "manual-categories"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "docs/business-guide/content-source-audit.md#action-category-rename"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "改分类名：同一分类 ID 显示新名称"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品分类中心中的“改分类名”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "编辑模式双击名称",
          "填写名称并回车确认"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "同一分类 ID 显示新名称"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "分类名称与记录必须有效",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "空名称或来源失效先修正；取消不改名，写盘失败按原提示处理"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-category-move",
    "title": "移动分类子树",
    "kind": "action",
    "summary": "完成移动分类子树，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "移动分类子树",
      "category-move"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-category-typed-target",
      "rule-category-cycle",
      "rule-category-stale",
      "rule-persistence"
    ],
    "related": [
      "manual-categories"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "docs/business-guide/content-source-audit.md#action-category-move"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "移动分类子树：整个真实子树移动并保存"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品分类中心中的“移动分类子树”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "右侧暂存来源",
          "左侧选目标或顶级分类",
          "核对路径后确认移动"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "整个真实子树移动并保存"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "绑定类型的目标不接收子分类",
          "分类移动不得形成循环",
          "分类来源与目标须仍有效",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "目标类型/循环/失效拒绝；保留待移动内容另选目标"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-category-copy",
    "title": "复制分类树",
    "kind": "action",
    "summary": "完成复制分类树，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "复制分类树",
      "category-copy"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-category-stale",
      "rule-persistence"
    ],
    "related": [
      "manual-categories"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "docs/business-guide/content-source-audit.md#action-category-copy"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "复制分类树：产生独立分类，不复制商品"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品分类中心中的“复制分类树”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择来源并点击复制",
          "确认复制分类及子分类"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "产生独立分类，不复制商品"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "分类来源与目标须仍有效",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "不可用来源先刷新定位；失败不当作完成"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-category-delete",
    "title": "删除分类",
    "kind": "action",
    "summary": "完成删除分类，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除分类",
      "category-delete"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-category-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-categories"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "docs/business-guide/content-source-audit.md#action-category-delete"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除分类：仅合法空分类被删除"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品分类中心中的“删除分类”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "核对引用和挂载商品",
          "确认删除分类"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "仅合法空分类被删除"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "分类删除保留真实下游",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "有子分类、商品或产品类型先处理真实下游；合法删除会清对应方案绑定，不级联删商品"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-type-save",
    "title": "保存产品类型",
    "kind": "action",
    "summary": "完成保存产品类型，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存产品类型",
      "type-save"
    ],
    "pageIds": [
      "page-product-types"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-type-category",
      "rule-type-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-product-types"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductTypeView.vue",
      "docs/business-guide/content-source-audit.md#action-type-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存产品类型：类型显式关联目标分类"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先选择分类范围；维护需产品类型创建/编辑/删除权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "产品类型中的“保存产品类型”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选分类范围和目标分类",
          "填写类型名称并保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "类型显式关联目标分类"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "产品类型只关联有效末级分类",
          "类型迁移与删除须保留引用",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "末级或引用限制失败先核对分类与模型"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-type-models",
    "title": "查看类型模型",
    "kind": "action",
    "summary": "完成查看类型模型，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查看类型模型",
      "type-models"
    ],
    "pageIds": [
      "page-product-types"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-type-category",
      "rule-type-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-product-types"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductTypeView.vue",
      "docs/business-guide/content-source-audit.md#action-type-models"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查看类型模型：定位该类型的既有模型"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先选择分类范围；维护需产品类型创建/编辑/删除权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "产品类型中的“查看类型模型”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选中类型",
          "打开查看模型"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "定位该类型的既有模型"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "产品类型只关联有效末级分类",
          "类型迁移与删除须保留引用",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无关联模型可从模型页按权限创建"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-type-delete",
    "title": "删除产品类型",
    "kind": "action",
    "summary": "完成删除产品类型，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除产品类型",
      "type-delete"
    ],
    "pageIds": [
      "page-product-types"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-type-category",
      "rule-type-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-product-types"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductTypeView.vue",
      "docs/business-guide/content-source-audit.md#action-type-delete"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除产品类型：仅未受引用的类型移除"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先选择分类范围；维护需产品类型创建/编辑/删除权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "产品类型中的“删除产品类型”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "查看模型和商品引用",
          "确认删除"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "仅未受引用的类型移除"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "产品类型只关联有效末级分类",
          "类型迁移与删除须保留引用",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "有引用先维护关联，不自动清历史"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-dictionary-save",
    "title": "保存全局属性与取值",
    "kind": "action",
    "summary": "完成保存全局属性与取值，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存全局属性与取值",
      "dictionary-save"
    ],
    "pageIds": [
      "page-params"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-dictionary-reference",
      "rule-model-dictionary",
      "rule-persistence"
    ],
    "related": [
      "manual-params"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ParamView.vue",
      "docs/business-guide/content-source-audit.md#action-dictionary-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存全局属性与取值：全局候选更新"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "维护需词典权限；先辨别全局改名与节点引用选择的区别。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性词典中的“保存全局属性与取值”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "打开新建参数或编辑",
          "填写正式名称和值并保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "全局候选更新"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "引用中的词典不能任意删除改名",
          "模型发布须保有真实词典引用",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "重名多义先按 ID 选择，不按文字强行合并"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-dictionary-value-remove",
    "title": "删除或改名词典取值",
    "kind": "action",
    "summary": "完成删除或改名词典取值，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除或改名词典取值",
      "dictionary-value-remove"
    ],
    "pageIds": [
      "page-params"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-dictionary-reference",
      "rule-model-dictionary",
      "rule-persistence"
    ],
    "related": [
      "manual-params"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ParamView.vue",
      "docs/business-guide/content-source-audit.md#action-dictionary-value-remove"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除或改名词典取值：未引用值可维护，引用值受保护"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "维护需词典权限；先辨别全局改名与节点引用选择的区别。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性词典中的“删除或改名词典取值”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "确认所属属性 ID 和实际值",
          "阅读引用来源后执行允许维护"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "未引用值可维护，引用值受保护"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "引用中的词典不能任意删除改名",
          "模型发布须保有真实词典引用",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "草稿/历史/允许值配置引用时停止并定位原节点"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-template-create",
    "title": "新建属性方案",
    "kind": "action",
    "summary": "完成新建属性方案，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "新建属性方案",
      "template-create"
    ],
    "pageIds": [
      "page-templates"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-template-bindings",
      "rule-dictionary-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-templates"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TemplateView.vue",
      "docs/business-guide/content-source-audit.md#action-template-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "新建属性方案：正式方案落盘，取消无半成品"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先有正式属性词典；新建、编辑、复制、删除按实际资源权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性方案中的“新建属性方案”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "点击新建方案",
          "配置名称和绑定属性",
          "确认保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "正式方案落盘，取消无半成品"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "方案绑定必须是真实词典属性",
          "引用中的词典不能任意删除改名",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "必填、权限或存储失败保留当前草稿"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-template-save",
    "title": "配置方案绑定",
    "kind": "action",
    "summary": "完成配置方案绑定，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "配置方案绑定",
      "template-save"
    ],
    "pageIds": [
      "page-templates"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-template-bindings",
      "rule-dictionary-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-templates"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TemplateView.vue",
      "docs/business-guide/content-source-audit.md#action-template-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "配置方案绑定：相同方案绑定更新"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先有正式属性词典；新建、编辑、复制、删除按实际资源权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性方案中的“配置方案绑定”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "加入词典属性",
          "选择公共/规格、必填和顺序",
          "核对影响后保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "相同方案绑定更新"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "方案绑定必须是真实词典属性",
          "引用中的词典不能任意删除改名",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "被引用影响需确认，非法绑定先修复"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-template-copy",
    "title": "复制属性方案",
    "kind": "action",
    "summary": "完成复制属性方案，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "复制属性方案",
      "template-copy"
    ],
    "pageIds": [
      "page-templates"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-template-bindings",
      "rule-dictionary-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-templates"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TemplateView.vue",
      "docs/business-guide/content-source-audit.md#action-template-copy"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "复制属性方案：新方案有独立身份，原方案不变"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先有正式属性词典；新建、编辑、复制、删除按实际资源权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性方案中的“复制属性方案”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择源方案复制",
          "在独立草稿改名称与属性",
          "保存副本"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "新方案有独立身份，原方案不变"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "方案绑定必须是真实词典属性",
          "引用中的词典不能任意删除改名",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "取消不留孤立副本；模型源走模型复制保护"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-template-delete",
    "title": "删除属性方案",
    "kind": "action",
    "summary": "完成删除属性方案，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除属性方案",
      "template-delete"
    ],
    "pageIds": [
      "page-templates"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-template-bindings",
      "rule-dictionary-reference",
      "rule-persistence"
    ],
    "related": [
      "manual-templates"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TemplateView.vue",
      "docs/business-guide/content-source-audit.md#action-template-delete"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除属性方案：未引用方案移除"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先有正式属性词典；新建、编辑、复制、删除按实际资源权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性方案中的“删除属性方案”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "检查引用数量",
          "确认删除"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "未引用方案移除"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "方案绑定必须是真实词典属性",
          "引用中的词典不能任意删除改名",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "有分类/商品引用先核对关联"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-model-create",
    "title": "新建模型",
    "kind": "action",
    "summary": "完成新建模型，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "新建模型",
      "model-create"
    ],
    "pageIds": [
      "page-models"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-material-source"
    ],
    "related": [
      "manual-models"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ModelListView.vue",
      "docs/business-guide/content-source-audit.md#action-model-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "新建模型：产生空白模型草稿"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "创建模型需要可用分类/类型；编辑与发布是不同能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型列表中的“新建模型”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择分类和显式产品类型",
          "填写模型名并创建"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "产生空白模型草稿"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布树必须满足真实结构",
          "模型发布须保有真实词典引用",
          "发布依据与历史快照保持",
          "正式物料来源必须一致"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "分类类型不一致重新选择"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-model-copy",
    "title": "复制模型",
    "kind": "action",
    "summary": "完成复制模型，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "复制模型",
      "model-copy"
    ],
    "pageIds": [
      "page-models"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-material-source"
    ],
    "related": [
      "manual-models"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ModelListView.vue",
      "docs/business-guide/content-source-audit.md#action-model-copy"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "复制模型：复制结构和配置，不复制商品及历史版本"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "创建模型需要可用分类/类型；编辑与发布是不同能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型列表中的“复制模型”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择已有模型复制",
          "核对新草稿名称与结构"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "复制结构和配置，不复制商品及历史版本"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布树必须满足真实结构",
          "模型发布须保有真实词典引用",
          "发布依据与历史快照保持",
          "正式物料来源必须一致"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "权限或源模型失效时保留原模型并重选"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-model-publish",
    "title": "发布模型版本",
    "kind": "action",
    "summary": "完成发布模型版本，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "发布模型版本",
      "model-publish"
    ],
    "pageIds": [
      "page-models",
      "page-specs"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-dictionary",
      "rule-model-structure",
      "rule-node-config",
      "rule-model-history",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-models"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ModelListView.vue",
      "src/views/SpecConfigView.vue",
      "docs/business-guide/content-source-audit.md#action-model-publish"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "发布模型版本：生成新的不可变发布快照"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "创建模型需要可用分类/类型；编辑与发布是不同能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型列表中的“发布模型版本”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "先保存模型",
          "结构检查并定位词典/业务问题",
          "确认发布"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "生成新的不可变发布快照"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "模型发布须保有真实词典引用",
          "发布树必须满足真实结构",
          "值业务配置是附属实例",
          "发布依据与历史快照保持",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "词典缺失/结构混挂/未知配置修复后重发"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-model-offline",
    "title": "下线模型",
    "kind": "action",
    "summary": "完成下线模型，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "下线模型",
      "model-offline"
    ],
    "pageIds": [
      "page-models"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-material-source"
    ],
    "related": [
      "manual-models"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ModelListView.vue",
      "docs/business-guide/content-source-audit.md#action-model-offline"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "下线模型：后续新建不再使用下线模型，历史依旧读原版"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "创建模型需要可用分类/类型；编辑与发布是不同能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型列表中的“下线模型”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "在模型列表选择下线",
          "核对后续使用限制"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "后续新建不再使用下线模型，历史依旧读原版"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布树必须满足真实结构",
          "模型发布须保有真实词典引用",
          "发布依据与历史快照保持",
          "正式物料来源必须一致"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "没有更新权限不能改变状态"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-model-edit",
    "title": "编辑模型节点",
    "kind": "action",
    "summary": "完成编辑模型节点，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "编辑模型节点",
      "model-edit"
    ],
    "pageIds": [
      "page-specs"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-node-config",
      "rule-material-source"
    ],
    "related": [
      "manual-specs"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpecConfigView.vue",
      "docs/business-guide/content-source-audit.md#action-model-edit"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "编辑模型节点：草稿树更新，发布版不自动改变"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "选择模型；查看模式只读，进入编辑后才能改结构；保存和发布授权分离。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型设计中的“编辑模型节点”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "进入编辑并选择结构/大纲/幕布",
          "引用词典建立真实属性/值",
          "保存模型"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "草稿树更新，发布版不自动改变"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布树必须满足真实结构",
          "模型发布须保有真实词典引用",
          "发布依据与历史快照保持",
          "值业务配置是附属实例",
          "正式物料来源必须一致"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "混挂子级或无词典引用定位具体节点"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-node-business-save",
    "title": "保存值节点业务配置",
    "kind": "action",
    "summary": "完成保存值节点业务配置，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存值节点业务配置",
      "node-business-save"
    ],
    "pageIds": [
      "page-specs"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-node-config",
      "rule-material-source"
    ],
    "related": [
      "manual-specs"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpecConfigView.vue",
      "docs/business-guide/content-source-audit.md#action-node-business-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存值节点业务配置：配置附着于该值，不增加规格分支"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "选择模型；查看模式只读，进入编辑后才能改结构；保存和发布授权分离。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型设计中的“保存值节点业务配置”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择值节点打开业务配置",
          "选择公共定义、范围和实例参数",
          "检查冲突再保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "配置附着于该值，不增加规格分支"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布树必须满足真实结构",
          "模型发布须保有真实词典引用",
          "发布依据与历史快照保持",
          "值业务配置是附属实例",
          "正式物料来源必须一致"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "未知类型保留原文并禁止受影响发布"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-node-naming-save",
    "title": "设置节点命名",
    "kind": "action",
    "summary": "完成设置节点命名，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "设置节点命名",
      "node-naming-save"
    ],
    "pageIds": [
      "page-specs"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-node-config",
      "rule-material-source"
    ],
    "related": [
      "manual-specs"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpecConfigView.vue",
      "docs/business-guide/content-source-audit.md#action-node-naming-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "设置节点命名：按最近适用祖先规则得到建议名称"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "选择模型；查看模式只读，进入编辑后才能改结构；保存和发布授权分离。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型设计中的“设置节点命名”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选节点命名规则",
          "编辑片段并预览真实组合",
          "保存模型后发布"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "按最近适用祖先规则得到建议名称"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布树必须满足真实结构",
          "模型发布须保有真实词典引用",
          "发布依据与历史快照保持",
          "值业务配置是附属实例",
          "正式物料来源必须一致"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "冲突看来源，不自动改写旧物料名"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-planning-save",
    "title": "保存规划范围",
    "kind": "action",
    "summary": "完成保存规划范围，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存规划范围",
      "planning-save"
    ],
    "pageIds": [
      "page-plans"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-history",
      "rule-sku-identity"
    ],
    "related": [
      "manual-plans"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductPlanView.vue",
      "docs/business-guide/content-source-audit.md#action-planning-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存规划范围：保留所选范围与具体版本"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需有已发布模型；规划维护和创建 SKU 分别检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品规划（保留入口）中的“保存规划范围”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "进入发布模型",
          "选择上层真实取值并核对名称",
          "保存规划"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "保留所选范围与具体版本"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布依据与历史快照保持",
          "SKU 追加去重和来源锁定"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "来源失效重新读取发布依据"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-planning-create-sku",
    "title": "从规划追加 SKU",
    "kind": "action",
    "summary": "完成从规划追加 SKU，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "从规划追加 SKU",
      "planning-create-sku"
    ],
    "pageIds": [
      "page-plans"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-history",
      "rule-sku-identity"
    ],
    "related": [
      "manual-plans"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductPlanView.vue",
      "docs/business-guide/content-source-audit.md#action-planning-create-sku"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "从规划追加 SKU：每条新增 SKU 留存规划/版本来源"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需有已发布模型；规划维护和创建 SKU 分别检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品规划（保留入口）中的“从规划追加 SKU”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "在规划点创建 SKU",
          "选择兼容 SPU",
          "预览、勾选可新增并确认"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "每条新增 SKU 留存规划/版本来源"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布依据与历史快照保持",
          "SKU 追加去重和来源锁定"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "已有身份跳过；不兼容主体重新选择"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-planning-delete",
    "title": "删除保存规划",
    "kind": "action",
    "summary": "完成删除保存规划，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除保存规划",
      "planning-delete"
    ],
    "pageIds": [
      "page-plans"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-model-history",
      "rule-sku-identity"
    ],
    "related": [
      "manual-plans"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductPlanView.vue",
      "docs/business-guide/content-source-audit.md#action-planning-delete"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除保存规划：允许删除的规划移除"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需有已发布模型；规划维护和创建 SKU 分别检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品规划（保留入口）中的“删除保存规划”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "核对已有商品与来源引用",
          "点击删除并处理提示"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "允许删除的规划移除"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "发布依据与历史快照保持",
          "SKU 追加去重和来源锁定"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "引用限制保留原记录，先查看下游"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-tree-query",
    "title": "在结构视图定位商品",
    "kind": "action",
    "summary": "完成在结构视图定位商品，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "在结构视图定位商品",
      "tree-query"
    ],
    "pageIds": [
      "page-tree"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation"
    ],
    "related": [
      "manual-tree"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TreePage.vue",
      "docs/business-guide/content-source-audit.md#action-tree-query"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "在结构视图定位商品：进入真实详情，结构本身只读"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "有结构视图读取权限；维护对象须进入相应业务页面并重新检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品结构视图中的“在结构视图定位商品”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "展开结构",
          "选择对象并打开商品"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "进入真实详情，结构本身只读"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "空树先核对已保存数据和范围"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-spu-query",
    "title": "查询 SPU",
    "kind": "action",
    "summary": "完成查询 SPU，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查询 SPU",
      "spu-query"
    ],
    "pageIds": [
      "page-spus"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation",
      "rule-view-isolation",
      "rule-spu-reference"
    ],
    "related": [
      "manual-spus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductListView.vue",
      "docs/business-guide/content-source-audit.md#action-spu-query"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查询 SPU：结果按主体统计，SKU/MAT 分别展示"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看 SPU；新增、编辑、上下架、删除分别按当前模式检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SPU 管理中的“查询 SPU”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选视图和分类",
          "输入关键词与真实字段条件",
          "用标签清除条件"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "结果按主体统计，SKU/MAT 分别展示"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份",
          "视图、临时范围与业务数据分离",
          "SPU 删除不级联清子记录"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无结果先清条件；保留临时范围"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-spu-view",
    "title": "配置 SPU 视图",
    "kind": "action",
    "summary": "完成配置 SPU 视图，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "配置 SPU 视图",
      "spu-view"
    ],
    "pageIds": [
      "page-spus",
      "page-columns-spu"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation",
      "rule-view-isolation",
      "rule-spu-reference"
    ],
    "related": [
      "manual-spus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductListView.vue",
      "docs/business-guide/content-source-audit.md#action-spu-view"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "配置 SPU 视图：配置按现有本机约定恢复"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看 SPU；新增、编辑、上下架、删除分别按当前模式检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SPU 管理中的“配置 SPU 视图”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "打开列表设置",
          "调整字段顺序、分组排序",
          "核对自动保存或另存视图"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "配置按现有本机约定恢复"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份",
          "视图、临时范围与业务数据分离",
          "SPU 删除不级联清子记录"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "不擅自清旧视图；恢复默认列是明确操作"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-spu-delete",
    "title": "删除 SPU",
    "kind": "action",
    "summary": "完成删除 SPU，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除 SPU",
      "spu-delete"
    ],
    "pageIds": [
      "page-spus"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation",
      "rule-view-isolation",
      "rule-spu-reference"
    ],
    "related": [
      "manual-spus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductListView.vue",
      "docs/business-guide/content-source-audit.md#action-spu-delete"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除 SPU：只有允许的空主体可删除"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看 SPU；新增、编辑、上下架、删除分别按当前模式检查权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SPU 管理中的“删除 SPU”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "核对上下架和子记录",
          "更多中删除并确认"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只有允许的空主体可删除"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份",
          "视图、临时范围与业务数据分离",
          "SPU 删除不级联清子记录"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "已发布先下架；有 SKU/MAT 或引用先处理"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-spu-save",
    "title": "保存 SPU 主体",
    "kind": "action",
    "summary": "完成保存 SPU 主体，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存 SPU 主体",
      "spu-save"
    ],
    "pageIds": [
      "page-spu-create",
      "page-spu-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-spu-input",
      "rule-spu-identity",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-spu-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpuEditView.vue",
      "docs/business-guide/content-source-audit.md#action-spu-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存 SPU 主体：先写主体，再明确进入 SKU 创建"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具有 SPU 创建权限；选择合法分类及对应类型/方案/模型依据。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新建 SPU中的“保存 SPU 主体”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "填写主体名和合法分类来源",
          "核对公共信息及状态",
          "保存或保存并新增 SKU"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "先写主体，再明确进入 SKU 创建"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "SPU 输入与有效引用",
          "有下游的 SPU 身份锁定",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "必填/身份锁定/权限失败修正原输入；写盘失败重试"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-spu-history",
    "title": "查看主体历史依据",
    "kind": "action",
    "summary": "完成查看主体历史依据，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查看主体历史依据",
      "spu-history"
    ],
    "pageIds": [
      "page-spu-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-spu-identity",
      "rule-model-history",
      "rule-persistence"
    ],
    "related": [
      "manual-spu-edit"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpuEditView.vue",
      "docs/business-guide/content-source-audit.md#action-spu-history"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查看主体历史依据：读取绑定的具体发布节点快照"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "路由 id 为 SPU；已有子记录时身份字段受既有锁定规则约束。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SPU 详情中的“查看主体历史依据”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "打开已有 SPU",
          "点击查看历史快照"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "读取绑定的具体发布节点快照"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "有下游的 SPU 身份锁定",
          "发布依据与历史快照保持",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无绑定版如实显示未绑定，不补造来源"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-sku-query",
    "title": "查询销售 SKU",
    "kind": "action",
    "summary": "完成查询销售 SKU，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查询销售 SKU",
      "sku-query"
    ],
    "pageIds": [
      "page-skus"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-view-isolation",
      "rule-view-conditions",
      "rule-sku-identity",
      "rule-persistence"
    ],
    "related": [
      "manual-skus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuWorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#action-sku-query"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查询销售 SKU：只查询真实销售记录"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备 SKU 查看；操作按新增/编辑/删除授权；视图配置独立于业务对象。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SKU 管理中的“查询销售 SKU”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择视图及临时搜索",
          "在更多筛选编辑 AND/OR 条件",
          "核对范围、结果与清除标签"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只查询真实销售记录"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "视图、临时范围与业务数据分离",
          "筛选逻辑与手工顺序保持",
          "SKU 追加去重和来源锁定",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "失效配置暂停查询，修复字段而非扩大范围"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-view-save",
    "title": "保存 SKU 列表视图",
    "kind": "action",
    "summary": "完成保存 SKU 列表视图，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存 SKU 列表视图",
      "view-save"
    ],
    "pageIds": [
      "page-skus",
      "page-columns-sku"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-view-isolation",
      "rule-view-conditions",
      "rule-persistence"
    ],
    "related": [
      "manual-skus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuWorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#action-view-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存 SKU 列表视图：正式配置与本机工作配置按原约定保存"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备 SKU 查看；操作按新增/编辑/删除授权；视图配置独立于业务对象。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SKU 管理中的“保存 SKU 列表视图”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "在字段/筛选/排序面板应用工作配置",
          "保存视图或另存为",
          "刷新核对"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "正式配置与本机工作配置按原约定保存"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "视图、临时范围与业务数据分离",
          "筛选逻辑与手工顺序保持",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "存储失败保留工作配置，修正后重试"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-view-restore",
    "title": "恢复 SKU 正式视图",
    "kind": "action",
    "summary": "完成恢复 SKU 正式视图，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "恢复 SKU 正式视图",
      "view-restore"
    ],
    "pageIds": [
      "page-skus",
      "page-columns-sku"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-view-isolation",
      "rule-view-conditions",
      "rule-sku-identity",
      "rule-persistence"
    ],
    "related": [
      "manual-skus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuWorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#action-view-restore"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "恢复 SKU 正式视图：恢复当前正式配置，临时搜索仍按原流程保留"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备 SKU 查看；操作按新增/编辑/删除授权；视图配置独立于业务对象。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SKU 管理中的“恢复 SKU 正式视图”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "确认不需当前未保存工作配置",
          "点击恢复已保存配置"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "恢复当前正式配置，临时搜索仍按原流程保留"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "视图、临时范围与业务数据分离",
          "筛选逻辑与手工顺序保持",
          "SKU 追加去重和来源锁定",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "不把恢复视图当重置商品数据"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-sku-manual-order",
    "title": "跨页手工排序",
    "kind": "action",
    "summary": "完成跨页手工排序，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "跨页手工排序",
      "sku-manual-order"
    ],
    "pageIds": [
      "page-skus"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-view-isolation",
      "rule-view-conditions",
      "rule-sku-identity",
      "rule-persistence"
    ],
    "related": [
      "manual-skus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuWorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#action-sku-manual-order"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "跨页手工排序：只改变手工展示顺序"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备 SKU 查看；操作按新增/编辑/删除授权；视图配置独立于业务对象。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "SKU 管理中的“跨页手工排序”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "清除冲突分组和字段排序",
          "勾选行加入排序暂存",
          "在目标更多中插到前面/后面并确认"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只改变手工展示顺序"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "视图、临时范围与业务数据分离",
          "筛选逻辑与手工顺序保持",
          "SKU 追加去重和来源锁定",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "对象失效或排序冲突先修正范围，不删除业务记录"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-sku-preview",
    "title": "预览新增 SKU",
    "kind": "action",
    "summary": "完成预览新增 SKU，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "预览新增 SKU",
      "sku-preview"
    ],
    "pageIds": [
      "page-sku-create"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-sku-input",
      "rule-sku-identity"
    ],
    "related": [
      "manual-sku-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuCreateView.vue",
      "docs/business-guide/content-source-audit.md#action-sku-preview"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "预览新增 SKU：预览不写业务数据"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "SPU 配置完整且来源兼容；按实际当前授权显示确认能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新增 SKU中的“预览新增 SKU”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选有效 SPU 和生成方式",
          "填写规格并预览",
          "区分可新增/已存在/无效"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "预览不写业务数据"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "SKU 规格必须属于主体方案",
          "SKU 追加去重和来源锁定"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "来源不一致补 SPU；变化后重新预览"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-sku-save",
    "title": "保存销售 SKU",
    "kind": "action",
    "summary": "完成保存销售 SKU，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存销售 SKU",
      "sku-save"
    ],
    "pageIds": [
      "page-sku-create",
      "page-sku-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-sku-input",
      "rule-sku-identity",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-sku-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuCreateView.vue",
      "src/views/SkuEditView.vue",
      "docs/business-guide/content-source-audit.md#action-sku-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存销售 SKU：创建或更新真实 SKU，保留主体和来源"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "SPU 配置完整且来源兼容；按实际当前授权显示确认能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新增 SKU中的“保存销售 SKU”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "新增页确认勾选规格，或编辑页改允许字段",
          "等待保存成功"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "创建或更新真实 SKU，保留主体和来源"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "SKU 规格必须属于主体方案",
          "SKU 追加去重和来源锁定",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "重复/非法身份拒绝，保留输入并重新核对"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-material-create",
    "title": "正式物料建档",
    "kind": "action",
    "summary": "完成正式物料建档，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "正式物料建档",
      "material-create"
    ],
    "pageIds": [
      "page-material-create"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-material-source",
      "rule-material-planning",
      "rule-material-identity",
      "rule-persistence"
    ],
    "related": [
      "manual-material-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MaterialCreateView.vue",
      "docs/business-guide/content-source-audit.md#action-material-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "正式物料建档：生成 MAT 并保存原始 PLN/版本依据"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "正式建档需一致且有效的发布依据；临时建档显式选择类型，不冒充正式规划。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "物料建档中的“正式物料建档”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择一致分类类型和发布版",
          "选择完整规划并预览",
          "确认建档"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "生成 MAT 并保存原始 PLN/版本依据"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "正式物料来源必须一致",
          "正式规划必须可用且完整",
          "MAT 与销售 SKU 身份分离",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "来源或规划失效重新选择，不覆盖旧档"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-material-temporary",
    "title": "创建临时物料",
    "kind": "action",
    "summary": "完成创建临时物料，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "创建临时物料",
      "material-temporary"
    ],
    "pageIds": [
      "page-material-create"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-material-source",
      "rule-material-planning",
      "rule-material-identity",
      "rule-persistence"
    ],
    "related": [
      "manual-material-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MaterialCreateView.vue",
      "docs/business-guide/content-source-audit.md#action-material-temporary"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "创建临时物料：创建无伪造正式 PLN 的临时 MAT"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "正式建档需一致且有效的发布依据；临时建档显式选择类型，不冒充正式规划。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "物料建档中的“创建临时物料”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择类型并打开临时物料",
          "填写实际人工属性和名称",
          "明确确认保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "创建无伪造正式 PLN 的临时 MAT"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "正式物料来源必须一致",
          "正式规划必须可用且完整",
          "MAT 与销售 SKU 身份分离",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "类型/输入不合法修正，不补造发布路径"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-material-edit",
    "title": "维护物料档案",
    "kind": "action",
    "summary": "完成维护物料档案，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "维护物料档案",
      "material-edit"
    ],
    "pageIds": [
      "page-material-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-material-identity",
      "rule-material-source",
      "rule-material-request",
      "rule-model-history"
    ],
    "related": [
      "manual-material-edit"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductEditView.vue",
      "docs/business-guide/content-source-audit.md#action-material-edit"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "维护物料档案：原编号/原来源保持，允许资料更新"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "主体须属于物料线；指定物料必须确属此主体并经身份判定。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "物料档案中的“维护物料档案”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "按主体路径和 sku query 定位 MAT",
          "查看编号来源并改允许字段",
          "保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "原编号/原来源保持，允许资料更新"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "MAT 与销售 SKU 身份分离",
          "正式物料来源必须一致",
          "物料关联请求回执与原始来源保留",
          "发布依据与历史快照保持"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "指定记录不属主体或是 SKU 时重选正确对象"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-material-relation",
    "title": "节点范围建档或关联现有 MAT",
    "kind": "action",
    "summary": "完成节点范围建档或关联现有 MAT，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "节点范围建档或关联现有 MAT",
      "material-relation"
    ],
    "pageIds": [
      "page-specs",
      "page-material-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-material-source",
      "rule-material-request",
      "rule-compatibility-manual-protection",
      "rule-conflict"
    ],
    "related": [
      "manual-specs"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpecConfigView.vue",
      "src/views/ProductEditView.vue",
      "docs/business-guide/content-source-audit.md#action-material-relation"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "节点范围建档或关联现有 MAT：一个 MAT 可关联多真实路径，不扩建第二身份"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "选择模型；查看模式只读，进入编辑后才能改结构；保存和发布授权分离。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品模型设计中的“节点范围建档或关联现有 MAT”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选指定发布版和锚点范围",
          "预览覆盖及兼容贡献",
          "明确新建或选择已有 MAT 并确认"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "一个 MAT 可关联多真实路径，不扩建第二身份"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "正式物料来源必须一致",
          "物料关联请求回执与原始来源保留",
          "人工修改与取消跨版本保留",
          "外部修订或预览依据变化需重新核对"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "人工保护/依据变更重新核对；版本范围确认不恢复取消声明"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-material-unlink",
    "title": "解除新增物料关联",
    "kind": "action",
    "summary": "完成解除新增物料关联，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "解除新增物料关联",
      "material-unlink"
    ],
    "pageIds": [
      "page-material-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-material-identity",
      "rule-material-source",
      "rule-material-request",
      "rule-model-history"
    ],
    "related": [
      "manual-material-edit"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductEditView.vue",
      "docs/business-guide/content-source-audit.md#action-material-unlink"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "解除新增物料关联：新增关系撤销，原始建档与历史回执保留"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "主体须属于物料线；指定物料必须确属此主体并经身份判定。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "物料档案中的“解除新增物料关联”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "从档案查看有效来源",
          "选允许解除的新增关系",
          "确认解除"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "新增关系撤销，原始建档与历史回执保留"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "MAT 与销售 SKU 身份分离",
          "正式物料来源必须一致",
          "物料关联请求回执与原始来源保留",
          "发布依据与历史快照保持"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "原始建档事实不作为普通新增关系删除"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-compatibility-bind",
    "title": "绑定明确设备型号",
    "kind": "action",
    "summary": "完成绑定明确设备型号，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "绑定明确设备型号",
      "compatibility-bind"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-compatibility-binding",
      "rule-permission"
    ],
    "related": [
      "manual-compatibility"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CompatibilityView.vue",
      "docs/business-guide/content-source-audit.md#action-compatibility-bind"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "绑定明确设备型号：后续声明查询有明确设备上下文"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "识别当前维护对象与方向；设备绑定和声明维护均按相应权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "适用关系中的“绑定明确设备型号”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "核对目标身份与型号来源",
          "选择合法主机型号并保存绑定"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "后续声明查询有明确设备上下文"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "适用绑定须有明确对象与主机",
          "默认模式与严格授权分开"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "非法或歧义绑定改选正式型号，不按文字自动合并"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-compatibility-declare",
    "title": "维护适用声明",
    "kind": "action",
    "summary": "完成维护适用声明，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "维护适用声明",
      "compatibility-declare"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-compatibility-binding",
      "rule-compatibility-basis"
    ],
    "related": [
      "manual-compatibility"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CompatibilityView.vue",
      "docs/business-guide/content-source-audit.md#action-compatibility-declare"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "维护适用声明：正式结论带来源；在售状态另行显示"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "识别当前维护对象与方向；设备绑定和声明维护均按相应权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "适用关系中的“维护适用声明”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择配件和主机粒度",
          "填基本结论、能力、条件及依据",
          "保存并双向查询"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "正式结论带来源；在售状态另行显示"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "适用绑定须有明确对象与主机",
          "适用声明按有效依据维护"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "冲突/缺依据处理真实声明，不把 MAT 当 SKU"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-compatibility-sync",
    "title": "同步模板适用更新",
    "kind": "action",
    "summary": "完成同步模板适用更新，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "同步模板适用更新",
      "compatibility-sync"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-compatibility-basis",
      "rule-compatibility-manual-protection",
      "rule-conflict"
    ],
    "related": [
      "manual-compatibility"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CompatibilityView.vue",
      "docs/business-guide/content-source-audit.md#action-compatibility-sync"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "同步模板适用更新：管理来源按规则同步，人工决定保持"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "识别当前维护对象与方向；设备绑定和声明维护均按相应权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "适用关系中的“同步模板适用更新”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "检查模板更新",
          "预览新增/变化/冲突",
          "确认允许的贡献范围"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "管理来源按规则同步，人工决定保持"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "适用声明按有效依据维护",
          "人工修改与取消跨版本保留",
          "外部修订或预览依据变化需重新核对"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "新依据使旧预览失效；人工保护需保留，不能自动恢复"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-compatibility-cancel",
    "title": "人工取消适用声明",
    "kind": "action",
    "summary": "完成人工取消适用声明，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "人工取消适用声明",
      "compatibility-cancel"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-compatibility-manual-protection",
      "rule-permission"
    ],
    "related": [
      "manual-compatibility"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CompatibilityView.vue",
      "docs/business-guide/content-source-audit.md#action-compatibility-cancel"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "人工取消适用声明：贡献记录标记人工取消，历史来源保留"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "识别当前维护对象与方向；设备绑定和声明维护均按相应权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "适用关系中的“人工取消适用声明”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "查看当前声明和来源",
          "明确取消并保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "贡献记录标记人工取消，历史来源保留"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "人工修改与取消跨版本保留",
          "默认模式与严格授权分开"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "后续只改备注/依据/核验状态不解除人工保护"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-framework-save",
    "title": "保存独立选配框架",
    "kind": "action",
    "summary": "完成保存独立选配框架，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存独立选配框架",
      "framework-save"
    ],
    "pageIds": [
      "page-benefits"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-framework-members",
      "rule-model-history"
    ],
    "related": [
      "manual-benefits"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageListView.vue",
      "docs/business-guide/content-source-audit.md#action-framework-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存独立选配框架：不选具体 SKU 也可保存合法类型框架"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "框架维护与包维护有独立权限；只读者可查询获准内容。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "权益包与框架中的“保存独立选配框架”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "填写框架名和类型组",
          "设置必选、种类数、件数及兼容过滤",
          "保存框架"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "不选具体 SKU 也可保存合法类型框架"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "框架类型范围与修订保护",
          "发布依据与历史快照保持"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "组范围或件数不完整先修正；旧包冻结修订不自动升级"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-benefit-copy",
    "title": "复制常用权益包",
    "kind": "action",
    "summary": "完成复制常用权益包，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "复制常用权益包",
      "benefit-copy"
    ],
    "pageIds": [
      "page-benefits"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-framework-members",
      "rule-model-history"
    ],
    "related": [
      "manual-benefits"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageListView.vue",
      "docs/business-guide/content-source-audit.md#action-benefit-copy"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "复制常用权益包：新包独立，历史清单不复制成新交付"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "框架维护与包维护有独立权限；只读者可查询获准内容。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "权益包与框架中的“复制常用权益包”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择常用包复制",
          "核对设备和成员",
          "保存独立新包"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "新包独立，历史清单不复制成新交付"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "框架类型范围与修订保护",
          "发布依据与历史快照保持"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "失效成员或条件重新核对，不沿用不符当前依据的确认"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-benefit-query",
    "title": "查找权益包与历史",
    "kind": "action",
    "summary": "完成查找权益包与历史，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查找权益包与历史",
      "benefit-query"
    ],
    "pageIds": [
      "page-benefits"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-framework-members",
      "rule-model-history"
    ],
    "related": [
      "manual-benefits"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageListView.vue",
      "docs/business-guide/content-source-audit.md#action-benefit-query"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查找权益包与历史：可区分配置与历史清单"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "框架维护与包维护有独立权限；只读者可查询获准内容。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "权益包与框架中的“查找权益包与历史”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "按列表范围和收藏查包",
          "打开当前配置或已保存清单"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "可区分配置与历史清单"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "框架类型范围与修订保护",
          "发布依据与历史快照保持"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "缺包回列表；不按同名混合记录"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-benefit-select",
    "title": "选配商品和服务",
    "kind": "action",
    "summary": "完成选配商品和服务，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "选配商品和服务",
      "benefit-select"
    ],
    "pageIds": [
      "page-benefit-create"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-benefit-validation",
      "rule-benefit-quote",
      "rule-framework-members",
      "rule-compatibility-binding"
    ],
    "related": [
      "manual-benefit-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageEditView.vue",
      "docs/business-guide/content-source-audit.md#action-benefit-select"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "选配商品和服务：包内成员是明确销售商品和服务"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可无设备自由组包；有设备则遵循正式兼容结论；保存可用配置需消除阻断问题。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新建权益包中的“选配商品和服务”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选设备/框架",
          "推荐或其他商品中选真实 SKU",
          "设置每包数量、服务计量和条件确认"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "包内成员是明确销售商品和服务"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "可用权益包通过当前成员与条件校验",
          "人工报价与参考合计分别记录",
          "框架类型范围与修订保护",
          "适用绑定须有明确对象与主机"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "框架组外/待确认/不适用不能冒充正常推荐"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-benefit-save",
    "title": "保存权益包",
    "kind": "action",
    "summary": "完成保存权益包，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存权益包",
      "benefit-save"
    ],
    "pageIds": [
      "page-benefit-create",
      "page-benefit-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-benefit-validation",
      "rule-framework-members",
      "rule-benefit-quote",
      "rule-persistence"
    ],
    "related": [
      "manual-benefit-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageEditView.vue",
      "docs/business-guide/content-source-audit.md#action-benefit-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存权益包：草稿保留待完善，可用配置需通过当前校验"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可无设备自由组包；有设备则遵循正式兼容结论；保存可用配置需消除阻断问题。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新建权益包中的“保存权益包”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "填写名称、成员、数量和规则",
          "定位处理问题",
          "保存草稿或保存权益包"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "草稿保留待完善，可用配置需通过当前校验"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "可用权益包通过当前成员与条件校验",
          "框架类型范围与修订保护",
          "人工报价与参考合计分别记录",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "引用失效可进入修正，但不能保存为可用或生成新清单"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-benefit-quote",
    "title": "填写并复核报价",
    "kind": "action",
    "summary": "完成填写并复核报价，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "填写并复核报价",
      "benefit-quote"
    ],
    "pageIds": [
      "page-benefit-create",
      "page-benefit-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-benefit-quote"
    ],
    "related": [
      "manual-benefit-create"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageEditView.vue",
      "docs/business-guide/content-source-audit.md#action-benefit-quote"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "填写并复核报价：0 元和未报价不同，可有负差额"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可无设备自由组包；有设备则遵循正式兼容结论；保存可用配置需消除阻断问题。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新建权益包中的“填写并复核报价”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "区分参考价与每包人工报价",
          "数量/成员变化后核对差额",
          "点击已复核当前报价"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "0 元和未报价不同，可有负差额"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "人工报价与参考合计分别记录"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "内容/价格改变使复核失效，不靠旧确认交付"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-benefit-deliver",
    "title": "预览并确认本机清单",
    "kind": "action",
    "summary": "完成预览并确认本机清单，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "预览并确认本机清单",
      "benefit-deliver"
    ],
    "pageIds": [
      "page-benefit-edit"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-benefit-validation",
      "rule-benefit-quote",
      "rule-benefit-preview",
      "rule-conflict",
      "rule-persistence"
    ],
    "related": [
      "manual-benefit-edit"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageEditView.vue",
      "docs/business-guide/content-source-audit.md#action-benefit-deliver"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "预览并确认本机清单：冻结商品/服务/价格/适配快照，不做支付库存"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "保存最新配置后，包为可用且当前预览通过才能确认生成。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "权益包详情中的“预览并确认本机清单”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "先保存包配置",
          "填包数并预览完整明细",
          "勾选确认后生成"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "冻结商品/服务/价格/适配快照，不做支付库存"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "可用权益包通过当前成员与条件校验",
          "人工报价与参考合计分别记录",
          "交付须基于最新保存与确认预览",
          "外部修订或预览依据变化需重新核对",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "旧修订或预览失效重新保存/预览，不重试旧候选"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-delivery-export",
    "title": "打印或导出历史清单",
    "kind": "action",
    "summary": "完成打印或导出历史清单，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "打印或导出历史清单",
      "delivery-export"
    ],
    "pageIds": [
      "page-benefit-delivery"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-delivery-snapshot",
      "rule-benefit-preview"
    ],
    "related": [
      "manual-benefit-delivery"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitDeliveryView.vue",
      "docs/business-guide/content-source-audit.md#action-delivery-export"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "打印或导出历史清单：文件使用生成时内容"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "清单存在；导出需交付清单导出权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "交付清单中的“打印或导出历史清单”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "打开清单核对快照",
          "点击打印或导出 Excel"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "文件使用生成时内容"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "历史交付只读冻结内容",
          "交付须基于最新保存与确认预览"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "导出失败可重试导出，不重新生成业务清单"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-brand-save",
    "title": "保存品牌目录",
    "kind": "action",
    "summary": "完成保存品牌目录，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存品牌目录",
      "brand-save"
    ],
    "pageIds": [
      "page-brands"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-catalog-names",
      "rule-persistence"
    ],
    "related": [
      "manual-brands"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BrandView.vue",
      "docs/business-guide/content-source-audit.md#action-brand-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存品牌目录：后续候选目录更新，旧商品文字不重写"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "新增/编辑需品牌权限；名称必填。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "品牌中心中的“保存品牌目录”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "新增/编辑名称标识说明",
          "点击保存或切换状态并核对"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "后续候选目录更新，旧商品文字不重写"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "目录名称维护不重写历史商品",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "名称必填；失败保留当前编辑"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-group-create",
    "title": "建立运营分组",
    "kind": "action",
    "summary": "完成建立运营分组，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "建立运营分组",
      "group-create"
    ],
    "pageIds": [
      "page-groups"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation",
      "rule-persistence"
    ],
    "related": [
      "manual-groups"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/GroupView.vue",
      "docs/business-guide/content-source-audit.md#action-group-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "建立运营分组：得到活动分组，不改分类"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "新增、编辑、删除分别按分组权限；选中目标分组。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "运营分组中的“建立运营分组”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "新建根分组或子组",
          "填写名称"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "得到活动分组，不改分类"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "维护失败看持久化提示，不重复生成无意义组"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-group-link",
    "title": "保存分组商品关联",
    "kind": "action",
    "summary": "完成保存分组商品关联，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存分组商品关联",
      "group-link"
    ],
    "pageIds": [
      "page-groups"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation",
      "rule-persistence"
    ],
    "related": [
      "manual-groups"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/GroupView.vue",
      "docs/business-guide/content-source-audit.md#action-group-link"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存分组商品关联：只更新该分组的商品集合"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "新增、编辑、删除分别按分组权限；选中目标分组。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "运营分组中的“保存分组商品关联”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择当前分组",
          "多选商品后保存关联"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只更新该分组的商品集合"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无分组先选中；解除关联不删商品"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-constraint-save",
    "title": "保存规格允许值规则",
    "kind": "action",
    "summary": "完成保存规格允许值规则，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存规格允许值规则",
      "constraint-save"
    ],
    "pageIds": [
      "page-rules"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-constraint-definition",
      "rule-persistence"
    ],
    "related": [
      "manual-rules"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RuleView.vue",
      "docs/business-guide/content-source-audit.md#action-constraint-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存规格允许值规则：现行规则参与原约束求值"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "规则维护权限；条件与目标必须引用实际词典属性和值。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "规格约束中的“保存规格允许值规则”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择方案和条件",
          "设置目标属性与允许值",
          "保存并核对冲突"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "现行规则参与原约束求值"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "现行允许值规则与旧参考分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "旧规则原文仅参考，不强行转成新规则"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-constraint-test",
    "title": "测试规则覆盖",
    "kind": "action",
    "summary": "完成测试规则覆盖，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "测试规则覆盖",
      "constraint-test"
    ],
    "pageIds": [
      "page-rules"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-constraint-definition",
      "rule-persistence"
    ],
    "related": [
      "manual-rules"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RuleView.vue",
      "docs/business-guide/content-source-audit.md#action-constraint-test"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "测试规则覆盖：只读求值，不保存商品"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "规则维护权限；条件与目标必须引用实际词典属性和值。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "规格约束中的“测试规则覆盖”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择方案和测试取值",
          "读取未覆盖/空候选/允许值说明"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只读求值，不保存商品"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "现行允许值规则与旧参考分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无覆盖不擅自推断新业务规则"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-mapping-save",
    "title": "修改分类方案绑定",
    "kind": "action",
    "summary": "完成修改分类方案绑定，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "修改分类方案绑定",
      "mapping-save"
    ],
    "pageIds": [
      "page-mappings"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-template-bindings"
    ],
    "related": [
      "manual-mappings"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MappingView.vue",
      "docs/business-guide/content-source-audit.md#action-mapping-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "修改分类方案绑定：共享 mappings 更新"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "方案须有结构属性；需模板编辑权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "属性方案绑定（历史入口）中的“修改分类方案绑定”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "在分类中心或旧绑定页选择方案",
          "核对分类上的实际绑定"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "共享 mappings 更新"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "方案绑定必须是真实词典属性"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无结构方案先补属性，清空不删除方案"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-overview-query",
    "title": "查看商品矩阵",
    "kind": "action",
    "summary": "完成查看商品矩阵，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查看商品矩阵",
      "overview-query"
    ],
    "pageIds": [
      "page-overview"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation"
    ],
    "related": [
      "manual-overview"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/OverviewView.vue",
      "docs/business-guide/content-source-audit.md#action-overview-query"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查看商品矩阵：只读已有销售记录"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备总览读取权限；需要修改时进入维护页面。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品总览中的“查看商品矩阵”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择整款/矩阵",
          "按分类定位现有商品"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只读已有销售记录"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "矩阵空位不是创建授权"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-check-locate",
    "title": "定位质量问题",
    "kind": "action",
    "summary": "完成定位质量问题，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "定位质量问题",
      "check-locate"
    ],
    "pageIds": [
      "page-check"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation",
      "rule-sku-input"
    ],
    "related": [
      "manual-check"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CheckView.vue",
      "docs/business-guide/content-source-audit.md#action-check-locate"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "定位质量问题：问题页不自动修正业务"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备质量检查读取权限，修改目标另需编辑权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品质量检查中的“定位质量问题”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "读取问题对象和字段",
          "进入原详情修正",
          "保存后重新检查"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "问题页不自动修正业务"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "业务对象与来源各有身份",
          "SKU 规格必须属于主体方案"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "删除对象不再定位时回列表核对"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-json-import",
    "title": "恢复 JSON 备份",
    "kind": "action",
    "summary": "完成恢复 JSON 备份，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "恢复 JSON 备份",
      "json-import"
    ],
    "pageIds": [
      "page-import"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-json-import",
      "rule-material-identity",
      "rule-permission",
      "rule-persistence",
      "rule-conflict"
    ],
    "related": [
      "manual-import"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductIoView.vue",
      "docs/business-guide/content-source-audit.md#action-json-import"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "恢复 JSON 备份：合法业务配置和冻结信息完整保留"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先导出备份；导入权限依导入前当前操作者，不取导入文件中的角色。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品导入导出中的“恢复 JSON 备份”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "先导出原备份",
          "选择合法 JSON 并核对权限/结构",
          "明确恢复并等待保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "合法业务配置和冻结信息完整保留"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "导入校验与当前角色保护",
          "MAT 与销售 SKU 身份分离",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复",
          "外部修订或预览依据变化需重新核对"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "结构/权限/身份失败拒绝；损坏原文走恢复，不加载种子覆盖"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-table-import",
    "title": "确认表格导入",
    "kind": "action",
    "summary": "完成确认表格导入，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "确认表格导入",
      "table-import"
    ],
    "pageIds": [
      "page-import"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-json-import",
      "rule-material-identity",
      "rule-persistence",
      "rule-conflict",
      "rule-permission"
    ],
    "related": [
      "manual-import"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductIoView.vue",
      "docs/business-guide/content-source-audit.md#action-table-import"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "确认表格导入：仅确认合法候选写入"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先导出备份；导入权限依导入前当前操作者，不取导入文件中的角色。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品导入导出中的“确认表格导入”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "匹配字段并预览",
          "处理错误和重复",
          "确认写入当前有效候选"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "仅确认合法候选写入"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "导入校验与当前角色保护",
          "MAT 与销售 SKU 身份分离",
          "真实写盘状态与失败恢复",
          "外部修订或预览依据变化需重新核对",
          "默认模式与严格授权分开"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "依据变化重新预览；存储失败按保存状态重试"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-backup-export",
    "title": "导出业务备份",
    "kind": "action",
    "summary": "完成导出业务备份，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "导出业务备份",
      "backup-export"
    ],
    "pageIds": [
      "page-import"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-json-import",
      "rule-material-identity",
      "rule-persistence",
      "rule-conflict",
      "rule-permission"
    ],
    "related": [
      "manual-import"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductIoView.vue",
      "docs/business-guide/content-source-audit.md#action-backup-export"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "导出业务备份：只读导出，不改业务"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "先导出备份；导入权限依导入前当前操作者，不取导入文件中的角色。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品导入导出中的“导出业务备份”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择当前范围/模板或 JSON 导出",
          "下载并妥善保存文件"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只读导出，不改业务"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "导入校验与当前角色保护",
          "MAT 与销售 SKU 身份分离",
          "真实写盘状态与失败恢复",
          "外部修订或预览依据变化需重新核对",
          "默认模式与严格授权分开"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "下载失败重试导出，不清本机数据"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-menu-save",
    "title": "保存菜单结构",
    "kind": "action",
    "summary": "完成保存菜单结构，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存菜单结构",
      "menu-save"
    ],
    "pageIds": [
      "page-menus"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-menu-structure",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-menus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MenuConfigView.vue",
      "docs/business-guide/content-source-audit.md#action-menu-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存菜单结构：真实导航更新，权限执行绑定不被文案改写"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "菜单更新权限；只能放置正式登记路由，保留现有个人导航偏好。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "菜单配置中的“保存菜单结构”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择中心/分组/正式路由",
          "填写上级、名称、排序、隐藏及权限",
          "保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "真实导航更新，权限执行绑定不被文案改写"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "菜单结构不改变执行授权",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "非空容器/非法路由/缺权限先修正"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-menu-restore",
    "title": "恢复默认菜单结构",
    "kind": "action",
    "summary": "完成恢复默认菜单结构，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "恢复默认菜单结构",
      "menu-restore"
    ],
    "pageIds": [
      "page-menus"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-menu-structure",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-menus"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MenuConfigView.vue",
      "docs/business-guide/content-source-audit.md#action-menu-restore"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "恢复默认菜单结构：只恢复菜单，不重置授权和业务"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "菜单更新权限；只能放置正式登记路由，保留现有个人导航偏好。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "菜单配置中的“恢复默认菜单结构”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "核对恢复范围",
          "确认恢复默认菜单"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只恢复菜单，不重置授权和业务"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "菜单结构不改变执行授权",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "写盘失败保留原菜单并处理本机保存提示"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-role-save",
    "title": "保存角色资料",
    "kind": "action",
    "summary": "完成保存角色资料，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存角色资料",
      "role-save"
    ],
    "pageIds": [
      "page-roles"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-role-protection",
      "rule-permission",
      "rule-conflict",
      "rule-persistence"
    ],
    "related": [
      "manual-roles"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RoleView.vue",
      "docs/business-guide/content-source-audit.md#action-role-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存角色资料：得到明确角色，不自动增加业务授权"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "角色资料维护与授权能力独立；严格模式下依赖权限须明确选择。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "角色管理中的“保存角色资料”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "新建或复制角色",
          "填写唯一编码和名称",
          "保存角色"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "得到明确角色，不自动增加业务授权"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "角色依赖与恢复能力受保护",
          "默认模式与严格授权分开",
          "外部修订或预览依据变化需重新核对",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "重码/受保护身份按提示修正"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-rbac-authorize",
    "title": "显式保存角色授权",
    "kind": "action",
    "summary": "完成显式保存角色授权，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "显式保存角色授权",
      "rbac-authorize"
    ],
    "pageIds": [
      "page-roles"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "manual-roles"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RoleView.vue",
      "docs/business-guide/content-source-audit.md#action-rbac-authorize"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "显式保存角色授权：只保存明确勾选能力，并集按启用角色计算"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "角色资料维护与授权能力独立；严格模式下依赖权限须明确选择。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "角色管理中的“显式保存角色授权”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择当前已登记权限",
          "核对依赖和影响用户",
          "保存授权"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只保存明确勾选能力，并集按启用角色计算"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "角色依赖与恢复能力受保护",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "缺依赖不自动补权，逐项核对再保存"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-role-delete",
    "title": "删除普通角色",
    "kind": "action",
    "summary": "完成删除普通角色，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "删除普通角色",
      "role-delete"
    ],
    "pageIds": [
      "page-roles"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-role-protection",
      "rule-permission",
      "rule-conflict",
      "rule-persistence"
    ],
    "related": [
      "manual-roles"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RoleView.vue",
      "docs/business-guide/content-source-audit.md#action-role-delete"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "删除普通角色：未引用普通角色可删除"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "角色资料维护与授权能力独立；严格模式下依赖权限须明确选择。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "角色管理中的“删除普通角色”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "查看关联用户",
          "先调整绑定",
          "确认删除"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "未引用普通角色可删除"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "角色依赖与恢复能力受保护",
          "默认模式与严格授权分开",
          "外部修订或预览依据变化需重新核对",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "超级管理员/恢复角色受保护，不能绕过"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-rbac-recover",
    "title": "恢复内置管理授权",
    "kind": "action",
    "summary": "完成恢复内置管理授权，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "恢复内置管理授权",
      "rbac-recover"
    ],
    "pageIds": [
      "page-roles"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-role-protection",
      "rule-permission",
      "rule-conflict",
      "rule-persistence"
    ],
    "related": [
      "manual-roles"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RoleView.vue",
      "docs/business-guide/content-source-audit.md#action-rbac-recover"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "恢复内置管理授权：保留可恢复的管理路径"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "角色资料维护与授权能力独立；严格模式下依赖权限须明确选择。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "角色管理中的“恢复内置管理授权”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "在角色管理查看恢复说明",
          "明确确认恢复内置超级管理员"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "保留可恢复的管理路径"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "角色依赖与恢复能力受保护",
          "默认模式与严格授权分开",
          "外部修订或预览依据变化需重新核对",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "恢复不是给全部自定义角色扩业务权限"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-permission-save",
    "title": "维护权限说明和状态",
    "kind": "action",
    "summary": "完成维护权限说明和状态，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "维护权限说明和状态",
      "permission-save"
    ],
    "pageIds": [
      "page-permissions"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "manual-permissions"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/PermissionView.vue",
      "docs/business-guide/content-source-audit.md#action-permission-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "维护权限说明和状态：说明变化不改变资源动作身份"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "权限更新能力；不能在文案编辑中更换权限码或实际执行绑定。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "权限目录中的“维护权限说明和状态”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "打开内置权限",
          "核对只读码和绑定",
          "保存允许字段"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "说明变化不改变资源动作身份"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "角色依赖与恢复能力受保护",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "引用/恢复路径保护时先看关联，不造新绑定"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-permission-reference",
    "title": "查看权限引用",
    "kind": "action",
    "summary": "完成查看权限引用，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "查看权限引用",
      "permission-reference"
    ],
    "pageIds": [
      "page-permissions"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "manual-permissions"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/PermissionView.vue",
      "docs/business-guide/content-source-audit.md#action-permission-reference"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "查看权限引用：只读定位影响范围"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "权限更新能力；不能在文案编辑中更换权限码或实际执行绑定。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "权限目录中的“查看权限引用”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "按权限搜索",
          "打开引用角色"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只读定位影响范围"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "角色依赖与恢复能力受保护",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无引用不等于任意停用恢复能力"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-user-save",
    "title": "保存本机用户",
    "kind": "action",
    "summary": "完成保存本机用户，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存本机用户",
      "user-save"
    ],
    "pageIds": [
      "page-users"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "manual-users"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/UserView.vue",
      "docs/business-guide/content-source-audit.md#action-user-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存本机用户：本机用户资料更新"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "用户维护和绑定角色能力独立；不引入真实后端登录系统。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "用户管理中的“保存本机用户”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "新建/编辑用户资料",
          "核对账号状态后保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "本机用户资料更新"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "角色依赖与恢复能力受保护",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "重复账号/保护用户按提示修正"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-user-bind",
    "title": "绑定用户角色",
    "kind": "action",
    "summary": "完成绑定用户角色，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "绑定用户角色",
      "user-bind"
    ],
    "pageIds": [
      "page-users"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "manual-users"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/UserView.vue",
      "docs/business-guide/content-source-audit.md#action-user-bind"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "绑定用户角色：严格模式有效能力按角色并集计算"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "用户维护和绑定角色能力独立；不引入真实后端登录系统。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "用户管理中的“绑定用户角色”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择用户",
          "显式选择启用角色并保存"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "严格模式有效能力按角色并集计算"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "角色依赖与恢复能力受保护",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无绑定权限不能代操作；不隐式授权未来能力"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-user-preview",
    "title": "模拟并退出身份",
    "kind": "action",
    "summary": "完成模拟并退出身份，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "模拟并退出身份",
      "user-preview"
    ],
    "pageIds": [
      "page-users"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "manual-users"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/UserView.vue",
      "docs/business-guide/content-source-audit.md#action-user-preview"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "模拟并退出身份：预览用于验证当前本机授权"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "用户维护和绑定角色能力独立；不引入真实后端登录系统。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "用户管理中的“模拟并退出身份”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "在支持的严格模式入口选择用户",
          "查看有效权限",
          "退出预览回操作者"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "预览用于验证当前本机授权"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "角色依赖与恢复能力受保护",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "默认统一管理员不因预览文案变成真实登录"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-account-save",
    "title": "保存账号资料",
    "kind": "action",
    "summary": "完成保存账号资料，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存账号资料",
      "account-save"
    ],
    "pageIds": [
      "page-account"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-account"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/AccountView.vue",
      "docs/business-guide/content-source-audit.md#action-account-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存账号资料：只更新本机演示资料"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备账号更新权限；仅修改可见的当前资料。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "账号设置中的“保存账号资料”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "填写当前资料",
          "点击保存资料"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只更新本机演示资料"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无权限或写盘失败保留输入"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-account-password",
    "title": "演示密码校验",
    "kind": "action",
    "summary": "完成演示密码校验，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "演示密码校验",
      "account-password"
    ],
    "pageIds": [
      "page-account"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-account"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/AccountView.vue",
      "docs/business-guide/content-source-audit.md#action-account-password"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "演示密码校验：只做校验，不保存密码"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "具备账号更新权限；仅修改可见的当前资料。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "账号设置中的“演示密码校验”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "输入密码及确认项",
          "查看格式校验"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只做校验，不保存密码"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "不一致修正，不宣称外部账号已改密"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-feedback-save",
    "title": "保存问题反馈",
    "kind": "action",
    "summary": "完成保存问题反馈，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存问题反馈",
      "feedback-save"
    ],
    "pageIds": [
      "page-feedback"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-feedback-local",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/FeedbackView.vue",
      "docs/business-guide/content-source-audit.md#action-feedback-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存问题反馈：反馈有明确页面/功能关联"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "反馈读取、更新、删除、导入导出按独立权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "反馈管理中的“保存问题反馈”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "从页面或指南打开反馈",
          "填写现象与必要来源",
          "保存到本机"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "反馈有明确页面/功能关联"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "反馈只在本机保存和导出",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "附件或保存失败保留输入，避免泄露全量业务库"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-feedback-export",
    "title": "导出本机反馈包",
    "kind": "action",
    "summary": "完成导出本机反馈包，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "导出本机反馈包",
      "feedback-export"
    ],
    "pageIds": [
      "page-feedback"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-feedback-local",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/FeedbackView.vue",
      "docs/business-guide/content-source-audit.md#action-feedback-export"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "导出本机反馈包：本机文件，不自动上传"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "反馈读取、更新、删除、导入导出按独立权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "反馈管理中的“导出本机反馈包”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "筛选/核对记录和附件",
          "导出反馈包并自行发送"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "本机文件，不自动上传"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "反馈只在本机保存和导出",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "导出失败保留记录重试；已导出记录按原限制处理"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-feedback-import",
    "title": "导入反馈包",
    "kind": "action",
    "summary": "完成导入反馈包，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "导入反馈包",
      "feedback-import"
    ],
    "pageIds": [
      "page-feedback"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-feedback-local",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/FeedbackView.vue",
      "docs/business-guide/content-source-audit.md#action-feedback-import"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "导入反馈包：恢复反馈及附件，不导入商品"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "反馈读取、更新、删除、导入导出按独立权限检查。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "反馈管理中的“导入反馈包”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择反馈包",
          "读取校验后确认本机导入"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "恢复反馈及附件，不导入商品"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "反馈只在本机保存和导出",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "坏包保留原记录，不因说明导入授予权限"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-access-explain",
    "title": "理解不可访问入口",
    "kind": "action",
    "summary": "完成理解不可访问入口，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "理解不可访问入口",
      "access-explain"
    ],
    "pageIds": [
      "page-forbidden"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-permission"
    ],
    "related": [
      "manual-forbidden"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ForbiddenView.vue",
      "docs/business-guide/content-source-audit.md#action-access-explain"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "理解不可访问入口：不泄露无权对象"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可直接读取一般无权限说明；严格模式按当前身份检查目标路径。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "无访问权限中的“理解不可访问入口”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "阅读一般权限说明",
          "返回合法工作台/指南"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "不泄露无权对象"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "默认模式与严格授权分开"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "未知或无权路由不无限重试"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-search",
    "title": "搜索业务知识",
    "kind": "action",
    "summary": "完成搜索业务知识，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "搜索业务知识",
      "guide-search"
    ],
    "pageIds": [
      "page-guide"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-permission",
      "rule-guide-storage",
      "rule-guide-permission"
    ],
    "related": [
      "manual-guide"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideHomeView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-search"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "搜索业务知识：仅索引说明，不搜索个人业务库"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "有指南阅读能力即可阅读；维护需独立能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "业务指南首页中的“搜索业务知识”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "输入页面/术语/操作或失败现象",
          "按类型打开结果"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "仅索引说明，不搜索个人业务库"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "指南与业务存储及草稿隔离",
          "默认模式与严格授权分开",
          "指南独立存储必须合法原子",
          "阅读与说明维护能力独立"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "无结果给建议和反馈，不编造回答"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-read",
    "title": "阅读页面与规则",
    "kind": "action",
    "summary": "完成阅读页面与规则，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "阅读页面与规则",
      "guide-read"
    ],
    "pageIds": [
      "page-guide-article"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-guide-storage",
      "rule-guide-permission"
    ],
    "related": [
      "manual-guide-article"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideArticleView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-read"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "阅读页面与规则：不改变原业务 URL 与草稿"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "文章存在且可阅读；业务练习入口另检查目标权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "指南文章中的“阅读页面与规则”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "从本页指南打开章节",
          "查前提/步骤/失败和相关条目",
          "关闭返回触发按钮"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "不改变原业务 URL 与草稿"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "指南与业务存储及草稿隔离",
          "指南独立存储必须合法原子",
          "阅读与说明维护能力独立"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "未知文章回目录；待确认内容不当实际限制"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-learn",
    "title": "按路线学习和练习",
    "kind": "action",
    "summary": "完成按路线学习和练习，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "按路线学习和练习",
      "guide-learn"
    ],
    "pageIds": [
      "page-guide-learn"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-guide-storage",
      "rule-guide-permission"
    ],
    "related": [
      "manual-guide-learn"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideLearnView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-learn"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "按路线学习和练习：已读与已练习各自记录"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "可阅读指南；有权业务页才允许练习跳转。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "新人学习路线中的“按路线学习和练习”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择目标路线",
          "阅读并主动去有权页面",
          "按核对点手动完成"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "已读与已练习各自记录"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "指南与业务存储及草稿隔离",
          "指南独立存储必须合法原子",
          "阅读与说明维护能力独立"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "打开文章不自动完成练习，不自动造样例"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-progress",
    "title": "保存个人收藏与进度",
    "kind": "action",
    "summary": "完成保存个人收藏与进度，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存个人收藏与进度",
      "guide-progress"
    ],
    "pageIds": [
      "page-guide",
      "page-guide-article",
      "page-guide-learn"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-guide-storage"
    ],
    "related": [
      "manual-guide"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideHomeView.vue",
      "src/views/guide/GuideArticleView.vue",
      "src/views/guide/GuideLearnView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-progress"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存个人收藏与进度：仅写当前明确 owner 的独立个人键"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "有指南阅读能力即可阅读；维护需独立能力。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "业务指南首页中的“保存个人收藏与进度”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "明确收藏/已读/已练习",
          "核对保存反馈"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "仅写当前明确 owner 的独立个人键"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "指南与业务存储及草稿隔离",
          "指南独立存储必须合法原子"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "失败不假报成功，身份变化不写到别人名下"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-maintain",
    "title": "维护指南说明",
    "kind": "action",
    "summary": "完成维护指南说明，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "维护指南说明",
      "guide-maintain"
    ],
    "pageIds": [
      "page-guide-manage"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-permission",
      "rule-guide-publication",
      "rule-guide-storage",
      "rule-guide-conflict"
    ],
    "related": [
      "manual-guide-manage"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideManageView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-maintain"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "维护指南说明：指南独立修订，不改业务规则"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需指南维护能力，提交时重新检查身份与授权。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "指南内容维护中的“维护指南说明”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择文章编辑草稿",
          "预览并核对实现",
          "发布或显式恢复说明"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "指南独立修订，不改业务规则"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "阅读与说明维护能力独立",
          "说明发布不修改内置业务条件",
          "指南独立存储必须合法原子",
          "指南修订冲突不可静默覆盖"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "权限/冲突/配额失败保留草稿与旧发布版"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-draft",
    "title": "保存说明草稿",
    "kind": "action",
    "summary": "完成保存说明草稿，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "保存说明草稿",
      "guide-draft"
    ],
    "pageIds": [
      "page-guide-manage"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-guide-publication",
      "rule-permission",
      "rule-persistence",
      "rule-guide-storage",
      "rule-guide-permission",
      "rule-guide-conflict"
    ],
    "related": [
      "manual-guide-manage"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideManageView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-draft"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "保存说明草稿：普通读者仍见原发布版"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需指南维护能力，提交时重新检查身份与授权。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "指南内容维护中的“保存说明草稿”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "编辑解释步骤与示例",
          "保存草稿并预览"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "普通读者仍见原发布版"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "指南与业务存储及草稿隔离",
          "说明发布不修改内置业务条件",
          "默认模式与严格授权分开",
          "真实写盘状态与失败恢复",
          "指南独立存储必须合法原子",
          "阅读与说明维护能力独立",
          "指南修订冲突不可静默覆盖"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "损坏/危险内容拒绝，当前输入保留"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-publish",
    "title": "发布核验说明",
    "kind": "action",
    "summary": "完成发布核验说明，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "发布核验说明",
      "guide-publish"
    ],
    "pageIds": [
      "page-guide-manage"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-permission",
      "rule-guide-publication",
      "rule-guide-storage",
      "rule-guide-conflict"
    ],
    "related": [
      "manual-guide-manage"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideManageView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-publish"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "发布核验说明：同载荷提交正文、修订和上一版"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需指南维护能力，提交时重新检查身份与授权。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "指南内容维护中的“发布核验说明”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "核对状态、适用实现和依据",
          "明确发布"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "同载荷提交正文、修订和上一版"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "阅读与说明维护能力独立",
          "说明发布不修改内置业务条件",
          "指南独立存储必须合法原子",
          "指南修订冲突不可静默覆盖"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "版本冲突读取最新核对，不能静默覆盖"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-guide-import",
    "title": "导入指南内容备份",
    "kind": "action",
    "summary": "完成导入指南内容备份，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "导入指南内容备份",
      "guide-import"
    ],
    "pageIds": [
      "page-guide-manage"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-guide-permission",
      "rule-guide-publication",
      "rule-guide-storage",
      "rule-guide-conflict"
    ],
    "related": [
      "manual-guide-manage"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideManageView.vue",
      "docs/business-guide/content-source-audit.md#action-guide-import"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "导入指南内容备份：只改指南说明，不带商品或授权"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "需指南维护能力，提交时重新检查身份与授权。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "指南内容维护中的“导入指南内容备份”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "选择仅含指南的文件",
          "校验预览 ID/引用/内容",
          "明确确认导入"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只改指南说明，不带商品或授权"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "阅读与说明维护能力独立",
          "说明发布不修改内置业务条件",
          "指南独立存储必须合法原子",
          "指南修订冲突不可静默覆盖"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "坏 schema/重复 ID/危险内容拒绝且保留原文"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  },
  {
    "id": "action-business-save",
    "title": "处理本机保存结果",
    "kind": "action",
    "summary": "完成处理本机保存结果，按真实入口处理成功与拒绝结果。",
    "aliases": [
      "处理本机保存结果",
      "business-save"
    ],
    "pageIds": [
      "page-categories",
      "page-product-types",
      "page-params",
      "page-templates",
      "page-spu-create",
      "page-spu-edit",
      "page-skus",
      "page-sku-edit",
      "page-material-create",
      "page-benefit-edit",
      "page-brands",
      "page-groups",
      "page-rules",
      "page-import",
      "page-menus",
      "page-roles",
      "page-permissions",
      "page-users",
      "page-account",
      "page-feedback",
      "page-guide-manage"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-persistence",
      "rule-conflict"
    ],
    "related": [
      "manual-categories"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "src/views/ProductTypeView.vue",
      "src/views/ParamView.vue",
      "src/views/TemplateView.vue",
      "src/views/SpuEditView.vue",
      "src/views/SkuWorkbenchView.vue",
      "src/views/SkuEditView.vue",
      "src/views/MaterialCreateView.vue",
      "src/views/BenefitPackageEditView.vue",
      "src/views/BrandView.vue",
      "src/views/GroupView.vue",
      "src/views/RuleView.vue",
      "src/views/ProductIoView.vue",
      "src/views/MenuConfigView.vue",
      "src/views/RoleView.vue",
      "src/views/PermissionView.vue",
      "src/views/UserView.vue",
      "src/views/AccountView.vue",
      "src/views/FeedbackView.vue",
      "src/views/guide/GuideManageView.vue",
      "docs/business-guide/content-source-audit.md#action-business-save"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "动作目的",
        "paragraphs": [
          "处理本机保存结果：只有真实持久化成功才称已保存"
        ]
      },
      {
        "id": "prerequisites",
        "title": "前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "entry",
        "title": "入口",
        "paragraphs": [
          "商品分类中心中的“处理本机保存结果”相关按钮；具体步骤如下。"
        ]
      },
      {
        "id": "steps",
        "title": "逐步操作",
        "steps": [
          "阅读当前动作保存状态",
          "等待原受控事务完成或明确重试"
        ]
      },
      {
        "id": "results",
        "title": "可观察结果",
        "paragraphs": [
          "只有真实持久化成功才称已保存"
        ]
      },
      {
        "id": "rules",
        "title": "可能命中的规则",
        "paragraphs": [
          "真实写盘状态与失败恢复",
          "外部修订或预览依据变化需重新核对"
        ]
      },
      {
        "id": "failures",
        "title": "失败与恢复",
        "paragraphs": [
          "内存未落盘、原数据未变和结果未确认分别处理"
        ]
      },
      {
        "id": "verification",
        "title": "适用实现与核验",
        "paragraphs": [
          "说明修订 1；以当前页面真实按钮与提交入口核对。保存、发布、预览、确认分别以该动作真实结果为准。"
        ]
      }
    ]
  }
]
