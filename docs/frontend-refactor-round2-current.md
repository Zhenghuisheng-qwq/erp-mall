# 商品列表工程重构：当前源码续做

RESULT：READY（2026-10-22）

## 实际基线

- 开工分支 `20261022`，HEAD `cff2fecd9200c929cb1da5299e9dd0893908cb21`，工作区干净。历史第二轮已经提取视图工具、筛选弹窗、手工排序和筛选展示函数；随后 SPU/SKU 拆页及导航/筛选优化也已存在，全部保留。
- 已阅读 README、商品配置闭环、`performance-round1.md`、历史第二轮报告和直接业务/检查调用。仓库、适用父目录和本次目录未发现 AGENTS.md。旧业务文档的版本 1 和旧路由仅作历史说明；当前源码为 `iyge-v2-mock-db` / V14、`/spus` / `/skus`。
- 修改前保存完整源码至 `work/refactor-round2-current/baseline/`，文件清单及干净状态在同目录上级的 `baseline.json`。原历史报告未改写。
- 执行期间 HEAD 被外部推进至 `54dbe8675cd22cc046ffd446097767a4cdf05b9f`，该提交包含本次三个生产文件的改动和忽略规则。本任务没有执行 commit、push、merge 或部署，也未回退。后续 package、检查脚本和本报告保留为工作区改动。完整审查请比较开工提交，而非只看 `git diff HEAD`。

## 修改及职责

| 文件 | 当前职责 / 修改理由 |
|---|---|
| `src/views/ProductListView.vue` | 保留路由/store 协调、业务命令、表格及选择、查询/分页、视图草稿和弹窗开关；调用以下两个专用模块。模板和全部样式原文与基线相同。 |
| `src/components/product-list/useProductListCategoryLayout.ts` | 集中维护本次挂载的分类浮层开关、侧栏临时收起、960px 宽度响应及 resize 注册/清理。仅接收视图 ID/布局 ref 和保存布局命令；不持有筛选条件副本。 |
| `src/components/product-list/tablePresentation.ts` | 将已经查询/排序/分页的 groups 转换为明确的表格展示类型；保留组/行顺序、Family 对象引用、row.id、已存 SKU 编号及全部格式化函数。无写入、无长期缓存。 |
| `scripts/product-list-presentation-check.ts` | 冻结输入、无 SKU 行、空组、缺失关联、重复源记录、保存身份、编辑后刷新及查询空值/同值双向排序的专项检查。 |
| `scripts/browser-product-list-current.mjs` | 当前基线的原版/新版行为、持久化、生命周期和截图对照；继承历史业务断言并适配当前路由/定位器。 |
| `package.json` | 增加 `check:product-list-refactor`，串行复用上述领域入口及两阶段浏览器对照，无依赖变更。 |
| `.gitignore` | 忽略本次本地快照、截图、日志和独立 Vite 缓存。 |
| 本报告 | 当前源码的结果与维护说明；历史第二轮报告继续保留。 |

原来页面内的分类显示 refs/computed/watch/resize 和行转换现在由专用模块维护；页面继续组合 `presentProductList` 的查询结果。原两个分类 watch 的依赖、默认 flush、注册顺序，路由打开工具与 resize 挂载顺序、分页 immediate watch 都保留。只有明确修改布局才调用原 `setViewCategoryLayout`；关闭面板、resize、往返挂载不会保存业务数据。

已有 `ProductListViewTools.vue` 负责列/分组/排序工具交互；`ProductListFilterDialog.vue` 通过明确事件即时编辑当前视图；`filterPresentation.ts` 是只读筛选展示；`useProductListManualOrder.ts` 维护临时勾选/拖动/跨页暂存，仅确认命令写排序。主查询和已保存视图仍由 `productListQuery.ts`、`productListViews.ts`、`productListPages.ts` 维护。持久化仍是页面命令 → 原领域/store 写入 → 原 deep watch → localStorage。

