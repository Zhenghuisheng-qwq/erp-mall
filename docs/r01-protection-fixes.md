# R01 补修报告：节点业务配置保护遗漏

验收日期：2026-10-25。本轮仅补修 R01；未提交、推送或部署。

开始与结束核对：分支 `20261022`，HEAD 均为 `74fcf7a4ac52502ee9b4fa4ec793435ab4a7f769`。开始时工作区干净，祖先目录及工程范围未发现适用的 AGENTS.md。未变更冻结 V2 选择器、SKU 算法或编号生成代码；历史快照仍沿用原保存语义。

## 修改文件

| 文件 | 修改用途 |
| --- | --- |
| `src/domain/dictionaryGuard.ts` | 收集草稿与历史 allowed-values 实际引用，接入删除与取值改名保护，提示版本、模型、节点和配置 ID。 |
| `src/domain/nodeBusinessStructure.ts`（新增） | 定义、实例及冻结字段的共享结构校验；安全读取视图；导入受保护字段签名。 |
| `src/domain/nodeBusiness.ts` | 导入结构问题汇总；定义及实例安全读取；损坏配置产生问题并使解析返回 invalid。 |
| `src/stores/catalog.ts` | normalizeStored 在迁移前校验；真实 importJson 在写入前校验结构和当前角色的 R01 权限。removeParamValue 原有调用链直接复用增强的 dictionaryRemovalBlock。 |
| `src/components/model-editor/NodeBusinessDialog.vue` | 容器与空记录安全展示；结构损坏显示错误及原文，停止编辑，避免过滤后保存导致原文丢失。 |
| `src/layouts/AdminLayout.vue` | 运营选择导入时提示只读约束；继续统一调用真实 Store 入口并展示拒绝原因。 |
| `scripts/r01-protection-fixture.ts`（新增） | Apple 允许颜色1、颜色2，但只建颜色1节点，同时提供冻结 V1 的独立夹具。 |
| `scripts/r01-protection-probe.ts`（新增） | 同一探针记录修复前后结果。 |
| `scripts/r01-protection-check.ts`（新增） | 20 项有实际断言的领域、真实 Store、内存及存储回归。 |
| `scripts/browser-r01-protection.mjs`（新增） | 隔离 Chrome 的真实词典操作、角色选择、文件导入导出和损坏存储恢复验收。 |
| 本报告及 `work/r01-protection-20261025/` | 证据、日志、截图与 HEAD 基线归档。缓存使用忽略目录。 |

## 三个问题的证据

1. **允许值引用保护**：修复前颜色2删除检查返回空、改名返回允许。修复后，草稿引用与仅历史引用分别拒绝；提示包含 `r01-model / Apple (r01-model-apple)`、配置 ID，历史引用另含 V1/version ID。匹配使用 `parameters.attributeId + parameters.values`，包括尚未创建 VALUE 节点的值，也不因配置停用而丢失引用。另一个属性的同文字颜色2仍可维护；颜色10虽然存在于冻结全量词典，但不在允许值集合内，仍可删除、改名。真实 Store 删除拒绝后内存及持久化均未变化。Chrome 实际操作同样拒绝颜色2、允许颜色10，历史冻结候选仍保留颜色10。
2. **导入只读保护**：修复前运营分别修改目录、草稿配置、历史配置均成功导入。修复后真实 store.importJson 比较新字段及其模型/节点/版本身份、冻结内容；权限取导入前 Store 的角色。四组回归还将导入文件角色伪装为 admin，目录、草稿、历史及冻结词典修改仍全部拒绝。每组均断言导出内存原文与原始持久化字符串不变。管理员合法备份完整恢复，保留配置、定义快照和词典快照；成功写入正常产生新的存储提交元数据。
3. **结构校验**：修复前对象形 businessConfigs 可被 normalizeStored 接受、businessIssues 返回空，解析抛出 object is not iterable。现在定义容器、实例容器、记录对象、必要身份/启用/范围/参数字段，以及可选冻结记录均校验。10 组损坏用例涵盖非数组、null 容器/记录、缺少 kind/parameters/values、历史 null 记录及坏冻结定义：导入全部拒绝，内存/存储不变；启动拒绝读取并交给原恢复机制，原始存储保留；领域解析安全返回 invalid 和具体问题。未知定义和未知 kind 的合法记录原文完整保留，显示不支持，并拒绝受影响发布。

修复前后同探针对照：[before/probe.json](../work/r01-protection-20261025/before/probe.json)、[after/probe.json](../work/r01-protection-20261025/after/probe.json)。

## 实际验证结果

| 检查 | 结果 |
| --- | --- |
| `r01-protection-check.ts` | 20 项全部通过；[断言清单](../work/r01-protection-20261025/domain/checks.json)。 |
| `r01-plan-check.ts` | 4 组 COMMON/兼容配置组合通过，保留规划、SKU 隔离与失败重试语义。 |
| `r01-business-check.ts` | 全部通过，覆盖继承、限制、冲突、发布冻结、编号保留、JSON 恢复与外部更新保护。 |
| `editor-safety-check.ts` | 7 项通过，含共享词典、改名/值创建撤销及历史快照保留。 |
| `functional-gaps-round3-check.ts` | 全部通过。 |
| `compatibility-storage-check.ts` | 全部通过，含导入/恢复失败原子性与存储锁保护。 |
| `template-compatibility-state-check.ts` | 14 项通过。 |
| `accessory-compatibility-state-check.ts` | 全部通过，含既有导入权限与校验回归。 |
| `npm run typecheck` | 通过。 |
| `npm run build` | 类型检查及生产构建通过；Vite 提示部分 chunk 超过 500 kB。 |
| `git diff --check` | 通过。 |
| 独立 Chrome `156.0.8078.47` | 7 项实际页面验收通过，pageerror 为空；[浏览器证据](../work/r01-protection-20261025/browser/evidence.json)。 |

浏览器通过真实“演示数据”菜单上传 JSON、下载内存导出并比较，而非调用浏览器内部 Store 完成操作。使用全新隔离 context，本机临时 Vite 地址。最初沙箱内访问 localhost 被拒绝，受控执行后通过；一次测试在管理员专用路由切换运营引发导航竞争，调整到双方可访问的商品页后完成，保留失败记录供追溯。最终结果以 evidence.json 为准。

截图：

- [词典引用拒绝](../work/r01-protection-20261025/browser/dictionary-reference-block.png)
- [运营目录导入拒绝](../work/r01-protection-20261025/browser/operator-directory-rejected.png)
- [运营草稿导入拒绝](../work/r01-protection-20261025/browser/operator-draft-rejected.png)
- [运营历史导入拒绝](../work/r01-protection-20261025/browser/operator-snapshot-rejected.png)
- [损坏存储恢复页](../work/r01-protection-20261025/browser/damaged-storage-recovery.png)

## 复跑方法与限制

PowerShell：

```powershell
$env:R01_PROTECTION_OUTPUT='work/r01-protection-20261025/recheck'
$env:DOMAIN_CHECK_CACHE_DIR='work/r01-protection-20261025/recheck-cache'
node scripts/run-domain-check.mjs scripts/r01-protection-check.ts
node scripts/browser-r01-protection.mjs
```

当前全局词典页面没有“取值改名”按钮，改名保护经实际导出的 valueRenameDecision 领域入口验证；Chrome 验证了现有词典删除入口，不宣称完成不存在的改名 UI 验收。结构损坏配置面板的安全读取有类型检查和领域断言，未单独通过浏览器注入坏 props；持久化损坏在挂载业务页面前已进入恢复页。未开展后端或线上环境验收。
