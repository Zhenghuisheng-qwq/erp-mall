# 第四轮：商品分类中心双栏工作区

RESULT：READY。仅代表本轮分类浏览、来源暂存及移动范围。

## 基线与边界

- 正式工程：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 分支：`20261022`；开始及结束 HEAD 均为 `3712fd1d4d32b1e5ae762991713a5f97ad1898ef`；开始时工作区干净。
- 本轮没有提交、推送、合并或部署，没有创建源码副本、审计基线、完整补丁或新 worktree。
- 本轮输出：`work/functional-gaps-round4/20261025-0010-f84d/`。下文证据路径均相对于此目录。
- 开始时检查现有页面、领域规则、持久化协调器及前三轮报告。真实 Chrome 基线见 `baseline/result.json`、`baseline/baseline.png`：旧页面已有单树搜索/展开/改名、父级选择器及 before/after/inner 领域命令；第二栏不具备对等搜索、反向拖放与独立面板关闭能力。

## 实现与交互

默认仍为单棵树加详情、查看模式。工具栏可以显式打开第二栏；编辑模式的“移动”入口也会打开第二栏并暂存来源。双栏模式默认收起详情，需要时可显式查看。

两栏读取同一份 `store.data.categories`。各组件分别持有搜索词、选中 ID、定位 ID、展开/折叠集合、滚动元素和改名输入引用。搜索结果由 `visibleCategoryRows` 生成，路径由 `categoryChain` 生成；搜索和展开只改变显示状态。DOM 查询限定在当前栏，重复显示同一分类不会把焦点或改名输入传到另一栏。

每栏有稳定实例 ID。关闭左栏会保留原右栏组件及其搜索、选中、展开和滚动状态；关闭右栏同理。只有一栏时不显示关闭按钮。重新打开的是新的、搜索为空的面板，初始选中取暂存来源或当前详情分类，不恢复已经关闭栏的旧筛选。标题按实例顺序递增。

“移动”只记录一个来源分类 ID 和来源栏 ID，同时显示实时完整路径及后代数量，不修改分类、不复制实体、不调用保存。再次选择来源会替换暂存；定位只清理并定位来源栏的搜索，其他栏不变；取消只清除暂存。来源栏关闭后，暂存仍可用于剩余栏，定位会回退到剩余栏。来源实体消失或数据导入/重置代次变化会清除暂存。

两栏均可拖出和接收分类，支持 A→B、B→A 及同栏排序。行上部和下部分别表示 before/after，中部表示 inner；用插入线、内部高亮和拒绝样式区分。状态提示预留固定高度，避免拖动过程中插入提示导致落点位移。面板滚动区边缘可自动滚动。标题、搜索框和空白区没有根移动提交逻辑。

不使用拖放时，先暂存来源，再通过鼠标或键盘 Enter 选择某栏目标，点击“确认移入”。根移动单独使用“移为根分类”。目标区域也显示来源名称，窄窗口滚动到下方时仍能确认正在移动什么。

## 领域规则与数据保护

新增 `categoryMovement.ts` 只在分类记录的临时副本上运行现有 `relocateCategoryNodes` / `moveCategoryNode`，用结构戳判断拒绝及实际无变化。真实写入仍调用现有 store 方法。页面与面板不直接 splice 分类数组或赋值 parentId；没有增加第二套业务规则或克隆整个业务数据做回滚。

拖动上下文包含来源 ID、来源栏、分类结构戳、页面代次及本次 token。drop 时重新检查编辑状态、保存状态、面板存在性、结构戳、代次、token、当前目标及现有领域规则。Escape、查看模式切换、角色变化、关闭相关面板、路由离开、卸载、结构变化、导入/重置代次变化会取消拖动。取消和真正无变化的移动不会调用实际写入或 flush。

自指、移入后代、缺失来源/目标及禁止新增子级的关联类型分类沿用现有拒绝规则。带类型的来源分类本身允许合法移动；停用分类没有新增禁移规则。原有管理员属性方案绑定权限保持不变。

