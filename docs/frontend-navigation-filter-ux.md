# 侧边导航与商品筛选体验优化

RESULT：**READY**。2026-10-22 完成。本轮导航、分类、筛选一致性及累计业务回归已实际通过；没有扩大到设计器、SKU 生成、规划对账或物料算法。

## 基线、保留成果与审查

- 实际分支：`20261022`。开工 HEAD：`5e6e74e2c1997b2ffe58f3473bd5be2f660bc64c`，最初工作区干净。SPU/SKU 拆页及前四轮性能、组件重构已经包含在该提交中。
- 已检查项目及父目录，未找到适用的 AGENTS.md。阅读 README、业务说明、SPU/SKU 报告及现有检查入口；历史说明中的旧数据版本以当前源码的版本 14 为准。
- 开工完整源码快照：`work/navigation-filter/baseline/`；文件清单及状态：`work/navigation-filter/baseline.json`。快照复制 tracked 与 untracked 源文件，没有覆盖原目录。记录中的 `?? work/` 是刚创建的本轮快照目录；创建前已检查工作区干净。
- 工作期间，外部操作于 21:10:27 将 HEAD 推进至 `2dbefc0c1c05902cd3d094099a13b11c7f889c62`，提交包含本轮部分中间改动。本代理未执行 commit、push、merge 或部署；保留该提交并在其上继续验证与修正，没有回退。
- 审查累计本轮改动用 `git diff 5e6e74e2c1997b2ffe58f3473bd5be2f660bc64c`；普通 `git diff` 只显示外部提交之后的收尾改动。最终完整补丁、状态及哈希清单见 `work/navigation-filter/navigation-filter-full.diff`、`final-status.txt`、`final-evidence.json`。
- 最终 HEAD 仍为 `2dbefc0c1c05902cd3d094099a13b11c7f889c62`；相对该提交有 9 个已跟踪文件修改和 1 份新增报告，均未暂存。累计开工基线改动共 16 个文件。
- 商品数据仍为版本 14，存储键 `iyge-v2-mock-db` 不变。规划、草稿组合、SKU 生成、V2 选择器、物料、兼容关系、核心设计器、路由与角色权限逻辑均未修改。

## 已确认的问题与修改

| 文件 | 原问题 / 本轮职责 |
|---|---|
| `src/layouts/RailNav.vue` | 删除顶部缩小、布局仅图标、底部展开菜单、二级固定/取消固定及独立收起之间的重叠逻辑。用布局、收起状态、临时分组和层级展开记录控制导航；删除悬停定时器及 pin 的持久化。保留原菜单层级、配色和权限过滤结果。 |
| `src/layouts/navigationPreferences.ts` | 新增只针对导航配置的纯迁移函数，校验格式及可访问分组；不读取或改写商品数据。 |
| `src/views/ProductListView.vue` | SPU/SKU 共用一致的搜索、分类、更多筛选、条件摘要和次级列表设置。移除窄屏下只有按钮没有面板的分支；条件、分页及视图继续由原页面偏好维护。 |
| `src/components/CategoryFilterTree.vue` | 只负责搜索、展开、选择、明确清除及关闭面板；删除停靠左侧/回到顶部事件和布局状态。 |
| `src/components/product-list/ProductListViewTools.vue` | 集中提供“常驻分类栏”；保留列、分组、排序、手工排序和全部视图管理功能，入口改为“列表设置”。 |
| `src/components/product-list/ProductListFilterDialog.vue` | 明确“即时生效”，将“外露”改为“显示在常用筛选”；适配窄窗口换行；条件仍通过原事件即时写入当前查询。 |
| `src/components/product-list/filterPresentation.ts` | 新增纯派生摘要和快捷控件可表达性判断，不复制条件状态、不修改输入；不把同字段 AND 条件合并成 OR。 |
| `scripts/navigation-filter-check.ts`、`browser-navigation-filter.mjs` | 迁移、复杂条件、不可变性、浏览器流程、基线查询及无关页面视觉对照。 |
| `scripts/browser-ui.mjs`、`browser-4e.mjs` | 将现有检查改为操作新版设置入口；分类条件、结果顺序、刷新、暂存区及业务数据断言保留。等待真实弹层过渡完成后操作。 |
| `scripts/check-frontend.mjs`、`package.json`、`.gitignore`、`README.md` | 复用统一入口，增加本轮检查，忽略本地快照和截图；无依赖新增或升级。 |

