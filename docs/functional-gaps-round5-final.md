# 前端交互收尾：第五轮实现与验证

RESULT：READY，仅覆盖本轮 A / B / C 固定范围。

## 1. 工程与执行记录

- 工程：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 实际分支 `20261022`；开始 HEAD `b8fa90ff9460c39e6df4311b0a3eae4a6c0bfd89`，结束 HEAD 相同。初始 `git status --short` 为空，无既有未提交或未跟踪成果。
- 已读取 README、package.json、四轮实现报告；工程与适用祖先路径未发现 AGENTS.md。保留原有演示数据/localStorage、业务身份及历史规则。
- 按 A 实现及直接回归 → B 实现及直接回归 → C 实现及直接回归 → 统一验收的顺序完成。没有升级依赖、复制源码、创建审计基线或 worktree。
- 没有提交、推送、合并或部署。
- 本轮运行根目录：`work/functional-gaps-round5/20261025-f31a/`，以下证据路径均相对此目录。全部浏览器使用独立 context 和隔离 fixture，不访问个人浏览器数据或个人 live-db。

## 2. A：节点旁新增属性与值

### 沿用与新增

新增局部组件 `NodeAddPanel.vue`，替换设计器属性和值选择器的两个居中弹窗承载。内容继续使用原有词典选择、多选、搜索、创建并引用和全局改名确认。`openAttributeAt`、`openValuePicker`、`openBindAttribute`、`createDictionaryAttribute`、`createDictionaryValueForNode`、`addAttribute`、`addValues` 仍负责既有结构命令。

面板标题区分添加属性、子属性、条件属性、属性值和已有属性引用。画布、同级/子级入口、大纲、幕布继续走原事件和快捷键，不改变 Enter、Tab、取值快捷键的结构语义。一次只开一个属性/值选择面板。取消、搜索和勾选不创建业务实体；确认才调用原合法命令，批量值添加仍形成一次结构历史。

### 锚点与输入

画布使用实际 `.vue-flow__node[data-id]`，大纲/幕布使用当前行 `[data-line]`；保存触发行 ID，避免同级添加误用父节点作为视觉锚点。无具体节点的根入口回退工作区元素。面板读取 `getBoundingClientRect()`，不把模型坐标当像素。打开期间跟随真实 DOM 矩形，因此缩放、平移及滚动后会重新定位；超出可见工作区或 DOM 消失时关闭。

靠右时放到节点左侧，位置限制在视口留白内，内容区可滚动，头部和操作区保留。窗口小于 760px 时使用居中轻量面板后备，宽度不超过视口减 24px。没有改变设计器原有三栏结构；700px 下背景业务区仍较拥挤，本轮只保证新增面板可操作。

面板阻止指针、滚动和快捷键冒泡给画布，但不 preventDefault 文本 Ctrl+Z。沿用输入合成检查，合成中的 Enter 不创建。Escape 仍由原词典逻辑优先关闭内层下拉，再关外层。词典下拉 teleport 到 body，仍可操作；本轮不使用粗糙的外部点击自动关闭逻辑。关闭时尝试将焦点返回原节点或行。原仅查询 `.el-dialog` 的下拉/输入保护已包含 `.node-add-panel`。

### 上下文与撤销保护

原有 `editContext / validContext / dialogContexts / validDialog / canEditStructure` 保留。新增面板上下文记录实际操作目标，而非回调时当前 selected；开关面板推进交互代次，旧确认无法借用重新打开面板的上下文。模型、会话、投影/编辑视图、版本来源、权限、目标节点和导入/重置失效会关闭或拒绝确认。选择器的暂存父级/绑定 ID 沿用原命令，确认时再次核对。

本轮没有新建宽松的撤销框架，也没有改写 `editorHistory`。共享词典已被其他模型/历史引用时，撤销仍会保守拒绝并提示；这不等于普通批量结构添加需要逐条撤销。新增词典值会真实引用现有属性，不产生未绑定占位，不发布模型、不分配 PLN、不创建 MAT。

## 3. B：SKU 展示字段与排序暂存

### 字段拖动和三层状态

字段行新增明确手柄，只有手柄 `draggable=true`。复选框、列宽、冻结选择器和上下按钮不是拖动入口。上半行/下半行分别为 before/after，显示插入线。Escape 取消在途拖动；原位/无效目标不换数组。

`skuColumnOrder.ts` 使用稳定字段 key，在完整 `draft.columns` 上移动。搜索列表只是投影，不会拿筛选结果覆盖完整数组；其余字段保留相对顺序，对象中的宽度、visible、frozen 和动态属性身份全部保留。上下按钮继续可用，至少显示编号或名称、最多冻结两列等原校验没有删除。

