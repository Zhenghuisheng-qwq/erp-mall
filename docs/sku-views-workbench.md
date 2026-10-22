# SKU 视图工作台实施报告

RESULT：READY。约定的 SKU 视图功能与下述验证完成；真实 macOS Safari 等边界单独列出。

## 1. 实际基线与保留成果

2026-10-22 开工，分支 `20261022`，开始 HEAD `215e3edfb51d72a7660eae8b83c78d4dd640b191`，工作区干净。本轮不回退到 54dbe86、40f8df07 或 20261019。历史报告中的 HEAD 和未提交状态仅表示当时现场。

已阅读 README、`spu-sku-management.md`、`frontend-navigation-filter-ux.md`、当前重构报告、第一轮性能报告及直接源码。项目、适用父目录和本轮目录未发现 AGENTS.md。基线完整归档为 `work/sku-workbench/baseline.zip`，解压源码为 `work/sku-workbench/baseline/`，HEAD/状态记录在同目录上级。状态记录创建时已经有本轮刚新增的类型文件；创建该文件前实际 `git status --short` 为空，归档取开工 HEAD，未把新代码冒充旧基线。

保留：SPU/SKU 独立入口、页面设置隔离、先选 SPU 创建及追加 SKU、单条维护、来源、SKU/MAT 判定、导航和权限、分类布局、展示转换和手工排序模块。未修改 SKU 生成、规划对账、模型设计器、MAT 建档算法或业务身份。未增加应用依赖，未提交、推送、合并或部署。

原 SKU 页只有即时条件编辑、单排序、单分组、列显隐和自动更新的视图。新工作台增加明确的应用/保存边界；SPU 继续使用原即时生效页面。`/skus` 指向独立协调页，避免新保存机制进入 SPU 的响应式和写入链。

## 2. 功能完成矩阵

证据目录统一为 `work/sku-workbench/`，下表用相对路径。最终执行结果另见第 11 节。

| 能力 | 实现与入口 | 证据 / 限制 |
|---|---|---|
| 正式 / 工作 / 弹窗草稿三层 | 完成；筛选编辑不动背后表格，应用改变工作配置，保存才替换正式视图 | query/state 专项；双引擎 draft-cancel、applied、dirty-work 检查 |
| 应用、保存、另存、恢复 | 完成；系统视图保存要求名称；失败保留 dirty 和可重试配置 | save-failure/retry、reload、restore 检查 |
| 全部 / 任一 / 一层条件组 | 完成；增删、复制组和组内编辑，空组/不完整条件不能应用 | 固定预期 WB-A/WB-B/WB-D；`filter-groups.png` |
| 类型化字段 / 操作符 | 完成当前数据支持的文本、枚举、多值、日期、SPU、分类 | 数字/布尔求值边界有测试；当前没有可真实暴露的规范数字/布尔业务字段，未虚构 |
| 动态独立列 | 完成；字段面板按词典 ID 添加，明确来源和适用性 | 字段截图、改名/失效测试 |
| 显隐、顺序、宽度、冻结 | 完成；上下按钮替代拖拽、自动宽度、表头拖动；至少保留一个识别列 | 字段保选、往返检查；小于 960px 或冻结总宽超过 320px 时临时不冻结并解释，偏好保留 |
| 多级排序 / 分组 / 密度 | 完成；最多三排序、两分组、舒适/紧凑 | 固定排序/计数/分页预期；手工冲突保留并提供清除入口 |
| 新建、复制、命名、删除 | 完成；去空格、空名/重名拒绝；删除只删配置 | 状态及浏览器复制刷新、删除默认回退 |
| 收藏、常用顺序、默认 | 完成；系统入口固定，收藏最多展示四个自定义快捷项，其他进入可搜索菜单 | 偏好往返、跨未收藏项前后移动专项、独立上下文默认入口 |
| 摘要、dirty、空状态 | 完成；完整括号逻辑，编辑/删除条件节点，长摘要折叠 | 空结果、失效配置、摘要及截图 |
| 历史视图 / keyword / presets | 完成；原视图保留，预设另迁移独立命名入口，不删除旧预设 | V14→V15→重复加载、复制/导入/刷新检查 |
| SPU 临时范围 | 完成；与视图条件求交，系统范围工作独立；只明确勾选才存为条件 | 第三个浏览器闭环、scope 专项 |
| 真实落盘 / 无效配置 | 完成；同步写成功后更新正式内存；无效查询返回空并停批量 | 配额失败、重试、损坏导入、失效字段检查 |
| Apple 浏览器体验 | Chrome 和 Playwright WebKit 完成同一流程验收 | Windows WebKit 27.2；真实 macOS Safari 和实体触控板未测 |
| 视图专用导出 | 未新增；“导入导出”进入原整库工具，不把它解释为当前视图结果导出 | 未开发新的导入系统或筛选结果导出 |