移动保持来源及后代 ID，不重建子树；关联商品、SKU、模型、历史快照、方案、MAT/PLN 及绑定不随分类路径移动而重新生成。领域用例比较非分类数据，浏览器在复制操作之前也逐项比较全部非分类顶层记录。保存的 SKU 后代分类筛选仍按当前树关系解释，不改写已保存条件中的分类 ID。

## 保存失败与重试

沿用内存先更新、随后 `flushPersistence()` 的语义；成功提示在 flush 成功后出现。保存中禁止再次修改。失败时显示本页未保存提示，保留已经移动后的内存结构及来源，不恢复旧快照；禁止继续叠加新的分类修改。

“重试保存当前结果”只再次 flush，不重放 before/after/inner 命令。浏览器注入配额错误后验证：内存保持新位置，磁盘保持旧位置，连续失败重试不改变分类，成功重试只新增一次写入，刷新后分类及排序与成功前内存完全一致。原有改名、复制、创建和删除也使用相同可见错误/保存入口。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/views/CategoryView.vue` | 面板管理、来源暂存、拖放上下文、统一移动提交、保存失败重试；保留详情和原有操作 |
| `src/components/category/CategoryBrowsePanel.vue` | 每栏独立浏览状态、局部改名/焦点、原生拖放落点、边缘滚动、非拖放目标入口 |
| `src/domain/categoryMovement.ts` | 复用领域命令的纯预检及结构变化检测 |
| `scripts/category-workspace-fixture.ts` | 独立分类/长列表及关联业务 fixture |
| `scripts/category-workspace-check.ts` | 分类规则、身份保护、既有分类选择器和保存失败领域回归 |
| `scripts/browser-category-workspace-baseline.mjs` | 修改前基线记录脚本（不能拿修改后页面冒充基线） |
| `scripts/browser-category-workspace.mjs` | 隔离真实浏览器用户路径和故障验收 |
| 本报告及同名 evidence JSON | 结果、范围、限制和证据索引 |

## 验证命令与结果

以下在工程根目录运行，PowerShell 环境变量指向本轮输出根 R：

```powershell
$R='work/functional-gaps-round4/20261025-0010-f84d'
$env:CATEGORY_WORKSPACE_OUTPUT="$R/domain-1"
$env:DOMAIN_CHECK_CACHE_DIR="$R/domain-1/cache"
node scripts/run-domain-check.mjs scripts/category-workspace-check.ts

$env:DOMAIN_CHECK_CACHE_DIR="$R/regression/cache"
$env:ROUND3_OUTPUT="$R/regression"
node scripts/run-domain-check.mjs scripts/functional-gaps-round3-check.ts
node scripts/run-domain-check.mjs scripts/editor-safety-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts

$env:CATEGORY_WORKSPACE_OUTPUT="$R/final-chrome"
$env:BROWSER_CHANNEL='chrome'
node scripts/browser-category-workspace.mjs
$env:CATEGORY_WORKSPACE_OUTPUT="$R/final-edge"
$env:BROWSER_CHANNEL='msedge'
node scripts/browser-category-workspace.mjs