三层状态保持不变：弹窗独立草稿 → 原工作台 apply 更新当前工作配置 → 保存/另存正式视图。取消弹窗不应用；保存失败仍由原工作台保留工作配置及错误，可重试。没有增加绕过持久化协调器的商品写入口。分组、排序条件、常用筛选、分类子树条件和窄窗口冻结降级沿用原实现。

### 暂存显示和保护策略

暂存按全量 `store.data.skus` 和 SPU 解析，展示 SKU 名称、编号、SPU 和既有 `skuFieldValue(...,'spec')` 规格摘要，使用原身份工具 `isRealSku` 排除 MAT。长内容截断并提供完整 title。已删除或不再是销售 SKU 的记录显示失效，可安全移除；不使用名称匹配记录。

策略明确为：**普通结果/搜索/条件变化保留暂存；插入时重新校验当前结果范围与 SKU 身份**。因此跨页保留、每次搜索输入不弹确认，暂存落在筛选外时提示并阻止插入，用户可以调整筛选或移除该项。

视图和 SPU 范围等明确切换，先用既有 `confirmStage(false)` 询问；取消时原视图、范围和暂存保留。真正切换成功后 watcher 才清理，保存失败或路由切换未完成不提前清空。离开页面、另存/新建/复制/删除视图也走相关保护。

插入确认捕获来源 ID 列表及视图/范围上下文，防止等待时换上下文；增加在途防重复提交。真实插入仍调用原 `insertManualIds`、`workbench.apply`，成功后仅移除本次已插入暂存，失败保留。重试是原幂等移动/插入规则，不生成重复 SKU 或修改业务记录。未重写行勾选或手工排序算法。

## 4. C：受控菜单与当前中心布局

### 注册表与唯一入口

`menuPageRegistry()` 以现有默认正式页面清单作为受控、无需必填业务参数的入口注册表。新增中心/分组可持久化；页面选择是恢复显示或调整规范入口父级，不生成新路由、组件或任意 URL。

页面保持原 `page:<route>` ID，一个正式页面一个入口。未知地址、javascript/external URL、非法父级、重复 ID/路由、页面作为父级及非法层级在保存/命令入口被拒绝。中心只能在根，分组只能在中心下，页面只能在中心或分组下。

加载旧数据仍先规范化：保留默认节点的标题、顺序、隐藏和角色定制及旧 products→SPU/SKU 迁移；保留自定义中心/分组。重复规范 ID 取第一条；陌生 ID 的同路由副本不被提升为第二套权限入口。原规范入口缺失时补系统规范入口，不按名称合并。存储格式仍为 version 1，没有清空升级。

删除只允许自定义空容器；有子菜单时明确要求先改挂，不静默丢失页面。恢复默认只删除菜单配置键，不重置商品、SKU 视图或其他业务数据。菜单保存/恢复异常显示错误并保留草稿，成功提示在存储成功后出现。

### 权限与安全入口

页面及父级中心/分组的角色共同限制访问，隐藏继续只影响菜单展示，不等同禁止直接链接。meta.admin 的已注册页面在菜单层保持管理员上限，路由原 meta.admin 守卫不变；菜单配置页自身也检查管理员状态。预览通过同一 `railModel` 投影生成，空容器不显示。

管理员始终有菜单配置恢复入口，`/menus` 管理员访问不会被菜单自定义锁死。该入口使用 router 导航，保留 SKU 暂存等离开守卫。运营没有恢复入口，直接打开菜单配置或管理员属性方案页面会被路由拒绝。前端演示权限仍不是服务器授权系统。

### 当前中心单菜单

导航设置新增“仅当前中心菜单”，保留原单栏合并导航和双栏导航。新模式不显示左侧中心轨道，只显示当前中心的页面/分组；顶部原生下拉切换到目标中心第一个可见入口。折叠时提供轻量当前中心菜单，仍可切中心。

布局偏好 `center` 与 collapsed 分开保存；普通折叠不覆盖布局。旧 single/dual/icons 偏好兼容，temporaryCompact 不持久化为正式布局。路由归属统一提取为 `menuRouteForLocation`，处理 SPU/SKU/物料/权益包详情及 columns query，匹配路径分段边界而非任意相似前缀。当前中心不可见时回退第一个可见中心；没有可见菜单时显示明确空态，管理员仍有恢复入口。

## 5. 修改文件与职责