## 3. 用户操作说明

1. 打开侧栏 **SKU 管理**（`/skus`）。首次进入使用本机默认视图，系统“全部 SKU”始终可达。
2. 点 **筛选**，选择字段、操作符和值。上方可以改为“任一条件”；添加条件组后，组内也能选“全部满足 / 任一满足”。预览数量不会提前刷新背后列表。
3. 点 **取消** 丢弃本次草稿；点 **应用筛选** 更新当前列表，此时出现“未保存”。
4. 点 **字段** 调整列、宽度、冻结及顺序，再点“应用配置”。点 **排序** 设置优先级；“更多 → 分组与显示”设置分组、密度和常驻分类。
5. 第一次点 **保存视图** 会要求另存名称；也可以直接点 **另存为**。输入名称并创建后，正式规则保存到本机。以后新增匹配 SKU 会自然进入结果，记录修改后不匹配则离开。
6. 在 **更多** 中收藏、设默认、移动常用顺序、复制、重命名或删除。切换视图不反复确认，已应用的临时调整按视图保留；刷新后仍显示未保存。
7. 点 **恢复已保存配置** 撤销工作调整。顶部搜索只在当前视图与 SPU 范围内查询，不进入正式规则；清空筛选保留列、排序、分组和 SPU 范围。
8. 从 SPU 的 SKU 数量或管理入口进入后，顶部范围条说明当前 SPU。主动切换命名视图时取交集。另存时，只有勾选“将当前 SPU 范围保存为条件”才把它写入规则；**查看全部 SKU** 才退出范围。

旧查询条件在弹窗中标明“历史条件（保留原语义）”；可以保留并叠加新条件，也可以清除后用新条件替代。清除历史条件只移除 keyword/filters，不抹掉旧排序/分组的兼容语义。

## 4. 页面与交互

四层为标题/范围/业务操作、常用视图栏、搜索/筛选/字段/排序/更多、摘要/表格/分页。视图快捷项横向滚动，不无限换行或新增永久侧栏；全部视图菜单可搜索。保存、另存和恢复的位置固定，dirty 使用轻量文字，危险删除单独确认。

主筛选弹窗宽度上限 820px，展示配置上限 800px，随视口缩小；标题和底部保留，条件/字段区内部滚动。两个大型配置弹窗不会同时由正常入口打开。弹窗取消真实丢弃草稿，普通配置不弹成功消息。类型选择使用 Element Plus 原有控件与主题；字段上下移动和键盘操作不依赖拖拽。

空状态区分无真实 SKU、当前 SPU 无 SKU、无匹配、失效配置和已删除 SPU。失效配置明确列问题，查询关闭并停用批量操作。保存失败给出本机存储原因，保留工作配置供重试。若正式配置同时有失效条件与列，可明确选择“重建工作配置”，确认后只重建工作副本，原保存视图仍保留，避免两个配置面板互相阻止修复。宽窄窗口保持横向滚动，避免冻结区域占满视口。

真实截图（Chrome）：

![SKU 工作台](../work/sku-workbench/browser/desktop.png)

![条件组](../work/sku-workbench/browser/filter-groups.png)

