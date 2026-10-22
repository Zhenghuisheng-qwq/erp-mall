# 前端工程第四轮收口

RESULT：**READY**。本次约定范围可以收口；不代表全项目无问题或所有页面均已优化。**本轮无新增生产代码改动**。前三轮成果完整保留，第四轮只调整验证工具、检查入口与交付说明。没有发现需要修正的确定生产回归，没有扩大组件拆分。

## 最终基线与工作区

- 分支 `20261019`；HEAD `3cfbcc0918ed8c63b35af33c8dcb02baab49089f`，未改变。
- 开始时工作区有 24 条状态记录，第二、三轮成果尚未提交。已读取 README、业务闭环说明、三轮报告、JSON 证据及相关脚本；项目及适用祖先目录未找到 AGENTS.md。
- 第四轮开始前的 **196 文件完整源码副本**：`work/refactor-final/baseline/`；清单 `work/refactor-final/baseline-manifest.json`。包括未跟踪的新组件、脚本和报告，不只复制 Git HEAD。清单摘要：`ff79fb13a5f71197a4612a40849d29c675f200bc4d0c03061b9fa909d425890a`。结束时逐文件校验副本未改变。
- 第一轮原始基线为 `8721e572e3a2f9010bcd6a6a9f60489733d56904`；第二轮原始基线为当前 HEAD；第三轮原始基线为 `work/refactor-round3/baseline/`，包含第二轮未提交成果，189 文件，摘要 `e75642c4be9525599658d903eec65318075dcb99cc5a7b67b926c0f7bc2a8c8c`。三者均没有替换成第四轮副本。
- 最终全部 **109 个 src 文件**与第四轮开始前逐字节相同。第一轮两个领域文件、第二轮五个生产文件、第三轮五个生产文件分别匹配原报告哈希。`package-lock.json` 的改动仍属于第二轮，本轮未升级或增加依赖。
- 工作区保留前三轮未提交修改与第四轮工具/文档修改；没有暂存、提交、推送、合并或部署。

第四轮独立补丁为 `work/refactor-final/round4.diff`，包含相对上述副本的修改及新增文件。`git apply --check --directory=work/refactor-final/baseline -- work/refactor-final/round4.diff` 通过，仅检查，未应用。当前工作区可审查累计成果；第四轮补丁便于单独审查本轮。前三轮报告和原始证据文件未改写。机器可读结果见 `docs/frontend-refactor-final-evidence.json`。

## 审查结果与保留理由

| 范围 | 源码核查结果 |
|---|---|
| 第一轮计算入口 | `SpecConfigView.draftPreview → previewDraftCombinations → legalPlanningCombinations + summarizePlanningCombinations`；当前草稿展开一次，另行计算历史快照。发布仍从 `catalog.publishSpecModel → alignPlanning → reconcilePlanningRecords` 进入。组合状态、物料解析、命名继续调用原领域函数。`logic.expandVariantPaths` 与规划共用 `expandFilteredPaths`，V2 生成入口未绕开原实现。 |
| 顺序、角色、身份与编号 | 索引均在单次调用内建立；子节点排序、首个未使用 PLN 匹配、停用恢复、全局最大编号一次扫描仍在。预览展示历史重复身份取最后一个编号、对账取首个可用记录的既有差别保留，没有“统一”业务规则。没有长期缓存。 |
| 商品列表组件 | 视图工具管理字段搜索/拖动瞬态，筛选弹窗呈现字段并发出类型化操作。没有传入整个页面上下文，没有双份业务状态；筛选即时生效，关窗不是回滚。手工排序 composable 只持有勾选、拖动、暂存，通过页面注入的 move/insert 写入。 |
| 模型设计器组件 | 合法组合弹窗负责展示、过滤控件和操作意图；节点适用弹窗负责草稿候选展示。模型/版本、宿主选择、实际业务写入均由页面协调。组合勾选 composable 只有一份 ref，无额外 watch/计时器。`V3MaterialActions` 保持原父页面插槽实例与触发 key。 |
| 状态和副作用 | 页面原 watch 的依赖、顺序与生命周期未因拆分改变。ref 解构保留 ref；computed 和展示函数不写业务输入。列表 resize 和设计器键盘监听有对应清理；没有新订阅。取消、确认、重开、切换模型及返回页面均有浏览器依据。 |
| 类型和依赖 | 新组件的 props/emits/models、纯函数输出和 composable 返回明确；没有新增 any 或用于掩盖空值的断言；展示类型未进入领域持久化类型。依赖方向为页面→展示组件/工具→领域类型，未发现新增运行时循环。 |
| 无引用清理 | 核对模板、组件引用、路由懒加载及局部动态分支。父页面 `.column-list` 仍用于保存视图设置，`.drag-handle` 仍用于表格手工排序；设计器 `.dict-empty` 仍有原弹窗使用，不能因为子组件有同名样式就删除。未发现有证据的残留待删代码。 |

