# 商品列表工程重构：第二轮

RESULT：READY

## 基线与范围

- 实际分支 `20261019`，HEAD `3cfbcc0918ed8c63b35af33c8dcb02baab49089f`；开始时工作区干净。没有切换、回退、提交或推送。
- 已阅读 README、商品配置闭环及业务保护说明、`performance-round1.md`；项目与父目录未发现适用的 AGENTS.md。
- 生产改动限定为商品列表页面及其功能目录。领域查询、排序、store、模型选择器、第一轮 planning / draftComboPreview 均未修改。
- README 中数据版本 1 已过时；本轮以源码的 `iyge-v2-mock-db` / V13 为准，未变更数据格式。

## 职责和状态归属

重构前，页面同时承担路由、业务写入、视图工具、筛选编辑、表格以及手工排序暂存。重构后的边界如下：

| 文件 | 职责与状态 |
|---|---|
| `src/views/ProductListView.vue` | 连接路由和 store；派生列表/筛选展示数据；保留表格、选择状态、页码、分类布局、视图管理草稿及弹窗开关；接收事件并调用原业务操作。 |
| `src/components/product-list/ProductListViewTools.vue` | 列搜索与拖动、分组和排序工具；仅拥有搜索词和拖动列 key。通过类型化事件请求持久化修改与页面入口操作。 |
| `src/components/product-list/ProductListFilterDialog.vue` | 展示复杂条件输入及外露字段；无条件副本，不修改 props；通过 ID、字段、操作符和值事件修改当前视图。 |
| `src/components/product-list/filterPresentation.ts` | 筛选展示类型、操作符选项与日期范围转换；纯函数，无响应式或持久化副作用。 |
| `src/components/product-list/useProductListManualOrder.ts` | 单次页面挂载中的勾选、拖动、跨页暂存、移除/清空与确认交互；只有传入的 move / insert 命令能保存排序。无 watch、订阅、定时器或挂载写入。 |

持久化链保持为：子组件事件 → 页面命令 → 原 `productListViews` / store 操作 → `store.data` → 原 deep watch → localStorage。筛选条件仍即时生效，关闭弹窗不撤销；新建/改名仍用原页面草稿。分页 watch 的 immediate、默认 flush，以及路由 watch、resize 注册和卸载清理均原样保留。

解决的问题：视图工具的临时状态与页面业务解耦；筛选输入的三条重复赋值路径合为类型明确的单一写入入口；手工排序的临时状态和确认流程集中维护；操作符保留联合类型，移除相应强制转换。样式随所属 DOM 移动，没有新增包装层、deep 选择器或全局样式补丁。

经过判断保留：表格及商品/SKU 操作仍在页面。原表格行数组创建、选择状态、展开和业务操作存在耦合，当前提取会增加大量回调，且可能顺带修复选择重置问题。查询/分组/排序算法、读取格式化、保存视图领域函数没有重写；没有跨调用缓存或页面提速声明。

## 验证结果

环境：Windows x64（10.0.26200），Node v22.18.0，Chrome 155.0.8059.85，Playwright Core 1.64.1。浏览器使用独立上下文，不读写用户日常浏览器数据。

| 检查 | 修改前 | 修改后 |
|---|---:|---:|
| product-list-check | 57 PASS | 57 PASS |
| product-list-view-check | 89 PASS | 89 PASS |
| product-list-query-check | 170 PASS | 170 PASS |
| planning-check | 18 PASS | 18 PASS |
| draft-combo-check | 10 PASS | 10 PASS |
| material-check | 本轮未单独前测 | 12 PASS |
| category-tree-select-check | 本轮未单独前测 | 11 PASS |
| browser-4a～4e | 全部 exit 0 | 全部 exit 0 |
| npm run build（含 vue-tsc -b） | exit 0 | exit 0 |
| npx vue-tsc -b | 包含于基线 build | 单独 exit 0 |

上述领域脚本有重叠，不合计成独立用例数。query 脚本包括分类、手工排序、查询、视图、身份、命名、组合物料状态和档案检查；planning 覆盖 V2 选择器、generateSkuFromModel 和规划计算。

旧 4A–4E 定位器和断言在基线均有效，没有放宽断言或超时。仅将它们的 Playwright 加载改为项目依赖，去掉个人电脑绝对路径。覆盖：SPU/SKU 与 MAT 身份、搜索/无结果/恢复、入口跳转、列显隐/拖动、视图新建/校验/取消/重命名/复制/删除/刷新、分组与字段排序、分类精确匹配和布局、保存筛选、跨页手工排序及确认/取消。4D 使用 286 条记录，从第 1、2 页暂存到第 14 页插入，检查顺序、数量、刷新和业务数据不变。