字段、失效配置、深色及窄屏分别见同目录 `fields.png`、`invalid-config.png`、`dark.png`、`narrow.png`。WebKit 对应六张图片位于 `work/sku-workbench/webkit/`，不是 Safari 实机截图。

## 5. 文件与调用关系

| 文件 | 职责 |
|---|---|
| `views/SkuWorkbenchView.vue` | SKU 路由/范围、临时搜索/分页/选择、表格与业务入口协调；不承担配置修复或条件求值 |
| `components/product-list/sku/SkuFilterDialog.vue` | 独立筛选草稿、条件组及匹配预览 |
| `components/product-list/sku/SkuRuleEditor.vue` | 单条件字段、操作符和类型化值输入 |
| `components/product-list/sku/SkuDisplayDialog.vue` | 展示配置草稿、列/排序/分组/密度/分类布局 |
| `components/product-list/useSkuWorkbench.ts` | 视图工作配置、dirty、显式命令、偏好及范围工作缓存 |
| `domain/skuWorkbenchTypes.ts` | 工作台专用配置与字段类型，仅偏好数据使用 |
| `domain/skuWorkbenchState.ts` | 默认配置、旧配置转换、读取修复、复制、范围条件及持久化事务 |
| `domain/skuWorkbenchFields.ts` | 字段目录、稳定 ID、适用性、读取及合法操作符 |
| `domain/skuWorkbenchQuery.ts` | 校验、条件树求值、旧语义桥接、排序/分组/分页、摘要 |
| `domain/types.ts` | 可选工作台字段与 V15；SKU/SPU/PLN/MAT 业务结构不变 |
| `domain/productListPages.ts` | 实际 SKU 容器初始化/兼容；SPU 继续原适配 |
| `domain/productListViews.ts` | 原 repair/create/copy 保留新配置和列宽/冻结，防止旧路径重建时丢失 |
| `stores/catalog.ts` | 原存储链上增加先写后换的 `commitSkuPage`，重复 deep watch 同载荷去重；迁移失败不退回 seed |
| `router/index.ts` | 仅 SKU 列表接入新协调页；原创建、编辑和权限守卫保留 |
| `scripts/sku-workbench-*-check.ts` / `*-performance.ts` | 固定预期领域、状态与性能检查 |
| `scripts/browser-sku-workbench.mjs` | 两引擎同一工作台交互入口 |
| `scripts/browser-sku-spu-preservation.mjs` | 真实开工快照与最终 SPU 的数据、页面偏好和明暗截图对照；缺基线明确失败 |
| `scripts/browser-ui.mjs` / `browser-4b.mjs` / `browser-spu-sku.mjs` / `browser-frontend-final.mjs` | 等待新 SKU 路由，使用应用式字段面板；保留原业务断言 |
| `package.json` / README / `.gitignore` | 明确检查入口、V15 说明、忽略本地证据；无依赖升级 |

复用的 `tablePresentation.ts` 仍生成原编号/名称/规格/父级展示；分类显示与 resize 清理继续由 `useProductListCategoryLayout` 负责；跨页手工暂存复用 `useProductListManualOrder` 和 `productListManual`，手工缺省顺序读取原 `unfilteredIds`。旧筛选展示用于历史条件摘要。SPU 的 `ProductListView.vue`、旧工具和即时筛选实现保留。

## 6. 状态与保存机制

| 状态 | 所属与生命周期 |
|---|---|
| 正式规则 | `productListPages.sku.views[].skuWorkbench` |
| 已应用工作配置 | composable 独立副本；暂存到本页 `skuWorkbench.working`，刷新可恢复 |
| 筛选/展示弹窗草稿 | 各弹窗打开时深复制；取消丢弃，应用时复制给工作配置 |
| 临时搜索 | SKU 页 query.keyword；指定 SPU 时独立临时搜索，退出恢复全局搜索；不复制到正式视图 |
| 旧已保存 keyword | `config.legacy.keyword`，继续作为正式兼容条件并显示摘要 |
| SPU 范围 | 路由 `?spu=ID`，不在正式配置中，除非用户明确选择保存 |
| 页码 | 页面偏好；SPU 范围独立页码，不在视图配置中 |
| 勾选 / 折叠 / 排序暂存 | 挂载中的 UI 状态，不写正式视图 |

