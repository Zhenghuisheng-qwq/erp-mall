# 设计器数据保护修复（第二轮）

RESULT：READY（仅设计器数据保护修复范围）

第一轮两份历史测试产物原字节仍未恢复，未以新产物冒充恢复。

## 1. 工程与基线

- 工程：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 分支：`20261022`；开始及结束核对的 HEAD：`55862021854feb1ea95f488b593ab5108bebdc64`。
- 开始时 `git status --short` 为空；沿当前工作区实施，没有回退参考提交。
- 已读取工程说明、package.json、第一轮报告；工程及适用上级目录未找到 AGENTS.md。
- 本轮仅处理撤销隔离、共享词典撤销保护、属性／值投影只读和结构拖拽撤销。没有提交、推送、合并或部署。
- 不复制源码基线，不新建或删除项目外审计目录。原 `_audit-baseline` 的独有历史成果保留结论不变。

## 2. 修复前的真实复现

在修改生产代码前，Chrome 中选中 A 的属性节点，真实按 ArrowDown 调整顺序；通过 Router query 切换 B（保留组件实例），在 B 选中节点后真实按 Ctrl+Z。

结果：B 的 6 个节点变为 0 个，旧 A 快照被错误放回全局节点集合。证据是 `baseline-2/result.json` 和 `baseline-2/cross-model.png`。该早期 JSON 的场景名称误写为 “A delete”，实际脚本执行的是 ArrowDown；保留原文件不改写，在此纠正名称。

这是本轮实际浏览器复现，不引用上一轮处理函数复现充数。基线首次尝试的删除用例没有成功建立历史，随后换成确定可撤销的排序操作。

源码同时确认：旧撤销整体替换 params/templateParams；画布拖拽未记历史；投影拖拽和部分命令仅检查 viewing；画布删除未进入撤销。

## 3. 历史隔离与恢复范围

采用“离开当前编辑上下文即清空历史”的方案，每条历史同时记录 modelId、内存 session，以及模型和词典的 before/after。

- A→B：清除 A 历史；B 不能使用 A 的历史。
- A→B→A：返回 A 时从空历史开始，不恢复离开前的历史。
- 左侧选择、query 切换、进入总览、只读模式变化均同步失效。
- 导入、整库恢复／重置、模块重置通过 store 的 editorGeneration 使旧会话失效；模型删除也同步失效。
- 普通模型保存不会递增 generation，不清空有效历史。
- 执行撤销再次核对模型和 session，不仅依赖 watcher 清栈。
- 保留最多 40 条历史；只保留当前模型的节点、关联、structureOrder、草稿节点适用规则及真正改变的词典 ID。
- 自动布局、展开折叠、无业务变化的操作不生成历史。手工自由摆放仍可调整位置，不被冒充为结构重挂。

同步命令在首次变更前捕获临时状态，在该同步操作结束后的微任务形成 before/after 差异；嵌套创建词典并添加节点合并为一次操作。临时全词典读取只用于计算差异，历史中不保存可整库覆盖的 params 快照。

## 4. 共享词典与候选校验

`editorHistory.ts` 先构造完整候选，再写入内存；没有验证成功就不修改业务数据，也不弹出历史。

- params 按本次改变的 ID 定向恢复或删除，不用名称决定恢复对象。
- 其他模型的节点、属性关联、词典和草稿节点规则保留；不恢复全局旧数组。
- 撤销前核对本模型当前结构、关联、顺序和草稿节点规则是否仍等于该条历史的 after。
- 核对被触碰词典实体当前内容；存在后续修改就拒绝。
- 词典恢复会影响其他模型、历史快照或其他业务引用时，保守拒绝，并提示原因。对于按名称存储的旧业务引用也作保守检查；不会按名称合并同名 ID。
- 新词典项后来被 B 引用：拒绝撤销，A、B 均不变化；去掉后续引用后，同一历史仍可重试。
- 校验恢复后的节点 ID 唯一、父节点存在、属性和值有效、模型关联和 structureOrder 引用有效，防止悬空引用。
- 删除节点连带移除的草稿节点适用规则一并恢复，已发布规则和其他模型规则不动。
- 引用切换复用已有 rebindSpecNode 校验，不能因为换属性而保留不属于新词典的子取值；根级同级检查限制在本模型，B 的同名／同属性根节点不阻挡 A。