| 文件 | 职责 |
| --- | --- |
| `src/components/model-editor/NodeAddPanel.vue` | 局部节点浮层定位、窄屏后备、焦点和内容滚动 |
| `src/views/SpecConfigView.vue` | 替换承载，捕获锚点/实际目标，失效关闭及输入保护 |
| `src/domain/skuColumnOrder.ts` | 稳定 key 的完整字段数组 before/after 移动 |
| `src/components/product-list/sku/SkuDisplayDialog.vue` | 手柄、插入提示、Escape/无变化保护 |
| `src/components/product-list/useProductListManualOrder.ts` | 延迟清理确认、插入上下文及重复提交保护 |
| `src/views/SkuWorkbenchView.vue` | 暂存业务标签、范围校验、视图/范围离开保护 |
| `src/domain/menuConfig.ts` | 自定义中心、规范页面、验证/迁移、父级权限及恢复路径 |
| `src/views/MenuConfigView.vue` | 受控新增 UI、管理员限制、失败保留草稿 |
| `src/layouts/navigationPreferences.ts` | center 偏好兼容 |
| `src/layouts/RailNav.vue` | 当前中心布局、切换、折叠与管理员恢复入口 |
| `src/layouts/AdminLayout.vue` | 复用统一页面归属规则 |
| `scripts/browser-editor-safety.mjs` | 两处标题选择器兼容旧弹窗/新面板，其余旧保护断言不变 |
| `scripts/functional-gaps-round5-check.ts` | 新字段排序及菜单/权限/偏好领域检查 |
| `scripts/browser-functional-gaps-round5.mjs` | A/B/C 贯通及 A 补充真实浏览器检查 |
| 本报告及 evidence JSON | 范围、执行结果及证据索引 |

原有 `scripts/round5-check.ts`、`scripts/browser-round5.mjs` 属于早期其他轮次，名称冲突发现后已从当前 HEAD 恢复，新检查使用 functional-gaps 命名，不覆盖旧脚本。

## 6. 实际验证

### 领域、类型与构建

| 检查 | 结果与证据 |
| --- | --- |
| 新字段排序/菜单检查 | PASS，`regression/functional-gaps-round5-check.log`；完整数组、动态 key、宽度/冻结、无变化、非法菜单、旧定制、权限、偏好 |
| 设计器安全领域 | PASS，7 组，`regression/editor-safety-check.log` |
| 第三轮分类与兼容 | PASS，11 组，`regression/functional-gaps-round3-check.log`、`regression/round3/domain.json` |
| 第四轮分类双栏领域 | PASS，9 组，`regression/category/result.json` |
| SKU 查询 | PASS，`regression/sku-workbench-query-check.log` |
| SKU 状态 | PASS，`regression/sku-workbench-state-check.log`，含工作/保存/恢复、失败重试和字段元数据 |
| 原导航/筛选 | PASS，`regression/navigation-filter-check.log` |
| 类型检查 | A/B/C 分阶段及最终 build 内 vue-tsc 均 PASS |
| 生产构建 | PASS，`build/build.log` |
| git diff --check | PASS，结束 HEAD 不变 |

执行旧脚本前检查写文件位置；第三轮和第四轮显式设置输出目录。未执行读取个人临时数据库的历史分类修复脚本、旧历史聚合入口或旧 migration/restore 输出脚本。

### 真实浏览器

- Chrome `156.0.8078.47`：完整贯通 **11 组 PASS**，`final/chrome-3/result.json`。
- Edge `156.0.4314.42`：相同完整贯通 **11 组 PASS**，`final/edge/result.json`。
- 设计器既有保护：Chrome 14 组 PASS（`stage-a/browser/result.json`），最终产品代码 Edge 14 组 PASS（`regression/editor-edge/result.json`）。包含模型切换、发布/投影只读、共享词典、原生 Ctrl+Z、合成 Enter、异步确认、配额失败、导入/重置。
- A 补充 Chrome：新词典值创建及共享历史撤销拒绝、大纲/幕布真实添加、100% 缩放、原生平移和滚动定位，以及真实切换模型后模拟迟到旧 DOM 确认的拒绝，共 7 组 PASS，见 `final/a-extra-3/result.json`。
- 均 headless，本机实际浏览器。桌面 1700×1100，设计器后备 700×900，导航明亮窄窗 800×950；旧保护脚本使用其原视口。

贯通从设计器节点入口开始，经新增/撤销、只读投影、SKU 字段拖动应用/另存/恢复、跨页暂存和插入、取消视图及 SPU 切换，再到菜单新增/改挂/保存、当前中心布局、刷新保存视图、角色检查及菜单恢复。字段拖动使用 dragTo 和 mouse down/move/up/Escape；新增、保存、菜单切换使用真实 DOM 控件，没有调用页面处理函数冒充用户操作。