工作缓存位于 SKU 页面作用域；SPU 同名 view ID 不会共享。系统“全部 SKU”的指定范围工作使用 `sku-system-all@spu:ID`，不会覆盖全局系统工作配置；命名视图仍读取自身工作规则后与范围求交。无独立 SKU 业务数据副本。

dirty 使用有效配置规范化比较，排除时间戳、内部条件 ID、分页、选择、搜索和属性名称别名元数据。正常保存先构造 SKU 页面设置候选，同步调用 localStorage；成功后才替换正式内存及清 dirty，随后相同 deep watch 载荷去重。写失败时正式配置和原磁盘保持，工作副本及错误仍在。一次正常保存的一次写入有专项断言；同一 tick 另有页码或搜索偏好变化时，会由原 watcher 另写该偏好，不冒充保存成功。

系统视图正式规则只读，调整后通过另存创建自定义视图。首次普通进入使用 defaultId；刷新 `/skus` 恢复 activeId 及工作；SPA 再进入和退出临时范围恢复当前选择。默认/当前删除回退到有效默认或系统入口。收藏栏移动按实际收藏邻居处理，不被中间未收藏视图挡住。

## 7. 字段与查询语义

字段目录定义 ID、来源、类型、能力、选项和读取方式。基础字段为已保存编号/名称/完整规格、所属 SPU、分类、SKU 状态、OA_SKUID、产品类型、模型、SKU 创建/维护日期、来源方式和真实 SPU 分组。编号沿用既有 `savedSkuCode`，未存 code 时展示记录 ID，不分配新编号。

动态属性使用 `attr:词典ID`，依据实际方案绑定、手工属性或规划来源判断适用；读取 SKU 规格优先于 SPU 公共属性。未应用字段与适用但未填写分开，不把所有缺值都当不适用。词典字符串 256G 不转成数字。字段搜索展示来源及 ID，同名不混同。

名称变更通过视图中观察到的 `attributeNames[id]` 及真实属性/规划来源名称保持读取；不存在任何历史名称映射的旧名称不猜测。删除字段保留其规则供用户看到失效，不自动移除并扩大结果。

新文本条件大小写不敏感，支持包含/不包含/等于/不等于/开头/空/非空；枚举使用保存的值；真实多值支持任意/全部/不包含。否定只命中适用且有值的记录。空值是 null、空白文本或空数组，数字 0 和 false 不是空。当前真实字段没有规范数字/布尔数据源，因此不在选项中虚构；其求值器有独立 0/false/范围边界测试。

新条件树外层 all/any，可含普通条件和一层 all/any 组。例：外层任一，组一“在售 且 白色 且 256G”，组二“在售 且 黑色 且 512G”。摘要保留括号和“且/或”，删除标签删除该完整根节点，不把 OR 拆成 AND。

历史 query 保留旧关键字、操作符及空值含义，经原 `presentProductList` 一次筛选；旧 `created` 继续看父 SPU 日期。未知字段/操作符明确报错。旧单排序/分组未改变时保留原结果顺序；用户改用新规则后使用新类型比较和空末规则，不静默重写历史视图。

日期按 **Asia/Shanghai** 业务日，周一开周；支持今天、昨天、本周、本月、近 7/30 天含今天，以及通过“介于”指定自定义闭区间。保存相对规则而非固定结果。页面每分钟、重新可见及重新进入刷新参考时间；日切最多受一分钟刷新周期影响。日期未填写不回退父级。`updatedAt` 表格继续读取 SKU 自己的维护时间，旧父级日期另列为“SPU 创建日期（历史含义）”。分类用稳定 ID，精确匹配与“包含下级分类”是不同操作；历史精确条件不自动升级。

