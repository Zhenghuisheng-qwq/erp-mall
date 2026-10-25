# R02：实际共用物料、多路径关联与提前建档

RESULT：READY（仅针对 R02）

验收日期：2026-10-25。分支 `20261022`；开始及完成时 HEAD 均为 `f11c4b5c0c0f22ce68ce28e56c133fe9d7efdeb5`。开始时工作区干净，未发现适用的 AGENTS.md。本轮未提交、推送或部署，未进入后续权益包轮次。

## 实际实现与数据关系

- 真实 MAT 仍保存在原物料档案集合中，编号沿用原生成及冲突校验。新增 `materialRelations` 保存显式路径／节点范围关系，`materialContributions` 保存兼容声明贡献及人工保护状态。这些是可选扩展，不改变旧数据版本。
- 多个完整 PLN 可以明确选择同一 MAT；同一 PLN 仍可创建多个 MAT。读取层按 MAT ID 去重，关联次数与档案条数分别表达。关联不改目标物料原编号、名称、所属档案及原始建档来源。
- 节点范围建档选择明确的已发布版本，只保存真实前缀及锚点，不补造末级属性、PLN 或 TMP。`current` 只关联当前节点；`subtree` 保存该版本明确覆盖的完整规划。为兼容核验枚举完整路径，不代表把 current 自动扩散至这些路径。
- 范围建档创建原始关系，不能通过解绑删除原始来源。新增显式关联可单独解除，不删除 MAT，也不移除其他关联。
- 共用策略要求显式选择目标，没有默认第一条、按名称自动合并或自动分组。跨产品类型／分类目标拒绝；策略冲突、不同下级策略不能静默选取。
- 新发布版本不会自动扩展旧范围。复用旧目标时展示新增／移除规划并要求确认，建立新版本关系；V1 快照及覆盖保持不变。模型复制只复制并重映射配置，不复制源模型生效关联。草稿与所选快照不一致会提示。

## 兼容处理与事务保护

范围操作按冻结版本的各条完整组合解析兼容声明，按内容去重但保留每个关系、规划、规则和声明贡献。不同主机声明可以合并，同主机矛盾结论／条件拒绝，失败不产生部分档案或关系。未配置或空快照在预览中说明，不清空已有声明，也不编造兼容结论。

解绑仅撤销该关系的贡献。其他来源仍使用的声明保留；最后来源消失时，只自动撤下本轮生成且未经人工修改的声明。自动撤下（retired）与人工删除（deleted）分开，前者允许新请求重新关联，后者以及人工修改继续受保护。旧的单组合同步入口不会覆盖多路径 MAT 的贡献。

Store 复用现有 command、候选事务、持久化队列／锁和 revision 检查，一次提交档案、关系、回执与兼容来源。配额失败和陈旧预览不改内存／持久化；重复请求不重复建档；已撤销请求不能复活关系。JSON 导入在真实 Store 入口依据导入前角色检查，运营不能借导入角色字段提升权限。损坏关系及贡献结构、伪造前缀／覆盖／冻结策略提交前拒绝；合法未知关系保留原文并阻止受影响操作。MAT、模型／版本引用和模块重置均校验保护。

## 页面与修改文件

结构、大纲、幕布在实际关联节点附近显示真实 MAT 编号、保存名称、直接建档／显式关联／继承、范围及数量；展开后沿原入口打开物料档案。结构卡片参与视图布局避让，不写入规格节点，不参与 SKU 或规划身份。大纲／幕布窄窗口卡片置于节点下方。档案反查显示全部来源，可定位模型、版本和节点；历史路径变动显示提示。

新增领域文件：`src/domain/materialRelations.ts`、`materialRelationCommands.ts`。

新增组件：`src/components/MaterialRelationDialog.vue`、`MaterialSourceList.vue`、`model-editor/NodeMaterialSummary.vue`。

调整领域及 Store：`src/domain/types.ts`、`material.ts`、`comboMaterialStatus.ts`、`nodeBusiness.ts`、`accessoryCompatibilityTypes.ts`、`accessoryCompatibilityCommands.ts`、`templateCompatibilitySync.ts`、`src/stores/catalog.ts`。

调整页面组件：`src/views/SpecConfigView.vue`、`src/layouts/AdminLayout.vue`、`src/components/ModelOutline.vue`、`V3FamilyBoard.vue`、`V3MaterialActions.vue`、`model-editor/LegalComboDialog.vue`、`NodeBusinessDialog.vue`、`comboPresentation.ts`。

