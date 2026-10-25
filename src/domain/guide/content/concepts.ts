import type { GuideArticle } from '../types'

export const guideConceptArticles: GuideArticle[] = [
  {
    "id": "concept-objects",
    "title": "业务对象与合法关联",
    "kind": "concept",
    "summary": "分类不自动等于类型；模型不是 SPU；PLN、MAT 与销售 SKU 各有身份。",
    "aliases": [
      "PLN",
      "MAT",
      "Model",
      "SPU",
      "SKU",
      "商品族",
      "物料不是SKU",
      "型号与商品"
    ],
    "pageIds": [
      "page-home",
      "page-models",
      "page-spus",
      "page-skus",
      "page-material-create"
    ],
    "actionIds": [],
    "ruleIds": [
      "rule-identity-separation"
    ],
    "related": [
      "manual-models",
      "manual-spus",
      "manual-skus",
      "manual-material-create"
    ],
    "sections": [
      {
        "id": "objects",
        "title": "对象对照",
        "table": {
          "headers": [
            "对象",
            "职责",
            "边界"
          ],
          "rows": [
            [
              "分类",
              "业务目录与归属",
              "不自动产生类型"
            ],
            [
              "产品类型",
              "显式关联末级分类，归属模型",
              "不等于分类名"
            ],
            [
              "属性方案",
              "公共/规格属性与录入约束",
              "不是某个商品"
            ],
            [
              "模型/发布版",
              "真实节点路径与冻结依据",
              "不是 SPU"
            ],
            [
              "PLN",
              "完整规划组合身份",
              "不是销售 SKU；同 PLN 可多 MAT"
            ],
            [
              "MAT",
              "物料档案编号与来源",
              "不能自动作为销售 SKU"
            ],
            [
              "SPU",
              "商品主体与公共信息",
              "可先无 SKU"
            ],
            [
              "SKU",
              "实际销售规格与所属主体",
              "来源应如实追溯，未关联不伪造"
            ]
          ]
        }
      },
      {
        "id": "flows",
        "title": "两条有分支的工作路径",
        "paragraphs": [
          "规划/物料：发布模型→真实组合/节点范围→明确建档或关联 MAT。",
          "销售商品：独立建立 SPU→手工/模板/模型/规划预览→确认真实 SKU。两条路径可合法关联，但不按名字自动合并。"
        ]
      },
      {
        "id": "history",
        "title": "历史与边界",
        "paragraphs": [
          "样式、菜单、指南和列表摘要均不能重算业务身份；发布与交付快照独立。"
        ]
      }
    ]
  },
  {
    "id": "concept-pending-requirements",
    "title": "仍待业务确认的需求边界",
    "kind": "concept",
    "summary": "缺少原始需求不等于缺功能，也不能据此宣称所有老板需求满足。",
    "aliases": [
      "幕布原文",
      "手机物料规则",
      "历史回填",
      "公共物料归组",
      "覆盖冲突"
    ],
    "pageIds": [
      "page-specs",
      "page-material-create",
      "page-benefits"
    ],
    "actionIds": [],
    "ruleIds": [],
    "related": [
      "manual-specs",
      "manual-material-create"
    ],
    "status": "business-pending",
    "sections": [
      {
        "id": "pending",
        "title": "明确待业务确认",
        "paragraphs": [
          "原幕布完整列表功能/字段、手机业务三类完整物料规则仍需原文核对。",
          "尚未确认的配置覆盖/排除/继承、公共物料自动归组、历史回填规则不能由演示数据推导。"
        ]
      },
      {
        "id": "effect",
        "title": "当前影响",
        "paragraphs": [
          "这些待确认项不作为新增执行限制，不自动合并、补关联或改历史。已实现功能以当前功能和规则说明为准。"
        ]
      }
    ]
  }
]