验收中定位并修复了新增布局造成的两处问题：列表设置内容受 flex 压缩，使拖动准备期间列滚动位置变化，事件实际从 `template` 而非目标 `brand` 开始；固定子项收缩策略、限制列滚动区后，实际 dragstart/drop、列顺序、刷新恢复全部通过。面板下移后底部可能超出视口，已配置 Popper 边界。点击弹层关闭采用 `hide-after=0`，消除旧的延迟关闭与再次打开竞争，不改筛选生效时机。

视觉检查另外发现原分组标题引用不存在的 `--surface-muted`，深色主题落回浅色背景而文字仍为浅色。仅将其纠正为项目已有的 `--app-surface-muted`，明亮主题颜色不变；最终截图和深色文字对比度检查通过。

## 最终导航规则与迁移

持久化键仍为 `iyge-nav-layout`，内容为 `{ layout: 'single' | 'dual', collapsed: boolean, openeds: string[] }`。`openGroup` 和导航设置弹层仅在组件内存在，刷新不恢复。

- 顶部按钮唯一控制导航展开/收起，标题及 aria-label 为“收起导航 / 展开导航”。
- “导航设置”仅选择单栏或双栏，不改变 collapsed。新用户默认单栏展开。
- 展开单栏保留文字、层级、键盘操作及原层级展开记录；双栏点击分组切换常驻内容，鼠标划过及点击页面内容不会切换或关闭它。
- 收起时点击图标打开临时浮层，另一个图标切换、再次点击同一图标关闭。访问页面、外部点击、Esc 关闭浮层，保持收起。浮层固定定位，不挤内容，有限高和滚动；窗口变化重算边界。
- Esc 优先留给正在操作的 Element Plus 弹窗、下拉层及输入框。导航自身 Esc 关闭后焦点回到相应图标；方向键可切换图标、进入和退出链接区。保留原生链接 Ctrl 新标签页行为。
- 路由变化清理临时状态，展开时定位当前分组；仅持久化用户偏好，导航操作不写商品库。

| 旧配置 | 新结果 |
|---|---|
| `mode=single` | 单栏展开 |
| `mode=dual`，`menuOpen` 非 false | 双栏展开 |
| `mode=dual, menuOpen=false` | 双栏偏好、收起；避免恢复一个没有二级面板的半展开状态 |
| `mode=icons` | 保持收起，按 `expandedMode` 恢复 single/dual；旧版本缺少 expandedMode 时沿用旧默认 dual |
| `pinned` | 不恢复、不写入新配置，不生成遗留浮层 |
| `openeds` | 保留合法可访问的分组及子分组，去重并滤掉失效/无权限记录；路由定位补齐当前层级 |
| 缺失、损坏、非法配置 | 单栏展开，安全定位当前页面 |

迁移只访问导航自己的 key；没有清空 localStorage 或改写其他视图体系。

## 分类与筛选状态

唯一条件源仍为当前视图 `spuQuery / skuQuery` 的 `keyword`、`filters`。分类树、快捷筛选、摘要、高级弹窗全部读写该源，无多份 categoryIds 或同步 deep watch。

