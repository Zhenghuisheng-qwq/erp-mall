# 设备与配件兼容关系工作台

RESULT：READY。已完成具体设备查看、双向查询、型号绑定、正式声明维护、MAT 声明复制、持久化失败重试及刷新恢复的闭环。这里的 READY 限于本轮约定范围，不表示全项目不存在既有问题。

## 1. 实际基线与交付状态

- 工作区：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 分支：`20261022`；开始及交付 HEAD 均为 `a57ff86bb5c52fe6d0185ce84a98e3e416e8495a`。没有使用历史提示中的旧提交替换当前源码。
- 开始时工作区干净，没有需要接管的未提交或未跟踪源码；适用祖先目录及仓库未发现 AGENTS.md。已阅读 README、SPU/SKU 与 SKU 工作台报告、现有兼容/节点适用/规划物料相关实现及检查入口。
- 开始前源码快照：`work/accessory-compatibility/baseline.zip`，由该 HEAD 的 `git archive` 生成，另展开到 `baseline/` 运行原实现检查；`baseline-head.txt` 保存提交。快照 SHA256 为 `780300ad26e0d66d2053ffcce21f58dacc15abd9c858c7fab13e3f2a2528871a`。
- 本轮结果全部保留为本地修改和新文件，未暂存、提交、推送、合并或部署。完整补丁：`work/accessory-compatibility/accessory-compatibility-full.diff`，包括新增文件；普通 `git diff` 只包含已跟踪文件的变更。
- 本轮机器可读证据：`docs/accessory-compatibility-workbench-evidence.json`；原始日志、独立测试输出和截图保存在忽略目录 `work/accessory-compatibility/`。

## 2. 核查结论与新增范围

原实现已经具有 MAT → 主机型号/指定 PLN 的多对多正式关系、管理汇总、双向检索、批量关联、取消及删除保护。`accessorySkuId` 的旧候选实际限定 MAT。已有 `/spus`、`/skus`、页面设置隔离和 SKU 工作台完整保留。

原实现没有具体销售手机 SKU 的统一型号解析与配件抽屉，也没有真实销售配件 SKU 的正式声明。旧型号管理汇总会包含各 PLN 的关联，不能直接作为具体手机推荐。销售 SKU 与 MAT 没有明确映射，本轮继续不按同 SPU、同 PLN、名称或规格自动建立对应。

本轮增量实现：统一型号解析、显式绑定和独立型号；SKU/MAT 共用正式声明容器；按实际型号与 PLN 判定的只读正反向查询；条件与能力分开表达；抽屉及统一维护入口；明确选择 MAT 后预览复制；管理员写入协调与存储异常恢复。未增加后端、外部服务、依赖、库存、价格或销量模块。

## 3. 数据结构和历史兼容

继续使用数据版本 `15` 和原 `iyge-v2-mock-db` 存储键。新增字段均为可选，不需要重新分配已有身份：

| 位置 | 内容与约束 |
| --- | --- |
| `CompatibilityLink` | `targetKind: sku/material`、`targetId`、结论、核验状态、能力、条件、依据、来源追溯；原 `id/accessorySkuId/host/note/createdAt/updatedAt` 保留 |
| `AppData.deviceModels` | 少量独立设备型号，带稳定产品类型、实际属性和时间；无 MAT、PLN 或销售设备也可维护 |
| `AppData.deviceBindings` | 销售设备 SKU → 明确主机身份；保存来源指纹，来源变化后要求处理 |
| `ParamDef.identityRole` | 可选 `host-model` 属性角色；历史数据继续使用已有字典“型号”约定，不依赖商品名称 |

缺少新字段的旧正式 MAT 关系按原有“已建立适用关系”读取为基本使用、已确认适用，明确注明历史关系及核验资料未记录。查询不回写补字段，不伪造核验人或测试依据。旧关系 ID、范围、备注、时间与数组顺序经过往返比较。

若新增目标别名与 `accessorySkuId` 矛盾，或目标类型缺失，不擅自改指向另一条有效对象。导入先校验结构、对象身份、范围、状态、条件和来源；悬空的历史引用保留并显示待处理，不将其当成已确认推荐。重复归一化、导入、刷新不新增重复关系。

## 4. 型号解析和绑定

所有新入口调用 `resolveDeviceSku`。结果明确分为 `resolved / unconfigured / ambiguous / invalid`，不在未确认状态返回猜测的配件结果。

