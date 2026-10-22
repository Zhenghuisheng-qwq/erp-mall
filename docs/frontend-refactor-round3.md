# 前端工程重构第三轮：模型设计器

RESULT：READY。本轮限定范围的重构、历史数据对照及关键验证完成；不代表全项目均已重构。

## 基线与范围

- 分支 `20261019`；HEAD `3cfbcc0918ed8c63b35af33c8dcb02baab49089f`，未创建提交。
- 已阅读 README、`docs/商品配置闭环.md`、第一轮保护说明和第二轮报告。项目及上级目录未发现适用的 AGENTS.md。业务说明中的旧数据版本描述不作为修改依据；实际持久化版本仍为 13。
- 第二轮 5 个生产文件与 `frontend-refactor-round2-evidence.json` 的 SHA-256 全部一致。复核工具栏、筛选展示类型和手工排序状态接口，未发现需阻止第三轮的类型或状态问题。第二轮源码、检查脚本、依赖和报告均保留。
- 在改动设计器前，将 Git 跟踪文件和未跟踪成果共 **189 个文件**复制到 `work/refactor-round3/baseline/`，并从该副本运行基线构建和领域检查。依赖使用当前已安装且锁定的 node_modules，没有安装或升级依赖。
- 清单 `work/refactor-round3/baseline-manifest.json` 逐文件保存路径、字节数、SHA-256、原始 Git 状态。清单内容摘要为 `e75642c4be9525599658d903eec65318075dcb99cc5a7b67b926c0f7bc2a8c8c`。浏览器每次运行前重新验证副本哈希；**没有用 HEAD 替换第二轮未提交成果**。

## 修改与边界

| 文件 | 职责与改动 |
| --- | --- |
| `src/views/SpecConfigView.vue` | 保留模型、版本和跨区域协调，接收弹窗意图；节点编辑草稿改用领域 `nodeType` 类型，物料操作与商品等级复用明确类型。 |
| `src/components/model-editor/LegalComboDialog.vue` | 提取合法组合表格、过滤工具、版本下拉和展开物料展示。props 只接收展示数据；明确的 emits 表达勾选、标记、建档、查看意图。 |
| `src/components/model-editor/NodeHostDialog.vue` | 提取节点适用配置展示；搜索和打开状态通过原始值 v-model 回传，勾选、移除和保存由页面处理。 |
| `src/components/model-editor/comboPresentation.ts` | 提取组合行和历史物料文案的纯转换，声明只读展示类型，复用领域类型。没有缓存、业务写入或新计算算法。 |
| `src/components/model-editor/useComboSelection.ts` | 集中维护唯一的勾选数组和切换、全选、反选、清空、保留有效编号操作。保留插入顺序及过滤隐藏行仍保持勾选的语义。 |
| `scripts/browser-designer-round3.mjs` | 同一操作脚本分别启动完整基线副本和工作区；比较完整业务数据、原始持久化写入序列、画布状态、截图和浏览器诊断。 |
| `.gitignore` | 仅新增本轮本地源码副本、日志、截图目录的忽略规则。 |
| 本报告及 `frontend-refactor-round3-evidence.json` | 保存范围、检查结果、文件哈希和证据索引。 |

原来页面直接包含两个弹窗模板、组合展示转换和勾选命令；现在页面调用两个专用弹窗、一个纯展示模块和一个小型 composable。减少了页面中展示格式、选择集合操作与业务写入的交织。没有另建业务修改路径，没有传递整个 store/AppData，没有新增生产依赖。

主要事件流：`LegalComboDialog → 页面原处理函数 → store 原有入口`；节点适用弹窗同样经页面调用原领域函数。`V3MaterialActions` 保持既有实现、props、token key 和创建时机，放在一个专用插槽中。命名规则继续复用 `NamingRuleDialog`。