- 默认顶部“商品分类”打开弹层；常驻时只有左栏选择控件，顶部显示摘要。“收起分类栏”是临时展示状态；关闭浮层或侧栏不清条件。
- 原 `sidebar` 偏好保留；原 `popover` 和 `hidden` 都可从顶部打开，不强制改写历史配置。新设置只写 sidebar/popover。
- 小于 960px 自动用浮层，回宽屏恢复 sidebar 偏好；不修改已保存的 categoryFilterLayout，也不清筛选。
- 去掉原“category 外露项误进入日期控件”的模板分支。用户选定的其他常用字段仍保留；默认分类、品牌、适用状态及 SKU 所属 SPU 可用。
- 只有零条或一条可准确表达的同字段条件才提供快捷控件。多个等值、排除、before/after 与范围组合等显示“高级条件”，原数组、ID、顺序及 AND 关系不变；没有静默去重。
- 摘要按实际操作符描述关键词、任一多选、排除、文本、日期及开放边界。未填写的 before/after 在原查询中会排除全部结果，摘要明确说明，不擅自更改这个业务规则。
- 删除单个摘要只删除对应条件或关键词；“清空筛选”只清当前页关键词及 filters，保留列、排序、分组、手工顺序、常用字段和当前 SPU 范围。范围通过“查看全部 SKU”独立退出。
- 无筛选不渲染摘要行；空结果仍有条件及清空入口。原查询函数 `productListQuery.ts` 和视图命令 `productListViews.ts` 未修改，父分类不包含子类等规则原样保留。

## 实际验证

环境：Windows，Node 22.18.0，项目 playwright-core 1.64.1，Chrome 155.0.8059.85。独立浏览器上下文，不访问或清空日常数据。业务时间固定为 `2026-10-22T04:00:00Z`，UI 的 Date.now 继续走时；比较保留 ID、关联、数组顺序和完整业务对象。

开工检查：`npm run check:frontend` 原 10 个入口全部通过；`npm run check:integration` 的 4a–4e 及 13 个业务检查点全部通过。原始证据为 `before-domain.log`、`before-integration.log` 和 `before-integration/`，没有改成最终结果。

以下路径均相对于 `work/navigation-filter/`：

| 实际执行命令 | 结果 / 证据 |
|---|---|
| `npm run typecheck` | 通过，`typecheck.log` |
| `npm run build` | 通过，`build.log`；保留已有大包提示 |
| `npm run check:frontend` | 11 个入口全部通过，含原规划、草稿组合、物料、列表、设计器领域检查、SPU/SKU 和本轮纯函数检查；`domain.log` |
| `npm run check:navigation-filter` | 纯函数检查及 9 个浏览器流程检查点通过；`navigation-filter.log`、`browser/result.json` |
| `npm run check:integration` | 4a–4e 和 13 个业务检查点通过；`integration.log`、`integration/result.json`、`integration/states.json`、`integration/diagnostics.json` |
| `npm run check:spu-sku` | 19 组领域检查及 12 个浏览器流程通过；`spu-sku.log`、`spu-sku/result.json` |
| `node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict --types node scripts/navigation-filter-check.ts` | 新检查严格类型检查通过，`check-types.log` |
| `git diff --check` | 通过；累计基线 diff 同样检查 |

最后一次全量集成及 SPU/SKU 检查后，仅修正了分组背景的主题变量；最终源码已再次运行本轮浏览器（含深色文字对比度）、类型检查和生产构建。全量业务结果复用对应未再变更的逻辑，不将它们称为样式修正后的重新执行。

本轮浏览器覆盖：

- 单/双栏的全部角色可见链接集合、实际路由进入；展开/收起/再次展开、图标切换、重复点击、外部点击、方向键、Enter、Esc 和焦点；展开时悬停不切换菜单。
- Ctrl 新标签页、前进后退、直接路由、刷新及当前高亮；旧导航配置/损坏配置；管理员、运营菜单及禁止页面守卫；导航布局操作商品库写入次数为 0。
- 分类搜索、多选、取消、清除、常驻与浮层、关闭后摘要；快捷与高级条件共同状态；取消常用字段展示仍保留有效摘要。
- 多条同字段条件、排除及日期范围不被压缩；单标签删除、空结果、清空范围边界；两页独立及指定 SPU 上下文；全业务对象前后一致。
- 1600×1000、1100×900、900×900、780×900；跨越 960 断点不丢偏好或条件，分类浮层边界及底部操作可用。
- 原检查继续覆盖列拖动、隐藏、保存视图、排序、分组、分页、286 条手工排序、筛选预设、刷新，以及发布、PLN 沿用/新增、同 PLN 多 MAT、历史快照保护和设计器生命周期。
- 同一完整夹具分别送入开工快照与最终代码，比较两页 10 组查询结果，包含父分类、多条件、排除和单边日期范围，完整对象及顺序相同：`browser/query-comparison.json`。

