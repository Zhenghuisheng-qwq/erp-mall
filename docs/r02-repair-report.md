# R02 补修报告

RESULT：READY（仅针对本次 R02 补修）

日期：2026-10-25。分支 `20261022`，开始时 HEAD 为审查基线 `f171eb2a2d2bef767226d9f1dadf04a0e5d94b22`，工作区干净。检查工程及祖先目录、相关源码／脚本／文档目录，未发现适用 AGENTS.md。没有提交、推送或部署；权益包未进入实施。

## 四项修复

### 1. 人工决定按稳定来源保护

`MaterialContribution.lineage` 保存模型 ID 与实际 ruleId/claimId 配对；每个 owner 同时保存 `EffectiveTemplateClaim.origins`。预览优先按 MAT、模型、真实配对匹配人工保护，完整内容签名只负责内容比较，不再把备注、依据或核验状态变化视为新来源。

人工取消／修改后，同谱系在 V2 改 note、source、verification 都会被拒绝；范围版本确认不代表恢复声明。无关新谱系、其他主机仍可操作。旧 deleted／modified 贡献不被清空或改回 managed。解绑保留稳定谱系，不随活动 owner 移除而丢失人工保护。

兼容旧数据：缺少配对字段时，从已有关系所指的冻结版本和真实范围解析原有效声明，不计算两个 ID 数组的笛卡尔积，不在导入时批量改写历史。无法恢复谱系时保留旧内容匹配保护。本轮没有新增“恢复人工取消声明”操作。

### 2. 条件规范化与内容比较分开

从既有模板领域语义提取 `templateConditionsSignature`，完整声明签名与冲突判断共用条件规范化：条件排列不影响等价，属性条件数组值去重并排序。冲突判断只比较相关主机／能力下的结论和规范化条件，备注不同不等于条件矛盾。

完整内容等价声明合并为一条声明，保留全部真实贡献配对；仅备注不同的完整声明仍分别保留。真正的结论或条件矛盾继续拒绝，失败前后内存及持久化内容相同。

### 3. 统一规划摘要和显示开关

新增 `materialPlanningIds`，从统一 `materialSources` 读取原始完整规划及有效新增关系。商品列表摘要按不同 MAT ID 和实际 PLN ID 去重；current 节点没有完整规划覆盖时计为零。默认统计全部发布版本中仍有效的关系并按 PLN ID 合并；指定版本时只统计该版本来源，已解除关系不计入。

商品列表、V3 档案主机来源摘要、旧物料兼容入口的主机来源查询一起接通。原始建档字段不改写，档案原始来源与全部关联来源继续分别展示。

“显示关联物料”统一控制结构清单、三视图节点卡片及结构卡片避让空间。关闭后不渲染卡片、不执行卡片避让；切换只改变展示，不修改物料关系和规格节点。

### 4. 成功重复请求也持久保存回执

关系新增可选 `requestIntent` 与 `requestAliases`。原请求 A 保留；相同关系已存在时，成功请求 B 的 ID 和规范化执行意图追加为别名，和关系一起经过 Store 候选事务提交。回执绑定来源、目标以及范围建档名称，修改来源或目标不能复用原请求 ID。

关系撤销后，A、B 均拒绝执行，与是否更新 basis 无关；新请求 C 可明确重新关联，仍复用原 MAT。原样重试 B 原先会因旧 basis 拒绝；本次修复的是 B 成功未留痕后更新 basis 可重新执行的漏洞。

新字段属于现有关系／贡献集合，自动进入原事务字段、导出恢复和运营导入签名保护；新增容器、记录及意图结构校验。配额失败时别名不落入内存或磁盘。旧记录可缺省这些字段，不补造未知的历史请求别名。

## 修改文件