| 状态 | 唯一维护位置与边界 |
| --- | --- |
| 分类、产品类型、模型、路由恢复 | 页面 `leafId / activeTypeId / templateId` 与原路由 watch。 |
| 草稿和已发布版本 | 草稿节点来自 store；页面 `comboVersionId` 选择已发布组合快照。历史组合查询不回写快照。`mode=view` 保留原读取方式，不新增历史画布加载逻辑。 |
| 选中节点、编辑节点、跨视图焦点 | 页面 `selected / editingId / outlineCue`；ModelOutline 原有词典编辑状态不变。 |
| 展开折叠 | 编辑状态沿用节点 `expanded`；只读状态沿用页面 `viewClosed`；分类树、侧栏偏好维持原位置。 |
| 三种视图 | 页面 `editorMode`；节点筛选 `viewMode` 与原 watch 不变。 |
| 视口 | 原 VueFlow 实例和页面视口事件处理；不改变 frameCanvas、fitAll、缩放、平移和持久化时机。 |
| 弹窗草稿 | 词典、节点草稿、主机搜索和待选主机仍在页面；命名和物料草稿仍在原组件。新弹窗不复制草稿。 |
| 组合勾选 | 每个页面实例调用一次 useComboSelection；页面原 watch 负责模型切换清空和有效编号保留。没有新增 watch/监听/定时器。 |
| 撤销 | 页面 `undoStack`，原 pushUndo/undoOutline 和快捷键处理不动。 |

VueFlow 仍挂载在原 `.board` 内，实例 ID 仍为 `model-designer`，没有新增 key、provider 或画布实例。核心画布、布局、树操作、词典弹窗及 Esc/焦点/撤销联动保留在页面：这些代码彼此耦合，本轮不强行拆分。发布校验和版本切换 watch 的依赖、immediate、注册顺序保持不变。

DOM 层级、class、key、表格插槽和文案保持原样。组合专用 scoped 样式随组件移动；共享的 `.dict-empty`、`.insight-empty` 在仍使用它们的两个作用域内保留。既有浮层全局样式暂留原页面加载位置，没有新增 deep/important 规则。抽取时曾检测到背景外层滚动相差 1px，未以遮罩或宽泛容差忽略。

## 实际验证

环境：Windows x64、Node 22.18.0、Chrome 155.0.8059.85、Playwright Core 1.64.1；浏览器 1920×1080、zh-CN、Asia/Shanghai。采用全新非持久化浏览器上下文，没有读取或清空用户浏览器数据。时间固定为 `2026-10-22T04:00:00Z`，检查点间递增 1 秒，重新加载时固定时钟重置；ID 仍由原生成器产生。测试准备写入单独分段，实际操作写入不删字段、不排序业务数组、不忽略重复写入。

以下领域命令在基线副本和重构工作区均实际运行：

| `node scripts/run-domain-check.mjs scripts/<名称>-check.ts` | 前 / 后通过数 |
| --- | --- |
| planning | 18 / 18 |
| draft-combo | 10 / 10 |
| naming | 24 / 24 |
| combo-material-status | 42 / 42 |
| material | 12 / 12 |
| consistency | 9 / 9 |
| layout | 17 / 17 |
| round5 | 27 / 27 |
| round1 | 24 / 24 |

合计 **183 项**。round5 覆盖词典重新绑定、历史快照和节点适用关系；round1 覆盖既有选择器/身份路径等保护项。第一轮领域实现、store、ProductModelSelector、SKU 生成、ModelOutline 和画布算法文件均未修改。

- 基线：在 `work/refactor-round3/baseline/` 执行 `npm run build`，通过。
- 分步骤：提取主机弹窗、组合弹窗、勾选逻辑后分别执行 `npx vue-tsc -b`，均通过。主机弹窗另完成前后搜索、选择、保存、重开、移除、关闭的交互比较。
- 工作区：`npm run build`（包含 `vue-tsc -b`）通过；`node --check scripts/browser-designer-round3.mjs`、`git diff --check` 通过。
- 浏览器：`node scripts/browser-designer-round3.mjs --before`、`node scripts/browser-designer-round3.mjs`，最终均退出 0；38 个检查点的完整数据、原始写入序列、画布变换、节点位置/连线和焦点状态一致。
- 两份旧脚本在基线即失败：`SMOKE_URL=http://127.0.0.1:5297 node scripts/browser-layout-fix.mjs` 固定查找“100%”按钮，当前初始缩放可为 122%；`browser-round8.mjs` 使用旧节点入口，找不到“品牌”。保留旧脚本及失败日志，用新脚本覆盖本轮相关操作，没有改旧业务期望。