收益是显示状态的生命周期和只读转换有了独立边界与类型，修改分类布局或表格展示无需同时阅读页面业务写入。未测量页面速度，不宣称提速比例。表格、展开、业务按钮及真实 SKU 读取保留在页面：进一步拆分会增加转发接口并触及已有选择行为。查询/分组/排序、全局 store、选择器、布局、画布、规划及 SKU 生成均未改写。

## 实际验证

环境：Windows x64 10.0.26200，Node 22.18.0，Vite 8.3.4，Chrome 155.0.8059.85，Playwright Core 1.64.1，pngjs 7.0.0。使用独立浏览器上下文和测试夹具，固定业务时间/ID，未操作日常浏览器数据。

| 执行命令 / 检查 | 结果与证据（均位于 `work/refactor-round2-current/`） |
|---|---|
| `npm run check:frontend` | 修改前、最终代码均 11 组 PASS；`before-domain.log` / `after-domain.log`。包括商品列表及视图/分类/手工排序、规划、草稿组合、物料、一致性、布局、round5、round1、SPU/SKU 和导航筛选；内部有重叠，不合计为独立用例数。 |
| `npm run check:integration` | 源码快照和最终代码的 4A–4E 全部 exit 0，13 个业务检查点 PASS；`before-integration/` / `after-integration/` 及对应日志。 |
| `npm run check:product-list-refactor` | 独立展示检查及原版/新版浏览器对照 PASS；`refactor-check.log`、`comparison/`。最后补充空值/同值顺序断言后又单独运行下一条。 |
| `node scripts/run-domain-check.mjs scripts/product-list-presentation-check.ts` | 最终版本三组专项断言 PASS；`presentation-check.log`。冻结输入不会被修改，重新计算能读取编辑后的值。 |
| `npm run typecheck` | exit 0；`typecheck.log`。 |
| `npm run build` | exit 0；`build.log`，保留既有大包提示。 |
| `git diff --check cff2fecd9200c929cb1da5299e9dd0893908cb21` | PASS；另检查未跟踪新增文件的空白与脚本语法。 |
| `node --check scripts/browser-product-list-current.mjs` | PASS。 |

4A–4E 覆盖列表身份、搜索、页码夹取/翻页、列显隐/拖序、视图创建校验/取消/切换/重命名/复制/删除及刷新、组合筛选与预设、分组折叠/清除、双向排序、跨页排序暂存/确认/取消/刷新，以及新增、详情、SKU 编辑、物料入口。领域检查覆盖中文排序、同值身份顺序、空值分组、组内顺序和分页无重复遗漏；新增展示检查确认空名称升降序和同值 ID 顺序经过转换保持一致。页面没有每页条数控件，使用独立持久化夹具设置 pageSize=2/page=2 后刷新验证两行及页码，不虚构 UI 操作。

本轮浏览器对照以 cff2fec 原页面通过 Vite 同路径替换为基线，要求除三个生产改动文件外所有已跟踪 `src` 依赖与基线一致。两阶段均执行相同操作，比较 **33 个状态点的完整持久化数据、数组顺序、每次写入的内容/次数/先后、可见行、计数及 resize 监听数量**，结果完全一致。覆盖日期单值/范围、分类单选/多选、枚举多选、即时条件及弹窗重开、角色权限、批量发布/下架/删除、单 SKU 状态、空库、SPU/SKU 跳转、路由工具入口、未保存离页、暂存移除/清空。新增分类检查确认关闭/宽窄变化零写入、切视图关闭旧浮层、连续三次离开返回不增加 resize 监听。

9 组截图为浅色首屏、展开行、复杂筛选弹窗、视图工具、SKU 列表、深色首屏、窄屏列表、分类侧栏、窄屏分类浮层。尺寸 1440×960 / 900×960，字体和浮层稳定后逐像素比较 PNG RGBA，**每组差异均 0**；未遮挡区域、未放宽阈值。实际查看复杂弹窗、分类侧栏与深色结果，DOM/样式提取无视觉回归。两阶段 pageerror / console error / warning 均为空。