解析使用实际产品类型、公共属性、SKU 规格、来源及稳定属性引用。模型和规划来源读取 SKU 绑定的发布快照、来源节点和已保存规格；不把最新发布版本或后来修改的产品规划节点、版本重新套到历史 SKU。规划来源不要求 `sku.planningId` 必然存在，能够从冻结来源及实际组合确认精确 PLN；存在多种可能时不取首个。

型号身份保留模型命名空间及祖先路径。同名不同模型、Pro/Pro Max 不自动合并；普通容量和颜色不扩大型号身份。模板、发布快照、历史规划、真实 SKU 和独立型号共同提供候选，不要求只有 active PLN 才能成为候选。模板身份与独立型号分别使用 `template:`、`device:` 命名空间。

无法唯一识别的手工、模板或历史 SKU 可显式选择已有型号，或先维护独立型号。选择限于匹配的主机产品类型；跨类型及重复显式绑定作为失效状态处理。重绑提示旧绑定及查询影响；确认时复验当前 SKU、来源指纹和上下文，防止旧对话框提交到新设备。解除绑定不删除兼容声明。保存失败保留原绑定和草稿，成功后重新解析并可刷新恢复。

## 5. 正式判定规则

- 型号级声明适用于确认的该型号；限定 PLN 声明仅在当前设备精确 PLN 匹配时加入。无 PLN 的已确认设备仍能命中型号声明，不能命中任意规格限定声明。
- 当前实际范围、同能力的已确认明确排除优先；型号排除不会被规格允许抵消。历史冲突保留全部依据并明确提示。未知条件的排除保持待确认，条件明确不满足的排除不生效。
- 条件支持设备属性 `eq/in/gte`、配套设备、协议/功率能力和人工前提。属性用真实字段判断；缺失、无法数值核验和不能自动确认的条件保持未知。界面展示“有条件适用”与需搭配/需确认内容。
- 基本使用、快充、指定能力分别计算。基本充电成立不等于快充成立；声明的功率要求不代表手机实际充电功率。没有基本使用声明时，多项特定能力保守汇总，不能由数组第一条结论决定整体状态。
- 待确认声明不升级成已确认推荐；未维护声明不会被批量推断为兼容或不兼容。
- 兼容事实与销售状态分开。销售推荐复用现有 SPU 上架和 SKU 在售规则；停售对象在“非在售”区域显示原兼容事实。
- 结果按真实 SKU/MAT 对象去重，保留所有有效依据；对象数、设备型号数、设备 SKU 数和声明数分别统计。正反向查询读取同一关系数组，不存反向副本，不生成商品笛卡尔积。
- 查询内建立索引，多个设备复用同次上下文的发布快照展开结果；上下文由调用方释放，没有跨调用长期缓存、截断或只查当前页面。

## 6. MAT 与销售 SKU 的边界

销售配件可直接维护声明，不要求先有 MAT。只有 MAT 声明时在“适用物料”展示，并提示尚无销售声明，提供复制或维护入口；不虚构对应 SKU。

复制操作必须明确选择源 MAT 和目标销售 SKU，展示源记录及声明，预览新增、重复、冲突、失效，再确认提交。新声明保存源 MAT 和原声明的 ID、身份及内容快照。确认后的副本独立保存；后续修改、删除源对象不会静默改写副本，也不构成 BOM 或动态继承。同 PLN 多个 MAT 不自动合并。取消预览零写入。

旧 `/compatibility?sku=MAT_ID`、型号入口和 Excel 流程继续有效；旧物料面板保留为“原物料适用关系”，仅作为管理视图。旧说明改为草稿加“保存说明”提交，避免失焦写入失败后无法按同一值重试。新旧入口均通过同一正式写入协调器，不各自直接改数组。

## 7. 实际操作路径和界面状态

1. **SKU 管理 `/skus`**：主机行点击“适用配件”；配件行点击“适用主机”。单条 SKU 编辑页面也有入口。
2. 抽屉查看名称、编码、完整已保存规格、型号来源；切换当前设备即时重新计算。销售配件、适用物料、待处理、不兼容、非在售分区，支持类型和关键词检索、详情、全部依据及反查主机。
3. 型号未配置/歧义/失效时进入“配置设备型号”。管理员可绑定、重绑、解除绑定或维护独立型号。只读角色仅查看。
4. “管理适用关系”或导航 `/compatibility`：选择真实销售 SKU/MAT、型号、型号级/指定 PLN、结论、核验状态、能力、条件、依据和备注；新增、编辑、批量待确认/排除/取消与 MAT 复制全部先预览，再确认。
5. SPU 列表及 SPU 编辑入口：单一已确认型号可以直接查看；多型号先选具体设备，不将 SPU 合集冒充每条 SKU 的适配结果。

