import type { GuideFlow } from '../types'

export const guideFlows: GuideFlow[] = [
  {
    "id": "flow-objects",
    "title": "认识业务对象",
    "goal": "分清分类、类型、方案、模型、PLN、MAT、SPU 和 SKU。",
    "prerequisites": [
      "先知道本机 Mock 与真实后端的边界。"
    ],
    "steps": [
      {
        "id": "objects-1",
        "title": "业务对象与关系",
        "articleId": "concept-objects",
        "route": "/",
        "practice": "在工作台只查看入口，不自动新建。",
        "checkpoints": [
          "能解释同 PLN 多 MAT",
          "能区分模型与 SPU"
        ]
      },
      {
        "id": "objects-2",
        "title": "主体与销售规格",
        "articleId": "manual-spus",
        "route": "/spus",
        "practice": "查看一个已有主体及其真实 SKU。",
        "checkpoints": [
          "物料数不是 SKU 数",
          "无来源如实显示未关联"
        ]
      }
    ]
  },
  {
    "id": "flow-foundation",
    "title": "建立基础资料",
    "goal": "从分类与显式类型进入词典、方案和模型。",
    "prerequisites": [
      "已读业务对象说明。"
    ],
    "steps": [
      {
        "id": "foundation-1",
        "title": "建立分类目录",
        "articleId": "manual-categories",
        "route": "/categories",
        "practice": "在隔离样例练习新增分类。",
        "checkpoints": [
          "分清查看/编辑",
          "知道目标绑定类型限制"
        ]
      },
      {
        "id": "foundation-2",
        "title": "显式关联类型",
        "articleId": "manual-product-types",
        "route": "/product-types",
        "practice": "查看一个末级分类关联类型。",
        "checkpoints": [
          "分类不自动等于类型"
        ]
      },
      {
        "id": "foundation-3",
        "title": "准备正式词典",
        "articleId": "manual-params",
        "route": "/params",
        "practice": "查看属性ID与各自取值。",
        "checkpoints": [
          "同名不同属性不合并"
        ]
      },
      {
        "id": "foundation-4",
        "title": "建立录入方案",
        "articleId": "manual-templates",
        "route": "/templates",
        "practice": "预览方案公共/规格角色。",
        "checkpoints": [
          "保存前取消不留半成品"
        ]
      }
    ]
  },
  {
    "id": "flow-model-publish",
    "title": "设计并发布模型",
    "goal": "理解树编辑、词典引用、保存与发布快照。",
    "prerequisites": [
      "分类、类型和词典已就绪。"
    ],
    "steps": [
      {
        "id": "model-publish-1",
        "title": "选择模型",
        "articleId": "manual-models",
        "route": "/models",
        "practice": "选择已有测试模型，不动历史快照。",
        "checkpoints": [
          "核对分类类型"
        ]
      },
      {
        "id": "model-publish-2",
        "title": "编辑真实结构",
        "articleId": "manual-specs",
        "route": "/specs",
        "practice": "查看三视图并定位真实属性和值。",
        "checkpoints": [
          "分支顺序独立",
          "混挂问题能定位"
        ]
      },
      {
        "id": "model-publish-3",
        "title": "保存后发布",
        "articleId": "action-model-publish",
        "route": "/models",
        "practice": "在隔离测试数据执行保存再发布。",
        "checkpoints": [
          "草稿不等于发布",
          "旧版来源保持"
        ]
      }
    ]
  },
  {
    "id": "flow-material",
    "title": "规划与物料建档",
    "goal": "从具体发布依据建立 MAT 并理解多来源范围。",
    "prerequisites": [
      "完成模型发布路线。"
    ],
    "steps": [
      {
        "id": "material-1",
        "title": "查看真实完整组合",
        "articleId": "manual-specs",
        "route": "/specs",
        "practice": "选择一个发布版查看完整 PLN。",
        "checkpoints": [
          "不组合树上不存在路径"
        ]
      },
      {
        "id": "material-2",
        "title": "正式与临时建档",
        "articleId": "manual-material-create",
        "route": "/materials/new",
        "practice": "按样例选择有效类型/模型范围。",
        "checkpoints": [
          "同 PLN 可多 MAT",
          "临时不伪造正式来源"
        ]
      },
      {
        "id": "material-3",
        "title": "查看来源和关联",
        "articleId": "manual-material-edit",
        "route": "/spus",
        "practice": "从物料入口查看范围与编号。",
        "checkpoints": [
          "路径是主体ID",
          "解除新增不抹原来源"
        ]
      }
    ]
  },
  {
    "id": "flow-sales",
    "title": "管理销售商品",
    "goal": "独立建立主体，再分批增加销售规格并查询。",
    "prerequisites": [
      "掌握 SPU/SKU/MAT 差别。"
    ],
    "steps": [
      {
        "id": "sales-1",
        "title": "保存空主体",
        "articleId": "manual-spu-create",
        "route": "/spus/new",
        "practice": "填写样例主体但明确保存才创建。",
        "checkpoints": [
          "名称及分类来源有效"
        ]
      },
      {
        "id": "sales-2",
        "title": "预览并追加规格",
        "articleId": "manual-sku-create",
        "route": "/skus/new",
        "practice": "选择测试主体后只确认合法新候选。",
        "checkpoints": [
          "已有不重复",
          "保留规划来源"
        ]
      },
      {
        "id": "sales-3",
        "title": "查询与保存视图",
        "articleId": "manual-skus",
        "route": "/skus",
        "practice": "设置条件/列并另存个人视图。",
        "checkpoints": [
          "AND/OR不丢",
          "SPU范围隔离"
        ]
      }
    ]
  },
  {
    "id": "flow-compatibility",
    "title": "配置适用关系",
    "goal": "用正式主机和目标身份维护双向适配。",
    "prerequisites": [
      "有明确主机型号和配件销售 SKU/MAT。"
    ],
    "steps": [
      {
        "id": "compatibility-1",
        "title": "识别对象与方向",
        "articleId": "manual-compatibility",
        "route": "/compatibility",
        "practice": "分别按主机和配件查询。",
        "checkpoints": [
          "基本适用与快充分开",
          "MAT不冒充SKU"
        ]
      },
      {
        "id": "compatibility-2",
        "title": "明确型号绑定",
        "articleId": "action-compatibility-bind",
        "route": "/compatibility",
        "practice": "核对已有设备绑定。",
        "checkpoints": [
          "不按名称自动合并"
        ]
      },
      {
        "id": "compatibility-3",
        "title": "理解人工保护",
        "articleId": "rule-compatibility-manual-protection",
        "route": "/compatibility",
        "practice": "查看取消来源说明，不为练习恢复声明。",
        "checkpoints": [
          "改备注不绕过取消",
          "无关新来源仍可执行"
        ]
      }
    ]
  },
  {
    "id": "flow-benefit",
    "title": "权益包与交付",
    "goal": "选配真实商品和服务，核对报价后生成本机清单。",
    "prerequisites": [
      "了解适配结论与具体销售 SKU。"
    ],
    "steps": [
      {
        "id": "benefit-1",
        "title": "先读框架",
        "articleId": "manual-benefits",
        "route": "/benefit-packages",
        "practice": "查看仅类型范围的独立框架。",
        "checkpoints": [
          "框架非商品",
          "旧包冻结修订"
        ]
      },
      {
        "id": "benefit-2",
        "title": "选配和条件确认",
        "articleId": "manual-benefit-create",
        "route": "/benefit-packages/new",
        "practice": "在测试包区分适配设备与包内手机。",
        "checkpoints": [
          "必选/数量能定位",
          "参考价空和0不同"
        ]
      },
      {
        "id": "benefit-3",
        "title": "保存与确认交付",
        "articleId": "manual-benefit-edit",
        "route": "/benefit-packages",
        "practice": "主动打开测试包并独立预览生成。",
        "checkpoints": [
          "保存不等于交付",
          "一次性服务不乘包数"
        ]
      },
      {
        "id": "benefit-4",
        "title": "历史快照与导出",
        "articleId": "manual-benefit-delivery",
        "route": "/benefit-packages",
        "practice": "查看已保存清单。",
        "checkpoints": [
          "无支付库存承诺",
          "导出读冻结内容"
        ]
      }
    ]
  },
  {
    "id": "flow-maintenance",
    "title": "日常维护与排错",
    "goal": "备份、辨别失败类别并按真实恢复路径处理。",
    "prerequisites": [
      "知道先保存何时才算落盘。"
    ],
    "steps": [
      {
        "id": "maintenance-1",
        "title": "导入预览与备份",
        "articleId": "manual-import",
        "route": "/import",
        "practice": "先导出测试备份，预览不直接写入。",
        "checkpoints": [
          "角色依据是导入前",
          "坏结构保留原文"
        ]
      },
      {
        "id": "maintenance-2",
        "title": "处理保存和冲突",
        "articleId": "troubleshooting-save",
        "route": "/guide",
        "practice": "辨别存储失败与依据变化。",
        "checkpoints": [
          "存储可受控重试",
          "冲突要重新核对"
        ]
      },
      {
        "id": "maintenance-3",
        "title": "最小上下文反馈",
        "articleId": "manual-feedback",
        "route": "/feedback",
        "practice": "查看一条本机反馈及附件流程。",
        "checkpoints": [
          "不自动上传",
          "不打包全业务库"
        ]
      }
    ]
  },
  {
    "id": "flow-administration",
    "title": "系统管理员维护",
    "goal": "分清菜单、角色、权限和用户绑定，并维护指南。",
    "prerequisites": [
      "有相应管理权限；理解默认/严格模式。"
    ],
    "steps": [
      {
        "id": "administration-1",
        "title": "导航展示",
        "articleId": "manual-menus",
        "route": "/menus",
        "practice": "查看正式路由和自定义分组。",
        "checkpoints": [
          "隐藏不等于撤权"
        ]
      },
      {
        "id": "administration-2",
        "title": "显式角色授权",
        "articleId": "manual-roles",
        "route": "/roles",
        "practice": "检查依赖和影响用户。",
        "checkpoints": [
          "不自动补权",
          "恢复能力受保护"
        ]
      },
      {
        "id": "administration-3",
        "title": "用户与预览",
        "articleId": "manual-users",
        "route": "/users",
        "practice": "区分真实操作者和预览身份。",
        "checkpoints": [
          "默认模式不启用严格校验"
        ]
      },
      {
        "id": "administration-4",
        "title": "说明草稿与发布",
        "articleId": "manual-guide-manage",
        "route": "/guide/manage",
        "practice": "维护说明但不改内置业务条件。",
        "checkpoints": [
          "指南与业务存储隔离",
          "冲突不静默覆盖"
        ]
      }
    ]
  }
]