画布 paint、布局、焦点、词典选择、撤销、键盘和三视图协调高度耦合，继续保留在原页面；商品表格、查询、store、持久化也不再拆分。子组件中的 props/events 均对应实际展示或操作，没有为压缩接口而新增上下文对象或通用框架。

## 第四轮具体修改

| 文件 | 问题、处理与收益 |
|---|---|
| `scripts/planning-performance-browser.mjs` | 原来会优先加载个人目录 `D:/tmp/pw`，实际测试工具版本可能偏离 lockfile。改用项目 `playwright-core`；支持 `BROWSER_CHANNEL`。基线源读取移到启动浏览器之前，读取失败不会遗留浏览器。 |
| `scripts/planning-performance-fixtures.mjs` | 缺少基线时只暴露 Git 失败。现在指出具体提交与源文件，并说明恢复历史或设置 `PLANNING_BASELINE`；支持 `PLANNING_OUTPUT_DIR`，本轮输出不覆盖第一轮证据。 |
| `scripts/browser-product-list-round2.mjs` | 增加提交与 before 证据存在性检查；支持 `ROUND2_BASELINE`、`ROUND2_OUTPUT_DIR`、`ROUND2_EVIDENCE_DIR`，可复用旧证据并独立保存新结果。浏览器启动失败会关闭 Vite。原行为、数据、像素断言不变。 |
| `scripts/browser-designer-round3.mjs` | 原来缺快照时只报 ENOENT。现在检查 manifest、每份源文件、所有对照证据并逐文件校验哈希；支持 `ROUND3_MANIFEST`、`ROUND3_OUTPUT_DIR`、`ROUND3_EVIDENCE_DIR`。明确禁止用 HEAD/当前源码冒充第三轮基线；浏览器启动失败关闭 Vite。原 38 检查点及像素断言不变。 |
| `scripts/browser-4a.mjs` 至 `browser-4e.mjs` | 原 Chrome 固定 channel 改为可配置 `BROWSER_CHANNEL`，保持既有断言及 `SMOKE_URL`。 |
| `scripts/check-frontend.mjs`、`package.json` | 增加 `typecheck`、`check:frontend`、`check:integration` 三个入口。领域入口复用 9 个现有脚本，失败立即返回非零；query 脚本已经运行 list/view/naming/combo/archive 等检查，不再重复启动它们。 |
| `scripts/browser-frontend-final.mjs` | 新增独立上下文的贯通验收：启动随机本地端口，运行列表 A–E 后走发布、物料、列表、刷新、历史版本闭环；保留完整有序数据与原始业务写入。可用 `--business-only` 只复验闭环，`FINAL_SOURCE_ROOT` 指向源码副本，`FINAL_OUTPUT_DIR` 指定输出。 |
| `.gitignore`、最终报告/JSON | 忽略本轮快照、日志和截图目录；保留可审查的小型结果说明。未删除历史报告，也未将历史运行写成第四轮运行。 |

## 本轮实际验证

环境：Windows 10.0.26200 x64、Node v22.18.0、Chrome 155.0.8059.85、项目锁定的 playwright-core 1.64.1 / pngjs 7。使用独立浏览器上下文，未清空或访问用户日常浏览器数据。固定业务时钟为 `2026-10-22T04:00:00Z`，闭环每检查点递增一秒并在测试 sessionStorage 保持刷新时钟；正式 UID/PLN/MAT 仍走原函数，没有替换分配逻辑。

