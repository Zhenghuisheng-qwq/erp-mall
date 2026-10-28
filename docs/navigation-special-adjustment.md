# 侧边栏菜单专项调整报告

RESULT：本次导航专项实现与隔离 Chrome 回归通过，可进入用户操作审查。未提交、推送或部署；不评价整个 ERP 完成度。

## 基线与边界

- 分支 `20261022`，实际 HEAD `6abaec1a868f59557c09e21b4321ef9b32271399`，与给定基线一致。
- 开始时已有 `docs/product-center-business-acceptance.md` 修改，本次保留、不覆盖。已检查适用路径，无额外 AGENTS.md 指令。
- 按老板补充保留单栏原有 Element Plus 菜单层级；重点调整双栏交互。
- 修改范围为导航组件、独立偏好及相关测试。未改业务数据结构、menuConfig 正式配置、路由、V2、SKU/PLN/MAT 算法。
- 使用全新 Chrome context 和独立 localStorage 测试数据；不读取或清理用户浏览器数据。

## 参考附件已实际体验

先打开 `D:/单子/商城erp/演示图/菜单演示与图片说明.html`，在隔离 Chrome 实际操作双栏悬浮、跨栏移动、图钉固定、文字折叠、取消固定及单栏。证据：`work/navigation-special/reference.json`、`reference-pinned-icons.png`、`reference-single.png`。只参考交互，正式导航仍用当前主题变量、图标体系和真实菜单。

## 修改文件

| 文件 | 实现 |
| --- | --- |
| src/layouts/RailNav.vue | 单栏保持原层级；双栏主栏图标上文字下，详情纵向单列；悬浮/图钉布局；顶部唯一折叠按钮；底部两选项布局弹层；独立当前页面/查看模块状态；窄屏保护、真实 href、键盘、清理监听和定时器 |
| src/layouts/navigationPreferences.ts | 独立 pinned 字段；默认 dual/显示文字/未固定；center→single、icons 兼容；合法展开配置清理与损坏回退 |
| src/layouts/AdminLayout.vue | 移除工作区重复折叠按钮位置，保留 router-view 与既有 temporaryCompact 机制 |
| scripts/navigation-filter-check.ts | 更新默认/迁移/固定状态断言，保留筛选及不变性断言 |
| scripts/browser-navigation-reference.mjs | 参考附件真实 Chrome 交互记录 |
| scripts/browser-navigation-special.mjs | 新导航真实页面专项断言与截图 |
| scripts/browser-navigation-filter.mjs | 调用专项替代旧导航结构断言，保留筛选/权限/路由/业务不变性；不再要求不存在的旧源码快照；账户内容在切换前后同布局进行像素比较 |

## 状态与迁移

- 布局、文字折叠、图钉分别保存于 `iyge-nav-layout`，不写 AppData。
- 默认双栏主栏 96px，详情 228px，折叠主栏 58px，单栏 228px。
- 未固定 hover/focus/click 只查看；跨栏不关闭，离开约 180ms 关闭，切换模块取消旧定时器。
- 图钉固定才占位；取消固定即关闭详情；折叠保持 pin/layout；切换单/双栏展开文字、清除悬浮、取消固定。
- 不保存悬浮模块、弹层开关或定时器。已有 single/dual 保留；center→single 并保留合法 collapsed/openeds；旧 icons 恢复相应布局和折叠；缺 pinned 默认 false；损坏偏好安全回退，写入失败仍可操作。
- 小于 1100px 或工作台 temporaryCompact 时详情浮层，不强占内容宽度；小于 700px 临时图标栏；回宽屏恢复长期选择。临时收起时顶部按钮打开导航，不篡改长期折叠偏好。

## 实际浏览器验收

Chrome `156.0.8078.47`，隔离测试数据。专项明细见 `work/navigation-special/browser/evidence.json`，筛选回归见 `work/navigation-filter/browser/result.json`。