新增 `scripts/browser-product-list-round2.mjs` 的原版/新版对照：

- 使用同一固定基线页面、独立夹具和固定时间；原版通过 Vite 只替换页面源文件，同时要求共享领域/store/布局等依赖相对基线未改变。
- 27 个检查点比较完整持久化数据、每次 localStorage 写入的顺序/内容/次数，以及可见行和总数。验证即时输入、清空、SKU 单条状态、商品批量发布/下架/删除、表格选择原行为、日期单值/范围、分类单选/多选、枚举多选、弹窗重开、角色、路由离开/返回、排序暂存移除/清空、每页条数恢复、空库及工具的路由入口。暂存操作明确断言零持久化写入；运营访问管理员列配置路由仍被拦截，管理员入口正常。
- 原页面没有“修改每页条数”控件；用独立持久化夹具设置 pageSize=2 / page=2，刷新后检查两行和页码 2，没有虚构 UI 功能。
- 七组截图：浅色首屏、展开行、复杂筛选弹窗、视图工具、SKU、深色首屏、900px 窄屏。正常尺寸为 1440×960，窄屏为 900×960；等待字体和弹层稳定，用 PNG RGBA 逐像素比较，七组均 0 差异。未屏蔽页面区域或放宽像素阈值，并实际查看了弹窗与工具截图。
- 原版和新版 pageerror / console error / warning 均为空；含页面卸载返回的对照，无新增重复业务操作。

`git diff --check`、新增浏览器脚本的 `node --check` 均通过。三次组件提取后分别运行 build；最终整理暂存写入后再次运行类型检查、build、4D/4E 和原版/新版对照。源码检查确认新文件无 any、ts-ignore、循环依赖、监听或持久化调用。

## 复现与证据

`package.json` / `package-lock.json` 仅新增精确版本的测试开发依赖 `playwright-core@1.64.1` 和 `pngjs@7.0.0`，现有应用依赖未升级。需要本机 Chrome；新增脚本可通过 `BROWSER_CHANNEL` 选择已安装的其他 Chromium channel。基线 Git 对象须保留。

```powershell
foreach ($check in @('product-list','product-list-view','product-list-query','planning','draft-combo','material','category-tree-select')) {
  node scripts/run-domain-check.mjs "scripts/$check-check.ts"
}
npm run dev -- --host 127.0.0.1 --port 5295 --strictPort
# 在另一个终端执行：
$env:SMOKE_URL='http://127.0.0.1:5295'
foreach ($script in @('4a','4b','4c','4d','4e')) { node "scripts/browser-$script.mjs" }
# 对照脚本自行启动/关闭 5296 端口的 Vite：
node scripts/browser-product-list-round2.mjs --before
node scripts/browser-product-list-round2.mjs
npx vue-tsc -b
npm run build
node --check scripts/browser-product-list-round2.mjs
git diff --check
```

原始日志、完整数据快照和前后 PNG 在 `work/refactor-round2/`；`.gitignore` 增加该目录，避免提交测试夹具和缓存。精简结果与证据摘要见 `frontend-refactor-round2-evidence.json`。本轮新增测试脚本中的定位调整都在原版先验证，并未修改旧脚本的业务断言。

## 已有问题与边界

- 原版展开行每次渲染重新创建 SKU 数组，没有稳定的行选择恢复；实际勾选会被清掉，“所选改停售”保持禁用。对照脚本保留并断言此行为，另测单条状态修改。批量发布/下架后商品选择也可能清空，测试按原行为重新选择。
- 原有生产构建“大于 500 kB 的 chunk”提示仍存在。没有新增构建错误；本轮不做打包优化。
- 关闭 5295 测试服务器时核对到旧浏览器回归期间的 Vite 日志：基线 12:09:10 两条、重构后 12:26:16 / 12:26:17 各一条 `ResizeObserver loop completed with undelivered notifications`。该提示前后均存在；4A–4E 均通过，独立的 27 检查点固定对照没有该提示或其他浏览器诊断。本轮未改相关布局/观察器。
- 未验证 Firefox/Safari、真实 Excel 文件导入导出、低配设备性能或全站页面。导入导出入口跳转已验证；文件处理及相关领域实现未修改。不对页面速度作未经测量的承诺。
- 下一轮最值得单独处理：明确并修复展开 SKU 的选择保持规则，再以选择/展开/批量操作回归为边界提取商品表格。这需要作为行为修复单独验收。

本轮到此停止，不提交、推送、合并或部署。