新增检查：`scripts/r02-fixture.ts`、`r02-relations-check.ts`、`r02-compatibility-check.ts`、`browser-r02.mjs`。`scripts/browser-r01.mjs` 仅同步两处共用策略显示文案选择器，未删除断言。

## 实际验收

证据独立保存于 [work/r02-20261025](../work/r02-20261025/)，未覆盖旧轮次证据。

| 验收范围 | 实际结果与证据 |
| --- | --- |
| 关系／Store 回归 | 14 组断言通过：[relations.json](../work/r02-20261025/domain/relations.json) |
| 兼容贡献回归 | 9 组断言通过：[compatibility.json](../work/r02-20261025/domain/compatibility.json) |
| 真实 Chrome 页面闭环 | 6 组场景通过，page errors 为空：[evidence.json](../work/r02-20261025/browser-accepted/evidence.json) |
| 类型检查与生产构建 | `npm run build` 包含类型检查并通过：[build-final.log](../work/r02-20261025/build-final.log)。存在大于 500 kB 的分包警告 |
| 冻结代码 | V2 选择器、SKU 算法、planning、catalogPersistence 的 Git blob 与 HEAD 相同：[protected-code.json](../work/r02-20261025/protected-code.json) |

受影响的 13 个既有领域回归均通过：`r01-plan-check`、`r01-business-check`、`r01-protection-check`、`material-check`、`material-archive-check`、`combo-material-status-check`、`planning-check`、`naming-check`、`spu-sku-check`、`editor-safety-check`、`template-compatibility-state-check`、`compatibility-benefit-storage-check`、`accessory-compatibility-state-check`。日志位于 [regression](../work/r02-20261025/regression/)。最终导入校验调整后重跑 R01 protection，读取层相关检查也再次通过。

用户要求的 16 项断言对应如下：

1. P1/P2 共用一条 MAT、刷新反查：关系回归及 Chrome 闭环。
2. 同 PLN 新建第二条 MAT：关系回归验证统一读取返回两条。
3. 原来源／编号不变：关系回归覆盖已有完整 PLN 物料复用。
4. 型号下仍有容量／颜色时提前建档：领域 fixture 与真实 Chrome 页面。
5. 完整 PLN／销售组合不变：关系回归、planning 与 spu-sku 旧回归。
6. current／subtree／兄弟隔离：关系回归。
7. 新版本显式预览确认、V1 不变：关系回归。
8. 多 MAT 合法、目标不默认：关系回归与 Chrome 目标选择。
9. 档案统计按 MAT 去重：统一读取及关系回归。
10. 三视图近节点展示、打开档案及反查：Chrome 桌面与窄窗口。
11. 解绑不删档案、不影响其他关系：领域与 Chrome 刷新闭环。
12. 共用配件多主机、双向查询、贡献：兼容回归。
13. 冲突／保存失败无半成品：兼容冲突、配额失败的状态断言。
14. 双页／重复请求／配额失败：真实 Chrome 双页陈旧预览；Store 队列重复请求；页面失败保留输入并重试。
15. 恢复、只读、结构及删除保护：真实 Store 导出恢复／拒绝后内存持久化不变断言，未知类型保留断言。
16. 旧 MAT、快照、规划及幂等：旧回归与 R01 三项检查通过。

浏览器为独立隔离 Chrome 156.0.8078.47 Context，桌面 1600×1000、窄窗口 980×720。真实操作覆盖配置发布 → 节点范围建档 → 另一完整路径显式选择同 MAT → 档案反查 → 刷新 → 解绑 → 原档案／其他来源保留。结构节点在建档及反复展开收起后执行矩形无重叠断言，窄窗口断言卡片及操作可达。最终截图均在 `browser-accepted`；早期定位器调试记录保留，最终证据以该目录为准。未宣称跨浏览器验收。

复现领域检查：`node scripts/run-domain-check.mjs scripts/r02-relations-check.ts`、`node scripts/run-domain-check.mjs scripts/r02-compatibility-check.ts`。浏览器：`node scripts/browser-r02.mjs`。可通过脚本支持的输出环境变量另存证据。

## 未决边界与停止点

- 本轮完成显式共用和范围来源，未定义所有自动分组键、跨类型自动归并、策略覆盖优先级或批量历史迁移规则。
- 仍为前端 Mock 本地存储及浏览器锁／revision 语义，没有实现后端数据库事务或跨设备协作。
- 未配置兼容数据会明确显示当前无法提供的兼容证据，遵循原建档语义；不会声称未知兼容已得到证明。
- 权益包后续轮次未实施。此次 READY 不代表整个商城 ERP 完成。

R02 到此停止，等待审查。