| 实际命令 | 结果 |
|---|---|
| `npm run typecheck` | exit 0。 |
| `npm run build` | exit 0，包含 vue-tsc 与 Vite 生产构建；保留原 >500 kB 提示。 |
| `npm run check:frontend` | 9 脚本通过：product-list-query 170、category-tree-select 11、planning 18、draft-combo 10、material 12、consistency 9、layout 17、round5 27、round1 24 条 PASS 日志。计数保留脚本自身的嵌套覆盖，不宣称都是互不重复用例。 |
| `node scripts/browser-product-list-round2.mjs`（下述输出配置） | 27 检查点与第二轮原始 before 的有序数据/写入一致；7 场景截图全部 RGBA 零差异；无浏览器错误或警告。 |
| `node scripts/browser-designer-round3.mjs`（下述输出配置） | 38 检查点与第三轮原始 before 的完整业务数据、有序写入、画布/UI 状态一致；11 场景对照通过；没有 pageerror，7 次 VueFlow 既有废弃提示与原 before 一致。 |
| `npm run check:integration`，`FINAL_OUTPUT_DIR=work/refactor-final/accepted` | exit 0。A–E 全通过；包含 286 条商品的跨页暂存、插入、刷新恢复。13 个业务检查点通过，新增闭环中没有 pageerror，仅两次原 VueFlow 提示。 |
| `node scripts/browser-frontend-final.mjs --business-only`（开始前副本、最终源码各一次成功运行） | 两边 13 检查点通过，完整 AppData、数组顺序、每次原始 DB 写入及浏览器诊断全部 deepEqual。最终等待方式适用于无自身 node_modules 的源码副本。 |
| `node scripts/planning-performance-browser.mjs`，`PLANNING_OUTPUT_DIR=work/refactor-final/planning` | 第一轮原实现与最终实现的预览、发布、4→5 条组合、沿用/新增/历史、重发、刷新、V2 页面及完整状态对照通过。验证了本轮改用项目依赖的脚本。 |
| `node work/refactor-final/tooling-check.mjs` | 7 类预期失败通过：规划提交、列表提交/证据、设计器 manifest/源文件/证据、浏览器 channel 缺失，均非零退出并给出明确原因；没有将缺依赖记为通过。 |
| `node --check <本轮涉及的 .mjs>`、`git diff --check` | 通过。新文件另以第四轮补丁的可应用性/空白检查覆盖。 |
| `node work/refactor-final/collect-evidence.mjs` | 快照完整性、前三轮源文件哈希、全量闭环对照、领域日志及第四轮补丁检查通过。 |

主要日志、截图、状态 JSON 均在 `work/refactor-final/`；最终汇总记录这些日志 SHA256。新入口从项目根目录运行，不依赖个人盘符。浏览器测试调用真实页面操作，只有独立条件树样本的准备和读取断言使用测试注入。

闭环实际核对了：重复三次打开预览不写 DB、不分配 PLN；发布沿用 `PLN-000001`～`000004` 并新增 `000005`；同一 `PLN-000001` 有三条不同 MAT，其中两条属于 V1、一条属于 V2；每次确认创建只增加一个物料、一个回执、一次 DB 写入。节点配置取消不写入，重开不保留未确认勾选，确认只新增一条草稿关系、一次写入。模型切换清空组合搜索/勾选；返回设计器后只有一个画布实例，Enter 只打开一个属性弹窗。所有旧快照和旧物料仍保持原内容/顺序。

列表实际从新物料名称找到 SPU，显示“已建物料 3 条 · 已关联规划 1 条”，真实 SKU 数仍为 0；“管理物料”能看到三条 MAT。刷新恢复完整数据和查询。历史 V1 下本版本物料为 2 条，另一版本分组为 1 条并注明 V2 来源；查看历史不改快照。

