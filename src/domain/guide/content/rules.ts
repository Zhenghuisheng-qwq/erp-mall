import type { GuideArticle } from '../types'

export const guideRuleArticles: GuideArticle[] = [
  {
    "id": "rule-category-typed-target",
    "title": "绑定类型的目标不接收子分类",
    "kind": "rule",
    "summary": "保持类型与末级分类的约束，来源绑定类型不等于来源不能移动",
    "aliases": [
      "绑定类型的目标不接收子分类",
      "category-typed-target"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [
      "action-category-create",
      "action-category-move"
    ],
    "ruleIds": [],
    "related": [
      "manual-categories"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "目标未绑定类型，且满足其他层级条件",
              "把分类移入已经显式关联产品类型的目标"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "把有类型的来源叶节点移到普通目录",
              "把新分类塞到已绑定类型的叶分类之下"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品分类中心；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "在左侧选其他可接收子分类的目标；需要时查看目标关联类型"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-category-cycle",
    "title": "分类移动不得形成循环",
    "kind": "rule",
    "summary": "避免目录闭环导致树遍历和归属失真",
    "aliases": [
      "分类移动不得形成循环",
      "category-cycle"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [
      "action-category-move"
    ],
    "ruleIds": [],
    "related": [
      "manual-categories"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "目标不是来源本身，也不是其后代",
              "移入自身或来源子孙"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "把同层 A 移到独立目录 B",
              "把 A 移到 A 的孩子之下"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品分类中心；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "保留来源，在目标树改选其他目录"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-category-stale",
    "title": "分类来源与目标须仍有效",
    "kind": "rule",
    "summary": "不让旧上下文写入错误层级",
    "aliases": [
      "分类来源与目标须仍有效",
      "category-stale"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [
      "action-category-move",
      "action-category-copy"
    ],
    "ruleIds": [],
    "related": [
      "manual-categories"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "确认时来源存在且所选目标存在或明确顶级",
              "来源已删除、目标已失效或结构依据不再匹配"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "当前存在的分类移动到顶级",
              "用旧窗口中已删除的目标继续确认"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品分类中心；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "重新核对当前树并选择来源/目标"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-model-dictionary",
    "title": "模型发布须保有真实词典引用",
    "kind": "rule",
    "summary": "冻结版本与草稿使用同一身份语义，不按文字跨属性合并",
    "aliases": [
      "模型发布须保有真实词典引用",
      "model-dictionary"
    ],
    "pageIds": [
      "page-params",
      "page-models",
      "page-specs"
    ],
    "actionIds": [
      "action-dictionary-save",
      "action-dictionary-value-remove",
      "action-model-create",
      "action-model-copy",
      "action-model-publish",
      "action-model-offline",
      "action-model-edit",
      "action-node-business-save",
      "action-node-naming-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-params",
      "manual-models",
      "manual-specs"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "属性 ID 存在，实际值属于该属性词典，配置引用合法",
              "缺失属性、值不属于引用属性、引用值被删除或改名"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "颜色属性引用自己的黑色值",
              "把品牌中的同文字取值当颜色引用"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于属性词典、商品模型列表、商品模型设计；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "定位具体节点，引用正式词典或维护未被引用的新值"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-model-structure",
    "title": "发布树必须满足真实结构",
    "kind": "rule",
    "summary": "确保真实路径枚举而非猜测全局组合",
    "aliases": [
      "发布树必须满足真实结构",
      "model-structure"
    ],
    "pageIds": [
      "page-models",
      "page-specs"
    ],
    "actionIds": [
      "action-model-create",
      "action-model-copy",
      "action-model-publish",
      "action-model-offline",
      "action-model-edit",
      "action-node-business-save",
      "action-node-naming-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-models",
      "manual-specs"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "节点层级和真实路径通过现有结构检查",
              "属性直接子级混挂属性/值、循环或缺失结构关系"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "一条属性下放值，再在值下加条件属性",
              "同一属性直接同时挂条件属性和取值"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品模型列表、商品模型设计；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "在结构检查定位节点路径，修正层级后保存再发布"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-model-history",
    "title": "发布依据与历史快照保持",
    "kind": "rule",
    "summary": "保留可追溯的创建依据",
    "aliases": [
      "发布依据与历史快照保持",
      "model-history"
    ],
    "pageIds": [
      "page-models",
      "page-specs",
      "page-plans",
      "page-spu-edit",
      "page-material-edit",
      "page-benefits"
    ],
    "actionIds": [
      "action-model-create",
      "action-model-copy",
      "action-model-publish",
      "action-model-offline",
      "action-model-edit",
      "action-node-business-save",
      "action-node-naming-save",
      "action-planning-save",
      "action-planning-create-sku",
      "action-planning-delete",
      "action-spu-history",
      "action-material-edit",
      "action-material-unlink",
      "action-framework-save",
      "action-benefit-copy",
      "action-benefit-query"
    ],
    "ruleIds": [],
    "related": [
      "manual-models",
      "manual-specs",
      "manual-plans"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "保存草稿后显式发布新版本，历史对象继续引用原版本",
              "用当前草稿替换旧发布树、自动改写旧 MAT/PLN 来源"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "V2 发布后 V1 物料仍显示 V1",
              "因样式布局变化重算旧编号或来源"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品模型列表、商品模型设计、商品规划（保留入口）、SPU 详情、物料档案、权益包与框架；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看绑定快照；新操作明确选择有效版本"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ],
    "status": "historical"
  },
  {
    "id": "rule-node-config",
    "title": "值业务配置是附属实例",
    "kind": "rule",
    "summary": "配置不得偷偷生成规格分支或波及兄弟路径",
    "aliases": [
      "值业务配置是附属实例",
      "node-config"
    ],
    "pageIds": [
      "page-specs"
    ],
    "actionIds": [
      "action-model-publish",
      "action-model-edit",
      "action-node-business-save",
      "action-node-naming-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-specs"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "记录结构有效、定义可支持、范围和参数明确",
              "容器损坏、无法执行的未知类型或实际冲突仍发布"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "A 路径限制颜色候选，B 路径配置独立",
              "把允许值限制当全局词典删除指令"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品模型设计；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看配置问题与节点来源，未知定义保留原文待处理"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-material-source",
    "title": "正式物料来源必须一致",
    "kind": "rule",
    "summary": "保证 MAT 的档案来源可核验",
    "aliases": [
      "正式物料来源必须一致",
      "material-source"
    ],
    "pageIds": [
      "page-models",
      "page-specs",
      "page-sku-create",
      "page-material-create",
      "page-material-edit"
    ],
    "actionIds": [
      "action-model-create",
      "action-model-copy",
      "action-model-offline",
      "action-model-edit",
      "action-node-business-save",
      "action-node-naming-save",
      "action-material-create",
      "action-material-temporary",
      "action-material-edit",
      "action-material-relation",
      "action-material-unlink"
    ],
    "ruleIds": [],
    "related": [
      "manual-models",
      "manual-specs",
      "manual-sku-create"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "分类、类型、模型和指定发布快照属于同一合法来源",
              "跨分类/类型模型、无效发布版或主体来源不匹配"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "在该类型发布模型中选一条规划建档",
              "仅名称相同就把别的类型发布版套入当前主体"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品模型列表、商品模型设计、新增 SKU、物料建档、物料档案；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "重新选择一致来源并预览，不能改旧快照凑一致"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-material-planning",
    "title": "正式规划必须可用且完整",
    "kind": "rule",
    "summary": "PLN 表示完整来源，不等于 MAT 或销售 SKU",
    "aliases": [
      "正式规划必须可用且完整",
      "material-planning"
    ],
    "pageIds": [
      "page-material-create"
    ],
    "actionIds": [
      "action-material-create",
      "action-material-temporary"
    ],
    "ruleIds": [],
    "related": [
      "manual-material-create"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "指定发布版仍含实际完整组合或合法节点覆盖",
              "规划不存在、版本内不含该组合、来源失效"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "同一有效 PLN 分别创建两个 MAT",
              "把词典任意组合伪装成发布模型里的 PLN"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于物料建档；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "回到指定发布版重新选择真实路径"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-material-identity",
    "title": "MAT 与销售 SKU 身份分离",
    "kind": "rule",
    "summary": "避免同名/旧字段造成跨对象误改",
    "aliases": [
      "MAT 与销售 SKU 身份分离",
      "material-identity"
    ],
    "pageIds": [
      "page-material-create",
      "page-material-edit",
      "page-import"
    ],
    "actionIds": [
      "action-material-create",
      "action-material-temporary",
      "action-material-edit",
      "action-material-unlink",
      "action-json-import",
      "action-table-import",
      "action-backup-export"
    ],
    "ruleIds": [],
    "related": [
      "manual-material-create",
      "manual-material-edit",
      "manual-import"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "按统一身份函数判断记录，并用正确主体与记录上下文访问",
              "用 MAT 当销售 SKU、跨主体 sku query 或导入身份冲突"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "主体路径加该主体 MAT 的 sku query 打开档案",
              "把另一主体 SKU ID 当当前物料修改"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于物料建档、物料档案、商品导入导出；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "从对应列表/原档案入口重新定位"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-material-request",
    "title": "物料关联请求回执与原始来源保留",
    "kind": "rule",
    "summary": "重复成功也必须被记住，不能覆写 A 或批改历史",
    "aliases": [
      "物料关联请求回执与原始来源保留",
      "material-request"
    ],
    "pageIds": [
      "page-material-edit"
    ],
    "actionIds": [
      "action-material-edit",
      "action-material-relation",
      "action-material-unlink"
    ],
    "ruleIds": [],
    "related": [
      "manual-material-edit"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "新 requestId 明确执行新意图；相同请求仅返回稳定原执行结果",
              "已受理请求更换来源/目标，或解绑后用旧请求重新建关联"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "A 建关联、B 同意图成功，解绑后以新 C 明确重新关联",
              "给 B 更新 basis 后企图复活已撤销关系"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于物料档案；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "重新预览并显式发起新操作，保留旧回执"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-spu-input",
    "title": "SPU 输入与有效引用",
    "kind": "rule",
    "summary": "主体可以独立建立，但不能留下伪造引用",
    "aliases": [
      "SPU 输入与有效引用",
      "spu-input"
    ],
    "pageIds": [
      "page-spu-create"
    ],
    "actionIds": [
      "action-spu-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-spu-create"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "名称非空、分类存在、方案/类型/发布版引用有效",
              "空名称、分类失效、类型与分类或版本与模型不一致"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "合法分类下保存无 SKU 的主体",
              "空名或用其他模型的发布版保存"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新建 SPU；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "定位名称与来源字段，修正后保存"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-spu-identity",
    "title": "有下游的 SPU 身份锁定",
    "kind": "rule",
    "summary": "不重生成子记录或抹去历史关系",
    "aliases": [
      "有下游的 SPU 身份锁定",
      "spu-identity"
    ],
    "pageIds": [
      "page-spu-create",
      "page-spu-edit"
    ],
    "actionIds": [
      "action-spu-save",
      "action-spu-history"
    ],
    "ruleIds": [],
    "related": [
      "manual-spu-create",
      "manual-spu-edit"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "在允许字段维护名称/编号/状态，来源相容时新增子记录",
              "已有 SKU、MAT 或历史关联后直接改分类/类型/版本/公共属性身份"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "旧主体改展示名称而子记录不变",
              "直接换主体模型使旧 SKU 变成另一种规格"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新建 SPU、SPU 详情；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "追加新规格或新建符合来源的主体，保留原对象"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-spu-reference",
    "title": "SPU 删除不级联清子记录",
    "kind": "rule",
    "summary": "防止删除主体隐式破坏下游",
    "aliases": [
      "SPU 删除不级联清子记录",
      "spu-reference"
    ],
    "pageIds": [
      "page-spus"
    ],
    "actionIds": [
      "action-spu-query",
      "action-spu-view",
      "action-spu-delete"
    ],
    "ruleIds": [],
    "related": [
      "manual-spus"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "已下架且无实际 SKU/MAT/受保护引用，按确认删除",
              "已发布直接删、有子记录或历史引用仍删除"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "删除无引用的空草稿主体",
              "删除主体同时想自动清全部 MAT"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于SPU 管理；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "先查看真实子记录及引用，按原流程处理"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-sku-input",
    "title": "SKU 规格必须属于主体方案",
    "kind": "rule",
    "summary": "让保存值可追踪到真实录入依据",
    "aliases": [
      "SKU 规格必须属于主体方案",
      "sku-input"
    ],
    "pageIds": [
      "page-sku-create",
      "page-sku-edit",
      "page-check"
    ],
    "actionIds": [
      "action-sku-preview",
      "action-sku-save",
      "action-check-locate"
    ],
    "ruleIds": [],
    "related": [
      "manual-sku-create",
      "manual-sku-edit",
      "manual-check"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "字段、必填和取值通过当前方案/约束，规格不覆盖主体公共值",
              "未绑定属性、非法取值、规格覆盖公共属性或无可生成规格"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "在主体方案内追加不同合法颜色",
              "直接加入不属于该方案的“占位属性”"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新增 SKU、编辑 SKU、商品质量检查；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "补全 SPU 或选实际绑定属性，再预览"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-sku-identity",
    "title": "SKU 追加去重和来源锁定",
    "kind": "rule",
    "summary": "不从展示摘要重推 SKU 编号或身份",
    "aliases": [
      "SKU 追加去重和来源锁定",
      "sku-identity"
    ],
    "pageIds": [
      "page-plans",
      "page-skus",
      "page-sku-create",
      "page-sku-edit"
    ],
    "actionIds": [
      "action-planning-save",
      "action-planning-create-sku",
      "action-planning-delete",
      "action-sku-query",
      "action-view-restore",
      "action-sku-manual-order",
      "action-sku-preview",
      "action-sku-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-plans",
      "manual-skus",
      "manual-sku-create"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "只确认有效新候选；已有 ID/规格不重复，来源身份保持",
              "修改有规划/节点来源 SKU 的规格身份、过期候选或跨 SPU 误写"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "查看已有候选并只追加另外一条新规格",
              "复制同规格后要求生成第二条同身份销售记录"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品规划（保留入口）、SKU 管理、新增 SKU、编辑 SKU；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看已有 SKU；变化后重新预览，需新身份则追加合法新规格"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ],
    "status": "historical"
  },
  {
    "id": "rule-view-isolation",
    "title": "视图、临时范围与业务数据分离",
    "kind": "rule",
    "summary": "保留用户选择和业务对象，自动适配不是手工列宽",
    "aliases": [
      "视图、临时范围与业务数据分离",
      "view-isolation"
    ],
    "pageIds": [
      "page-spus",
      "page-skus",
      "page-columns-spu",
      "page-columns-sku"
    ],
    "actionIds": [
      "action-spu-query",
      "action-spu-view",
      "action-spu-delete",
      "action-sku-query",
      "action-view-save",
      "action-view-restore",
      "action-sku-manual-order"
    ],
    "ruleIds": [],
    "related": [
      "manual-spus",
      "manual-skus",
      "manual-columns-spu"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "视图条件与路由 SPU 范围相交，默认仅保存正式配置",
              "清筛选扩大到其他 SPU、将临时范围自动覆盖全部视图"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "某 SPU 中查看同一个保存视图后返回全部 SKU",
              "恢复视图顺带重置商品或写自动宽度"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于SPU 管理、SKU 管理、SPU 列配置与视图、SKU 字段与视图设置；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "核对当前范围，按明确包含范围选项保存"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-view-conditions",
    "title": "筛选逻辑与手工顺序保持",
    "kind": "rule",
    "summary": "查询结果与排序必须可解释",
    "aliases": [
      "筛选逻辑与手工顺序保持",
      "view-conditions"
    ],
    "pageIds": [
      "page-skus",
      "page-columns-sku"
    ],
    "actionIds": [
      "action-sku-query",
      "action-view-save",
      "action-view-restore",
      "action-sku-manual-order"
    ],
    "ruleIds": [],
    "related": [
      "manual-skus",
      "manual-columns-sku"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "条件在原 AND/OR 组内执行，父分类包含下级用明确操作；手排无冲突",
              "失效字段扩大查询、在分组/字段排序冲突时继续拖排"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "清除字段排序和分组后用暂存跨页插入",
              "把两个不同属性同名条件合并成一个"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于SKU 管理、SKU 字段与视图设置；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "修复配置并明确清除冲突，不删除原工作规则"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-compatibility-binding",
    "title": "适用绑定须有明确对象与主机",
    "kind": "rule",
    "summary": "避免名称猜测扩大适用范围",
    "aliases": [
      "适用绑定须有明确对象与主机",
      "compatibility-binding"
    ],
    "pageIds": [
      "page-compatibility",
      "page-benefit-create"
    ],
    "actionIds": [
      "action-compatibility-bind",
      "action-compatibility-declare",
      "action-benefit-select"
    ],
    "ruleIds": [],
    "related": [
      "manual-compatibility",
      "manual-benefit-create"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "主机型号合法且目标是实际受支持的 SKU/MAT 粒度",
              "型号歧义、目标不存在、错误身份或非法绑定"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "为配件销售 SKU 明确绑定主机型号",
              "按手机名字自动把 MAT 关系算作销售兼容"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于适用关系、新建权益包；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "选正式设备型号并核对目标身份"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-compatibility-basis",
    "title": "适用声明按有效依据维护",
    "kind": "rule",
    "summary": "双向查询和维护共享同一事实依据",
    "aliases": [
      "适用声明按有效依据维护",
      "compatibility-basis"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [
      "action-compatibility-declare",
      "action-compatibility-sync"
    ],
    "ruleIds": [],
    "related": [
      "manual-compatibility"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "结论、能力、条件和来源通过真实校验，预览依据仍有效",
              "真实矛盾结论/条件、过期 basis 或错误目标"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "同结论同条件集合仅排列不同，保留真实来源",
              "因为备注相同就合并两个矛盾主机结论"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于适用关系；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "处理冲突并重新预览，不无限重试旧候选"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-compatibility-manual-protection",
    "title": "人工修改与取消跨版本保留",
    "kind": "rule",
    "summary": "内容签名变化不等于来源身份变更",
    "aliases": [
      "人工修改与取消跨版本保留",
      "compatibility-manual-protection"
    ],
    "pageIds": [
      "page-compatibility"
    ],
    "actionIds": [
      "action-material-relation",
      "action-compatibility-sync",
      "action-compatibility-cancel"
    ],
    "ruleIds": [],
    "related": [
      "manual-compatibility"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "稳定规则/声明真实谱系相同则继承人工决定；无关新来源按原规则执行",
              "只改 note/source/核验状态后重新生成已取消或改过声明"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "另一无关主机声明可以按规则执行",
              "确认新版本范围就静默恢复已取消兼容"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于适用关系；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看人工来源保护并保留决定，本轮没有显式恢复不重建"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-framework-members",
    "title": "框架类型范围与修订保护",
    "kind": "rule",
    "summary": "容器损坏与可修复缺引用必须区分",
    "aliases": [
      "框架类型范围与修订保护",
      "framework-members"
    ],
    "pageIds": [
      "page-benefits",
      "page-benefit-create"
    ],
    "actionIds": [
      "action-framework-save",
      "action-benefit-copy",
      "action-benefit-query",
      "action-benefit-select",
      "action-benefit-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-benefits",
      "manual-benefit-create"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "成员在唯一启用类型组；合法冻结修订；缺失引用可读并修正",
              "真实组外 SKU 导入为可用、重叠类型组或损坏冻结依据"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "保存只有类型范围的框架，再动态选择新在售 SKU",
              "商品模块重置导致已引用框架成员失效仍提交"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于权益包与框架、新建权益包；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "定位组/成员修正；破坏引用的模块重置应拒绝"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-benefit-validation",
    "title": "可用权益包通过当前成员与条件校验",
    "kind": "rule",
    "summary": "草稿可待完善，但可用/交付不能绕过阻断",
    "aliases": [
      "可用权益包通过当前成员与条件校验",
      "benefit-validation"
    ],
    "pageIds": [
      "page-benefit-create",
      "page-benefit-edit"
    ],
    "actionIds": [
      "action-benefit-select",
      "action-benefit-save",
      "action-benefit-deliver"
    ],
    "ruleIds": [],
    "related": [
      "manual-benefit-create",
      "manual-benefit-edit"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "真实成员、数量、服务、设备及条件确认符合当前配置",
              "失效 SKU/主体/主机、件数/必选种数不符或无正式适配依据"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "缺成员的旧包可打开修复后再保存可用",
              "缺引用仍生成新交付，或把 MAT 放成销售商品"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新建权益包、权益包详情；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "点具体问题定位成员输入，修正后保存；旧历史只读"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-benefit-quote",
    "title": "人工报价与参考合计分别记录",
    "kind": "rule",
    "summary": "报价不是自动由参考价推导出的唯一售价",
    "aliases": [
      "人工报价与参考合计分别记录",
      "benefit-quote"
    ],
    "pageIds": [
      "page-benefit-create",
      "page-benefit-edit"
    ],
    "actionIds": [
      "action-benefit-select",
      "action-benefit-save",
      "action-benefit-quote",
      "action-benefit-deliver"
    ],
    "ruleIds": [],
    "related": [
      "manual-benefit-create",
      "manual-benefit-edit"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "未填与 0 元区分；每包报价人工填写，变化后复核当前依据",
              "把空价当 0，内容/参考价变后沿用旧复核"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "参考合计高于人工报价，负差额合法",
              "数量已改变仍拿旧报价确认直接交付"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新建权益包、权益包详情；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "核对组成与价源，点击复核当前报价"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-benefit-preview",
    "title": "交付须基于最新保存与确认预览",
    "kind": "rule",
    "summary": "防止生成与当前承诺不一致的清单",
    "aliases": [
      "交付须基于最新保存与确认预览",
      "benefit-preview"
    ],
    "pageIds": [
      "page-benefit-edit",
      "page-benefit-delivery"
    ],
    "actionIds": [
      "action-benefit-deliver",
      "action-delivery-export"
    ],
    "ruleIds": [],
    "related": [
      "manual-benefit-edit",
      "manual-benefit-delivery"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "包可用、无未保存更改、当前修订预览通过并明确确认",
              "停用/失效包、旧修订/过期条件/旧预览继续生成"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "保存后填本次包数、预览、勾选再生成",
              "修改商品或价格后直接确认旧预览"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于权益包详情、交付清单；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "保存最新配置并重新预览核对"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-delivery-snapshot",
    "title": "历史交付只读冻结内容",
    "kind": "rule",
    "summary": "交付清单是本机约定，不虚构订单支付库存",
    "aliases": [
      "历史交付只读冻结内容",
      "delivery-snapshot"
    ],
    "pageIds": [
      "page-benefit-delivery"
    ],
    "actionIds": [
      "action-delivery-export"
    ],
    "ruleIds": [],
    "related": [
      "manual-benefit-delivery"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "查看/导出使用生成时快照，后续商品和框架可独立维护",
              "按当前商品/价格重算旧清单或把导出当出库激活"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "旧清单继续显示旧参考价与人工报价",
              "改当前包后要求旧 Excel 自动换内容"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于交付清单；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "打开正确清单，导出失败只重试导出"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-json-import",
    "title": "导入校验与当前角色保护",
    "kind": "rule",
    "summary": "导入不能成为绕过 Store 校验的第二写入口",
    "aliases": [
      "导入校验与当前角色保护",
      "json-import"
    ],
    "pageIds": [
      "page-import"
    ],
    "actionIds": [
      "action-json-import",
      "action-table-import",
      "action-backup-export"
    ],
    "ruleIds": [],
    "related": [
      "manual-import"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "结构合法、身份/冻结依据有效且当前导入前操作者获准",
              "非数组/空记录/缺参数、非法组外成员或用文件角色绕过只读"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "管理员恢复合法备份保留配置和历史",
              "运营借 JSON 修改定义/草稿/历史配置"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品导入导出；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "保留当前数据和原文，修复合法备份后重新确认"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-persistence",
    "title": "真实写盘状态与失败恢复",
    "kind": "rule",
    "summary": "不同事务保存状态必须如实区分",
    "aliases": [
      "真实写盘状态与失败恢复",
      "persistence"
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
      "page-feedback"
    ],
    "actionIds": [
      "action-category-create",
      "action-category-rename",
      "action-category-move",
      "action-category-copy",
      "action-category-delete",
      "action-type-save",
      "action-type-models",
      "action-type-delete",
      "action-dictionary-save",
      "action-dictionary-value-remove",
      "action-template-create",
      "action-template-save",
      "action-template-copy",
      "action-template-delete",
      "action-model-publish",
      "action-spu-save",
      "action-spu-history",
      "action-sku-query",
      "action-view-save",
      "action-view-restore",
      "action-sku-manual-order",
      "action-sku-save",
      "action-material-create",
      "action-material-temporary",
      "action-benefit-save",
      "action-benefit-deliver",
      "action-brand-save",
      "action-group-create",
      "action-group-link",
      "action-constraint-save",
      "action-constraint-test",
      "action-json-import",
      "action-table-import",
      "action-backup-export",
      "action-menu-save",
      "action-menu-restore",
      "action-role-save",
      "action-rbac-authorize",
      "action-role-delete",
      "action-rbac-recover",
      "action-permission-save",
      "action-permission-reference",
      "action-user-save",
      "action-user-bind",
      "action-user-preview",
      "action-account-save",
      "action-account-password",
      "action-feedback-save",
      "action-feedback-export",
      "action-feedback-import",
      "action-business-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-categories",
      "manual-product-types",
      "manual-params"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "受控事务真实 setItem 成功后报告保存完成",
              "把内存已改但写盘失败称已保存，或删除原数据腾空间"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "修复空间问题后用页面受控重试",
              "配额错误后静默加载种子数据覆盖原存储"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品分类中心、产品类型、属性词典、属性方案、新建 SPU、SPU 详情、SKU 管理、编辑 SKU、物料建档、权益包详情、品牌中心、运营分组、规格约束、商品导入导出、菜单配置、角色管理、权限目录、用户管理、账号设置、反馈管理、指南内容维护；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "读取具体保存状态；导出可恢复原文；按原受控路径重试"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-conflict",
    "title": "外部修订或预览依据变化需重新核对",
    "kind": "rule",
    "summary": "防止多窗口与异步操作丢更新",
    "aliases": [
      "外部修订或预览依据变化需重新核对",
      "conflict"
    ],
    "pageIds": [
      "page-sku-create",
      "page-benefit-edit",
      "page-import",
      "page-roles"
    ],
    "actionIds": [
      "action-material-relation",
      "action-compatibility-sync",
      "action-benefit-deliver",
      "action-json-import",
      "action-table-import",
      "action-backup-export",
      "action-role-save",
      "action-role-delete",
      "action-rbac-recover",
      "action-business-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-sku-create",
      "manual-benefit-edit",
      "manual-import"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "锁内依据/修订与当前数据一致，重复请求意图稳定",
              "旧窗口覆盖新数据，更新 basis 复活已完成旧请求"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "读取最新后重新预览并发起明确新操作",
              "只重复提交旧候选而不查看当前更改"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新增 SKU、权益包详情、商品导入导出、角色管理；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "读取最新、核对差异，再预览或保存"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-permission",
    "title": "默认模式与严格授权分开",
    "kind": "rule",
    "summary": "前端 Mock 授权不等于真实后端鉴权",
    "aliases": [
      "默认模式与严格授权分开",
      "permission"
    ],
    "pageIds": [
      "page-spu-create",
      "page-import",
      "page-menus",
      "page-roles",
      "page-permissions",
      "page-users",
      "page-account",
      "page-feedback",
      "page-forbidden",
      "page-guide"
    ],
    "actionIds": [
      "action-model-publish",
      "action-spu-save",
      "action-sku-save",
      "action-compatibility-bind",
      "action-compatibility-cancel",
      "action-json-import",
      "action-table-import",
      "action-backup-export",
      "action-menu-save",
      "action-menu-restore",
      "action-role-save",
      "action-rbac-authorize",
      "action-role-delete",
      "action-rbac-recover",
      "action-permission-save",
      "action-permission-reference",
      "action-user-save",
      "action-user-bind",
      "action-user-preview",
      "action-account-save",
      "action-account-password",
      "action-feedback-save",
      "action-feedback-export",
      "action-feedback-import",
      "action-access-explain",
      "action-guide-search"
    ],
    "ruleIds": [],
    "related": [
      "manual-spu-create",
      "manual-import",
      "manual-menus"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "默认统一管理员访问已登记能力；显式严格模式按启用角色并集检查",
              "把隐藏菜单当撤权、把阅读指南当编辑权限，或访问未知路由"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "只读指南用户查说明，需操作时另检查能力",
              "文案修改或权限预览给操作者暗增写权限"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于新建 SPU、商品导入导出、菜单配置、角色管理、权限目录、用户管理、账号设置、反馈管理、无访问权限、业务指南首页、指南内容维护；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "核对当前模式、所需能力和实际角色，找有权管理员处理"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-identity-separation",
    "title": "业务对象与来源各有身份",
    "kind": "rule",
    "summary": "避免无分支的伪线性流程和历史误改",
    "aliases": [
      "业务对象与来源各有身份",
      "identity-separation"
    ],
    "pageIds": [
      "page-tree",
      "page-spus",
      "page-compatibility",
      "page-groups",
      "page-overview",
      "page-check"
    ],
    "actionIds": [
      "action-tree-query",
      "action-spu-query",
      "action-spu-view",
      "action-spu-delete",
      "action-group-create",
      "action-group-link",
      "action-overview-query",
      "action-check-locate"
    ],
    "ruleIds": [],
    "related": [
      "manual-tree",
      "manual-spus",
      "manual-compatibility"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "分类/类型/模型/SPU/SKU/PLN/MAT按实际 ID 和合法关联维护",
              "同名自动合并、将 PLN 当 SKU、把 MAT 当销售记录"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "同 PLN 多 MAT，SPU 另追加真实销售 SKU",
              "因为型号名称相同就全局补关联"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品结构视图、SPU 管理、适用关系、运营分组、商品总览、商品质量检查；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "从正确对象入口查具体来源，显式建立允许关系"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ],
    "status": "historical"
  },
  {
    "id": "rule-catalog-names",
    "title": "目录名称维护不重写历史商品",
    "kind": "rule",
    "summary": "目录候选和已保存业务事实分离",
    "aliases": [
      "目录名称维护不重写历史商品",
      "catalog-names"
    ],
    "pageIds": [
      "page-brands"
    ],
    "actionIds": [
      "action-brand-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-brands"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "合法目录名称/说明独立保存，历史商品保留原文字",
              "改品牌目录时自动替换所有旧商品文字"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "目录新品牌名用于后续选择",
              "把品牌改名当成批量商品数据迁移"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于品牌中心；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看实际商品公共属性，按需要逐条维护"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-constraint-definition",
    "title": "现行允许值规则与旧参考分开",
    "kind": "rule",
    "summary": "不由说明猜测未确认覆盖/继承规则",
    "aliases": [
      "现行允许值规则与旧参考分开",
      "constraint-definition"
    ],
    "pageIds": [
      "page-rules"
    ],
    "actionIds": [
      "action-constraint-save",
      "action-constraint-test"
    ],
    "ruleIds": [],
    "related": [
      "manual-rules"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "实际方案/条件/目标/取值齐全的现行规则参与求值",
              "把不能无损转换的旧规则当已执行限制"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "规则测试显示真实覆盖和空候选",
              "只看旧 note 就宣称所有新组合受限"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于规格约束；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "在规则测试核对，待业务确认不自行补规则"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-menu-structure",
    "title": "菜单结构不改变执行授权",
    "kind": "rule",
    "summary": "展示与路由/动作授权分层",
    "aliases": [
      "菜单结构不改变执行授权",
      "menu-structure"
    ],
    "pageIds": [
      "page-menus"
    ],
    "actionIds": [
      "action-menu-save",
      "action-menu-restore"
    ],
    "ruleIds": [],
    "related": [
      "manual-menus"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "正式路由可合法放入中心/分组，排序/改名/隐藏保留",
              "非法路由、循环父子、删非空容器或把菜单名当权限身份"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "SKU 改显示名仍用原路由和语义图标",
              "隐藏编辑入口后误以为已撤销编辑权限"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于菜单配置；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "修正容器和正式路由，授权到角色/权限管理处理"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-role-protection",
    "title": "角色依赖与恢复能力受保护",
    "kind": "rule",
    "summary": "保留可恢复管理员并避免权限暗中扩张",
    "aliases": [
      "角色依赖与恢复能力受保护",
      "role-protection"
    ],
    "pageIds": [
      "page-roles",
      "page-permissions",
      "page-users"
    ],
    "actionIds": [
      "action-role-save",
      "action-rbac-authorize",
      "action-role-delete",
      "action-rbac-recover",
      "action-permission-save",
      "action-permission-reference",
      "action-user-save",
      "action-user-bind",
      "action-user-preview"
    ],
    "ruleIds": [],
    "related": [
      "manual-roles",
      "manual-permissions",
      "manual-users"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "角色编码唯一、依赖显式勾选、无引用普通角色可删",
              "隐式补权、删除有用户角色、撤销受保护恢复路径"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "新增只读角色明确选页面能力",
              "勾权限组时自动包含未来所有能力"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于角色管理、权限目录、用户管理；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看引用、补明确依赖、按恢复入口处理"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-feedback-local",
    "title": "反馈只在本机保存和导出",
    "kind": "rule",
    "summary": "反馈不是远程同步或业务备份",
    "aliases": [
      "反馈只在本机保存和导出",
      "feedback-local"
    ],
    "pageIds": [
      "page-feedback"
    ],
    "actionIds": [
      "action-feedback-save",
      "action-feedback-export",
      "action-feedback-import"
    ],
    "ruleIds": [],
    "related": [
      "manual-feedback"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "反馈正文及必要来源/附件按原流程本机保存，人工导出交付",
              "宣称自动上传服务器、打包整个业务库或编辑已受限制导出记录"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "反馈包只含选定反馈和附件",
              "为解释规则导出所有角色和商品草稿"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于反馈管理；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "保留原记录，重试附件/导出并最小化公开上下文"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-guide-isolation",
    "title": "指南与业务存储及草稿隔离",
    "kind": "rule",
    "summary": "查看说明不会保存业务数据、清空草稿或替代业务确认。",
    "aliases": [
      "指南与业务存储及草稿隔离",
      "guide-isolation"
    ],
    "pageIds": [
      "page-guide",
      "page-guide-article"
    ],
    "actionIds": [
      "action-guide-search",
      "action-guide-read"
    ],
    "ruleIds": [],
    "related": [
      "manual-guide",
      "manual-guide-article"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "使用边界",
        "table": {
          "headers": [
            "可以",
            "不能"
          ],
          "rows": [
            [
              "在帮助抽屉内查看功能、规则和关联说明",
              "因打开说明而修改业务数据、切换身份或重置输入"
            ],
            [
              "主动打开有权限的业务页面，并遵循未保存离开确认",
              "把阅读说明当成已经执行保存、发布或交付"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "示例",
        "paragraphs": [
          "在未保存 SKU 页面打开规则说明再关闭，原有输入仍应保留。"
        ]
      },
      {
        "id": "next",
        "title": "继续操作",
        "paragraphs": [
          "关闭帮助抽屉返回原编辑位置；实际业务操作按原页面按钮和确认执行。"
        ]
      }
    ]
  },
  {
    "id": "rule-type-category",
    "title": "产品类型只关联有效末级分类",
    "kind": "rule",
    "summary": "分类范围查询不等于允许在所有目录层级绑定类型",
    "aliases": [
      "产品类型只关联有效末级分类",
      "type-category"
    ],
    "pageIds": [
      "page-product-types"
    ],
    "actionIds": [
      "action-type-save",
      "action-type-models",
      "action-type-delete"
    ],
    "ruleIds": [],
    "related": [
      "manual-product-types"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "分类存在、启用且无子分类，同类名称不重复",
              "目标失效/停用/非末级或同分类同名类型"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "在有效叶分类显式创建类型",
              "在还有子分类的目录下创建类型"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于产品类型；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "改选合法末级分类并核对同名记录"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-type-reference",
    "title": "类型迁移与删除须保留引用",
    "kind": "rule",
    "summary": "避免上游分类类型变化破坏既有来源",
    "aliases": [
      "类型迁移与删除须保留引用",
      "type-reference"
    ],
    "pageIds": [
      "page-product-types"
    ],
    "actionIds": [
      "action-type-save",
      "action-type-models",
      "action-type-delete"
    ],
    "ruleIds": [],
    "related": [
      "manual-product-types"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "类型未受实际模型、商品、框架或历史引用保护",
              "在有受保护引用时迁移或删除类型"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "删除无引用测试类型",
              "删除仍被框架历史修订使用的类型"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于产品类型；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看类型关联模型/商品与包框架，按合法流程处理"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-template-bindings",
    "title": "方案绑定必须是真实词典属性",
    "kind": "rule",
    "summary": "公共/规格角色和顺序属于方案依据",
    "aliases": [
      "方案绑定必须是真实词典属性",
      "template-bindings"
    ],
    "pageIds": [
      "page-templates",
      "page-mappings"
    ],
    "actionIds": [
      "action-template-create",
      "action-template-save",
      "action-template-copy",
      "action-template-delete",
      "action-mapping-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-templates",
      "manual-mappings"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "方案身份有效、绑定属性真实、角色与顺序明确",
              "使用失效属性、重复绑定或把空占位当正式绑定"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "方案内一条属性设为公共，其余真实属性设规格",
              "只输入一个未落词典的新属性名就当已绑定"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于属性方案、属性方案绑定（历史入口）；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "先维护词典，再选择引用并保存方案"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ],
    "status": "historical"
  },
  {
    "id": "rule-dictionary-reference",
    "title": "引用中的词典不能任意删除改名",
    "kind": "rule",
    "summary": "全量冻结候选不等于实际允许值引用，保护须精确",
    "aliases": [
      "引用中的词典不能任意删除改名",
      "dictionary-reference"
    ],
    "pageIds": [
      "page-params",
      "page-templates"
    ],
    "actionIds": [
      "action-dictionary-save",
      "action-dictionary-value-remove",
      "action-template-create",
      "action-template-save",
      "action-template-copy",
      "action-template-delete"
    ],
    "ruleIds": [],
    "related": [
      "manual-params",
      "manual-templates"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "未被使用的实际属性值可按原流程维护",
              "草稿节点、历史快照、允许值配置、商品或规则实际引用"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "删除 A 属性下未引用值，B 同名值不误拦",
              "删除尚无 VALUE 节点但被允许值配置引用的值"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于属性词典、属性方案；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "阅读引用来源并定位模型节点，保留历史快照"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-category-input",
    "title": "分类名称与记录必须有效",
    "kind": "rule",
    "summary": "改名维护记录本身，不由文字暗合并分类",
    "aliases": [
      "分类名称与记录必须有效",
      "category-input"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [
      "action-category-rename"
    ],
    "ruleIds": [],
    "related": [
      "manual-categories"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "分类记录存在且名称去空后非空",
              "来源已失效或名称为空"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "同一分类ID改为非空展示名称",
              "清空名称后请求保存"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品分类中心；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "定位名称并填写，再按原保存路径确认"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  },
  {
    "id": "rule-category-reference",
    "title": "分类删除保留真实下游",
    "kind": "rule",
    "summary": "分类删除不级联删除商品或类型",
    "aliases": [
      "分类删除保留真实下游",
      "category-reference"
    ],
    "pageIds": [
      "page-categories"
    ],
    "actionIds": [
      "action-category-delete"
    ],
    "ruleIds": [],
    "related": [
      "manual-categories"
    ],
    "sections": [
      {
        "id": "conditions",
        "title": "真实允许与禁止条件",
        "table": {
          "headers": [
            "允许条件",
            "禁止条件"
          ],
          "rows": [
            [
              "无子分类、挂载商品与关联类型，按确认删除",
              "仍有子分类/商品/产品类型，或已发布商品需先按原流程处理"
            ]
          ]
        }
      },
      {
        "id": "examples",
        "title": "正确与失败示例",
        "table": {
          "headers": [
            "正确示例",
            "失败示例"
          ],
          "rows": [
            [
              "删除一个没有这些下游的空分类",
              "删除仍挂销售商品的分类"
            ]
          ]
        }
      },
      {
        "id": "impact",
        "title": "影响范围",
        "paragraphs": [
          "适用于商品分类中心；不追溯重写已有快照或凭说明新增限制。"
        ]
      },
      {
        "id": "next",
        "title": "当前下一步",
        "paragraphs": [
          "查看子分类、商品与类型；方案绑定随合法删除清理，不宣称所有mapping都阻止删除"
        ]
      },
      {
        "id": "mode",
        "title": "适用权限模式",
        "paragraphs": [
          "默认统一管理员与显式严格 RBAC 模式均保留业务约束。严格模式还需页面和动作权限；阅读规则不会授予权限。"
        ]
      }
    ]
  }
]