当前查看对象独立于批量勾选。抽屉查看、搜索、反查和关闭不写商品、规划、物料、声明或保存视图，不改变原搜索、筛选、页码、勾选和滚动。关闭后焦点返回入口；Esc 在普通查看场景关闭抽屉，弹窗/下拉先处理自己的键盘事件。切换设备清理临时检索、旧详情及未确认的维护上下文。

空态区分未配置、歧义、失效引用、无声明、类型无结果、搜索无结果、仅 MAT 和保存失败，并提供相应操作，不罗列全库未知配件。

## 8. 写入、导入和恢复

`catalog` 的兼容命令先检查权限并重新校验预览，在候选副本上应用变更，完成序列化和真实 `localStorage.setItem` 后才更新内存兼容数组。重复新增/复制跳过已有声明；明确编辑保留原 ID/创建时间。显式持久化与原 deep watch 协调，避免同一业务动作二次写入。导入键顺序不同也验证只提交一次。

保存失败不先显示成功，不修改原内存/磁盘，表单草稿和预览保留，按钮可按同一值重试。取消声明不删除 SKU、SPU、MAT、PLN 或型号。对象删除继续检查正式引用，新增绑定也参与保护。

为满足“不完整旧数据不能重新灌种子”，启动时只在存储键真正不存在时初始化演示数据。已有空串、坏 JSON、缺必要数组或不支持版本进入明确恢复界面，原始存储零覆盖；可下载原始字节备份，选择独立备份文件，校验并预览后确认。恢复写入失败仍保留原存储和候选文件，可重试。可读历史数据迁移失败则保留已读取历史数据并给出错误，不改成 seed。

这是本轮必要的数据安全补齐：`main.ts` 仅增加加载失败分流，未重构路由或全局持久化体系。

## 9. 修改文件与维护边界

| 文件 | 职责 |
| --- | --- |
| `src/domain/accessoryCompatibilityTypes.ts`、`types.ts` | 新展示/判定结果、声明条件、独立型号、绑定及可选业务字段 |
| `src/domain/deviceResolution.ts` | 产品角色、候选、冻结来源、型号与精确 PLN 解析、来源指纹、调用内索引 |
| `src/domain/accessoryCompatibilityQuery.ts` | 只读判定、分区、去重、条件、能力、正反向查询 |
| `src/domain/accessoryCompatibilityCommands.ts` | 数据校验、预览、冲突/重复、应用变更、复制来源快照 |
| `src/domain/compatibility.ts` | 保留原 MAT 管理逻辑，适配目标身份及新增引用保护 |
| `src/stores/catalog.ts` | 权限、存储先行提交、绑定/独立型号命令、导入与加载失败保护 |
| `src/components/compatibility/AccessoryCompatibilityDrawer.vue` | 当前查看上下文、查询结果、详情/反查、焦点；不拥有正式业务数组 |
| `CompatibilityManager.vue`、`DeviceBindingDialog.vue` | 各自表单草稿、预览、确认；业务写入进入 store |
| `LegacyMaterialCompatibility.vue` | 保留原 MAT 入口、管理汇总与现有样例辅助操作，统一提交 |
| `compatibilityPresentation.ts` | 文案及纯展示；完整规格复用既有 `savedSkuSpec` |
| `src/views/CompatibilityView.vue` | 统一工作台与旧入口、路由上下文协调 |
| `SkuWorkbenchView.vue`、`SkuEditView.vue`、`SpuEditView.vue`、`ProductListView.vue` | 增加入站按钮及受控抽屉，不接管原查询、选择或编辑状态 |
| `src/components/StoredDataRecovery.vue`、`src/main.ts` | 原始数据保护、文件校验恢复与启动分流 |
| `scripts/accessory-compatibility-*.ts`、`browser-accessory-compatibility.mjs` | 独立样例、纯领域/真实 store/浏览器验证 |
| `package.json`、`README.md`、`.gitignore`、本报告与证据 JSON | 明确检查入口、使用说明和本轮证据隔离 |

核心画布、布局、焦点/撤销实现、V2 选择器、SKU 生成、PLN/物料算法和 SKU 视图内部保留原实现。没有另写一套规划或商品查询算法。