调试失败如实保留：新入口初稿写错 category 检查文件名，已改为实际 `category-tree-select-check.ts` 并去掉重复覆盖；新闭环初稿误把 MAT 当真实 SKU，又误以为 V1 不应展示 V2 的关联物料，分别由 `productList.isRealSku` 及既有 `comboMaterialStatusCheck F` 证明确认原语义后修正测试路径，没有修改生产规则或既有断言；源码副本无自身 node_modules 时的等待导入失败，改用两帧等待后复验。相关失败日志 `domain` 初稿之外的 `integration.log`、`business.log`、`business-corrected.log` 保留；最终通过结果使用独立目录 `accepted`、`business-baseline`、`business-final`，不把调试失败计作生产回归。

## 视觉与历史证据复用

第四轮实际重新执行了第二、三轮浏览器脚本，**before 图和 before 状态复用原证据，没有重跑/重建原基线**。列表检查覆盖明亮、展开行、筛选、视图工具、SKU、深色、900px；设计器覆盖结构、大纲、幕布、命名、草稿组合、物料组合、历史组合、节点适用、深色、空模型、无模型。

已查看第三轮原命名弹窗前后图和说明。第四轮仍仅命名场景 `(1322,366)` 一个像素在 `[232,237,243,255]` / `[241,244,248,255]` 间变化；481 个可见元素几何和计算样式相同，NamingRuleDialog 源码哈希未变。沿用原来严格限定该像素/色值/几何的断言，没有新增阈值、遮罩或放宽要求，未改整体样式。其余 10 场景零差异。

第一轮 **53 个差分场景、调用计数和耗时证据复用** `docs/performance-round1-evidence.json`，没有重新测时，也不宣称本轮产生额外提速。两份领域源码 SHA256 与该证据一致。历史测量为固定样本、2 次预热、7 次交替测量中位数；Node v22.18.0 / Ryzen 9 9950X / Windows，样本深度均 6：

| 样本：节点/组合/历史规划 | 预览 ms，优化前→后 | 对账 ms，优化前→后 |
|---|---|---|
| 小：24 / 16 / 32 | 0.269 → 0.152 | 0.102 → 0.076 |
| 中：162 / 384 / 1500 | 20.432 → 2.423 | 17.002 → 1.796 |
| 大：610 / 3456 / 12000 | 1264.380 → 32.836 | 1209.354 → 26.673 |

第一轮计数保留：同一草稿展开 2→1，预览完整对账/记录复制/编号分配均为 0；中样本对账最大编号扫描 192→1。这里是第一轮历史结果，不是第四轮重新执行的性能数字。

## 后续维护入口

| 修改目标 | 应查看的文件与状态边界 |
|---|---|
| 列表筛选 | `src/views/ProductListView.vue` 负责活动视图和写入；`components/product-list/ProductListFilterDialog.vue` 只编辑展示行；`filterPresentation.ts` 管操作符/日期展示；业务匹配仍在 `domain/productListQuery.ts`。关闭弹窗不会撤销已生效条件。 |
| 列、分组、排序、保存视图 | `ProductListViewTools.vue` 负责控件及搜索/拖动瞬态；页面接事件进入 `domain/productListViews.ts` / query 的原函数。视图管理确认弹窗仍在页面。 |
| 手工排序 | `useProductListManualOrder.ts` 管临时勾选和暂存确认，`ProductListView.vue` 注入持久化命令。不要把暂存写入 store；跨页插入与恢复跑 browser-4d。 |
| 合法组合 | `SpecConfigView.vue` 管模型/版本、过滤、业务动作与 watch；`LegalComboDialog.vue` 展示；`useComboSelection.ts` 管唯一勾选 ref；`comboPresentation.ts` 做只读映射。实际创建仍走 `V3MaterialActions → catalog.createMaterial`。 |
| 节点适用配置 | `NodeHostDialog.vue` 发出 toggle/remove/save；`SpecConfigView.openHostConfig/saveDraftHosts/dropDraftHost` 管草稿状态和写入，领域规则在 `nodeCompatibility.ts`。移除是既有即时草稿写入，关闭不是撤销已保存/已移除关系。 |
| 组合预览与发布 | `draftComboPreview.ts` 只读，`planning.ts` 保留身份/角色/顺序/编号；发布仍由 `catalog.publishSpecModel` 进入。不要在展示组件实现另一套计算。 |