这是一套保守的局部撤销机制；共享实体发生冲突时宁可明确拒绝，不提供跨模型合并或强制覆盖。

## 5. 投影只读、焦点与物料

独立的 canEditStructure 判断不修改全局 viewing。仅画布的属性／值投影禁止结构编辑；切到大纲或幕布后，隐藏的画布筛选不会锁住合法编辑。

UI 与命令入口共同保护：添加、删除、引用选择／新建词典、改名、双击、右键菜单、快捷键、拖拽、重挂、撤销及弹窗完成回调。命名弹窗在投影下只读，关闭后不接受保存。

保留选择、缩放、平移、只读展开与定位。投影的展开记录放在本地视图状态中，不修改真实节点 expanded；平移缩放不写模型画布状态。保存、发布和独立物料浏览没有通过修改 viewing 被一并禁用。

关联物料面板在两种投影中均可浏览：值投影高亮组合值节点；属性投影高亮这些值所属的属性节点；完整结构仍沿用第一轮的完整组合值高亮。历史物料选择只改变该面板的版本来源，面板明确标注画布仍是当前模型结构，不把物料快照写入草稿。

输入框保留原生 Ctrl+Z。输入合成期间 Enter 不提交词典创建。画布聚焦使用 preventScroll，并避开 segmented、select、label 等控件，修复物料面板展开后切投影被抢焦点、滚动导致点错项的问题。

## 6. 拖拽、异步和持久化语义

拖动开始捕获模型、会话、交互上下文和原结构；结束时重新校验。先在脱离响应式数据的节点候选上执行原 reparent 合法性判断，验证完成才应用父级和排序，接着记录一次历史。

一次 Ctrl+Z 恢复父级、同级顺序和原节点位置。无效目标、后代循环、非法值目标、原位操作、Escape 取消不会生成结构历史。切模型、切版本来源、切投影／编辑视图都会取消在途拖拽；拖动期间模型已有别的结构修改也拒绝继续。拖拽从不把期间独立发生的词典修改收进自己的撤销记录。

异步确认捕获发起时上下文，返回后检查 session、当前权限和目标节点。词典／新增节点弹窗绑定打开时的上下文，关闭或切换后不能借用新模型的 selected。新建模型和复制完成后也检查原上下文，避免迟到导航覆盖当前选择。

模型显式保存携带上下文校验，真正进入现有持久化协调器后再检查一次。撤销只推进已应用到内存的历史；持久化失败仍保留当前编辑态和现有未保存／错误提示，不把内存撤销重新执行一次。显式保存即使回到与发布版一致的结构，也实际尝试写盘，不提前显示虚假的成功。未增加绕过协调器的业务写入口。

## 7. 验证记录

本轮运行根目录：`work/editor-safety-round2/20261024-1042-a91f/`。所有路径以下相对该目录。

| 最终检查 | 结果／证据 |
| --- | --- |
| Chrome 真实浏览器 | 14 组通过；`chrome-accepted/result.json` |
| Edge 真实浏览器 | 14 组通过；`edge-accepted/result.json` |
| 第一轮 Chrome 回归 | 10 组通过；`round1-regression/chrome/chrome-result.json` |
| 数据保护领域检查 | 7 组通过；`domain/editor-safety-completion.log` |
| 原有命名／规划／物料／第一轮领域回归 | 通过；`domain/naming.log`、`planning.log`、`material.log`、`functional-gaps.log` |
| npm run typecheck | 通过；`domain/accepted-typecheck.log` |
| npm run build | 通过；`domain/accepted-build.log`；产物在 `domain/accepted-build/dist` |
| git diff --check | 退出码 0；仅提示 vite.config.ts 的 LF/CRLF 工作区转换约定 |

少量关键截图：`baseline-2/cross-model.png` 为修复前 B 节点丢失；`chrome-accepted/cross-model.png` 为修复后；`chrome-accepted/projection.png` 为只读值投影；`chrome-accepted/drag-restored.png` 为恢复后的结构。Edge 对应目录也保留截图。属性投影高亮由两种浏览器的实际点击及 DOM 数量／业务不变断言验证。

### 实际浏览器操作

