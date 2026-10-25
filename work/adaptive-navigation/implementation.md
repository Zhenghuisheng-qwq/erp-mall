# 导航自适应收紧验收

起点：HEAD 4c26e078，工作区干净。仅修改 RailNav.vue 与导航验证脚本；未修改 AdminLayout、导航偏好格式、菜单配置、RBAC 或业务页面。

## 实现

- 主栏宽度统一由 NAV_WIDTH / primaryWidth 产生 CSS 变量；文字折叠宽度、布局和浮层定位使用相同来源，不再在 CSS 与定位回退分别写常量。
- 详情根据实际主题字体测量现有菜单文字，计算两列所需空间；常规预算保持紧凑，少数超长名只允许约 8 个宽字的宽度预算，随后完整换行，附 title 原文。大屏不因可用宽度变大而扩大留白。
- 详情受容器/视口宽度约束；小空间先缩组间距和单项间距，手机再退为单列。常见桌面继续两列十字结构。
- 只有给正文留下足够可用空间才 dock。空间不足临时 overlay，不写用户 pinned 或 collapsed 偏好；恢复足够空间后自动 dock。
- 临时 overlay 的关闭按实际 dock 状态处理：Esc 恢复焦点，hover 离开、外部点击可关闭；只保留不持久化的临时关闭状态，避免 pin=true 的 fallback 马上重新打开。
- 超长中文与无空格英文中心标题 min-width:0 + overflow-wrap:anywhere；图钉 flex:none 独立占位，标题不挤压按钮。

## 实测矩形

1366/1920 等均为真实独立 Chrome 页面 CSS 视口，使用相同种子数据。

| CSS视口宽 | 修改前详情/正文 | 修改后详情/正文 |
| --- | --- | --- |
| 1280 | 520 / 664 | 336 / 848 |
| 1366 | 520 / 750 | 336 / 934 |
| 1440 | 520 / 824 | 336 / 1008 |
| 1920 | 520 / 1304 | 336 / 1488 |
| 2560 | 520 / 1944 | 336 / 2128 |

表中336是本次默认菜单实测结果，不是新固定宽度。单个超长自定义菜单实测368（断言不超过默认1.15倍）；只有中心直属入口的模块更窄。浮动时正文位置保持主栏右边界；固定时正文左边界等于主栏＋实际详情宽。连续 resize 覆盖2560→375→1920，所有面板在视口内，偏好原文保持。

## 真正的 Chrome 125% / 150% 缩放

真实测试不是 deviceScaleFactor 或 CDP 页面缩放：

1. 创建完全独立临时 Chrome profile，viewport:null，以 --window-size=1366,1000 打开真实 Chrome。
2. 在 chrome://settings/appearance 使用浏览器的 chrome.settingsPrivate.setDefaultZoom 设置原生页面默认缩放。
3. 不使用 CDP metrics / pageScaleFactor；导航到本地实际页面。
4. 检查 outerWidth、innerWidth、devicePixelRatio、visualViewport.scale，确认是浏览器布局缩放而非 pinch 缩放。

| 原生缩放 | outerWidth | innerWidth | DPR | visualViewport.scale | 实际导航 |
| --- | --- | --- | --- | --- | --- |
| 100% | 1366 | 1350 | 1 | 1 | dock |
| 125% | 1366 | 1080 | 1.25 | 1 | dock，正文648 CSS px |
| 150% | 1366 | 900 | 1.5 | 1 | 临时overlay，正文不让位 |

截图与数据：native-zoom/native-{100,125,150}-{light,dark}.png、native-zoom/result.json。临时 profile 关闭后安全删除，未访问用户 Chrome profile。

最初尝试直接写 Preferences.partition.default_zoom_level 并未生效（125%仍DPR1/inner1350），未把该失败尝试记为通过；最后采用 Chrome Settings API 并以实际指标证明生效。

另有 browser-navigation-adaptive.mjs 的等效 CSS 视口125/150测试，仅作为窗口预算仿真记录，不混同于上述原生缩放。

## 实际执行

- node scripts/browser-navigation-adaptive.mjs --before：修改前五档宽度和代表截图。
- node scripts/browser-navigation-adaptive.mjs：最终8组通过，含连续resize、临时overlay Esc/leave/外点关闭→宽恢复、长中心标题/图钉边界、折叠来源、原业务数据字节不变；pageerror=[]。
- node scripts/browser-navigation-native-zoom.mjs：独立 Chrome 原生100/125/150全部通过，pageerror=[]。
- NAV_SPECIAL_OUTPUT=work/adaptive-navigation/regression node scripts/browser-navigation-special.mjs：11组原导航回归通过。旧固定616/578断言替换为实际主栏/详情/正文几何，触屏125可用正文足够时允许dock，不再假设必须overlay。权限模式与其它原断言保留。
- NAV_GRID_OUTPUT=work/adaptive-navigation/grid-regression node scripts/browser-navigation-grid-finish.mjs：7组两列/配置顺序/隐藏/奇数组/自定义/窄屏回归通过，旧520/616假设移除。
- git diff --check：通过。最终统一类型检查/生产构建由主代理执行。

## 截图与限制

before/ 与 after/ 同尺寸代表对照：pinned-1366-light.png、pinned-1920-light.png、pinned-2560-light.png、floating-1366-light.png、floating-2560-light.png。

最终 after/ 另含 pinned-1366-dark.png、floating-1366-dark.png、temporary-overlay-900.png、temporary-overlay-375.png、long-name-content-sized.png、direct-only-compact.png、long-center-chinese.png、long-center-english.png。

本轮最终截图均由最后源版本重新生成并目视检查。已移除旧期望“432!=96”产生且已解决的 regression failure.json/png，保留成功结果及日志。

尺寸连续变化过程中 Vite 仍记录已有 ResizeObserver loop completed with undelivered notifications. 开发通知；修改前固定菜单同样出现，未隐藏。没有浏览器 pageerror，实际矩形、焦点、偏好和数据断言通过。原生验证为已安装 Chrome 156.0.8078.47，无 Safari/Firefox/实体触屏声明。