新字段排序最多三项，重复字段拒绝，按字段类型比较，空/不适用末尾，同值保留默认身份顺序。分组最多两层，全量匹配结果计算各层数量后按记录分页；分组身份使用真实值键，不靠显示标签折叠。手工顺序与不支持的字段排序/分组组合有提示，不静默覆盖；新增记录按原默认序追加到已有手工顺序末尾。

最终结果是权限路由范围、真实 SKU、SPU 范围、历史兼容条件、新条件树和顶部临时搜索的交集。查询/展示函数只读输入，无全局结果缓存。

## 8. 持久化、往返与历史兼容

存储键仍为 `iyge-v2-mock-db`，版本 **14→15**。新增可选的 `ProductListSavedView.skuWorkbench` 与 `ProductListPageState.skuWorkbench`；后者含结构版本、activeId/defaultId、favorites/order、working。配置含条件树、legacy、columns(width/frozen)、sorts/groups、density、manualOrder、sortMode、categoryLayout、属性名称映射，不含结果快照或业务记录。

新系统 ID 为 `sku-system-all`；原 `view-default` 名称、条件、列、keyword、手工顺序均保留。旧 presets 原数组保留，并以稳定的 `sku-preset:旧ID` 建立可选择视图，不重复迁移。两页仍由 `productListPageData` 映射实际容器，保存不写顶层旧字段冒充生效。

`repairModeQuery`、`repairColumns`、`repairView`、create/copy 相关路径已检查并补充保留新元数据；旧查询字段不被新条件树代替。V15 加载修复配置形状，损坏值保留可解释的无效标记，不能变成“无条件”。未知宽度/冻结/重复列/条件组也会验证失败。

已验证保存→JSON→normalize→重复加载、复制→刷新、V14 迁移→再次加载一致，含列宽冻结、三排序/两分组、密度、内部条件、历史单边日期、keyword、别名和工作缓存。SPU 与业务对象保持完整有序比较。

迁移落盘失败保留原磁盘及已兼容读取的内存，显示原因，不退回 seed、不清库；失败导入不替换当前业务对象，解除限制后可重试。没有降级旧版应用读取 V15 的承诺，应保留 V14 备份及使用当前版本。

## 9. 业务与选择边界

真实 SKU/MAT 使用原 `catalogIdentity`，不按当前页面另猜身份。新列表排除 MAT；单 SKU 状态、编辑、删除及批量命令仍走 catalog store 和原适用关系保护。SPU、PLN、版本快照、MAT 回执与关联不由视图命令写入。

勾选为稳定 SKU ID。全选仅当前页，页面明确“全选本页”；同查询翻页保留，批量只作用于仍在有效结果内的已选真实 SKU。切换视图、范围或结果身份序列清理旧选择并说明。字段显隐、列宽、密度改变不清选择；没有自动新增“全部匹配结果”批量能力。

导入导出入口仍是原整库工具，未将当前视图、字段或勾选接入导出，不声称导出当前筛选结果。角色权限沿用路由和既有业务入口，未提供团队共享或跨设备同步。

## 10. 浏览器与视觉覆盖

系统 Windows x64 10.0.26200、Node 22.18.0、Playwright Core 1.64.1。Chrome 155.0.8059.85 与 Playwright WebKit 27.2 均实际运行完整 24 检查点，1600×1000 / 780×900、明亮/深色。独立上下文、固定业务时间与可追踪 ID；未清空或访问日常浏览器数据。

实际验证键盘 focus+Enter 打开、Esc 取消及焦点回到触发按钮，浮层不被表格裁切、窄窗按钮/底部可达；用水平 mouse.wheel 输入断言表格 scrollLeft 前进。不是实体触控板或真实 macOS Safari 验证。WebKit 首次指针点击按钮不聚焦，测试改用真实键盘路径保留焦点返回断言，未降低要求。

