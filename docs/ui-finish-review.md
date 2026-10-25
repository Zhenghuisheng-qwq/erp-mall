# 当前界面收尾：列表核查、导航焦点与双栏层级

RESULT：本轮已确认范围通过，可进入用户操作审查。本地列表优化已核对保留；补齐了键盘焦点保护和双栏详情层级。没有新增业务功能；未提交、推送或部署。

## 起点与保护

- 用户给定远端基线 `9e6b4b4`；实际本地 HEAD 为 `411c46a46b2c324fa6db7f4b6ae0be45e477057f`，分支 `20261022`。
- 开始时列表报告、组件、测试和截图共有 33 个已暂存新增文件。保留其内容与暂存状态，没有执行 reset、checkout、unstage、commit、push。
- 两个列表页面优化已在实际 HEAD 中，未重复重做；本轮业务页面源码没有新增修改。
- 已检查祖先目录、工程以及 src/scripts 下适用 AGENTS.md，未发现额外文件。
- 浏览器使用隔离 context 与测试夹具；新证据全部写入 `work/ui-finish/`，保留原 `work/list-polish/` 与导航证据。

## 本轮改动

| 文件 | 说明 |
| --- | --- |
| src/layouts/RailNav.vue | 记录当前鼠标/键盘操作方式；180ms 计时器到期时检查键盘焦点，避免关闭正在操作的详情；Tab 离开正常关闭；Escape 恢复模块焦点并避免 focus 事件重新打开；双栏详情加文件夹分组图标、次级色 12px 标题、14px 功能入口图标和 24px 文字缩进 |
| src/layouts/navigationIcons.ts | 展示层按真实路由映射 Element Plus 语义图标，未配置路由用 Document 后备；不按菜单名称匹配 |
| scripts/browser-ui-finish.mjs | 修改前复现、同尺寸导航截图；修改后焦点、鼠标、图钉、层级、改名/长文字、后备图标及数据不变性验收 |
| scripts/browser-list-navigation-finish.mjs | 同上一轮确切列表夹具、长名称/12属性，复验两页宽窄屏及导航固定/取消/折叠/展开矩形和数据不变性 |
| docs/ui-finish-review.md | 本报告 |

单栏原有 Element Plus 层级保留；布局、折叠、图钉及偏好保存逻辑未重做。中心直达入口仍在中心下，真实 menuConfig 排序、改名、隐藏、权限和路由保持。

## 导航焦点：操作、预期、实际

| 操作 | 预期与实际 | 证据 |
| --- | --- | --- |
| 修改前：未固定双栏，聚焦模块，ArrowRight 进入详情，鼠标离开，等待 280ms | 缺陷实际复现：详情关闭 | before/navigation-result.json，keyboardSurvivesMouseLeave=false |
| 修改后相同步骤，继续 Tab 到下一功能 | 详情保持，焦点仍在链接中 | after/navigation-result.json、keyboard-focus-retained.png |
| Escape | 详情关闭；焦点回到原模块，等待后也不重新打开 | 专项实际断言 |
| 聚焦最后一个详情入口，再 Tab 真正离开导航 | 焦点到导航外，延时后详情关闭 | 专项实际断言 |
| 纯鼠标 hover→离开；左栏移入详情 | 离开延时关闭；跨栏保持打开 | 专项实际断言 |
| 图钉固定后离开、Escape | 固定状态与详情保留 | 专项及原导航回归 |
| 布局弹层与业务弹窗 Escape | 原优先级保留；业务弹窗先处理，不抢走输入焦点 | navigation-regression.log、filter-regression/result.json |

## 双栏视觉层级

- 顶部中心名与图钉继续组成独立标题区。
- 分组标题：文件夹图标、当前主题次级文字色、12px、组间 16px；标题与第一项距离较近，不伪装成页面链接。
- 功能入口：16px 图标列 + 对齐文字列，正文 14px、20px 行高；文字比标题向右 24px（四个分组均通过页面矩形断言）。
- 当前页面沿用主题背景和强调色；包含当前页面的分组只轻微加重字重和图标，不使用同等强度高亮。
- 浅色、深色、悬浮、固定均使用相同 DOM/CSS；当前页面在系统中心时，商品中心无任何功能选中仍能辨认归属。
- 测试将 SKU 菜单改为超长名称：保持原图标，文字在列内完整换行；未知路由使用中性后备图标。