## 10. 实际验证命令与结果

环境：Windows，Node `v22.18.0`，项目已安装依赖，Chrome `155.0.8059.85`，独立临时浏览器上下文。领域测试固定 `2026-10-23T04:00:00.000Z`；浏览器固定新建时间为 `08:00Z`，计时器使用前进的时钟。新测试使用明确“独立测试”数据，未触碰日常浏览器存储。身份、来源、关键关联、数组顺序均参与比较。

下表全部为本轮实际执行；多处共同调用的旧脚本不累计为额外覆盖。

| 命令 | 结果与证据 |
| --- | --- |
| `node work/accessory-compatibility/baseline-checks.mjs` | 原 HEAD 快照运行原兼容、SPU/SKU、SKU 查询/状态、上一轮三个修复专项，通过；`before-checks.log` |
| `npm run check:accessory-compatibility` | 19 组查询、11 组状态、16 个 Chrome 验收点通过；`final-accessory.log`、`query-result.json`、`state/result.json`、`browser-final/result.json` |
| `node scripts/run-domain-check.mjs scripts/accessory-compatibility-query-check.ts` | 最终补充第三方 CaseWorks 配件对 Apple 品牌独立测试设备的声明用例后，19 组再次通过；`final-query.log` |
| `node scripts/run-domain-check.mjs scripts/compatibility-check.ts` | 原兼容检查 15 项通过，含真实 Excel；`final-domain.log` |
| `node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts` | 23 组通过；同上 |
| `node scripts/run-domain-check.mjs scripts/sku-workbench-state-check.ts` | 6 组通过，原断言未放宽；同上 |
| `node scripts/run-domain-check.mjs scripts/excel-import-check.ts` | 20 项通过，实际正式写入 583 行，重复预览 583 行已导入；同上 |
| `npm run check:frontend` | 11 个既有脚本通过：商品查询、分类、规划、草稿、物料、一致性、布局、round5、round1、SPU/SKU、导航筛选；同上 |
| `npm run check:spu-sku` | 19 组领域及 12 个浏览器验收点通过；`final-business-browser.log`、`spu-sku/result.json` |
| `node scripts/browser-sku-workbench.mjs` | 24 个浏览器验收点通过，含原查询、字段、分组、保存和刷新；同上、`sku-workbench/result.json` |
| `npm run check:integration -- --business-only` | 13 个核心闭环验收点通过，涵盖预览不写入、发布、PLN 沿用/新增、多 MAT、刷新、弹窗、模型切换、快捷键和历史；同上、`integration/result.json`。未把脚本的商品列表扩展分支 4a–4e 标记为本次执行 |
| `npm run check:sku-views:fixes` | 既有分组、迁移、恢复检查及 7 个浏览器验收点通过；`final-sku-fixes.log`、`sku-fixes/browser/result.json` |
| `npm run typecheck` | 最终生产源码通过；`typecheck.log` |
| `npm run build` | 最终生产源码通过；`build.log`，保留既有大包提示 |
| `node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict --noUnusedLocals --types node scripts/accessory-compatibility-query-check.ts scripts/accessory-compatibility-state-check.ts scripts/accessory-compatibility-fixtures.ts` | 新测试自身严格类型检查通过；`final-check-types.log` |
| `node --check scripts/browser-accessory-compatibility.mjs`、`git diff --check`、新文件 no-index 空白检查 | 通过；最终审查脚本与输出 `final-review.mjs`、`final-review.json` |

实际真实 Excel 为 `D:\单子\商城erp\前期包\2.0 数据\1.1 手机 Apple.xlsx`，本机存在并读取，不是用合成文件代替真实文件。

运行浏览器与旧检查时实际设置输出目录，避免覆盖历史验收：

```powershell
$env:ACCESSORY_BROWSER_OUTPUT='work/accessory-compatibility/browser-final'
npm run check:accessory-compatibility
$env:SPU_SKU_OUTPUT_DIR='work/accessory-compatibility/spu-sku'
npm run check:spu-sku
$env:SKU_WORKBENCH_OUTPUT_DIR='work/accessory-compatibility/sku-workbench'
node scripts/browser-sku-workbench.mjs
$env:FINAL_OUTPUT_DIR='work/accessory-compatibility/integration'
npm run check:integration -- --business-only
$env:SKU_GROUP_OUTPUT_DIR='work/accessory-compatibility/sku-fixes'
$env:SKU_MIGRATION_FIX_OUTPUT='work/accessory-compatibility/sku-fixes/migration'
$env:SKU_RESTORE_FIX_OUTPUT_DIR='work/accessory-compatibility/sku-fixes'
$env:SKU_FIX_OUTPUT_DIR='work/accessory-compatibility/sku-fixes/browser'
npm run check:sku-views:fixes
```