故障准备明确区分：配额错误包装 Storage.setItem；会话失效修改 editorGeneration；删除暂存 SKU/目标节点模拟外部变化并恢复仅该 fixture 实体；旧保护脚本部分路由切换由 Router 触发；A 补充用例在真实模型切换后激活已脱离 DOM 的旧确认按钮，明确作为迟到事件故障模拟，并非正常新增验收。系统输入法检查是 CompositionEvent 合约测试，不声称操作了 Windows 原生候选窗。

已查看代表截图：最终双浏览器目录下 `node-panel.png`、`node-panel-narrow.png`、`sku-workbench.png`、`current-center.png`、`navigation-light-narrow.png`。面板主题沿用现有变量，当前中心模式没有左侧中心轨道；窄窗保留字段表格横向滚动和原冻结降级。

### 实际命令

下面列出入口和输出变量；复跑请使用新的唯一目录，不覆盖本次证据。

```powershell
$run='work/functional-gaps-round5/20261025-f31a'
$env:DOMAIN_CHECK_CACHE_DIR="$run/regression/cache"
$env:ROUND3_OUTPUT="$run/regression/round3"
$env:CATEGORY_WORKSPACE_OUTPUT="$run/regression/category"
node scripts/run-domain-check.mjs scripts/functional-gaps-round5-check.ts
node scripts/run-domain-check.mjs scripts/editor-safety-check.ts
node scripts/run-domain-check.mjs scripts/functional-gaps-round3-check.ts
node scripts/run-domain-check.mjs scripts/category-workspace-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-state-check.ts
node scripts/run-domain-check.mjs scripts/navigation-filter-check.ts

$env:ROUND5_STAGE='ALL'
$env:ROUND5_OUTPUT="$run/final/chrome-3"
$env:BROWSER_CHANNEL='chrome'
node scripts/browser-functional-gaps-round5.mjs
# Edge 同入口：BROWSER_CHANNEL=msedge，ROUND5_OUTPUT=$run/final/edge
# A 补充同入口：ROUND5_STAGE=A，使用单独输出目录。
$env:EDITOR_SAFETY_OUTPUT_DIR="$run/regression/editor-edge"
$env:BROWSER_CHANNEL='msedge'
node scripts/browser-editor-safety.mjs

$env:CHECK_OUTPUT_DIR="$run/build"
npm run build -- --outDir work/functional-gaps-round5/20261025-f31a/build/dist
git -c safe.directory=D:/单子/商城erp/mock/iyge-v2-mock diff --check
```

### 过程失败与修正

- 实际发现并修正节点浮层层级高于词典 teleport 下拉，导致选项被遮挡的问题。
- 补强面板开关交互代次，避免关闭后重新打开沿用旧确认上下文；保留管理员菜单恢复入口的路由离开守卫。
- 新浏览器脚本多次定位失败来自 Element Plus 隐藏 input、按钮实际名称、动画退出、同名视图按钮和折叠/弹出两种动作；修正真实 DOM 定位后重跑，没有放宽业务断言。
- 新值撤销用例最初误期望已发布共享词典可直接回滚，检查实际保护提示后改为验证既有原子拒绝，未弱化业务保护。
- 一次在浏览器运行期间生成 typecheck tsconfig 触发 Vite 配置更新提示，最终验收与最终构建分开运行。
- 早期失败结果 JSON 保留，重复截图、缓存、dist 和增量编译文件仅在本轮目录内定向清理。

## 7. 限制、历史证据与固定待办

固定待办 A 节点邻近新增、B 字段拖动与暂存、C 受控菜单与当前中心布局均已完成；四轮领域/数据保护回归通过。未增加 redo、自由 BOM、商品算法、动态页面生成器、后端或其他新优化轮次。

未验证 Firefox/Safari、触摸设备、Windows 原生 IME 候选窗、物理设备/DPI 矩阵。设计器窄窗背景三栏仍保持原结构；本轮不做全站响应式重构。旧 Vue Flow options 弃用提示及部分概览边初始化警告仍可出现，最终新贯通无 pageerror；构建保留大 chunk 提示，没有扩展包拆分。

第一轮两份历史证据 `work/sku-workbench-fixes/migration/after-result.json` 和 `work/sku-workbench-fixes/restore-after.json` 原字节仍未恢复，没有以本轮结果冒充恢复。此前被用户删除的历史 work 证据也未重建。本轮仅保留必要摘要、关键截图和报告，没有源码镜像或 node_modules 副本。

READY 不代表真实后端、支付、库存等全部 ERP 能力上线。本轮完成后停止；不提交、推送、合并或部署。