浏览器覆盖 38 个检查点：分类/类型/模型和路由恢复，空模型/无模型/空词典，三视图与折叠，属性和值选择、同级新增取消、节点草稿确认、调序撤销、真实拖放条件分支及撤销、删除、缩放/适配/平移/刷新；命名 token 顺序、预览、取消、继承和确认；组合预览只读、过滤、逐条勾选、全选反选、等级、批量创建/跳过已有物料；单 PLN 两条 MAT；发布成功/失败/重复发布；新条件组合、历史版本、快照保护；节点适用保存和移除；弹窗输入按键隔离与重新挂载后命令只执行一次。

第二轮集成冒烟：从设计器进入商品列表，打开已提取的视图工具并搜索“名称”字段，再返回设计器验证快捷键。未重复跑与本轮无关的全部商品列表检查。

截图场景：浅色结构、大纲、幕布、命名规则、草稿组合、已有物料展开、历史组合、节点适用配置、深色结构、空模型和无模型。**10 组逐像素一致；命名规则 1 组仅差 1 像素**：坐标 `(1322,366)`，RGBA 为 `[232,237,243,255]` 与 `[241,244,248,255]`，位于原命名 token 虚线圆角边缘。人工查看原图并逐项比较，该场景全部 481 个可见元素的几何和计算样式严格一致，NamingRuleDialog 源码哈希不变，因此按边角栅格差异记录。脚本只允许这一坐标、这一对颜色且几何/样式/源码验证全部通过的情况，不使用遮罩、区域容差或通用像素阈值；其他差异仍失败。原始数据和浏览器证据保存在 `work/refactor-round3/`，摘要为 `docs/frontend-refactor-round3-evidence.json`。

实际逐像素检查也阻止了中途的一项误判：命名弹窗未完全关闭就打开组合弹窗时，外层滚动位置会竞争，产生 1px 背景位移。补齐关闭和焦点恢复等待后，三张组合弹窗截图均为零差异；没有修改生产滚动或焦点实现。浏览器无新增错误或 Vue 警告；最终前后均只有 7 次原有 VueFlow 参数废弃提示，没有 pageerror。

## 原有行为、风险及未验证项

- 第二轮记录的 SKU 勾选重置、大包提示、旧浏览器脚本中的 ResizeObserver 提示继续作为原有问题；未夹带修复。当前对照中的 VueFlow options 参数废弃提示来自原 useVueFlow 调用。
- 实际支持的是普通 `V` 添加属性值，`Alt+V` 无操作；两者均按基线验证。发布失败当前只提示警告，没有自动定位错误节点的流程；本轮未补造该能力。
- 重复发布保留版本/PLN，但会更新画布时间。历史版本选择用于合法组合；只读模式的折叠不写草稿。刷新会执行原 frameCanvas，不能把“保存了视口参数”解释为必然原样恢复视口。本轮比较实际前后行为。
- 新脚本补齐真实 VueFlow 变换层 `.vue-flow__transformationpane` 的稳定等待，避免在缩放动画结束前拖动画布；没有改生产动画、排队或持久化实现。命名弹窗关闭后等待焦点恢复，再打开下一个弹窗。
- 没有覆盖所有屏幕尺寸、浏览器、权限组合、全部手工摆放路径和真实用户历史数据；真实 Excel 导入不在本轮范围，未验证。只有独立测试数据，未接触正式业务数据。
- 后续可单独维护旧浏览器脚本，并继续评估词典选择与焦点管理边界；paint、布局/组合性能、SKU 勾选问题应另立范围处理。

第三轮独立补丁：`work/refactor-round3/round3.diff`，按源码副本比较，仅包含本轮修改与新增文件；不把第二轮改动算入第三轮。已执行 `git apply --check --directory=work/refactor-round3/baseline -- work/refactor-round3/round3.diff`，通过，仅检查可应用性，未应用补丁。完整本地 diff 仍保留在当前工作区。未提交、推送、合并或部署。