使用 Playwright 驱动本机安装的浏览器，headless，1600×1000，zh-CN；这是真实浏览器 DOM、鼠标、键盘操作，不是调用设计器处理函数代替操作。

- Chrome：156.0.8078.47。
- Edge：156.0.4314.42。
- 跨模型排序／Ctrl+Z、A→B→A、同模型撤销、左侧切换、query 切换、总览清单的“查看”／“进入编辑”。
- 属性／值投影分别执行删除、添加快捷键、Ctrl+Z、双击、右键、实际鼠标拖动和展开折叠，业务结构与引用不变。
- 隐藏值投影状态下，大纲／幕布排序仍有效。
- 完整结构真实鼠标重挂，Ctrl+Z 恢复；再次 Ctrl+Z 无重复历史；后代和非法值目标不变化。
- Escape 取消拖动、拖动中切 query、查看模式拖动／撤销保护。
- 投影物料高亮不改变数据、不增加历史；属性和值两种高亮。
- A 的删除确认框打开后切 B，再点确认，B 不变。
- UI 创建新词典并引用；模拟另一个模型后来引用后，真实 Ctrl+Z 连续拒绝；移除后续引用后仍可撤销，独立新词典保留。
- 原生文本 Ctrl+Z；中文文本输入及合成中 Enter 不提交。
- 注入本机配额失败后，已应用的撤销不重放；重试保存和正常保存后撤销均正确。
- store 的导入／重置／删除命令配合真实 Ctrl+Z，验证旧历史失效；测试删除采用可删除的草稿 B，不绕开正式模型引用保护。

说明：query 导航、外部词典引用、导入／重置、配额故障是明确标记的测试准备／store 操作。IME 的 CompositionEvent 是模拟事件契约检查，不声称操作了 Windows 原生中文输入法。

### 领域与相关回归

- editor-safety：7 组，包括上下文拒绝、其他模型不被回滚、共享引用拒绝可重试、同名 ID、改名／取值恢复、缺失引用／ID 冲突、纯布局无历史、合法／非法引用、节点规则恢复、排队保存重新校验。
- naming：24 项通过，覆盖命名规则、历史快照与物料名称。
- planning：18 项通过，覆盖规划组合、发布版本、PLN 身份等直接链路。
- material：12 项通过，覆盖物料建档和历史关联。
- functional-gaps 领域检查通过。
- 第一轮 Chrome 浏览器回归：10 组通过。包含常用筛选外露、保存／恢复、真实锁等待、存储失败重试、跨标签页冲突、组合物料显示／两值高亮／精确 MAT 档案跳转、页面功能与反馈来源、历史／草稿组合及 4096 组合分页。

### 命令与输出隔离

没有运行串联旧审计的 npm 聚合入口。执行前检查选用脚本及本地依赖中的文件写入，额外核对动态加载的 fixture；没有调用 SKU migration/restore 脚本。

最终实际使用的环境变量：浏览器 `EDITOR_SAFETY_OUTPUT_DIR` 分别为运行根目录下 `chrome-accepted`／`edge-accepted`；第一轮脚本的 `FUNCTIONAL_GAPS_OUTPUT_DIR` 为 `round1-regression`；领域 `DOMAIN_CHECK_CACHE_DIR` 为 `domain/completion-cache`；类型检查和构建的 `CHECK_OUTPUT_DIR` 分别为 `domain/accepted-typecheck`／`domain/accepted-build`，`npm_config_cache` 为 `domain/accepted-npm-cache`。最终构建命令的 `--outDir` 是运行根目录下 `domain/accepted-build/dist`。

以下为同一组命令的复跑模板；复跑时使用新的子目录，勿覆盖上述证据。