普通工作台及 SPU/SKU 流程诊断为空。累计列表基线与最终各出现两次 ResizeObserver 提示，设计器各有两次 Vue Flow 弃用提示；导航对照的原生 window 提示数量未增加，不屏蔽。SPU 明暗两组各 1,382,400 像素，前后差异均 0；完整 SPU 页面设置与行身份/顺序也相同。历史 `check:product-list-refactor` 的原重构零像素断言和旧截图未改写；新功能不应套旧 SKU 零差异要求，使用新入口验收。

## 11. 实际执行记录

修改前：`npm run check:frontend` 11 入口 PASS（`before-domain.log`）；完整旧源码上的 `npm run check:integration` 4A–4E 和 13 个业务点 PASS（`before-integration.log` / `before-integration/`）。这些不是最终源码结果。

最终命令和结果由 `sku-views-workbench-evidence.json` 记录。以下均实际执行，最终通过日志与排障失败日志分开保存：

| 命令 | 结果、覆盖与日志 |
|---|---|
| `npm run typecheck` / `npm run build` | 均 exit 0；`typecheck.log` / `build.log`，保留大包提示 |
| `npm run check:frontend` | 原 11 入口全部 PASS；`final-domain.log`，含规划/V2/草稿组合/物料/列表/布局等 |
| `npm run check:sku-views` | 查询 23 条 PASS 输出、状态 6 组、Chrome 24 点全通过；`workbench-final.log` |
| `BROWSER_ENGINE=webkit` 下同浏览器脚本 | 24 点 PASS；`webkit-final-current.log`，对应最终脚本与恢复入口 |
| `npm run check:integration` | 4A–4E 与 13 业务点全部 PASS；`integration-current-final.log` / `integration/result.json` |
| `npm run check:spu-sku` | 原 19 组领域、12 个创建/追加/维护/范围/刷新流程全部 PASS；`spu-sku-final.log` |
| `npm run check:navigation-filter` | 领域 + 9 个浏览器点 PASS，含 10 组旧查询及无关页面视觉；`final-navigation-filter.log` |
| 新检查独立 `tsc --strict` | exit 0；`check-types.log`，完整命令在 evidence JSON |
| `git diff --check` | PASS；新增未跟踪文件用 no-index --check 单独验证，完整补丁含新文件 |
| `node scripts/browser-sku-spu-preservation.mjs` | 原快照/最终 SPU 明暗截图均零差异，行/顺序/设置一致；`spu-visual.log` / `spu-visual/result.json` |
| `npm run check:sku-views:performance` 对应的领域入口 | 实际命令 `node scripts/run-domain-check.mjs scripts/sku-workbench-performance.ts` PASS；`performance.log` / `performance.json` |

独立检查类型的实际命令为 `node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict --types node scripts/sku-workbench-query-check.ts scripts/sku-workbench-state-check.ts scripts/sku-workbench-performance.ts`，exit 0。新增浏览器脚本均运行 `node --check`。

新工作台三场景均有固定记录 ID 预期；不会用求值器生成自己的预期。完整配置/业务状态在各 browser `states.json`，结果与控制台在 `result.json`。保存失败通过只对测试上下文的 Storage.setItem 注入配额错误验证；没有屏蔽错误或清空数据。

排障与最终证据分开：初次迁移不幂等、选择误清理、分页未立即夹取、新列表漏单条删除入口为真实实现问题，已修；旧入口等待新懒加载页面、下拉输入层定位及字典夹具真实取值为测试适配；开发期间 HMR 打断和首次 WebKit 焦点前提不同有独立失败日志。未增加超时、删除断言或把失败改称通过。WebKit 首次下载因网络权限失败，获准后下载到本项目忽略目录，未改应用依赖。

## 12. 性能实测

Windows / AMD Ryzen 9 9950X 16-Core / Node 22.18.0。固定时间、10 SPU、两个动态字段、一个条件、两排序、一层分组；50 行一页。预热两次，测九次取中位数，`performance.now()`，断言不计入时间。完整原始测量在 `work/sku-workbench/performance.json`。

| SKU 数 | 匹配数 | 查询中位数 | 当前页展示转换中位数 |
|---:|---:|---:|---:|
| 100 | 50 | 1.0196ms | 0.1681ms |
| 10,000 | 5,000 | 91.7991ms | 0.1675ms |