| 场景/操作 | 预期与实际 | 状态/证据 |
| --- | --- | --- |
| 首次打开；hover 商品中心；移入详情；离开；快速切系统模块 | 默认未固定无详情；跨栏保持；延迟关闭；旧定时器不关闭新详情；页面模块高亮不被查看模块替代 | 通过，dual-floating.png |
| 悬浮→固定→折叠→展开→取消固定 | 工作区 x 依次 96→324→286→324→96；悬浮不挤占；pin aria-pressed 正确 | 通过，rectangles、dual-pinned.png、icons-pinned.png |
| 单栏、折叠及恢复；底部 hover/click/方向键/Enter/Escape | 只有单栏/双栏两个选项；原层级保留；图标功能项具名称提示；布局切换展开且取消固定；键盘聚焦不被鼠标离开计时器关闭 | 通过，single.png、single-icons.png |
| 刷新偏好；旧 center/icons；无 pinned；损坏值；写入抛错 | 合法选择恢复；安全迁移；失败不阻断导航 | 通过，专项断言 |
| 真实配置改 SKU 名、排序、隐藏品牌；管理员/运营遍历全部入口 | 两布局逐项等于实际 railModel；运营 /menus 路由拒绝 | 通过，专项断言 |
| Ctrl 新页；路由跳转；前进后退 | href 可用，原页不误跳；实际页面高亮正确 | 通过，专项断言 |
| Element Plus 更多筛选弹窗与导航同时打开，按 Escape | 第一次仅关闭业务弹窗，再次才关闭导航 | 通过，筛选回归 escape-layer-priority |
| 浅色/深色，1366、900、375 宽度 | 导航可操作；窄屏详情在视口内；恢复宽屏保留 pin/layout；菜单独立滚动、底部入口可达 | 通过，dual-dark.png、narrow-900.png、mobile-375.png |
| 触屏 tap；模块上下/右/左方向键；等效 125% 视口 | 点击模块不路由跳转，tap 固定/布局有效；键盘进入详情并返回；1093×720 CSS 视口及 1.25 deviceScaleFactor 下浮层受约束 | 通过（模拟），scaled-touch-125.png |
| 导航展示操作前后比对 Store 与持久化原文 | AppData 和历史快照原文不变 | 通过，专项断言 |
| 分类筛选、复杂条件、清除、SPU/SKU 范围、账户内容 | 筛选原语义保留；10 组查询切换前后一致；账户同布局前后像素差 0 | 通过，query-comparison.json、visual-comparison.json |

截图目录：`work/navigation-special/browser/`。单栏、悬浮、固定、图标、窄屏均为实际页面截图，不是演示首页。

## 执行结果

- `node scripts/browser-navigation-reference.mjs`：通过。
- `node scripts/run-domain-check.mjs scripts/navigation-filter-check.ts`：通过，包含迁移/权限与筛选 AND/OR/排除/范围/不可变性。
- `node scripts/browser-navigation-special.mjs`：通过，最终包含触屏/键盘/等效缩放检查，pageerror 为空。
- `node scripts/browser-navigation-filter.mjs`：通过（调用专项 + 6 组保留回归），console/window diagnostics 为空。
- `npm run build`：通过，内含 TypeScript/vue-tsc 检查和生产构建；日志 `work/navigation-special/build.log`。存在 Vite 大于 500kB 的分包提示，不是构建失败；未扩大到业务拆包改造。
- `git diff --check`：通过。

首次浏览器启动受沙箱 localhost 访问限制，随后以获准的隔离 Chrome 本地测试执行成功。首次用主标题作为“离开导航”目标时，被符合预期的浮层遮挡；测试改为移到工作区右侧，不更改产品行为以迎合测试。后续回归通过。

## 限制与未验证

- 等效缩放通过 CSS 视口和 deviceScaleFactor 模拟；未实际操作 Chrome 工具栏缩放、实体触屏设备、Safari/Firefox 或屏幕阅读器，不宣称这些环境已通过。
- 本次未重跑全部 183 项业务验收；仅跑受影响导航/筛选回归及类型构建。
- 没有已知未修复的本次导航阻断项。可交用户亲自操作确认交互；完成后停止，不进入新功能轮次。