```powershell
$env:EDITOR_SAFETY_OUTPUT_DIR='work/editor-safety-round2/20261024-1042-a91f/<新的浏览器子目录>'
$env:BROWSER_CHANNEL='chrome' # Edge 为 msedge
node scripts/browser-editor-safety.mjs

$env:DOMAIN_CHECK_CACHE_DIR='work/editor-safety-round2/20261024-1042-a91f/domain/<新的缓存目录>'
node scripts/run-domain-check.mjs scripts/editor-safety-check.ts
node scripts/run-domain-check.mjs scripts/functional-gaps-check.ts
node scripts/run-domain-check.mjs scripts/naming-check.ts
node scripts/run-domain-check.mjs scripts/planning-check.ts
node scripts/run-domain-check.mjs scripts/material-check.ts

$env:FUNCTIONAL_GAPS_OUTPUT_DIR='work/editor-safety-round2/20261024-1042-a91f/round1-regression'
$env:BROWSER_CHANNEL='chrome'
node scripts/browser-functional-gaps.mjs

$env:CHECK_OUTPUT_DIR='work/editor-safety-round2/20261024-1042-a91f/domain/<新的编译目录>'
$env:npm_config_cache='work/editor-safety-round2/20261024-1042-a91f/domain/<新的 npm 缓存目录>'
npm run typecheck
npm run build -- --outDir work/editor-safety-round2/20261024-1042-a91f/domain/<新的编译目录>/dist
git -c safe.directory=D:/单子/商城erp/mock/iyge-v2-mock diff --check
```

Git safe.directory 仅为本次命令参数，未修改全局 Git 配置。typecheck/build 的可选目录只生成引用主工程的三个小型 tsconfig 和编译缓存，不复制源码；未设环境变量时普通开发行为保持原样。

前期类型检查曾沿用工程原有的 `node_modules/.tmp` 可再生增量缓存；最终验收已切到上述隔离配置。没有重写旧审计 JSON、截图或报告。新建测试、浏览器缓存、最终构建及 npm 缓存均保留在本轮目录，不清空 work。

## 8. 修改文件与职责

| 文件 | 职责 |
| --- | --- |
| src/views/SpecConfigView.vue | 上下文、历史接入、结构命令保护、拖拽事务、异步目标和焦点／投影物料展示 |
| src/domain/editorHistory.ts | 局部 before/after、词典差异、冲突与引用校验、完整候选结果 |
| src/stores/catalog.ts | 数据替换 generation、排队模型保存前的上下文校验 |
| src/domain/outlineEdit.ts | 根级属性同级校验限定所属模型 |
| src/components/NamingRuleDialog.vue | 已关闭／只读弹窗不保存 |
| scripts/editor-safety-check.ts | 独立领域及持久化契约检查 |
| scripts/browser-editor-safety.mjs | 真实浏览器验收和故障／外部修改准备 |
| scripts/browser-functional-gaps.mjs | 第一轮脚本增加可选输出根目录 |
| scripts/run-domain-check.mjs | 领域检查可选 Vite 缓存目录 |
| scripts/run-typecheck.mjs、package.json、vite.config.ts | 可选隔离编译缓存和构建输出，不改变默认开发流程 |
| docs/functional-gaps-round2-editor-safety.md | 本报告 |

## 9. 问题、限制与保全

本轮修复了跨模型污染、整库词典回滚、投影写入入口、拖拽／画布删除遗漏历史、异步确认目标漂移、输入合成误提交以及面板展开后抢焦点的问题。

各次验收输出使用不同子目录。早期失败在终端记录，后续脚本还保存 failure.json／failure.png；没有把失败产物改写为通过。过程中的失败包括：最初未触发历史的删除尝试、忽略全局数组排列的比较方式、删除受引用保护的发布模型、假设浏览器一次文本撤销清空全部字符，以及最终发现并修复的投影切换焦点问题。

本轮已知未完成缺陷：无。已验证的范围和非系统级 IME 的限制如上，不把未测场景宣称为真实输入法验收。

仍保留的观察／边界：Vue Flow options 弃用警告；进入总览的关系图短暂报告 edge source/target 缺失（总览组件未改动，本轮未展开修复）；构建大 chunk 提示。普通 HTTP 无 Web Locks 的多标签页原子性没有增加新的保证。Windows 系统级中文 IME 候选窗没有自动化验收，测试覆盖中文文本和合成事件契约。

分类双栏、节点新增浮层、菜单配置、SKU 列拖拽、兼容关系两个既有边界继续留待后续，本轮未扩展。

第一轮两份历史测试产物原字节仍未恢复，未以新产物冒充恢复。未反复寻找备份、未生成替身结果、未覆盖旧产物。本轮完成状态不代表历史原字节已恢复，也不代表全部前端待办结束。