- 领域：`src/domain/materialRelationCommands.ts`、`materialRelations.ts`、`templateCompatibility.ts`、`material.ts`。
- 页面和组件：`src/views/ProductListView.vue`、`SpecConfigView.vue`、`src/components/V3FamilyBoard.vue`、`compatibility/LegacyMaterialCompatibility.vue`。
- 新回归：`scripts/r02-repair-check.ts`、`browser-r02-repair.mjs`、`browser-r02-repair-compatibility.mjs`。
- 原 `scripts/browser-r02.mjs` 同步显式打开物料显示开关，保留原验收断言。

## 实际验收证据

本轮独立输出目录：[work/r02-repair-20261025](../work/r02-repair-20261025/)，旧 R02 证据未覆盖。

| 检查 | 结果 |
| --- | --- |
| 新增真实 Store 回归 | 13 组通过，[store-checks.json](../work/r02-repair-20261025/store-checks.json) |
| R02 关系领域检查 | 14 组通过，[relations.json](../work/r02-repair-20261025/domain/relations.json) |
| R02 兼容领域检查 | 9 组通过，[compatibility.json](../work/r02-repair-20261025/domain/compatibility.json) |
| 独立 Chrome 主流程 | 8 组通过，[evidence.json](../work/r02-repair-20261025/browser/evidence.json) |
| 独立 Chrome 兼容补修 | 2 组通过，[evidence.json](../work/r02-repair-20261025/browser-compatibility/evidence.json) |
| 类型检查、生产构建 | 通过；最终 `npm run build` 包含类型检查，[build-final.log](../work/r02-repair-20261025/build-final.log) |
| 冻结代码 | V2 选择器、SKU 算法、规划算法、catalogPersistence 与 HEAD blob 相同，[protected-code.json](../work/r02-repair-20261025/protected-code.json) |

新增 Store 断言覆盖：取消／修改各三种字段变化的正常保存发布；旧数据冻结来源解析；无关主机；真实配对与笛卡尔积反例；条件倒序和 in 值倒序／重复；备注差异；真实结论／条件冲突原子性；摘要 3→4→3、current 为零、同 PLN 多 MAT、跨版本去重；A/B/C 请求链、修改请求意图拒绝、配额失败、导出恢复、损坏结构及运营导入拒绝。

受影响的九项既有检查均通过，日志在 [regression](../work/r02-repair-20261025/regression/)：

- `r01-plan-check`、`r01-business-check`、`r01-protection-check`。
- `material-check`、`material-archive-check`、`combo-material-status-check`。
- `template-compatibility-domain-check`、`template-compatibility-state-check`、`compatibility-benefit-storage-check`。

Chrome 156.0.8078.47 使用全新隔离 Context，桌面 1600×1000 和窄窗口 980×720。通过真实页面验证等价条件关联、取消声明、修改模板备注、保存并发布 V2、再关联预览保护；商品列表实际显示 3→4→3；三视图显示开关；原范围创建、刷新反查、解绑、双页冲突、失败重试和布局检查继续通过。两个成功报告均无 pageerror。关键截图：[V2 人工保护](../work/r02-repair-20261025/browser-compatibility/cancelled-v2-protected.png)、[4 条规划摘要](../work/r02-repair-20261025/browser/digest-4.png)。

首次沙箱浏览器访问 localhost 被拒绝，取得工具执行权限后隔离 Chrome 验收通过，不记为业务失败或跳过。生产构建仍有大于 500 kB 分包提示，浏览器日志有既有 Vue Flow 参数弃用提示；没有宣称零警告。

复现新增 Store 检查：`node scripts/run-domain-check.mjs scripts/r02-repair-check.ts`；两项浏览器脚本分别为 `node scripts/browser-r02-repair.mjs`、`node scripts/browser-r02-repair-compatibility.mjs`。

## 剩余限制与停止点

本轮没有恢复人工取消声明的授权操作；同来源人工保护命中时明确拒绝。旧版本从未记录过的成功别名无法追溯补造；新成功请求均保存回执。自动分组、跨类型归并、权益包、后端跨设备事务均不在本轮。

保留原 MAT 编号、原始建档来源、冻结历史快照及 V2／SKU 语义。本次 READY 只针对四项 R02 补修，不代表整个 ERP 完成。完成后停止，等待审查。
