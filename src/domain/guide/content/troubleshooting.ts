import type { GuideArticle } from '../types'

export const guideTroubleshootingArticles: GuideArticle[] = [
  {
    "id": "troubleshooting-save",
    "title": "保存后仍有未保存提示",
    "kind": "troubleshooting",
    "summary": "先区分字段校验、内存结果和真正写盘失败。",
    "aliases": [
      "保存后仍有未保存提示",
      "persistence"
    ],
    "pageIds": [],
    "actionIds": [
      "action-business-save"
    ],
    "ruleIds": [
      "rule-persistence"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "保存后仍有未保存提示",
          "类别：persistence。先区分字段校验、内存结果和真正写盘失败。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "看原页面保存状态与错误，不将弹窗关闭当成功。",
          "空间或写入问题处理后，用原受控重试入口；先导出可恢复内容。",
          "若提示其他窗口/依据变化，转冲突核对而非无限重试。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  },
  {
    "id": "troubleshooting-conflict",
    "title": "预览或修订已变化",
    "kind": "troubleshooting",
    "summary": "本次依据已不是当前数据，不能把存储重试当恢复旧候选。",
    "aliases": [
      "预览或修订已变化",
      "conflict"
    ],
    "pageIds": [],
    "actionIds": [
      "action-business-save"
    ],
    "ruleIds": [
      "rule-conflict"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "预览或修订已变化",
          "类别：conflict。本次依据已不是当前数据，不能把存储重试当恢复旧候选。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "读取最新对象与当前修订。",
          "核对自己的未保存输入和差异，保留草稿。",
          "重新预览或明确新请求，再按原流程确认。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  },
  {
    "id": "troubleshooting-category-target",
    "title": "分类移不进去",
    "kind": "troubleshooting",
    "summary": "根据真实命中原因区分目标绑定类型、循环与失效，不能只凭现象断定。",
    "aliases": [
      "分类移不进去",
      "business"
    ],
    "pageIds": [],
    "actionIds": [
      "action-category-move"
    ],
    "ruleIds": [
      "rule-category-typed-target"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "分类移不进去",
          "类别：business。根据真实命中原因区分目标绑定类型、循环与失效，不能只凭现象断定。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "确认右侧来源与左侧目标。",
          "若目标已绑定类型，换可接收子分类的目标；来源有类型不自动等于不能移动。",
          "若移入自身/后代则另选独立目录；若目标失效则重新定位。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  },
  {
    "id": "troubleshooting-sku-missing",
    "title": "新增 SKU 没有可新增项",
    "kind": "troubleshooting",
    "summary": "已有、无效与空生成范围是不同情况。",
    "aliases": [
      "新增 SKU 没有可新增项",
      "input"
    ],
    "pageIds": [],
    "actionIds": [
      "action-sku-preview"
    ],
    "ruleIds": [
      "rule-sku-identity"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "新增 SKU 没有可新增项",
          "类别：input。已有、无效与空生成范围是不同情况。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "看候选结果列，不重复创建已有身份。",
          "核对主体方案、公共属性和发布/规划来源。",
          "修改范围后重新预览；不从名称摘要推导身份。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  },
  {
    "id": "troubleshooting-benefit-issue",
    "title": "权益包不能保存可用或交付",
    "kind": "troubleshooting",
    "summary": "先按问题定位具体成员、数量、设备或报价；不能统一建议删除商品。",
    "aliases": [
      "权益包不能保存可用或交付",
      "business"
    ],
    "pageIds": [],
    "actionIds": [
      "action-benefit-save"
    ],
    "ruleIds": [
      "rule-benefit-validation"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "权益包不能保存可用或交付",
          "类别：business。先按问题定位具体成员、数量、设备或报价；不能统一建议删除商品。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "点击问题进入包内清单并定位输入。",
          "修正失效引用、框架范围和条件确认。",
          "保存最新配置并复核报价，再重新预览交付。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  },
  {
    "id": "troubleshooting-access",
    "title": "看得到菜单却不能操作",
    "kind": "troubleshooting",
    "summary": "菜单显示、页面访问和动作权限分别判断。",
    "aliases": [
      "看得到菜单却不能操作",
      "permission"
    ],
    "pageIds": [],
    "actionIds": [
      "action-rbac-authorize"
    ],
    "ruleIds": [
      "rule-permission"
    ],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "看得到菜单却不能操作",
          "类别：permission。菜单显示、页面访问和动作权限分别判断。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "核对当前是否为显式严格模式。",
          "记录所需能力而不泄露无权对象内容。",
          "请有授权能力的管理员核对用户、启用角色和权限依赖。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  },
  {
    "id": "troubleshooting-unknown",
    "title": "未知错误如何处理",
    "kind": "troubleshooting",
    "summary": "现象或旧字符串不足以精确判断命中规则。",
    "aliases": [
      "未知错误如何处理",
      "unknown"
    ],
    "pageIds": [],
    "actionIds": [
      "action-feedback-save"
    ],
    "ruleIds": [],
    "related": [
      "manual-feedback"
    ],
    "revision": 1,
    "status": "verified",
    "implementation": "商品中心 V3 当前工作区（2026-10-25）；内容修订 1",
    "evidence": [
      "src/domain/guide/failure.ts",
      "docs/business-guide/content-source-audit.md#troubleshooting"
    ],
    "sections": [
      {
        "id": "symptom",
        "title": "现象与失败类别",
        "paragraphs": [
          "未知错误如何处理",
          "类别：unknown。现象或旧字符串不足以精确判断命中规则。"
        ]
      },
      {
        "id": "steps",
        "title": "检查顺序与恢复",
        "steps": [
          "保留公开的原始信息、当前动作和页面。",
          "先读本页指南，核对保存状态；不要盲目重复提交。",
          "仍无法判断时反馈最小上下文，不上传整个 AppData。"
        ]
      },
      {
        "id": "feedback",
        "title": "何时反馈",
        "paragraphs": [
          "按以上顺序仍不能确定时，带当前动作、必要对象/字段和原错误反馈；未知情况不冒配确定规则。"
        ]
      }
    ]
  }
]