日常核心检查：已有依赖时运行 `npm run check:frontend`、`npm run check:integration`、`npm run typecheck`、`npm run build`、`git diff --check`。新环境按 lockfile 执行 `npm ci`，另需安装 Chrome；使用 Edge 可设置 `$env:BROWSER_CHANNEL='msedge'`。没有浏览器会失败，不会跳过。核心领域/集成入口不要求历史快照。

复现本次历史对照（PowerShell，项目根目录；各段环境变量只用于对应脚本）：

```powershell
$env:ROUND2_OUTPUT_DIR='work/refactor-final/list'
$env:ROUND2_EVIDENCE_DIR='work/refactor-round2'
node scripts/browser-product-list-round2.mjs

$env:ROUND3_OUTPUT_DIR='work/refactor-final/designer'
$env:ROUND3_EVIDENCE_DIR='work/refactor-round3'
# 默认 ROUND3_MANIFEST 指向 work/refactor-round3/baseline-manifest.json
node scripts/browser-designer-round3.mjs

$env:PLANNING_OUTPUT_DIR='work/refactor-final/planning'
node scripts/planning-performance-browser.mjs

$env:FINAL_SOURCE_ROOT='work/refactor-final/baseline'
$env:FINAL_OUTPUT_DIR='work/refactor-final/business-baseline'
node scripts/browser-frontend-final.mjs --business-only
$env:FINAL_SOURCE_ROOT=(Get-Location).Path
$env:FINAL_OUTPUT_DIR='work/refactor-final/business-final'
node scripts/browser-frontend-final.mjs --business-only
node work/refactor-final/collect-evidence.mjs
```

历史对照需要保留对应 Git 提交，以及本地 before 图/状态、源码快照和 manifest；这些大文件在忽略的 work 目录，换机器时需原样带走。第三轮不能从 HEAD 重建包含第二轮未提交工作的基线。缺失时脚本明确报错；若只验证当前代码，使用不依赖历史文件的核心入口。第二/三轮视觉脚本分别使用 5296 / 5298 端口，若被占用会明确失败，需先释放；最终集成入口自动选择空闲端口。

## 既有问题、未验证项与停止边界

独立的既有问题清单：

1. SKU 展开表勾选会被重建行数据重置；第二轮 before 和本轮对照一致，保留原断言和缺陷，未混入修复。
2. 旧列表 A–E 在 Vite 日志产生两次 ResizeObserver 提示；第二轮记录同为 before 2 / after 2，本轮仍为 2。固定列表对照及新增闭环没有该错误。未屏蔽提示；不据此声称整个应用不存在 ResizeObserver 问题。
3. VueFlow options 参数废弃提示：设计器完整对照前后均 7 次，新增闭环在开始前副本/最终源码均 2 次；没有新增诊断。
4. 构建仍有 >500 kB 大包提示；没有临时改打包、加载方式或依赖。
5. 旧 `browser-smoke.mjs`、`browser-layout-fix.mjs`、`browser-round8.mjs` 的旧定位器已在前三轮基线失败，未作为本轮门禁，未伪报通过。新入口使用当前有效检查。
6. README/早期业务说明仍记数据版本 1，源码为 13；没有迁移数据。普通 V 有操作而 Alt+V 无操作、发布失败只告警、重复发布更新画布时间、刷新时 frameCanvas 重新取景，均为保留的原行为，不能将其描述为本轮新增功能。

未验证：真实用户历史数据和真实 Excel 文件导入；所有浏览器/设备/权限组合；全站页面；干净机器重新安装依赖。浏览器可用，约定核心交互、数据保护、必要视觉、类型与生产构建均已实际覆盖。这些未验证项不阻断本轮约定收口。

后续只记录有证据的 SKU 勾选、旧检查脚本、文档版本与现有警告问题；没有自动开展第五轮。本次范围内没有遗留已知重构阻断，完成后停止。