导航同尺寸对照（1366×900）：

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 浅色悬浮 | work/ui-finish/before/navigation-floating-light.png | work/ui-finish/after/navigation-floating-light.png |
| 浅色固定 | work/ui-finish/before/navigation-pinned-light.png | work/ui-finish/after/navigation-pinned-light.png |
| 深色悬浮 | work/ui-finish/before/navigation-floating-dark.png | work/ui-finish/after/navigation-floating-dark.png |
| 深色固定 | work/ui-finish/before/navigation-pinned-dark.png | work/ui-finish/after/navigation-pinned-dark.png |

补充长文字截图：after/navigation-long-name-light.png、navigation-long-name-dark.png。

## SPU/SKU 实现核查与实际复验

核查结论：上轮优化已完成，无需重新实施。SKU 显式手动宽度优先；仅 header-dragend 写入手动宽度，自动布局只读配置。名称/完整规格两行摘要；点击查看并复制保存内容。冻结配置与窄屏临时保护保留。SPU 摘要使用统一物料关联读取去重，品牌汇总和属性字段没有合并。更多菜单仍保留原角色与对象条件、路由参数、删除保护和手工排序操作。

独立核查详情：`work/ui-finish/list-review/review.md`。

| 实际验收 | 结果 |
| --- | --- |
| SKU 工作台浏览器 | 24 项通过：筛选 AND/OR、分组、临时搜索、保存视图、收藏/默认、手动列宽/冻结、刷新、SPU 临时范围、失败重试及横向滚动 |
| 两页 1366/1920/900 | 表格边界均在 main 和视口内；窄屏通过表格内部滚动 |
| SKU 1366 | 容器/表体 1196/1196px |
| SKU 1920 | 容器/表体 1750/1750px |
| 固定/取消/折叠/展开 | 两页共 14 组矩形断言通过 |
| 长规格 | 目标摘要两行、完整查看/复制；原名称与 12 个规格属性保留 |
| 数据不变性 | 导航/展示前后 productListPages、完整 Store、原始持久化字符串完全相等 |
| 菜单配置/运营权限 | 原导航专项逐项核对真实 railModel，重命名/排序/隐藏和角色路由权限回归通过 |

两页使用上轮确切夹具、同尺寸（1366×1000）对照：

- SPU 优化前：`work/list-polish/before/spus-1366.png`；本轮确认后：`work/ui-finish/list-review/current/spus-1366.png`。
- SKU 优化前：`work/list-polish/before/skus-1366.png`；本轮确认后：`work/ui-finish/list-review/current/skus-1366.png`。
- 同目录另有 1920/900、两页深色、完整规格及导航状态截图；原优化前截图未覆盖。
- 矩形与结果：`work/ui-finish/list-review/current/result.json`。

## 实际命令与结果

| 命令 | 结果 |
| --- | --- |
| node scripts/browser-ui-finish.mjs --before | 成功复现原焦点缺陷，生成 before 证据 |
| node scripts/browser-ui-finish.mjs | 6 组专项检查通过，Chrome 156.0.8078.47，pageerror=[] |
| node scripts/browser-list-navigation-finish.mjs | 两页适配、复制/保护、14 组导航矩形和数据原文不变通过 |
| node scripts/browser-sku-workbench.mjs | 24 项通过，diagnostics=[] |
| node scripts/browser-navigation-filter.mjs | 导航专项和 6 组 SPU/筛选回归通过，console/window diagnostics=[] |
| sku-workbench-query-check.ts / sku-workbench-state-check.ts / product-list-presentation-check.ts | 领域检查全部通过 |
| npm run build | 内含类型检查及生产构建，退出 0；build.log |
| git diff --check | 通过 |

## 剩余问题与验证范围

- 无已知未修复的本轮阻断问题。
- 列表连续调整尺寸时仍记录两条既有 `ResizeObserver loop completed with undelivered notifications.` 开发通知；未屏蔽，见 list-review/current-browser.log。矩形、行高、功能及数据断言均通过，不宣称零诊断。
- 构建保留大于 500kB 分包提示；未扩展拆包或业务改造。
- 本轮使用独立桌面 Chrome；未额外验证 Safari/Firefox、屏幕阅读器或实体触屏。未重跑全部 183 项业务验收。
- 完成后停止；本地结果可供用户亲自操作验收，尚未推送远端。