13 个集成业务点包括重复预览不写库、不消耗编号、首次发布、PLN 沿用/新增及版本关联、同 PLN 多条 MAT、适用配置取消/重开/一次确认、切模型清理、物料返回列表、刷新恢复、离开返回/快捷键和历史快照。额外严格比较前后 `states.json` 完整数据与写入载荷、diagnostics、检查点及 MAT 身份，全部相同；结果在 `integration-comparison.json`。

旧 `node scripts/browser-product-list-round2.mjs --before` 实际 exit 1：默认历史 3cfbcc 的共享依赖已发生合法变化，原 guard 正确拒绝替换（`legacy-browser.log`）。原脚本保持历史用途；新脚本保留其 27 点断言并补充 6 点分类/生命周期检查，适配 `/spus`/`/skus`、新建 SPU、更多筛选、分页面视图存储及实际离页按钮。开发时一次旧“确定”离页定位失败，仅将定位改为当前“离开”，未降低业务断言。

最终验收初次并行运行时两个 Vite 服务发生动态模块加载失败，疑似依赖缓存竞争；日志分别保留为 `refactor-parallel-failure.log`、`after-integration-parallel-failure.log`。新对照脚本使用输出目录中的独立 cacheDir；随后顺序重跑两个完整入口均通过。此失败没有计为通过，也未通过增大超时、自动重试或跳过入口掩盖。

## 复现与审查

```powershell
npm ci
npm run check:frontend
# 浏览器入口顺序执行，避免既有脚本共用 Vite 缓存
npm run check:product-list-refactor
npm run check:integration
npm run typecheck
npm run build
git diff --check cff2fecd9200c929cb1da5299e9dd0893908cb21
git diff cff2fecd9200c929cb1da5299e9dd0893908cb21
```

本轮实际使用已有 node_modules，没有重新执行 npm ci；该命令供新检出环境安装锁定依赖。浏览器需已安装 Chrome，可设置 `BROWSER_CHANNEL=msedge`。新对照脚本可用 `ROUND2_CURRENT_BASELINE` 指定原提交，`ROUND2_CURRENT_OUTPUT_DIR` 指定输出，`ROUND2_CURRENT_EVIDENCE_DIR` 复用有效原图。默认基线 Git 对象必须存在；缺基线、缺原图、共享源码变化或缺浏览器都会失败，不静默跳过。新脚本无个人电脑绝对路径。集成输出可用 `FINAL_OUTPUT_DIR` 配置，快照前测使用 `FINAL_SOURCE_ROOT`。

完整本地补丁保存在 `work/refactor-round2-current/review.patch`，包含相对开工提交的累计变动及新增未跟踪文件；`final-source.json` 记录最终文件哈希和工作区状态。源码快照/日志/图片已忽略，不进入业务数据或构建。

## 既有问题及覆盖边界

- SPU 展开行 SKU 勾选重置：基线同样存在，对照显式保留；未混入修复。下一项最值得单独处理的是该选择状态的行引用稳定性与批量操作回归。
- ResizeObserver：基线和最终列表集成日志各出现两次相同提示，未新增、未屏蔽。设计器两次 Vue Flow options 弃用提示前后相同。构建仍有大包提示。
- Git 提示无权限读取用户全局 ignore 文件，工作区及项目 ignore 读取正常，Git 命令实际 exit 0；未修改个人环境配置。
- 浏览器只验证上述 Chrome 桌面尺寸及现有角色/主题，未扩展至所有浏览器或设备。未重新导入真实 Excel、验证后端/多人并发/迁移；本轮没有改动这些路径。
- 无已知由本次结构提取引入的阻断问题；READY 限于本轮边界，不表示全站无历史问题。达到范围内验收条件后停止。