新专项不依赖个人绝对路径。领域与状态输出可用 `ACCESSORY_OUTPUT_DIR`、`ACCESSORY_STATE_OUTPUT_DIR` 配置；浏览器输出用 `ACCESSORY_BROWSER_OUTPUT`，主浏览器可用 `BROWSER_CHANNEL=msedge` 选择已安装 Edge。默认使用安装的 Chrome；缺浏览器会实际报错，不静默跳过。真实 Excel 及旧对照基线依赖沿用原脚本要求。复现原实现可对上述 HEAD 执行 `git archive` 到隔离目录，再运行保存的基线 runner；不能用修改后源码充当旧基线。

## 11. 需求覆盖与存储故障证据

机器证据中查询组按顺序记为 Q1–Q19，状态组 S1–S11，浏览器 B1–B16。下列为需求映射，不把一个组虚增为多次执行：

| 领域要求 | 对应证据 |
| --- | --- |
| 1–7 多种配件/多型号、容量颜色、Pro/Max、同名隔离、品牌与第三方 | Q1–Q6、Q9–Q10；Q1 还验证保存公共属性与变体属性的完整规格 |
| 8–12 型号/规格合并、其他 PLN 排除、无 PLN、四种来源、歧义失效 | Q3–Q10、Q16，S5–S6，B4–B6 |
| 13–15 明确排除、未知条件、基本/快充 | Q11–Q15，B1、B11 |
| 16–18 对象去重、依据保留、SKU/MAT 隔离、无隐式映射 | Q1–Q2、Q9、Q17–Q19，B1、B10 |
| 19–20 MAT 预览复制、来源可追溯、独立副本 | S1、S4，B3（取消→确认两条→改源排除→副本不变→刷新） |
| 21 下架与兼容事实 | Q1、B1 的非在售分区 |
| 22–24 迁移/导入导出、存储失败重试刷新 | S2、S5、S7–S11，B2–B5、B12–B13；原 SKU 状态及上一轮修复专项 |
| 25–26 纯查看不变、节点配置不写正式声明 | Q19、S1、B1，既有草稿/规划/节点弹窗集成 |

实际故障通过拦截下一次真实 `setItem` 抛出 `QuotaExceededError` 注入，没有仅模拟一个布尔返回值。状态检查记录 20 次尝试、15 次成功写入；其余为预期失败/幂等零写入。覆盖正式声明、绑定及解除、独立型号、导入、历史迁移；浏览器额外覆盖同值旧 MAT 说明重试和恢复文件重试。对失败前后内存及存储原始值做比较，成功后刷新验证。

独立状态检查验证键顺序不同的导入只写一次、重复导入不增关系；绑定写入失败和来源过期均不覆盖原状态；失效历史引用不丢弃。浏览器恢复还下载并比较原始损坏数据字节，错误文件不写入，成功恢复的关键记录和数组顺序等于导入 JSON。

## 12. 浏览器与视觉证据

新专项 16 个验收点涵盖：手机→配件→详情/反查；新增保存失败保留→重试→立即结果→刷新；MAT 独立复制；绑定/解除；多型号 SPU；统一维护；只读角色；列表页码/搜索/勾选/滚动保持；仅 MAT 指引；批量新增/重复/待确认/排除/取消；旧 MAT 说明；损坏数据恢复；明暗主题和窄窗口。

- Chrome 明亮及深色：1366×768。
- 窄窗口：780×900。
- 125% 等效可用性：1093×614 CSS 视口、`deviceScaleFactor=1.25`，检查抽屉/弹窗横向边界，并实际滚动点击底部取消按钮。不是实际切换 Windows 系统缩放或 Chrome zoom。
- 新浏览器专项、SPU/SKU、SKU 工作台与上一轮修复浏览器输出均没有 pageerror、console error 或 Vue warning；设计器集成保留原 Vue Flow 弃用提示，详见限制。
- 截图为本轮最终生产代码生成，实际查看了明亮销售结果、MAT 复制预览、恢复界面、深色、窄窗口及 125% 等效编辑器；最后规格修正后重新生成并复核销售摘要与等效缩放编辑器。没有把旧报告截图说成本轮重新执行。

