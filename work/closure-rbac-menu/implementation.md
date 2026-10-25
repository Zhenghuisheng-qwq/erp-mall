# 双栏内部两列与 Store 补修验证

本轮独立输出目录 `work/closure-rbac-menu/`。开始时实际 HEAD a4d521e，保留了原有 docs/rbac-management.md 与 browser-navigation-special.mjs 的权限模式兼容改动。未提交、推送或部署。

## 双栏内部布局

RailNav.vue 仅改双栏详情的 template/CSS：直属入口通栏；可见 sections 的原配置序列按 row-major 排为两列。默认商品管理/模型在上排、运营/分析在下排，由可见顺序自然产生，不依赖组名字或固定ID坐标。相邻成对左格的右边线和后续行的上边线相交成十字；奇数末组通栏，避免空格孤立线；仅一个可见分组无多余分隔。分隔为现有主题边线，不是按钮。面板 520px，浮动时 main x=96不变，固定后x=616，图标固定时x=578。375视口降为单列，900仍为宽松两列浮层。

已完成修改前后 1366×900 浅/深主题、悬浮/固定对照：navigation/before/ 与 navigation/after/ 的 default-{floating,pinned}-{light,dark}.png。

额外截图：renamed-reordered.png、hidden-three.png、custom-five-light.png、custom-five-dark.png、mobile-375.png、narrow-900.png。已实际目视核查默认十字与自定义奇数组、主题及文字空间。

实际命令：

- node scripts/browser-navigation-grid-finish.mjs --before：修改前截图完成。
- node scripts/browser-navigation-grid-finish.mjs：7组通过，pageerror=[]，result.json含各组页面矩形与边线值。
- NAV_SPECIAL_OUTPUT=work/closure-rbac-menu/navigation/regression node scripts/browser-navigation-special.mjs：原11组专项通过；仅更新旧324/286宽度断言至616/578，保留原权限模式兼容及全部关键断言。
- UI_FINISH_OUTPUT=work/closure-rbac-menu/navigation/focus-regression node scripts/browser-ui-finish.mjs：原6组键盘/层级/改名回归通过，pageerror=[]；直属入口断言改为新通栏wrapper，独立输出避免覆盖历史证据。

导航交互脚本、单栏、图钉、折叠和偏好逻辑未改；测试实际复验 keyboard focus进入详情后鼠标离开不关、Escape恢复焦点，以及纯鼠标离开仍关闭。

## Store 补修

只新增脚本 scripts/closure-store-repair-check.ts，未改 Store 源码。真实 Pinia + Catalog persistence + Node Web Locks 测试环境。严格与默认各9组通过。

- strict：SKU delete-only actor 直接 removeSku(MAT id)拒绝且内存/磁盘不变。
- strict：MAT import-only candidate 夹带结构合法的 SPU名称、SKU名称、现有兼容声明note更新均因实际权限原因拒绝；不是靠损坏record得到假通过。合法MAT-only维护成功。
- default：统一管理员模式下合法混合候选沿原流程成功；两模式损坏skus容器均原子拒绝。
- 品牌与词典同一成功写盘事务（精确一次）；strict缺dictionary:update拒绝；注入写盘失败时品牌、词典、磁盘及输入草稿保持。
- 规则create/update实际区分；条件及ID保留，写盘失败原子拒绝。
- 合法backup中super缺import/reset/update授权仍能恢复全部登记权限，原root ID、其它role、users与业务不变；strict普通角色拒绝；default统一管理员开放且不会改变当前模拟用户ID。
- super发起模拟后重开Store仍有有效return并可退出。无context、无proof、错proof、同nonce伪造pair但没有受控issued记录、非super来源和target不符均不提升；分别实际尝试写公开active/preview/return三个ref后仍不变。
- Category移动保持分类ID、子树父链、type/rule引用与所有其它业务；typed叶子/cycle/写盘失败均保留原内存磁盘。

命令：

- VITE_RBAC_ENFORCEMENT=true node scripts/run-domain-check.mjs scripts/closure-store-repair-check.ts → store/strict/result.json，store-strict.log。
- 默认未置VITE_RBAC_ENFORCEMENT node scripts/run-domain-check.mjs scripts/closure-store-repair-check.ts → store/default/result.json，store-default.log。

严格拒绝断言没有在默认模式被误用或删除；默认明确按统一管理员契约断言行为。公开只读ref的攻击测试会产生预期Vue只读写入警告，日志保留。模拟凭据只检验受控API签发与上下文完整性；任意同源脚本若能篡改整个AppData或issued存储已在前端Mock信任边界之外，不声称生产认证安全。

最终类型检查与生产构建由主代理统一执行。