$env:CHECK_OUTPUT_DIR="$R/final-build"
npm run build -- --outDir work/functional-gaps-round4/20261025-0010-f84d/final-build/dist
git -c safe.directory=D:/单子/商城erp/mock/iyge-v2-mock diff --check
```

命令按类别列出；Edge 实际执行早于最后一次 Chrome，最后 Chrome 额外增加了暂存定位/取消零写入断言与窄窗口目标区截图，未改变产品代码。

- 分类领域 9 组 PASS：前后排序、完整子树、根移动、带类型来源、非法目标原子拒绝、无变化/取消、停用来源、动态 SKU 后代筛选、真实 store 保存重试。`domain-1/result.json`。
- 相关既有分类检查：在新增脚本内实际调用 `runCategoryTreeSelectChecks` 和 `runProductListCategoryChecks`，PASS。不运行会读取个人 live-db 并生成备份的 `category-fix-check.ts`。
- 第三轮功能回归 11 组 PASS：`regression/round3.log`、`regression/domain.json`。
- 设计器安全回归 7 组 PASS：`regression/editor-safety.log`。
- SKU 查询回归 PASS：`regression/sku-query.log`。
- `npm run build` 先执行 vue-tsc，再生产构建，均退出 0：`final-build/build.log`。存在部分 chunk 大于 500 kB 的构建提示，未扩展本轮范围处理包拆分。
- `git diff --check` PASS，结束 HEAD 未变化。

### 实际浏览器范围

Chrome **156.0.8078.47**，Edge **156.0.4314.42**，均是安装的真实浏览器、headless、独立 context、隔离 fixture/localStorage，不读取或修改个人浏览器数据。两者 11 组全部通过，无 pageerror、console warning/error。

覆盖默认单栏/查看、两栏独立搜索和展开、来源暂存、A→B/B→A inner、跨栏 before/after、同栏排序、重复无变化零写入、非法后代及类型目标、Escape、外部数据代次变化、查看模式取消、关闭拖动目标、标题区域不提交、长列表边缘滚动、关闭任一栏保留另一栏状态、键盘非拖放移动、配额失败/连续重试/刷新、同节点局部改名、复制子树、删除保护、属性方案入口、明暗主题、1700×1100 与 800×950 窄窗口、键盘移为根分类。

拖动通过 Playwright dragTo 和 mouse down/move/up 触发浏览器 HTML5 原生事件；没有调用页面 onDrop 或 store.relocateCategory 代替 UI。浏览器原生拖动占用鼠标期间，切换查看模式和关闭目标栏使用真实 DOM 控件的 element.click() 来触发并发上下文变化；这两项不是鼠标物理点击验收。外部代次变化和 Storage.setItem 配额错误为明确测试注入。读取 store/localStorage 仅用于断言。

最终证据：`final-chrome/result.json`、`final-edge/result.json`；两目录的 `dual-dark.png` 与 `dual-light-narrow.png`，以及 Chrome `narrow-target.png`。窄窗口页面有内部主区滚动，因此目标面板单独滚动后截取，不把首屏截图当成全部页面可见的证据。

### 实际发现与修复记录

- 首次类型检查发现模板 command 参数隐式 any，补充类型后通过。
- 首次浏览器检查发现落点提示插入改变树位置，inner 实际变为 before；固定提示区高度后通过。
- 原生拖动期间常规鼠标点击模式按钮不能完成，测试改为上述 DOM 控件激活，保持真实拖动。
- 增加边缘滚动后，关闭栏滚动断言曾读到尚未结束的 wheel 值；等待滚轮稳定后再采样。
- 拖动后的防误点时间窗也拦截了立即键盘选择，修正为键盘不受防误点击时间窗限制，仍禁止拖动中选择。
- 双栏受全局相邻 panel margin 影响产生高度错位，本页局部清零后检查截图对齐。
- 失败尝试的 result JSON 保留，重复截图和可再生成缓存/构建产物定向清理，不覆盖或删除前三轮输出。

## 限制与历史说明

未运行 Firefox/Safari、触摸设备、实体设备/DPI 矩阵及人工有头浏览器操作。路由离开/卸载的取消由代码检查确认，未单独增加对应原生拖动浏览器断言；缺失来源/目标通过领域断言，导入/重置取消通过代次故障注入验证。属性方案入口检查其存在和原编辑弹窗，不扩展执行方案设计器全流程。

历史 `work/sku-workbench-fixes/migration/after-result.json` 和 `work/sku-workbench-fixes/restore-after.json` 原始字节仍未恢复；本轮未寻找替身，也不宣称补回历史验收。本轮证据仅代表本次 fixture 与当前代码。

本轮结束，不继续节点新增浮层、SKU 列拖拽、菜单配置或其他模块改造。
