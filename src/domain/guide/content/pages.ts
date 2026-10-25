import type { GuideArticle } from '../types'

export const guidePageArticles: GuideArticle[] = [
  {
    "id": "manual-home",
    "title": "商品工作台操作手册",
    "kind": "page",
    "summary": "从业务统计、关键词和分类快捷入口找到商品任务；本页本身不创建订单。",
    "aliases": [
      "商品工作台",
      "/"
    ],
    "pageIds": [
      "page-home"
    ],
    "actionIds": [
      "action-workbench-search",
      "action-workbench-issues"
    ],
    "ruleIds": [],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/WorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#page-home"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "从业务统计、关键词和分类快捷入口找到商品任务；本页本身不创建订单。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "分类、SPU 与真实销售 SKU；统计入口跳到对应维护页面。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "可读取工作台；严格模式下目标页面还需独立查看权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "从工作台查商品",
          "从工作台定位问题"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "在关键词框输入商品名称并进入商品列表。",
          "查看问题统计，点击待处理入口进入商品质量检查。",
          "通过新增商品或分类快捷入口进入 SPU 新建，再核对带入分类。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "查询或跳转到目标页面；工作台只读统计不写入业务对象。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "分类统计与 SKU 数不是同一口径；演示数据仅是本机样例。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "没有结果先清除关键词，再核对分类与是否存在真实 SKU；没有目标权限返回有权入口。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：搜索已保存的手机名称进入 SPU 列表；搜索不会自动创建同名 SPU。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-categories",
    "title": "商品分类中心操作手册",
    "kind": "page",
    "summary": "查看目录与商品引用，并在编辑模式维护分类及移动子树。",
    "aliases": [
      "商品分类中心",
      "/categories"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [
      "action-category-create",
      "action-category-rename",
      "action-category-move",
      "action-category-copy",
      "action-category-delete",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-category-typed-target",
      "rule-category-cycle",
      "rule-category-stale",
      "rule-persistence",
      "rule-category-input",
      "rule-category-reference"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CategoryView.vue",
      "docs/business-guide/content-source-audit.md#page-categories"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "查看目录与商品引用，并在编辑模式维护分类及移动子树。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "分类上下级、显式产品类型、分类绑定方案和挂载商品；分类不自动等于类型。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "查看/编辑模式分离；新增、编辑、删除分别检查分类操作权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "新建分类",
          "改分类名",
          "移动分类子树",
          "复制分类树",
          "删除分类",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "切到编辑模式，选中分类，使用新增根分类/新增子分类或双击改名。",
          "把来源放入右侧待移动区，在左侧目标树选择新上级或顶级分类。",
          "核对来源、目标路径及影响范围，点击确认移动；保存失败保留上下文并按提示重试。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "保存成功后树位置更新并持久化；取消移动只清除本次移动暂存。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "目标绑定类型后不能继续接收子分类；来源绑定类型本身不等于禁止来源移动。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "移入自身/后代或目标失效时另选合法目标；删除时有子分类、商品或产品类型先查看这些下游。写盘失败核对保存状态，不能当作完成。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "允许：把带类型的叶分类移动到可接收子分类的空目录；禁止：把任意分类移入其后代。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-product-types",
    "title": "产品类型操作手册",
    "kind": "page",
    "summary": "给末级分类显式建立类型，并查看类型关联的模型。",
    "aliases": [
      "产品类型",
      "/product-types"
    ],
    "pageIds": [
      "page-product-types"
    ],
    "actionIds": [
      "action-type-save",
      "action-type-models",
      "action-type-delete",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-type-category",
      "rule-type-reference",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductTypeView.vue",
      "docs/business-guide/content-source-audit.md#page-product-types"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "给末级分类显式建立类型，并查看类型关联的模型。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "产品类型关联分类；类型与模型是不同对象，分类范围可含下级。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "先选择分类范围；维护需产品类型创建/编辑/删除权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存产品类型",
          "查看类型模型",
          "删除产品类型",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "选择当前分类，按需要切换是否包含下级。",
          "点击新增产品类型，填写类型名称并确认目标分类。",
          "在类型行查看模型或编辑；删除前查看引用提示。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "保存后类型列表与分类关联更新；模型入口定位现有模型，不自动生成模型。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "已有关联模型/商品的类型不能任意迁移或删除；目标末级分类约束按实际检查执行。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "分类未选中先选择；不能迁移先查看关联模型与商品，不通过改名绕过引用。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：同一分类显式增加两个不同类型；不能把分类名称当成已经存在的类型。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-params",
    "title": "属性词典操作手册",
    "kind": "page",
    "summary": "维护全局属性、实际取值和取值分组；全局维护会影响后续候选。",
    "aliases": [
      "属性词典",
      "/params"
    ],
    "pageIds": [
      "page-params"
    ],
    "actionIds": [
      "action-dictionary-save",
      "action-dictionary-value-remove",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-dictionary-reference",
      "rule-model-dictionary",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ParamView.vue",
      "docs/business-guide/content-source-audit.md#page-params"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护全局属性、实际取值和取值分组；全局维护会影响后续候选。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "属性 ID、属性值、方案绑定、草稿节点、业务配置和已发布快照引用。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "维护需词典权限；先辨别全局改名与节点引用选择的区别。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存全局属性与取值",
          "删除或改名词典取值",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新建参数后填写真实属性名称和取值。",
          "进入编辑，保存名称、添加取值或调整取值分组。",
          "删除或改名被引用值时阅读来源提示，到模型/方案核对，不直接移除历史。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "合法修改写入本机全局词典；不会改写已发布快照。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "允许值配置本身就是引用，尚未创建对应节点也受保护；同名值不能跨属性混判。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "被引用时查看属性 ID 和具体模型/节点；新增取值必须保存到实际词典，不能只填占位文本。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：A 属性的“黑色”被引用，不意味着 B 属性同文字值也必须被拦截。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-templates",
    "title": "属性方案操作手册",
    "kind": "page",
    "summary": "建立可被分类复用的公共/规格属性录入方案；普通方案与模型分开维护。",
    "aliases": [
      "属性方案",
      "/templates"
    ],
    "pageIds": [
      "page-templates"
    ],
    "actionIds": [
      "action-template-create",
      "action-template-save",
      "action-template-copy",
      "action-template-delete",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-template-bindings",
      "rule-dictionary-reference",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TemplateView.vue",
      "docs/business-guide/content-source-audit.md#page-templates"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "建立可被分类复用的公共/规格属性录入方案；普通方案与模型分开维护。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "方案、属性绑定、公共/规格角色、必填和顺序；复制不复制商品。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "先有正式属性词典；新建、编辑、复制、删除按实际资源权限检查。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "新建属性方案",
          "配置方案绑定",
          "复制属性方案",
          "删除属性方案",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "点击新建方案或已有方案的配置。",
          "加入词典属性，指定公共/规格、必填，使用上移/下移调整结构顺序。",
          "查看影响确认后保存；用预览录入检查效果，再到分类中心绑定。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "新建/复制仅确认保存才落盘；取消不生成半成品方案。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "引用中的方案删除受保护；方案状态变化不重写历史商品；模型条目按模型权限处理。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "名称或绑定不合法先修正文案和属性；写盘失败保留输入，处理存储后重试保存。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：复制方案后修改公共属性，原方案和历史商品不跟随副本改动。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-models",
    "title": "商品模型列表操作手册",
    "kind": "page",
    "summary": "按分类和显式产品类型管理模型的草稿、发布和下线入口。",
    "aliases": [
      "商品模型列表",
      "/models"
    ],
    "pageIds": [
      "page-models"
    ],
    "actionIds": [
      "action-model-create",
      "action-model-copy",
      "action-model-publish",
      "action-model-offline"
    ],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-material-source"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ModelListView.vue",
      "docs/business-guide/content-source-audit.md#page-models"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "按分类和显式产品类型管理模型的草稿、发布和下线入口。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "模型、所属类型、发布版本和由版本派生的商品来源；模型不是 SPU。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "创建模型需要可用分类/类型；编辑与发布是不同能力。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "新建模型",
          "复制模型",
          "发布模型版本",
          "下线模型"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "点击新建模型，选择分类、产品类型并填写模型名称。",
          "用查看模型或编辑模型进入设计器；适用设备配置维护模板声明。",
          "保存结构后单独发布模型；下线只改变后续可用性，复制生成独立草稿。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "发布生成带快照的版本；复制不复制商品、物料或原历史发布版本。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不能凭模型同名合并身份；未保存草稿不自动成为发布依据。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "分类/类型不一致先重新选择；发布问题进入设计器定位节点再保存、发布。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：V2 发布后，既有 MAT 仍指向其建档版本，不自动迁移为 V2。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-specs",
    "title": "商品模型设计操作手册",
    "kind": "page",
    "summary": "在结构、大纲、幕布中维护同一模型树，配置节点命名、业务与合法组合。",
    "aliases": [
      "商品模型设计",
      "/specs"
    ],
    "pageIds": [
      "page-specs"
    ],
    "actionIds": [
      "action-model-edit",
      "action-model-publish",
      "action-node-business-save",
      "action-node-naming-save",
      "action-material-relation"
    ],
    "ruleIds": [
      "rule-model-structure",
      "rule-model-dictionary",
      "rule-model-history",
      "rule-node-config",
      "rule-material-source"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpecConfigView.vue",
      "docs/business-guide/content-source-audit.md#page-specs"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "在结构、大纲、幕布中维护同一模型树，配置节点命名、业务与合法组合。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "属性节点/值节点、全局词典引用、值附属配置、草稿和发布快照、PLN 与 MAT。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "选择模型；查看模式只读，进入编辑后才能改结构；保存和发布授权分离。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "编辑模型节点",
          "发布模型版本",
          "保存值节点业务配置",
          "设置节点命名",
          "节点范围建档或关联现有 MAT"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "在类型/模型目录打开模型，选择结构、大纲或幕布视图。",
          "选中节点引用词典属性/值；用节点操作增加同级、下级，配置命名或业务范围。",
          "先结构检查并定位问题，保存模型，再发布；在指定发布版查看完整组合和节点范围物料。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "三个视图共享同一节点业务树；发布冻结节点及词典依据，组合预览不自动建档。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "属性直接子级不能混挂属性和值；分支顺序按真实树保留；显示关联物料只控制展示。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "出现未绑定词典、未知业务类型或结构冲突时定位真实节点；有新发布依据时重新预览建档。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：型号节点可提前建 MAT，但不能用提前范围截断其下完整销售组合。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-plans",
    "title": "商品规划（保留入口）操作手册",
    "kind": "page",
    "summary": "基于发布模型保存选定上层取值范围，再选择 SPU 追加真实 SKU。",
    "aliases": [
      "商品规划（保留入口）",
      "/plans"
    ],
    "pageIds": [
      "page-plans"
    ],
    "actionIds": [
      "action-planning-save",
      "action-planning-create-sku",
      "action-planning-delete"
    ],
    "ruleIds": [
      "rule-model-history",
      "rule-sku-identity"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "historical",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductPlanView.vue",
      "docs/business-guide/content-source-audit.md#page-plans"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "基于发布模型保存选定上层取值范围，再选择 SPU 追加真实 SKU。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "ProductPlan 是保存的规划范围；PLN 是完整组合标识，二者不能混称。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "需有已发布模型；规划维护和创建 SKU 分别检查权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存规划范围",
          "从规划追加 SKU",
          "删除保存规划"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "从已发布模型卡进入规划并选择真实存在的上层取值。",
          "核对名称、已选节点和真实下级结果后保存规划。",
          "点击创建 SKU，选择兼容 SPU，预览并确认追加；已有结果可查看 SPU。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "规划保留模型版本与所选路径；SKU 在独立新增页确认后才创建。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不枚举树上不存在的跨分支组合；选最末值只覆盖其实际完整路径。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "无发布模型先完成发布；来源过期回到最新规划选择，不反向改历史快照。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：选择型号节点展开其下真实容量/颜色；不是把所有属性词典做笛卡尔积。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。历史保留入口，以当前源码核对职责；新人优先使用上述主流程。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-tree",
    "title": "商品结构视图操作手册",
    "kind": "page",
    "summary": "用已保存业务对象的结构帮助查询和定位商品，本页无写入操作。",
    "aliases": [
      "商品结构视图",
      "/tree"
    ],
    "pageIds": [
      "page-tree"
    ],
    "actionIds": [
      "action-tree-query"
    ],
    "ruleIds": [
      "rule-identity-separation"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "historical",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/TreePage.vue",
      "docs/business-guide/content-source-audit.md#page-tree"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "用已保存业务对象的结构帮助查询和定位商品，本页无写入操作。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "分类、方案/结构与商品关系；这不是模型设计器。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "有结构视图读取权限；维护对象须进入相应业务页面并重新检查权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "在结构视图定位商品"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "展开分类和结构节点查找对象。",
          "选择商品节点查看对应信息。",
          "通过已有商品入口进入详情；结构修改请回分类或模型设计。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "只改变本页展开、选中和跳转；不会保存新的节点或生成商品。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "只读树不替代实际规格组合和来源判断。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "没有节点先核对分类和已保存商品；无对象时回列表，不据空树推断商品已删除。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：从树定位某 SPU 后编辑其资料；展开树本身不会新增 SKU。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。历史保留入口，以当前源码核对职责；新人优先使用上述主流程。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-spus",
    "title": "SPU 管理操作手册",
    "kind": "page",
    "summary": "以商品主体为单位查询、分组和维护，并分批追加其下 SKU。",
    "aliases": [
      "SPU 管理",
      "/spus"
    ],
    "pageIds": [
      "page-spus"
    ],
    "actionIds": [
      "action-spu-query",
      "action-spu-view",
      "action-spu-delete"
    ],
    "ruleIds": [
      "rule-identity-separation",
      "rule-view-isolation",
      "rule-spu-reference"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductListView.vue",
      "docs/business-guide/content-source-audit.md#page-spus"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "以商品主体为单位查询、分组和维护，并分批追加其下 SKU。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "SPU 是主体；SKU 数只计销售规格；物料与关联规划在次级摘要显示。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "查看 SPU；新增、编辑、上下架、删除分别按当前模式检查权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "查询 SPU",
          "配置 SPU 视图",
          "删除 SPU"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "通过当前视图入口切换已保存视图，搜索并按分类及品牌来源筛选。",
          "在列表设置调整列、顺序、分组和排序；已生效条件在标签区清除。",
          "行内编辑或新增 SKU；更多中查看适用关系、管理物料、复制或删除。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "配置按现有自动保存约定保留；新增 SKU 进入指定 SPU 的独立创建流程。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "显式手动列宽/冻结和旧视图保留；品牌汇总与规格品牌是不同字段；发布商品不能直接删除。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "无结果先清除条件；删除被引用时处理真实子记录；物料数不能当销售 SKU 数。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：物料 2 · 关联规划 1 表示两个 MAT 共用一个 PLN，不是两条 SKU。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-spu-create",
    "title": "新建 SPU操作手册",
    "kind": "page",
    "summary": "独立保存商品主体，可先没有 SKU，再分批追加。",
    "aliases": [
      "新建 SPU",
      "/spus/new"
    ],
    "pageIds": [
      "page-spu-create"
    ],
    "actionIds": [
      "action-spu-save",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-spu-input",
      "rule-spu-identity",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpuEditView.vue",
      "docs/business-guide/content-source-audit.md#page-spu-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "独立保存商品主体，可先没有 SKU，再分批追加。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "主体分类/类型、方案或发布模型、公共属性；复制来源 from 只填草稿。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具有 SPU 创建权限；选择合法分类及对应类型/方案/模型依据。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存 SPU 主体",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "填写主体名称、分类及公共信息。",
          "核对当前模型/方案与绑定版本，处理字段错误。",
          "点击保存 SPU，或保存并新增 SKU；等待保存成功后继续。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "只保存主体；保存并新增 SKU 跳到相同主体的规格创建页，不自动创建空 SKU。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "名称必填；分类/类型/模型来源一致；状态发布需独立发布能力。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "必填缺失定位输入；保存失败保留表单并重试；无有效来源回基础资料修正。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：先保存“演示手机系列”主体，再两次追加规格，仍属于同一 SPU。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-spu-edit",
    "title": "SPU 详情操作手册",
    "kind": "page",
    "summary": "维护已存在主体资料，查看真实 SKU、物料和绑定版本。",
    "aliases": [
      "SPU 详情",
      "/spus/:id"
    ],
    "pageIds": [
      "page-spu-edit"
    ],
    "actionIds": [
      "action-spu-save",
      "action-spu-history",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-spu-identity",
      "rule-model-history",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SpuEditView.vue",
      "docs/business-guide/content-source-audit.md#page-spu-edit"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护已存在主体资料，查看真实 SKU、物料和绑定版本。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "当前 SPU、其销售 SKU、物料档案及创建时的发布快照。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "路由 id 为 SPU；已有子记录时身份字段受既有锁定规则约束。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存 SPU 主体",
          "查看主体历史依据",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "核对主体、分类/类型和绑定版本摘要。",
          "编辑可修改资料并保存，或从管理 SKU/新增 SKU 进入子记录流程。",
          "若有绑定版本，打开历史快照；物料从管理物料查看。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "保存主体不会删除、替换或重新生成已有 SKU/MAT。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "来源身份不能随意更换；动态 id 不会生成另一套手册。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "不存在时回 SPU 列表；身份锁定先查子记录；取消离开确认可保留输入。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：修改展示名称不把旧 MAT 的建档版本改成当前最新版本。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-skus",
    "title": "SKU 管理操作手册",
    "kind": "page",
    "summary": "按真实销售 SKU 查询，维护工作配置与正式保存视图。",
    "aliases": [
      "SKU 管理",
      "/skus"
    ],
    "pageIds": [
      "page-skus"
    ],
    "actionIds": [
      "action-sku-query",
      "action-view-save",
      "action-view-restore",
      "action-sku-manual-order",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-view-isolation",
      "rule-view-conditions",
      "rule-sku-identity",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuWorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#page-skus"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "按真实销售 SKU 查询，维护工作配置与正式保存视图。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "销售 SKU、所属 SPU、来源；MAT 被统一身份判定排除。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备 SKU 查看；操作按新增/编辑/删除授权；视图配置独立于业务对象。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "查询销售 SKU",
          "保存 SKU 列表视图",
          "恢复 SKU 正式视图",
          "跨页手工排序",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "从当前视图入口选择视图，输入临时搜索；更多筛选保留 AND/OR 条件组。",
          "配置列、手动宽度、冻结、多级排序和分组，保存视图或另存，恢复可撤销工作配置。",
          "点击两行规格摘要查看/复制完整内容；行内编辑，更多查看适用关系或组权益包。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "视图与本机工作配置按原约定恢复；展示变化不会重建 SKU 身份。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "SPU 路由临时范围与视图相交，默认不保存到全部 SKU；手工排序与字段排序/分组冲突时暂停拖排。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "无结果清筛选仍保留路由范围；失效字段先修复配置；保存失败保留工作配置，不覆盖正式视图。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：同一视图限定在一个 SPU，返回全部 SKU 后原正式配置仍在。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-sku-create",
    "title": "新增 SKU操作手册",
    "kind": "page",
    "summary": "选择已存在 SPU 后手工、模板、发布模型或规划方式预览追加规格。",
    "aliases": [
      "新增 SKU",
      "/skus/new"
    ],
    "pageIds": [
      "page-sku-create"
    ],
    "actionIds": [
      "action-sku-preview",
      "action-sku-save"
    ],
    "ruleIds": [
      "rule-sku-input",
      "rule-sku-identity",
      "rule-material-source",
      "rule-conflict"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuCreateView.vue",
      "docs/business-guide/content-source-audit.md#page-sku-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "选择已存在 SPU 后手工、模板、发布模型或规划方式预览追加规格。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "销售 SKU 候选、SPU 公共信息、模型版本及可选规划来源。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "SPU 配置完整且来源兼容；按实际当前授权显示确认能力。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "预览新增 SKU",
          "保存销售 SKU"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "先选 SPU；需要时在新建 SPU 并继续弹窗保存主体。",
          "选择单个规格或批量来源，填写/选择值，点击预览规格。",
          "区分可新增、已存在、无效，勾选可新增项后确认新增。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "只有确认新增才写入；每条规划 SKU 保留完整路径及具体模型版本来源。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "预览不写盘；已有身份不重复创建；切换 SPU 要确认丢弃当前候选。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "来源不一致补全 SPU 或重选；全是已存在时查看已有 SKU；依据变化重新预览。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：同一 SPU 分两次各新增一个不同颜色；原规格保留。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-sku-edit",
    "title": "编辑 SKU操作手册",
    "kind": "page",
    "summary": "维护单条销售 SKU 的允许字段，保持所属主体和来源。",
    "aliases": [
      "编辑 SKU",
      "/skus/:id"
    ],
    "pageIds": [
      "page-sku-edit"
    ],
    "actionIds": [
      "action-sku-save",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-sku-input",
      "rule-sku-identity",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuEditView.vue",
      "docs/business-guide/content-source-audit.md#page-sku-edit"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护单条销售 SKU 的允许字段，保持所属主体和来源。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "路由 id 是 SKU；物料记录必须走物料入口。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备 SKU 编辑权限；规划/节点来源规格可能锁定。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存销售 SKU",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "核对所属 SPU、来源和绑定版本。",
          "修改允许的名称、OA 编号、状态等；来源锁定的规格不强行改写。",
          "点击保存并等待成功，或取消并处理未保存确认。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "保存更新当前 SKU；不会换所属 SPU 或自动创建其他规格。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不能用 MAT ID 冒充 SKU；有来源的身份字段按真实约束锁定。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "记录不存在/属于物料时从列表选择正确对象；输入错误保留并修正，保存失败按提示处理。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：给既有销售 SKU 改 OA 编号，不重算其来源组合。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-material-create",
    "title": "物料建档操作手册",
    "kind": "page",
    "summary": "从已发布规划或临时流程建立 MAT 档案。",
    "aliases": [
      "物料建档",
      "/materials/new"
    ],
    "pageIds": [
      "page-material-create"
    ],
    "actionIds": [
      "action-material-create",
      "action-material-temporary",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-material-source",
      "rule-material-planning",
      "rule-material-identity",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MaterialCreateView.vue",
      "docs/business-guide/content-source-audit.md#page-material-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "从已发布规划或临时流程建立 MAT 档案。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "分类、类型、模型版本、PLN 与 MAT；一个 PLN 可建多条 MAT。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "正式建档需一致且有效的发布依据；临时建档显式选择类型，不冒充正式规划。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "正式物料建档",
          "创建临时物料",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "选择分类/产品类型和已发布模型依据。",
          "预览真实完整组合，核对命名来源；从组合入口建档。",
          "无法匹配正式规划时使用创建临时物料，保存后打开指定物料档案。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "生成独立 MAT 编号和原始来源；不是创建销售 SKU。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "正式与临时来源分开；版本和组合不能凭名称拼接；预览不创建记录。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "分类/类型/模型不一致重选；规划失效重新读取；编号冲突按原提示重新确认，不覆盖旧档。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：同一 PLN 建两个不同采购用途 MAT，二者编号和来源各自保留。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-material-edit",
    "title": "物料档案操作手册",
    "kind": "page",
    "summary": "在物料所属主体内查看指定档案、来源、范围关联和允许维护字段。",
    "aliases": [
      "物料档案",
      "/materials/:id"
    ],
    "pageIds": [
      "page-material-edit"
    ],
    "actionIds": [
      "action-material-edit",
      "action-material-relation",
      "action-material-unlink"
    ],
    "ruleIds": [
      "rule-material-identity",
      "rule-material-source",
      "rule-material-request",
      "rule-model-history"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductEditView.vue",
      "docs/business-guide/content-source-audit.md#page-material-edit"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "在物料所属主体内查看指定档案、来源、范围关联和允许维护字段。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "路径 id 是 family/SPU 主体 ID，query.sku 选择该主体内 MAT；不能当成 SKU id 路由。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "主体须属于物料线；指定物料必须确属此主体并经身份判定。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "维护物料档案",
          "节点范围建档或关联现有 MAT",
          "解除新增物料关联"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "通过物料摘要/建档结果进入档案，核对 MAT 编号与名称。",
          "查看原始建档和有效关联来源，定位模型/PLN；必要时明确取消新增关联。",
          "维护允许字段并保存；临时物料使用其独立入口。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "原 MAT 编号、原始来源与历史版本保持；取消新增关联不抹掉原始建档事实。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "指定记录必须匹配主体；范围覆盖按完整 PLN 去重，不按展示文字合并。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "物料不存在或身份不匹配回列表重选；过期依据先重新预览；人工保护不能用版本确认代替恢复。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：/materials/主体ID?sku=物料ID 定位正确档案；把物料ID放路径中不会等价。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-compatibility",
    "title": "适用关系操作手册",
    "kind": "page",
    "summary": "按设备型号与真实对象维护双向适用声明，并保留原物料维护入口。",
    "aliases": [
      "适用关系",
      "/compatibility"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [
      "action-compatibility-bind",
      "action-compatibility-declare",
      "action-compatibility-sync",
      "action-compatibility-cancel"
    ],
    "ruleIds": [
      "rule-compatibility-binding",
      "rule-compatibility-basis",
      "rule-compatibility-manual-protection",
      "rule-identity-separation"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CompatibilityView.vue",
      "docs/business-guide/content-source-audit.md#page-compatibility"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "按设备型号与真实对象维护双向适用声明，并保留原物料维护入口。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "主机型号、销售配件 SKU、MAT、基本适用/快充能力、人工及模板贡献来源。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "识别当前维护对象与方向；设备绑定和声明维护均按相应权限检查。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "绑定明确设备型号",
          "维护适用声明",
          "同步模板适用更新",
          "人工取消适用声明"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "选择兼容关系工作台或原物料适用关系，核对 route 传入的 SKU/设备上下文。",
          "绑定明确设备型号，按主机找配件或按配件找主机查看正式结论。",
          "新增/修改/取消声明；模板更新先预览差异再确认同步。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "双向查询使用同一声明依据；售卖状态与兼容事实分开。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "基本适用不等于快充；MAT 声明不能自动冒充 SKU 声明；人工取消/修改跨版本受保护。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "缺型号先合法绑定；依据变更重新预览；待确认与不适用不能写成正常推荐。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：配件适用两种主机可以两份声明；仅有快充能力不代表已具基本适用证据。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-benefits",
    "title": "权益包与框架操作手册",
    "kind": "page",
    "summary": "查询包配置、收藏/复制常用包，并独立维护只有类型范围的选配框架。",
    "aliases": [
      "权益包与框架",
      "/benefit-packages"
    ],
    "pageIds": [
      "page-benefits"
    ],
    "actionIds": [
      "action-framework-save",
      "action-benefit-copy",
      "action-benefit-query"
    ],
    "ruleIds": [
      "rule-framework-members",
      "rule-model-history"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageListView.vue",
      "docs/business-guide/content-source-audit.md#page-benefits"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "查询包配置、收藏/复制常用包，并独立维护只有类型范围的选配框架。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "权益包、框架修订、真实 SKU、独立服务和历史交付清单。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "框架维护与包维护有独立权限；只读者可查询获准内容。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存独立选配框架",
          "复制常用权益包",
          "查找权益包与历史"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "筛选包列表或收藏常用包，从新建/编辑进入组包。",
          "在选配框架页签新建框架，设置类型组、必选/种类数/件数规则并保存。",
          "复制旧包后核对设备、成员及冻结规则；查看已保存交付历史。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "保存框架不固定未来具体 SKU；应用时包冻结该次框架修订。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "旧自由包保留原语义；框架不是商品；未选商品也可独立保存合法框架。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "框架组范围不完整先补类型；无权维护只读；复制后的失效引用需修正。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：先建立“充电配件类型”框架，新上架兼容 SKU 可在运行时出现。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-benefit-create",
    "title": "新建权益包操作手册",
    "kind": "page",
    "summary": "在适配上下文中选择真实销售 SKU 和服务，保存新包配置。",
    "aliases": [
      "新建权益包",
      "/benefit-packages/new"
    ],
    "pageIds": [
      "page-benefit-create"
    ],
    "actionIds": [
      "action-benefit-save",
      "action-benefit-select",
      "action-benefit-quote"
    ],
    "ruleIds": [
      "rule-benefit-validation",
      "rule-benefit-quote",
      "rule-framework-members",
      "rule-compatibility-binding"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageEditView.vue",
      "docs/business-guide/content-source-audit.md#page-benefit-create"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "在适配上下文中选择真实销售 SKU 和服务，保存新包配置。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "设备上下文、包内手机、商品行、服务、参考价、每包人工报价和可选框架。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "可无设备自由组包；有设备则遵循正式兼容结论；保存可用配置需消除阻断问题。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存权益包",
          "选配商品和服务",
          "填写并复核报价"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "填写权益包名称，选择适配设备；需交付手机时明确勾选包含这台手机。",
          "选择框架或自由规则，分别查看推荐/其他商品，加入 SKU 并设置数量及服务计量。",
          "处理条件确认、参考价和报价，点击问题定位；保存草稿或保存权益包。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "草稿可留待完善；可用保存通过当前校验；保存并预览仍不等于确认生成清单。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "空参考价与 0 元不同；框架范围一直生效，推荐还需正式基本适用。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "无效成员先定位具体数量/商品；缺适配证据回适用关系；改成员后报价需重新复核。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：适配手机 A 仅提供上下文，未勾包含不会把手机送入清单。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-benefit-edit",
    "title": "权益包详情操作手册",
    "kind": "page",
    "summary": "继续维护已保存包，并按本次包数独立预览和确认交付清单。",
    "aliases": [
      "权益包详情",
      "/benefit-packages/:id"
    ],
    "pageIds": [
      "page-benefit-edit"
    ],
    "actionIds": [
      "action-benefit-save",
      "action-benefit-deliver",
      "action-benefit-quote",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-benefit-validation",
      "rule-benefit-quote",
      "rule-benefit-preview",
      "rule-persistence",
      "rule-conflict"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitPackageEditView.vue",
      "docs/business-guide/content-source-audit.md#page-benefit-edit"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "继续维护已保存包，并按本次包数独立预览和确认交付清单。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "包修订、冻结框架、成员/服务、人工报价、交付依据和历史清单。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "保存最新配置后，包为可用且当前预览通过才能确认生成。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存权益包",
          "预览并确认本机清单",
          "填写并复核报价",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "修改成员、服务、条件和报价后先保存；旧报价按提示复核。",
          "填写本次包数，点击预览本次交付，核对完整明细及计量。",
          "勾选已核对完整组成/适配/报价，再确认生成；历史清单单独打开。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "生成本机冻结清单；后续修改商品、价格、框架或包配置不改旧清单。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "更改内容/价格/依据使旧预览失效；停用包不能生成新清单，但历史仍可读。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "冲突先读取最新或重新预览；写盘失败保留输入；失效引用修正后再保存可用/交付。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：三包的每包服务乘三，本次一次性服务仍按本次数量计量。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-benefit-delivery",
    "title": "交付清单操作手册",
    "kind": "page",
    "summary": "只读查询生成时约定并打印/导出 Excel。",
    "aliases": [
      "交付清单",
      "/benefit-packages/deliveries/:id"
    ],
    "pageIds": [
      "page-benefit-delivery"
    ],
    "actionIds": [
      "action-delivery-export"
    ],
    "ruleIds": [
      "rule-delivery-snapshot",
      "rule-benefit-preview"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BenefitDeliveryView.vue",
      "docs/business-guide/content-source-audit.md#page-benefit-delivery"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "只读查询生成时约定并打印/导出 Excel。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "清单冻结的名称、数量、价格来源、人工报价、适配说明；当前包仅作回看入口。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "清单存在；导出需交付清单导出权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "打印或导出历史清单"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "核对清单编号、本次包数和商品/服务明细。",
          "需要时查看当前包配置，区分它与此清单的历史内容。",
          "点击打印清单或导出 Excel，核对生成文件。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "导出读取清单原快照；本页无修改历史清单操作。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不代表支付、订单、库存扣减、出库或服务激活。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "不存在回权益包查已保存清单；打印/导出失败可直接重试，不重新生成清单。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：商品后来改价，旧清单及其 Excel 仍使用生成时参考价和报价。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-brands",
    "title": "品牌中心操作手册",
    "kind": "page",
    "summary": "维护后续选用的品牌目录名称、标识、说明和启停。",
    "aliases": [
      "品牌中心",
      "/brands"
    ],
    "pageIds": [
      "page-brands"
    ],
    "actionIds": [
      "action-brand-save",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-catalog-names",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/BrandView.vue",
      "docs/business-guide/content-source-audit.md#page-brands"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护后续选用的品牌目录名称、标识、说明和启停。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "品牌目录与已保存商品公共属性文字不是同一个可批量重写对象。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "新增/编辑需品牌权限；名称必填。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存品牌目录",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新增品牌，填写名称，可选标识和说明。",
          "点击保存并等待成功；编辑入口修改已有目录记录。",
          "用状态开关启停，核对保存结果。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "目录更新持久化；历史商品品牌文字保持原样。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "改目录名称不会自动改全部商品；页面没有删除品牌入口。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "缺名称修正当前输入；写盘失败保留弹窗，不把关闭当保存成功。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：目录品牌更名后，旧商品中保存的品牌文字不被批量替换。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-groups",
    "title": "运营分组操作手册",
    "kind": "page",
    "summary": "维护活动/推荐用分组树，并显式选择关联商品。",
    "aliases": [
      "运营分组",
      "/groups"
    ],
    "pageIds": [
      "page-groups"
    ],
    "actionIds": [
      "action-group-link",
      "action-group-create",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-identity-separation",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/GroupView.vue",
      "docs/business-guide/content-source-audit.md#page-groups"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护活动/推荐用分组树，并显式选择关联商品。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "分组、父子关系与 SPU.productGroupIds；不改变商品分类或规格。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "新增、编辑、删除分别按分组权限；选中目标分组。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存分组商品关联",
          "建立运营分组",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新建分组或新增子组，在右侧编辑名称。",
          "多选需要关联的商品。",
          "点击保存关联，核对所选商品的分组归属。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "关联仅调整当前分组的商品集合；名称按原页面即时修改语义保存。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "取消某分组关联不删除商品；不是分类移动工具。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "没有当前分组先选择树节点；保存失败看全局本机保存提示，不反复创建同名分组。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：一个 SPU 可加入活动组，原分类保持不变。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-rules",
    "title": "规格约束操作手册",
    "kind": "page",
    "summary": "维护“当条件成立时目标属性允许哪些值”的现行规则并测试。",
    "aliases": [
      "规格约束",
      "/rules"
    ],
    "pageIds": [
      "page-rules"
    ],
    "actionIds": [
      "action-constraint-save",
      "action-constraint-test",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-constraint-definition",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RuleView.vue",
      "docs/business-guide/content-source-audit.md#page-rules"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护“当条件成立时目标属性允许哪些值”的现行规则并测试。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "方案、条件属性、目标属性、允许值；旧不可转换规则只保留参考。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "规则维护权限；条件与目标必须引用实际词典属性和值。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存规格允许值规则",
          "测试规则覆盖",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新增规则，选择方案、条件属性及值、目标属性和允许值。",
          "保存后用列表/链式/树形/总览检查同一规则。",
          "在规则测试选择方案和值，查看未覆盖或允许值为空提示。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "现行规则参与约束；切换视图不生成第二套规则。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "无法无损转换的旧规则不参与校验；允许值冲突须回实际条件检查。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "缺方案/目标/值先补全；冲突不靠删提示绕过；保存失败保留抽屉输入。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：当颜色为白色时容量只允许 256G；其他颜色是否覆盖以真实规则结果为准。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-mappings",
    "title": "属性方案绑定（历史入口）操作手册",
    "kind": "page",
    "summary": "保留分类到方案的旧维护入口，新人优先去分类中心绑定。",
    "aliases": [
      "属性方案绑定（历史入口）",
      "/mappings"
    ],
    "pageIds": [
      "page-mappings"
    ],
    "actionIds": [
      "action-mapping-save"
    ],
    "ruleIds": [
      "rule-template-bindings"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "historical",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MappingView.vue",
      "docs/business-guide/content-source-audit.md#page-mappings"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "保留分类到方案的旧维护入口，新人优先去分类中心绑定。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "与分类中心共享同一份 mappings，不是独立方案副本。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "方案须有结构属性；需模板编辑权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "修改分类方案绑定"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "找到需要绑定的分类行。",
          "在方案下拉选择有结构的方案，或明确清空绑定。",
          "到分类中心核对同一分类的方案显示。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "直接修改共享绑定，其他入口读取同一结果。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "清空绑定不删除方案；不把隐藏菜单当撤销路由权限。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "方案不在候选先到属性方案补结构；无权时回可读入口。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：在此改一个分类绑定，分类中心会显示同一变化。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。历史保留入口，以当前源码核对职责；新人优先使用上述主流程。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-overview",
    "title": "商品总览操作手册",
    "kind": "page",
    "summary": "按已有商品主体/规格矩阵查询整体商品结构，本页无写入操作。",
    "aliases": [
      "商品总览",
      "/overview"
    ],
    "pageIds": [
      "page-overview"
    ],
    "actionIds": [
      "action-overview-query"
    ],
    "ruleIds": [
      "rule-identity-separation"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/OverviewView.vue",
      "docs/business-guide/content-source-audit.md#page-overview"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "按已有商品主体/规格矩阵查询整体商品结构，本页无写入操作。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "已保存 SPU 和真实 SKU 的列表/矩阵；物料有独立入口与身份。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备总览读取权限；需要修改时进入维护页面。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "查看商品矩阵"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "选择有结构的属性方案，切换商品视图或规格矩阵。",
          "在规格矩阵选择列维度，对照已有商品与规格状态。",
          "从商品或矩阵单元格打开现有详情；空位不会自动补建。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "只读展示；矩阵单元格不自动补建缺失 SKU。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "空格不等于合法但尚未生成的所有组合；统计口径以现有销售记录为准。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "找不到商品先清筛选并核对主体/销售身份；不要将 MAT 数当 SKU 数。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：矩阵缺一个颜色不授权自动生成该规格。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-check",
    "title": "商品质量检查操作手册",
    "kind": "page",
    "summary": "列出当前校验发现的必填、重复和非法取值，定位原对象处理。",
    "aliases": [
      "商品质量检查",
      "/check"
    ],
    "pageIds": [
      "page-check"
    ],
    "actionIds": [
      "action-check-locate"
    ],
    "ruleIds": [
      "rule-identity-separation",
      "rule-sku-input"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/CheckView.vue",
      "docs/business-guide/content-source-audit.md#page-check"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "列出当前校验发现的必填、重复和非法取值，定位原对象处理。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "现有商品/规格校验问题；不是覆盖全部老板业务规则的验收结论。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备质量检查读取权限，修改目标另需编辑权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "定位质量问题"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "浏览问题类型、对象与字段。",
          "点击去修改或对应商品入口。",
          "在原编辑页修正并保存，再返回检查结果。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "此页不自动修数据；问题消失以重新查询和实际保存为准。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不能把空列表解释成所有业务需求都满足。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "对象已删除就回列表核对；不清楚原因提交带最小上下文的反馈。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：发现重复规格后由维护者判断保留记录，不自动按名称合并。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-import",
    "title": "商品导入导出操作手册",
    "kind": "page",
    "summary": "下载模板、导出备份并通过预览/明确确认恢复或导入本机数据。",
    "aliases": [
      "商品导入导出",
      "/import"
    ],
    "pageIds": [
      "page-import"
    ],
    "actionIds": [
      "action-json-import",
      "action-table-import",
      "action-backup-export",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-json-import",
      "rule-material-identity",
      "rule-persistence",
      "rule-conflict",
      "rule-permission"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductIoView.vue",
      "docs/business-guide/content-source-audit.md#page-import"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "下载模板、导出备份并通过预览/明确确认恢复或导入本机数据。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "表格候选、字段匹配、正式/临时物料身份、JSON 备份及原持久化。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "先导出备份；导入权限依导入前当前操作者，不取导入文件中的角色。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "恢复 JSON 备份",
          "确认表格导入",
          "导出业务备份",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "下载模板或导出现有商品，核对格式和范围。",
          "选择文件并匹配字段，预览错误、重复、冲突及将写入对象。",
          "处理问题后确认写入；JSON 恢复核对保存结果，遇冲突重新读取预览。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "预览不等于落盘；确认通过事务后写入，历史冻结信息按原备份保留。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "禁止跨 MAT/SKU 身份混用，坏结构或真实框架组外成员不能靠导入绕过。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "结构损坏明确拒绝并保留原数据；写盘失败不能显示完成；失效引用与容器损坏分开处理。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：合法未知配置保留原文并阻止受影响发布；不是静默丢弃未知记录。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-columns-spu",
    "title": "SPU 列配置与视图操作手册",
    "kind": "page",
    "summary": "通过列配置 query 直接打开 SPU 列/分组/排序设置；与 SPU 列表共用配置。",
    "aliases": [
      "SPU 列配置与视图",
      "/spus?panel=columns"
    ],
    "pageIds": [
      "page-columns-spu"
    ],
    "actionIds": [
      "action-spu-view"
    ],
    "ruleIds": [
      "rule-view-isolation"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ProductListView.vue",
      "docs/business-guide/content-source-audit.md#page-columns-spu"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "通过列配置 query 直接打开 SPU 列/分组/排序设置；与 SPU 列表共用配置。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "SPU 展示视图、列顺序、分组排序和自动保存设置。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备 SPU 及列表视图读取能力；修改按视图更新授权。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "配置 SPU 视图"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "通过列配置与视图入口或 SPU 列表设置打开。",
          "勾选字段，拖动顺序，选择分组/排序。",
          "关闭设置并核对当前视图，另存或恢复默认列按明确按钮执行。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "不创建额外业务页面数据；旧 /columns 与 /products?panel=columns 映射此状态。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不擅自覆盖自定义旧视图；展示列不改变 SPU/SKU 身份。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "字段找不到先搜索列目录；保存失败处理本机存储提示。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：隐藏 OA 列只是展示选择，不删除已有编号。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-columns-sku",
    "title": "SKU 字段与视图设置操作手册",
    "kind": "page",
    "summary": "识别 SKU 的列配置 query 上下文并解释工作配置/正式视图区别。",
    "aliases": [
      "SKU 字段与视图设置",
      "/skus?panel=columns"
    ],
    "pageIds": [
      "page-columns-sku"
    ],
    "actionIds": [
      "action-view-save",
      "action-view-restore"
    ],
    "ruleIds": [
      "rule-view-isolation",
      "rule-view-conditions"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/SkuWorkbenchView.vue",
      "docs/business-guide/content-source-audit.md#page-columns-sku"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "识别 SKU 的列配置 query 上下文并解释工作配置/正式视图区别。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "SKU 字段、宽度、冻结、密度、分组排序和保存视图。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备 SKU 与视图读取；实际字段设置由字段按钮打开。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存 SKU 列表视图",
          "恢复 SKU 正式视图"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "进入 SKU 列表，点击字段。",
          "配置显示、顺序、手动宽度和冻结，再应用工作配置。",
          "保存视图或另存；不需要当前改动时恢复已保存配置。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "字段调整先进入工作配置，保存才覆盖正式视图；页面 query 不切成 SPU 数据。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "系统视图、SPU 临时范围和普通自定义视图遵循原有隔离。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "失效字段到配置修复；窄屏暂不冻结时原保存冻结仍保留。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：把名称列手动设宽，导航收起后自动布局不覆盖这个宽度。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-menus",
    "title": "菜单配置操作手册",
    "kind": "page",
    "summary": "维护真实导航结构、页面放置、改名隐藏和顺序，不直接授予业务权限。",
    "aliases": [
      "菜单配置",
      "/menus"
    ],
    "pageIds": [
      "page-menus"
    ],
    "actionIds": [
      "action-menu-save",
      "action-menu-restore",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-menu-structure",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/MenuConfigView.vue",
      "docs/business-guide/content-source-audit.md#page-menus"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护真实导航结构、页面放置、改名隐藏和顺序，不直接授予业务权限。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "业务中心、分组、正式页面路由、菜单所需查看权限。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "菜单更新权限；只能放置正式登记路由，保留现有个人导航偏好。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存菜单结构",
          "恢复默认菜单结构",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新增中心/分组，或放置已登记页面。",
          "填写显示名、上级、顺序及页面访问权限，保存前核对结构。",
          "用隐藏/排序调整导航；恢复默认只恢复菜单结构。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "保存菜单后导航实时读取；角色、授权、用户及导航偏好不被恢复菜单重置。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "隐藏不撤销严格模式路由授权；非空容器不能直接删除；菜单不能造任意网址。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "非法父子关系改选上级；权限未选先选正式目录；写盘失败保留抽屉草稿。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：将 SKU 改显示名称，真实 /skus 路由、图标和权限保持。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-roles",
    "title": "角色管理操作手册",
    "kind": "page",
    "summary": "维护角色及显式授权，查询关联用户与授权差异。",
    "aliases": [
      "角色管理",
      "/roles"
    ],
    "pageIds": [
      "page-roles"
    ],
    "actionIds": [
      "action-role-save",
      "action-rbac-authorize",
      "action-role-delete",
      "action-rbac-recover",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-role-protection",
      "rule-permission",
      "rule-conflict",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/RoleView.vue",
      "docs/business-guide/content-source-audit.md#page-roles"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护角色及显式授权，查询关联用户与授权差异。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "用户可绑定多个启用角色，有效能力取权限并集；超级管理员受保护。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "角色资料维护与授权能力独立；严格模式下依赖权限须明确选择。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存角色资料",
          "显式保存角色授权",
          "删除普通角色",
          "恢复内置管理授权",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新增或复制角色，填写唯一编码、名称和说明。",
          "打开配置权限，搜索并勾选已登记能力，检查新增/撤销和关联用户数量。",
          "补齐依赖后保存授权；有用户引用先调整绑定再删除普通角色。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "只保存明确选中的当前能力；不自动把未来新增权限授予自定义角色。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "内置超级管理员和恢复能力不能随意撤销；角色授权不等于菜单显示设置。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "缺依赖逐项勾选；受保护角色不强改；冲突或存储失败保留草稿核对后重试。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：给列表查看不自动得到商品编辑；授权依赖也不会悄悄扩张。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-permissions",
    "title": "权限目录操作手册",
    "kind": "page",
    "summary": "查看内置权限的资源/动作/路由绑定并维护说明、显示名和允许的状态。",
    "aliases": [
      "权限目录",
      "/permissions"
    ],
    "pageIds": [
      "page-permissions"
    ],
    "actionIds": [
      "action-permission-save",
      "action-permission-reference",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/PermissionView.vue",
      "docs/business-guide/content-source-audit.md#page-permissions"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "查看内置权限的资源/动作/路由绑定并维护说明、显示名和允许的状态。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "权限码是稳定执行身份；角色引用与依赖单独查询。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "权限更新能力；不能在文案编辑中更换权限码或实际执行绑定。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "维护权限说明和状态",
          "查看权限引用",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "按模块、类型、状态或关键词筛选目录。",
          "打开编辑，核对只读权限码和执行绑定；修改允许的名称/说明/状态。",
          "查看引用角色，处理引用约束后保存。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "目录文案变化不重写执行边界或自动授予角色权限。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "恢复路径受保护；被角色引用的权限停用依当前检查拒绝。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "空名称修正；停用被拒先查引用；不得编造新权限码代替正式目录。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：把“查看 SKU”改显示名，不会把查看变成更新动作。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-users",
    "title": "用户管理操作手册",
    "kind": "page",
    "summary": "维护本机演示用户、角色绑定和受控身份预览。",
    "aliases": [
      "用户管理",
      "/users"
    ],
    "pageIds": [
      "page-users"
    ],
    "actionIds": [
      "action-user-save",
      "action-user-bind",
      "action-user-preview",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-permission",
      "rule-role-protection",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/UserView.vue",
      "docs/business-guide/content-source-audit.md#page-users"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护本机演示用户、角色绑定和受控身份预览。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "用户资料、启停状态、显式角色；默认统一管理员与严格 RBAC 模式分开。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "用户维护和绑定角色能力独立；不引入真实后端登录系统。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存本机用户",
          "绑定用户角色",
          "模拟并退出身份",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "新建或编辑用户，填写名称、账号等实际字段。",
          "选择需要绑定的启用角色，核对绑定后可用能力。",
          "严格模式下可按现有入口模拟身份并退出；默认模式仍统一管理员。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "本机用户资料与角色关系保存；身份预览不代表真实服务器登录。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不能从旧“管理员/运营”菜单开关推断现行授权；受保护管理员保留恢复路径。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "重复账号或无效角色按提示修正；没有目标权限不能通过预览获得。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：默认模式新增普通用户不自动启用严格校验；严格模式按其角色并集检查。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-account",
    "title": "账号设置操作手册",
    "kind": "page",
    "summary": "维护当前本机账号资料并演示密码格式校验。",
    "aliases": [
      "账号设置",
      "/account"
    ],
    "pageIds": [
      "page-account"
    ],
    "actionIds": [
      "action-account-save",
      "action-account-password",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/AccountView.vue",
      "docs/business-guide/content-source-audit.md#page-account"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护当前本机账号资料并演示密码格式校验。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "当前演示身份资料；密码校验不是服务器改密。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "具备账号更新权限；仅修改可见的当前资料。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存账号资料",
          "演示密码校验",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "填写显示名、账号，点击保存资料并核对保存结果。",
          "在修改密码区域填写新密码和再输入一次，点击检查。",
          "至少六位且两次相同才通过；这里只校验，不保存密码。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "资料保存在本机；密码只校验，不保存密码。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "无真实后端身份认证或密码重置承诺。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "格式/确认不一致先修正输入；保存资料失败看本机持久化状态。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：密码检查通过后不能宣称外部账号密码已经修改。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-feedback",
    "title": "反馈管理操作手册",
    "kind": "page",
    "summary": "查询和导出本机反馈及附件，保留来源页面/功能的历史关联。",
    "aliases": [
      "反馈管理",
      "/feedback"
    ],
    "pageIds": [
      "page-feedback"
    ],
    "actionIds": [
      "action-feedback-save",
      "action-feedback-export",
      "action-feedback-import",
      "action-business-save"
    ],
    "ruleIds": [
      "rule-feedback-local",
      "rule-permission",
      "rule-persistence"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/FeedbackView.vue",
      "docs/business-guide/content-source-audit.md#page-feedback"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "查询和导出本机反馈及附件，保留来源页面/功能的历史关联。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "反馈文本、类型、featureId、附件、本地标记和导出状态。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "反馈读取、更新、删除、导入导出按独立权限检查。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存问题反馈",
          "导出本机反馈包",
          "导入反馈包",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "按页面/类型/标记筛选，打开详情查看附件。",
          "编辑尚未导出的记录，或打开合法且有权的原页面。",
          "导出反馈包自行交付；需要时导入反馈包，删除会清对应附件。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "反馈仍保存在本机，不自动发送服务器；导出包包含明确选定内容。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "已导出的记录不能照原编辑流程改写；指南反馈只带最小来源字段，不打包业务库。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "附件读取/导出失败保留记录并重试；敏感业务内容先自行去除再反馈。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：反馈“分类移动失败”可带规则编号，不需要导出全部商品和角色权限。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-forbidden",
    "title": "无访问权限操作手册",
    "kind": "page",
    "summary": "解释当前页面不可访问并提供返回和可用入口；本页无写入操作。",
    "aliases": [
      "无访问权限",
      "/forbidden"
    ],
    "pageIds": [
      "page-forbidden"
    ],
    "actionIds": [
      "action-access-explain"
    ],
    "ruleIds": [
      "rule-permission"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/ForbiddenView.vue",
      "docs/business-guide/content-source-audit.md#page-forbidden"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "解释当前页面不可访问并提供返回和可用入口；本页无写入操作。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "请求的内部页面与当前有效能力；不展示无权读取的对象详情。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "可直接读取一般无权限说明；严格模式按当前身份检查目标路径。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "理解不可访问入口"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "阅读缺少能力或无效入口提示。",
          "返回工作台或有权限页面。",
          "需要权限时向有授权能力的管理员说明任务，不把隐藏菜单当授权依据。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "安全离开不可访问入口，不修改商品或权限。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "默认统一管理员也只接受登记路由；本页作为辅助状态不重复计入正式业务页面分母。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "不存在或无权限地址不无限重试；不能把他人对象名称加入公开失败卡。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：可看指南但无商品编辑能力时，指南不会代替授权。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。已按当前按钮、路由和提交入口静态核对；实际浏览器核验记录另列验收报告。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-guide",
    "title": "业务指南首页操作手册",
    "kind": "page",
    "summary": "按业务概念、页面、动作、规则和问题搜索同一内容源。",
    "aliases": [
      "业务指南首页",
      "/guide"
    ],
    "pageIds": [
      "page-guide"
    ],
    "actionIds": [
      "action-guide-search",
      "action-guide-progress"
    ],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-permission",
      "rule-guide-storage",
      "rule-guide-permission"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideHomeView.vue",
      "docs/business-guide/content-source-audit.md#page-guide"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "按业务概念、页面、动作、规则和问题搜索同一内容源。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "内置内容、已发布说明、个人收藏/进度；与业务 AppData 分离。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "有指南阅读能力即可阅读；维护需独立能力。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "搜索业务知识",
          "保存个人收藏与进度"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "搜索术语、页面或失败现象，按结果类型阅读。",
          "从学习路线进入步骤并主动打开练习页面。",
          "手动标记已读/已练习或收藏，不把打开文章当作完成练习。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "阅读与搜索不写业务数据；进度只写明确个人的指南键。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "不自动创建示例商品或重置数据库；无结果不编造答案。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "空结果换用对象/动作关键词或反馈；个人存储失败仍可阅读，不能显示保存成功。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：搜索“物料不是SKU”进入对象说明，而不是扫描个人业务库。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。本轮新增页面说明，等待集成与实际验收后核验。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-guide-article",
    "title": "指南文章操作手册",
    "kind": "page",
    "summary": "阅读统一页面、动作和规则详情，按目录与相关条目继续查阅。",
    "aliases": [
      "指南文章",
      "/guide/articles/:articleId"
    ],
    "pageIds": [
      "page-guide-article"
    ],
    "actionIds": [
      "action-guide-read",
      "action-guide-progress"
    ],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-guide-storage",
      "rule-guide-permission"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideArticleView.vue",
      "docs/business-guide/content-source-audit.md#page-guide-article"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "阅读统一页面、动作和规则详情，按目录与相关条目继续查阅。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "稳定 articleId、内容修订、核验状态和相关规则。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "文章存在且可阅读；业务练习入口另检查目标权限。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "阅读页面与规则",
          "保存个人收藏与进度"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "阅读用途、前提、步骤、规则和失败处理。",
          "按页内目录定位，查看相关条目或收藏。",
          "主动进入业务页时遵循未保存离开保护；本页指南内阅读不改变业务 URL。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "当前发布说明被显示；不存在文章提供明确返回而非空白。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "说明编辑不改变业务规则；待业务确认不是实际限制。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "文章不存在返回目录搜索；规则原因未知先看原错误，不强行套已知条目。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：阅读分类移动规则后回原抽屉，原待移动来源/目标应保留。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。本轮新增页面说明，等待集成与实际验收后核验。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-guide-learn",
    "title": "新人学习路线操作手册",
    "kind": "page",
    "summary": "按真实任务目标循序阅读、练习并核对结果。",
    "aliases": [
      "新人学习路线",
      "/guide/learn/:flowId"
    ],
    "pageIds": [
      "page-guide-learn"
    ],
    "actionIds": [
      "action-guide-learn",
      "action-guide-progress"
    ],
    "ruleIds": [
      "rule-guide-isolation",
      "rule-guide-storage",
      "rule-guide-permission"
    ],
    "related": [
      "concept-objects"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideLearnView.vue",
      "docs/business-guide/content-source-audit.md#page-guide-learn"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "按真实任务目标循序阅读、练习并核对结果。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "路线步骤、文章修订、个人已读/已练习状态。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "可阅读指南；有权业务页才允许练习跳转。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "按路线学习和练习",
          "保存个人收藏与进度"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "先看路线目标和前置知识。",
          "逐步阅读关联手册，再主动进入合法练习入口。",
          "分别手动标记已读和已练习，按核对点确认理解。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "进度按个人身份保存；内容更新保留旧进度并提示复习。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "没有考试、排名或自动生成演示数据。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "路线不存在回学习首页；进度保存失败只重试进度，不重做业务动作。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：看过权益包交付步骤不代表已经生成清单。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。本轮新增页面说明，等待集成与实际验收后核验。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  },
  {
    "id": "manual-guide-manage",
    "title": "指南内容维护操作手册",
    "kind": "page",
    "summary": "维护解释/步骤/示例的草稿、预览和发布，查看覆盖与缺口。",
    "aliases": [
      "指南内容维护",
      "/guide/manage"
    ],
    "pageIds": [
      "page-guide-manage"
    ],
    "actionIds": [
      "action-guide-draft",
      "action-guide-publish",
      "action-guide-import",
      "action-guide-maintain",
      "action-business-save"
    ],
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
      "concept-objects"
    ],
    "revision": 1,
    "status": "review",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/views/guide/GuideManageView.vue",
      "docs/business-guide/content-source-audit.md#page-guide-manage"
    ],
    "sections": [
      {
        "id": "purpose",
        "title": "页面用途与职责边界",
        "paragraphs": [
          "维护解释/步骤/示例的草稿、预览和发布，查看覆盖与缺口。"
        ]
      },
      {
        "id": "objects",
        "title": "主要对象与上下游",
        "paragraphs": [
          "指南独立内容载荷、修订、上一发布版；内置 ID 与业务绑定不可编辑。"
        ]
      },
      {
        "id": "prerequisites",
        "title": "操作前提与权限",
        "paragraphs": [
          "需指南维护能力，提交时重新检查身份与授权。"
        ]
      },
      {
        "id": "actions",
        "title": "真实入口与关键操作",
        "paragraphs": [
          "保存说明草稿",
          "发布核验说明",
          "导入指南内容备份",
          "维护指南说明",
          "处理本机保存结果"
        ]
      },
      {
        "id": "steps",
        "title": "按动作操作步骤",
        "steps": [
          "选择文章编辑说明，保存草稿后预览。",
          "填写核验状态、适用实现和依据，明确发布后普通读者才看到。",
          "恢复上一发布说明或导出指南备份；导入先校验预览再明确提交。"
        ]
      },
      {
        "id": "results",
        "title": "成功结果与保存位置",
        "paragraphs": [
          "正文、修订和上一版同载荷原子提交；不更改商品、角色或导航偏好。"
        ]
      },
      {
        "id": "rules",
        "title": "限制与关联规则",
        "paragraphs": [
          "管理员改文案不放宽业务校验；冲突不允许后写静默覆盖。"
        ]
      },
      {
        "id": "failures",
        "title": "常见失败与当前处理",
        "paragraphs": [
          "配额失败保留草稿和旧发布版；其他窗口更新后核对最新修订再发布；坏数据保留原文供恢复。"
        ]
      },
      {
        "id": "examples",
        "title": "正反例与检查",
        "paragraphs": [
          "示例：将规则说明改为待核验，不会让原禁止操作变成允许。"
        ]
      },
      {
        "id": "verification",
        "title": "内容版本与核验状态",
        "paragraphs": [
          "本说明修订 1。本轮新增页面说明，等待集成与实际验收后核验。演示示例不扩写为老板已确认的真实规格规则。"
        ]
      }
    ]
  }
]