## 截图和诊断

截图目录：`work/navigation-filter/browser/`。已实际查看主要截图，保留原配色、字体和组件风格。

- `navigation-single.png`、`navigation-dual.png`：两种展开导航。
- `navigation-collapsed-flyout.png`：收起图标和临时菜单。
- `filters-summary-advanced.png`：复杂条件摘要及管理入口。
- `category-sidebar.png`：常驻分类栏。
- `list-narrow-desktop.png`、`category-popover-900.png`、`category-popover-780.png`：较窄桌面及低于断点的实际操作。
- `filters-dark.png`：深色主题。
- `account-before.png`、`account-final.png`：相同旧双栏偏好下的无关账号页内容，1264×911，差异像素 **0**；数据在 `visual-comparison.json`。

常规 pageerror / console error / Vue warning 诊断为空。额外监听原生 window error 后，完整导航路由/刷新/展开流程在开工快照和最终代码中各出现 1 条同样的 ResizeObserver 提示；`browser/window-diagnostics.json` 保存来源和数量，并断言最终不增加。仅重放新标签页不足以复现该提示，补齐相同路由往返和展开操作后才完成对照；没有放宽要求或屏蔽警告。

累计集成基线有 2 条 ResizeObserver、2 条 Vue Flow 弃用提示，最终为 1 条、2 条；没有新增 Vue 警告。排障失败日志不作为通过证据，最终以 PASS 的 JSON 和最终运行日志为准。

## 复现与维护

```powershell
npm run typecheck
npm run check:frontend
npm run check:navigation-filter
npm run check:spu-sku
npm run check:integration
npm run build
git diff --check
```

浏览器默认使用已安装 Chrome，可设置 `BROWSER_CHANNEL=msedge`。本轮输出可设 `NAV_FILTER_OUTPUT_DIR`，对照源码目录可设 `NAV_FILTER_BASELINE`。缺浏览器或基线明确失败，不静默跳过。

默认基线为开工保存的 `work/navigation-filter/baseline`。新检出环境可只读导出 `5e6e74e2c1997b2ffe58f3473bd5be2f660bc64c` 至另一个空目录，再将 `NAV_FILTER_BASELINE` 指向该完整源码；需能解析项目 node_modules。不能用外部中间提交 `2dbefc0` 充当开工基线。运行前检查基线文件存在，错误信息提供准确目录和提交要求。

维护导航转换看 RailNav 和 navigationPreferences；改分类显示看 ProductListView / CategoryFilterTree / ProductListViewTools；改条件解释与快捷安全性看 filterPresentation；改实际查询语义仍看 productListQuery，本轮没有另建查询实现。持久化、跨页适配、手工排序继续用原 productListPages / productListViews / useProductListManualOrder。

## 既有问题与未验证范围

- 既有 ResizeObserver 通知、Vue Flow 弃用和大包提示保留；不屏蔽、不扩大修复。
- 原 SPU 展开行 SKU 勾选重置问题不在本轮；独立 SKU 页选择及批量状态已有实际回归。
- 没有扩展到所有浏览器、移动设备或任意高度；仅验证上述 Chrome 桌面窗口及明暗主题。
- 本轮不涉及 Excel，未重新导入真实文件；前轮真实 Excel 证据仍是历史结果。没有验证后端、多人并发或数据迁移，项目仍为本地存储演示。
- 历史视觉脚本按历史源码保留；本轮可复现入口是上表脚本，不把历史截图视为本轮重跑。

本轮约定范围已达到收口标准，停止扩展。READY 不表示所有历史问题或所有页面均已优化。
