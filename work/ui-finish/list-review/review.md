# 列表收尾独立核查

核查当前工作区的 SPU/SKU 展示优化。开始时 HEAD 为 411c46a46b2c324fa6db7f4b6ae0be45e477057f，已有 staged 新文件全部保留。祖先、项目、src/scripts 中未发现适用 AGENTS.md。未修改业务源码或暂存区。

核查结论：上一轮列表优化实现已在本地，不需重复实现。未发现本次核查范围内的新阻断问题。

- SKU 使用显式 column.width 优先；无手动宽度时内容列采用不同 min-width，状态/日期/编号为窄定宽。自动布局不写入配置，只有原 header-dragend 路径写手动列宽。
- 冻结列保持原配置及窄屏临时保护，未修改持久化口径。
- 名称/规格两行摘要只作用展示；完整弹层按保存属性显示，复制原完整内容，未依据摘要重建 SKU。
- SPU 展示列读取 orderedColumns 元数据，物料/规划按 MAT ID 和统一 materialPlanningIds 去重。
- SPU/SKU 更多菜单保留原对象条件及动作；SKU 组权益包仍限管理员且为主机。删除仍调用原确认和业务保护。这里只做代码核查，未额外宣称运营页面场景已跑。
- brand 汇总字段与 attr:ID 属性字段 ID/绑定未合并；快捷条件收敛展示后原更多筛选和生效条件标签继续保留。

实际执行（全部通过）：

- node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts → query.log
- node scripts/run-domain-check.mjs scripts/sku-workbench-state-check.ts → state.log
- node scripts/run-domain-check.mjs scripts/product-list-presentation-check.ts → presentation.log
- SKU_WORKBENCH_OUTPUT_DIR=work/ui-finish/list-review/sku-browser node scripts/browser-sku-workbench.mjs → sku-browser.log / sku-browser/result.json

真实 Chrome 共 24 个检查点通过，包括 AND/OR、临时搜索、视图保存/收藏/刷新、手动宽度与冻结保留、范围隔离、失败重试、删除默认视图回退、无结果状态和横向滚动。浏览器 diagnostics 为 []。输出在本轮独立目录，未覆盖 work/list-polish 或导航原证据。

类型检查和生产构建由主代理统一执行，本核查不重复运行。

## 本轮列表与导航矩形补验

新增 `scripts/browser-list-navigation-finish.mjs`，复用上一轮 `browser-list-polish.mjs` 的同一确切夹具：createBenefitPackageFixture；phone-a 长名称重复 8 次；追加 12 个长规格属性。输出独立 `work/ui-finish/list-review/current/`，未覆盖上一轮前后截图。

命令：`node scripts/browser-list-navigation-finish.mjs`。最终退出码 0，通过。

- 两页各 1366 / 1920 / 900（高度 1000）均断言 table 外边界位于 main 与视口内。
- SKU 1366：容器/表体 1196/1196px；1920：1750/1750px；900：容器 730px，表体 1192px，内部横向滚动。
- SPU 保留已配置的较多列：1366 表体 1596px 位于容器内横向滚动；1920 表体填满 1750px 容器。未擅自隐藏旧视图字段。
- 两页各 7 种导航状态，共 14 组矩形断言：unpinned、pinned、icons-pinned、expanded-pinned、unpin-restored、icons-unpinned、expanded-unpinned。全部通过。
- 自动适配前后 productListPages、完整内存 Store、原始持久化字符串完全相等，未把自动列宽写作手动列宽。
- 同脚本继续验证两行规格/完整复制、删除取消和已发布 SPU 删除拒绝、深色主题。
- 所有截图及结果：current/result.json、current/spus-1366.png、current/skus-1366.png；对应 1920/900 及各导航状态截图也已输出，可与原 work/list-polish/before 同尺寸比较。

pageerror 数组为空。开发日志仍有两条既知 ResizeObserver 通知，未隐藏，详见 current-browser.log；尺寸与操作断言均通过。不声称零诊断。