这是 Node 中的查询与页面字段转换时间，未包含浏览器渲染、磁盘、JSON 全库保存、弹窗及整页交互延迟；没有前后提速比例。大样本只用于检查受影响读取路径，不截断合法记录。自动列宽只读取至多 200 条已存在真实 SKU 估计文字宽度，不限制查询或显示结果数量。

## 13. 既有问题、限制与遗留项

- 历史 SPU 展开行勾选重置问题保留，本轮新 SKU 页的字段保选和跨页规则单独验证，不混称已修全站。
- 既有 ResizeObserver、Vue Flow 弃用和生产大包提示保留，不屏蔽、不顺带改加载或画布。
- 真实 macOS Safari、实体触控板、其他移动设备未测。没有后端、多人并发、跨设备同步或团队共享。
- 未重新导入真实 Excel；本轮使用独立 JSON/配置往返与业务夹具，未改变 Excel 解析、SKU 生成或建档规则。
- 未开发视图结果导出；原全库工具继续使用。未知旧属性名称没有来源映射时不猜测；字段删除会暂停查询，需修复。
- 本机 JSON 存储仍受浏览器配额约束；失败显式保留工作并允许重试，不宣称无限容量或持久化同步服务。
- 日期页内最多一分钟更新周期；无实体时间跨日等待，固定边界由领域测试覆盖，重新进入和可见性刷新实际代码已有清理。

## 14. 可复验清单

```powershell
npm ci
npm run typecheck
npm run build
npm run check:frontend
npm run check:sku-views
npm run check:integration
npm run check:spu-sku
npm run check:navigation-filter
npm run check:sku-views:performance
git diff --check
```

本轮使用现有锁定依赖，没有重跑 npm ci；上面第一条供新检出安装。浏览器入口建议串行运行，旧脚本部分共用 Vite 缓存。Chrome 默认使用已安装 channel，可用 `BROWSER_CHANNEL=msedge`。新工作台浏览器脚本使用独立缓存；缺浏览器明确失败。

WebKit 复验（Playwright 引擎，不是真实 Safari）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) 'work/sku-workbench/browsers'
node node_modules/playwright-core/cli.js install webkit
$env:BROWSER_ENGINE = 'webkit'
$env:SKU_WORKBENCH_OUTPUT_DIR = 'work/sku-workbench/webkit'
node scripts/browser-sku-workbench.mjs
Remove-Item Env:BROWSER_ENGINE
```

输出可设置 `SKU_WORKBENCH_OUTPUT_DIR`、`FINAL_OUTPUT_DIR`、`SPU_SKU_OUTPUT_DIR`、`NAV_FILTER_OUTPUT_DIR`。导航历史对照需要真实旧源码，原 `NAV_FILTER_BASELINE` 配置仍适用；不能指向修改后的代码。新工作台不依赖个人绝对路径。

手动复验按第 3 节创建视图，确认取消不改表、应用显示未保存、刷新恢复、保存清 dirty；添加 OR 组验证固定结果；从 SPU 进入并切视图验证交集；修改 SKU 状态看其离开规则；再清筛选并退出范围。视图操作前后对比完整业务数组，预期不变。删除视图预期只删除规则。

## 15. 最终交付

结束分支仍为 `20261022`，HEAD 仍为 `215e3edfb51d72a7660eae8b83c78d4dd640b191`。本轮源码、脚本和报告均留在工作区，没有暂存或提交。完整文件清单/哈希、实际命令结果和截图清单见 `sku-views-workbench-evidence.json`；完整本地 diff 位于 `work/sku-workbench/sku-workbench-full.diff`，包括未跟踪新文件。

约定范围可以验收收口，无已知由本轮引入的阻断问题。READY 限于本报告矩阵与已说明环境，不代表真实 Safari、所有设备或全站历史问题均已通过。达到本轮范围后停止；未提交、未推送、未合并、未部署。