截图目录：`work/accessory-compatibility/browser-final/`。共 12 张：`device-sales-light.png`、`accessory-reverse.png`、`declaration-storage-failure.png`、`material-copy-preview.png`、`material-only-guidance.png`、`incomplete-storage-safe-recovery.png`、`dark-desktop.png`、`dark-desktop-editor.png`、`narrow.png`、`narrow-editor.png`、`equivalent-125-percent.png`、`equivalent-125-percent-editor.png`。

## 13. 修复过程中发现并处理的问题

有独立失败记录的具体问题已修正：跨主机类型的历史显式绑定被错误接受；后来修改产品规划可能改变历史 SKU 解析；没有 basic 时任取特定能力首条决定结论；导入对象键顺序导致 deep watch 再次写入；新导入失败文案不满足原 SKU 状态检查契约。相关中间记录为 `state-before-cross-type.log`、`review-plan-edit.json`、`review-capability-order.json`、`state-before-import-order.log`、`old-state-before-message-fix.log`。最后恢复原“无法写入本机”契约，原检查断言未改。

另外修正新抽屉及详情只显示变体属性、遗漏已保存公共属性的问题，复用既有规格展示规则并增加真实展示断言；受影响专项、类型和构建重新执行。开发期测试选择器、弹窗过渡等待、滚动采样时机和 JSON 的 undefined 对照问题已修正，未通过删减业务断言来迁就实现；中间失败记录保存在 work 下，与 final 结果分开。

## 14. 冻结区域、历史记录和限制

独立范围审计 `final-scope-audit.json` 核对 52 个受保护源码/旧检查及 14 个历史文档（9 md、5 json），Git blob 和规范化换行后的内容全部与基线一致。包括 `draftComboPreview.ts`、`planning.ts`、`material.ts`、`spuSku.ts`、`logic.ts`、`nodeCompatibility.ts`、`catalogIdentity.ts`、V2 选择器、核心设计器、SKU 查询/状态与先前三项修复脚本。Windows checkout 的 CRLF 与 Git LF 会导致原始磁盘 SHA256 不同，报告不将这种换行差异描述为字节完全相等。新增文件 no-index 空白检查识别合法 CRLF（`cr-at-eol`），仍检查真正的行尾空格、文件尾空行和 space-before-tab。

业务检查进一步验证已发布快照、历史版本、PLN 沿用/新增、同 PLN 多 MAT、原 SKU/MAT 身份与节点独立语义。没有升级依赖、改变数据版本、路由结构或全站样式。

必须如实记录一次证据目录操作失误：首次基线检查漏设旧迁移脚本输出变量，覆盖了一个被忽略的历史产物 `work/sku-workbench-fixes/migration/after-result.json`。不能恢复其原始字节；随后修正为隔离输出并重新完成原 HEAD 基线检查。该旧产物不作为本轮证明；已跟踪历史报告/证据和用户业务数据未被改写。本轮报告与证据为全新文件。

未验证或保留限制：

- 未执行真实 macOS Safari、WebKit、实体触控板、全部设备/浏览器；主要验收 Chrome，未将可配置 Edge 误写成实际运行。
- 未实际改变 Windows 系统缩放；完成上述等效缩放与按钮可达性检查。
- 不验证真实配件硬件的电气/快充性能，不虚构业务核验依据；未知协议、功率、线缆等仍需人工确认。
- 没有在用户日常浏览器存储上执行迁移或恢复；测试使用独立上下文，用户应在实际导入前保留自己的备份。
- 既有设计器 Vue Flow options 参数弃用提示在集成里出现两次，核心画布未改；本轮新专项没有新增 Vue 警告。既有 ResizeObserver 提示未在本轮新上下文复现，未通过屏蔽告警处理。
- 既有生产构建大于 500 kB 的 chunk 提示保留。旧修复 runner 并行运行时出现一次 HMR 24678 端口占用提示，该进程退出 0，后续领域和浏览器断言均通过；新浏览器 runner 使用隔离端口/缓存并关闭 HMR。
- 原报告中的 SKU 勾选重置问题继续作为既有问题保留，本轮不顺带修复。

当前没有已知由本轮新增、且阻断上述闭环的未解决问题。满足本轮收口条件，停止扩展；未自动开展后续重构。
