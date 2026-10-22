# SPU / SKU 独立管理实施与验收

RESULT：**READY**。2026-10-22 完成。本轮约定的创建、追加、维护、删除保护、旧数据兼容和页面闭环已实现并实际验证。改动全部留在本地，未暂存、提交、推送、合并或部署。

## 基线与范围

- 实际分支：`20261022`；开始及结束 HEAD：`40f8df07a4a6ac9d794ef8c39e24999590cc6745`。使用当前最新本地分支，没有切换到任务中的参考分支。
- 开始时无用户未提交源码。基线由上述完整提交保存；`work/spu-sku/baseline-head.txt`、`baseline-status.txt` 记录现场。状态文件中的两条未跟踪项就是本轮刚创建的基线记录自身。
- 已核查适用目录，未发现 AGENTS.md；阅读 README、商品配置业务说明、前四轮报告和统一检查入口。前四轮成果已经在基线提交中。
- `planning.ts`、`draftComboPreview.ts`、`logic.ts`（含 `generateSkuFromModel`）、`ProductModelSelector.vue`、设计器核心页面及前三轮提取的工具、弹窗和 composable 均未改写。没有依赖升级或新依赖，`package-lock.json` 未变。
- 本轮必要修改集中在商品入口、路由菜单、列表协调、独立创建/编辑流程、写入边界、类型判定及兼容迁移。没有后端、画布、布局算法或全站样式重构。

## 已确认并处理的原风险

| 原调用链 / 风险 | 本轮处理 |
|---|---|
| `ProductEditView / ProductPlanView → catalog.saveBundle` 会整体替换 Family 的子数组 | 新流程分别调用 `saveSpu / appendSkus / editSku`。兼容 `saveBundle` 先在副本校验，再写入；未出现在草稿中的记录保留，不能借保存删除其他 SKU 或 MAT。旧编辑器处理失败结果，不再误报成功。 |
| `catalog.removeSku` 删除最后一条后自动删除 Family | 去掉自动删除父级；保留原适用关系检查和 MAT 删除回执。SPU 删除单独检查子记录及阻止删除的关联，不级联。 |
| 记录类型依赖 `family.line`，V3 主体下所有记录容易被算成 MAT | 集中判定并增加可选 `recordKind`。V3 主体可以显式追加真实 SKU；物料页、模型数量、适用物料候选使用统一判定。 |
| 商品规划直接创建新 Family，并用 `family.productPlanId` 阻止再次生成 | 改为先选择兼容 SPU，再预览及追加；每条新 SKU 保存来源。保留旧 Family 的单规划关联；有来源引用的规划拒绝删除。 |
| 双模式列表共用分页、视图及查询容器 | 两套页面设置独立持久化；迁移每个旧视图的两套配置，保留排序、列、筛选和选择状态。 |
| 新建 ID 在固定时钟、模块重载时可能与旧 ID 相撞 | 新 SPU / SKU 分配 ID 时检查现有主体、记录、删除回执和适用关联。已有 SPU 编辑目标已删除时拒绝保存，不悄悄重建。 |

## 最终数据关系与写入规则

SPU 仍为 `ProductFamily`，真实 SKU 仍以单个 `familyId` 关联有效 SPU，历史 ID 不变。模型不等于 SPU，PLN 不等于 SKU，MAT 不等于 SKU；同一 PLN 下多条 MAT 保持原语义。

`catalogIdentity.ts` 统一分类：已有物料编码或建档回执属于物料；其次读取显式 `recordKind`；未标记的历史数据再沿用 V3 Family 的判断。新 SKU 写 `recordKind: 'sku'`，新 MAT 写 `'material'`。迁移不会批量给旧记录补写类型，也不会因为新分类删除旧数据。SKU 行不再展示“该 SPU 有多少物料”作为 SKU 的关联关系。

- **保存 SPU**：允许空 SPU；只保存主体公共信息。已有 SKU、MAT 或历史身份时锁定分类、类型、模型版本及公共属性，不自动重生成子记录。名称、OA 编号和现有商品状态可维护。
- **追加 SKU**：只接受有效父级。预览区分新增、已存在和无效，新增默认选中；按当前 SPU 内规格属性身份去重，不按名称、不跨 SPU 去重。提交重新计算、校验候选和已有记录，全部校验后一次追加；旧记录顺序不变，没有新增时不写入、不更新时间。
- **单条编辑**：只更新指定真实 SKU，不更换 `familyId`。保留来源及版本；有模型节点或规划来源的规格身份锁定，普通模板规格修改也检查规则和重复。状态批量操作限定真实 SKU。
- **删除**：SKU 删除后保留 SPU；SPU 有 SKU、MAT 或阻止删除的适用关系时明确拒绝，相关管理入口仍在列表和详情中。没有新增级联删除。
- **生成来源**：新 SKU 的 `creationSource` 记录生成方式、模板、模型版本、规划 ID/名称和创建时间；规划来源还有既有 `sourceNodeIds`。追加不覆盖 `family.productPlanId`，旧记录可按父级历史规划解释，未记录的来源显示未记录。
- **历史模型**：使用 SPU 绑定的发布快照。失效版本拒绝生成；不会自动换成最新版本。版本 14 数据不会再触发旧版的“缺失版本回填最新”逻辑。模型生成复用合法组合与原 SKU 生成函数，一次预览内复用模型展开结果，没有长期缓存或数量截断。

## 使用路径和路由兼容

| 地址 / 入口 | 行为 |
|---|---|
| `/spus` | SPU 管理：搜索、筛选、排序、分组、分页、独立视图与列；准确的真实 SKU 数量，编辑/追加/管理入口。 |
| `/spus/new`、`/spus/:id` | 新建及详情编辑；保存空 SPU、保存并新增 SKU；查看子 SKU、物料和绑定的历史节点快照。 |
| `/skus`、`/skus?spu=ID` | SKU 管理及指定 SPU 的临时范围，显示“当前查看”“查看 SPU”“查看全部 SKU”。 |
| `/skus/new`、`?spu=ID` | 先选择 SPU，再手工创建、按模板范围或按模型批量预览、确认追加。支持流程内新建 SPU；取消内联表单保留原 SKU 输入；切换主体前确认丢弃未保存规格。 |
| `/skus/new?template=ID`、`?plan=ID` | 属性方案、模型、规划的真实按钮进入同一流程；优先兼容主体并解释不兼容原因。规划兼容性检查分类、类型、模型、版本及公共属性。 |
| `/skus/:id` | 单 SKU 编辑；保存/取消返回原 SKU 列表范围。 |
| `/materials/new`、`/materials/:id` | 独立物料建档和档案管理，复用 V3 建档、临时物料及物料管理组件。不是“创建 SKU”的别名。 |
| `/products`、`/products/new` | 分别转到 SPU 列表、新建 SPU，保留查询参数。 |
| `/products/:id` | SPU 详情；`?add=1` 转到预选 SPU 的 SKU 创建；旧复制规格参数也带入创建草稿。 |
| `/products/:id?sku=ID` | 按真实记录类型转到 SKU 编辑或 MAT 管理，不把 MAT 转进 SKU 编辑。 |
| `/columns`、`/products?panel=columns` | 转到 SPU 的列/视图工具。 |

菜单增加 SPU 管理、SKU 管理，旧商品菜单自定义位置及角色权限分别继承到两项。详情、创建、物料和列入口均经过权限映射；列权限还需满足所在页面权限。菜单高亮和编辑器对象切换同步处理。

临时 SPU 范围使用本地页面设置副本，重置临时关键词/过滤和页码，不改全局保存视图。退出恢复原 SKU 页的查询、列和分页；刷新或复制链接仍限定同一 SPU。不存在的 SPU 显示空范围，不能退回全量结果掩盖问题。

## 持久化兼容与维护位置

存储键仍为 `iyge-v2-mock-db`，版本从 13 升为 **14**，沿用原深度监听写入和 JSON 导入导出。

最小扩展为可选 `Sku.recordKind`、可选 `Sku.creationSource`，以及 `AppData.productListPages.{spu,sku}`。旧单页字段保留供兼容；两页各自持有视图集合、当前视图、查询/分页、筛选预设。迁移深拷贝旧视图中的两种模式，不依赖旧页当时激活哪种模式；重复加载不重复迁移、不丢记录。旧版应用本身不认识版本 14，不能把降级旧应用当作读取新版数据的方式。

| 文件 / 组件 | 职责与状态归属 |
|---|---|
| `views/ProductListView.vue` | 两个路由的共享列表实现，路由固定模式；各自协调查询、分页、选择和跳转。业务仍读同一 store；临时 SPU 范围只在页面内持有。 |
| `domain/productListPages.ts` | 两页偏好迁移和原视图命令适配；无双向 watch，不复制业务数组。修改视图/过滤仍查看 `productListViews.ts`、`productListQuery.ts` 和原 `components/product-list/`。 |
| `views/SpuEditView.vue`、`components/catalog/SpuForm.vue` | 详情历史展示、表单及保存协调；表单独占本地草稿，store 持有已保存主体。 |
| `views/SkuCreateView.vue` | SPU 归属、生成方式、候选和勾选状态、内联新建、确认提交。 |
| `components/catalog/SpuPicker.vue`、`SkuFields.vue` | 只读主体搜索/兼容说明、规格表单。规格表单编辑父页面的本地草稿，不能直接写业务记录。 |
| `views/SkuEditView.vue`、`useUnsavedCatalog.ts` | 单条维护及离开未保存流程的提示；模型/规划来源和父级不可任意改写。 |
| `domain/spuSku.ts`、`stores/catalog.ts` | 纯预览、身份/规则校验、原子追加与明确写入边界；ID 避让、删除及存储仍由 store 协调。 |
| `domain/catalogIdentity.ts` | 真实 SKU / MAT 判定唯一入口；列表、V3 档案和适用关系候选共用。 |

## 实际验证与证据

环境：Windows、Node **22.18.0**、项目依赖 `playwright-core 1.64.1`、Chrome **155.0.8059.85**。未安装或升级依赖。浏览器全部使用独立上下文，没有清空日常浏览器数据。

基线实际运行：原 `npm run check:frontend` 的 9 个检查入口全部通过；原 `npm run check:integration` 的 4a–4e 列表检查和 13 个业务检查点通过。记录分别在 `work/spu-sku/before-domain.log`、`before-integration.log`、`before-integration/`。这些是修改前结果，不冒充最终运行。

| 最终执行命令 | 结果 / 证据 |
|---|---|
| `npm run typecheck` | 通过；`work/spu-sku/typecheck.log`。 |
| `npm run build` | 通过，包含 vue-tsc 和 Vite 生产构建；`work/spu-sku/build.log`。保留原有大包提示。 |
| `npm run check:frontend` | 原 9 个入口及新增 SPU/SKU 入口全部通过，共 10 个入口；`work/spu-sku/final-domain.log`。 |
| `npm run check:spu-sku` | 新增 19 组领域检查、12 个浏览器流程检查点通过；`work/spu-sku/final-spu-sku.log`。 |
| `node scripts/browser-spu-sku.mjs` | 增补“退出临时 SPU 范围恢复第 2 页”断言后完整重跑通过；最终结果、完整有序业务快照和诊断在 `work/spu-sku/browser/result.json`，日志为 `final-browser.log`。 |
| `npm run check:integration` | 最终代码 4a–4e 全通过，13 个业务检查点全通过；`work/spu-sku/integration.log`、`final-integration/result.json`、`states.json`、`diagnostics.json`。 |
| `node scripts/run-domain-check.mjs scripts/compatibility-check.ts` | 15 项通过，包含真实物料表关联；`work/spu-sku/compatibility.log`。 |
| `node scripts/run-domain-check.mjs scripts/excel-import-check.ts` | 20 项通过；真实工作簿含 1234 个公式、物料表无合并单元格，正式导入 583 条、重复预览识别已导入 583 条；`work/spu-sku/excel-import.log`。 |
| `node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --strict --types node scripts/spu-sku-check.ts scripts/spu-sku-fixtures.ts` | 新检查和夹具的独立严格类型检查通过；`work/spu-sku/check-types.log`。 |
| `git diff --check` | 通过；最终补丁和文件清单见下面的本地交付。 |

真实 Excel 两个补充检查使用只读文件 `D:\单子\商城erp\前期包\2.0 数据\1.1 手机 Apple.xlsx`。现在可用环境变量 `ERP_MATERIAL_XLSX` 指定其他位置，缺文件明确失败。通用 `check:frontend` 不依赖这个外部文件。PowerShell 示例：

```powershell
$env:ERP_MATERIAL_XLSX = 'D:\自己的数据目录\1.1 手机 Apple.xlsx'
node scripts/run-domain-check.mjs scripts/compatibility-check.ts
node scripts/run-domain-check.mjs scripts/excel-import-check.ts
```

新增脚本使用项目依赖和动态本地端口，没有个人工具绝对路径。浏览器默认 Chrome，可设置 `BROWSER_CHANNEL=msedge`；缺浏览器会失败。新流程输出目录可设置 `SPU_SKU_OUTPUT_DIR`，集成验收可设置 `FINAL_OUTPUT_DIR`。

### 本轮风险覆盖

- 空 SPU 保存和刷新；从 SKU 页先选 SPU、从 SPU 预选、内联新建后继续；取消内联表单保留输入，取消切换 SPU 保留原主体和草稿。
- 模板、模型、规划页面实际入口；单条创建及一次多个规格；追加保留旧 SKU/MAT 内容和顺序；批内重复、重复来源、重复提交、重复点击均不重复创建。
- 原子校验失败、失效候选/父级、缺失配置、失效历史版本；预览不写业务对象或分配正式编号。
- 单条编辑、批量状态、SPU 改名不影响同级数据；最后一条 SKU 删除后 SPU 保留；有子记录的 SPU 拒删。
- V3 Family 同时有 3 条真实 SKU 和同一 PLN 的 2 条 MAT；真实 SKU 列表/数量、物料列表、旧定位链接分别正确。
- 不同规划分批追加保留每条来源，父级历史来源不覆盖；绑定版本不跟随新增版本；发布快照、PLN 和建档回执不被新流程改写。
- 两页查询、列、保存视图、分页独立；临时范围清除旧关键词，刷新保持范围，退出恢复旧筛选和第 2 页；旧新增、详情、添加 SKU、SKU/MAT 定位和列配置链接可用。
- 累计集成验收继续覆盖设计器预览重复打开不写入、发布 PLN 沿用/新增、同一 PLN 多物料、模型切换、弹窗取消/确认、离开返回、快捷键及历史快照。

领域检查固定时间和 ID 生成器，比较完整对象、身份、关联和数组顺序；另有固定时钟 ID 碰撞/删除回执保护用例。浏览器固定业务 `new Date()` 时间，`Date.now()` 随界面计时前进，以免冻结 Element Plus 的防抖。浏览器断言使用本次真实产生的稳定 ID 比较关联，不抹掉 ID 或排序差异。排障中冻结全部时钟导致的全选超时已定位为测试环境问题，修正计时后保留全选和批量状态断言通过。

### 最终视觉证据

以下均为本轮实际截图，位于 `work/spu-sku/browser/`：

- `spu-desktop.png`、`sku-scope-desktop.png`：1600×1000 明亮主题列表、所属范围及入口。
- `template-batch-preview.png`、`plan-batch-preview.png`：新增/已有候选、来源及批量确认。
- `material-with-real-skus.png`：同一主体下只在物料档案展示 MAT。
- `sku-narrow.png`、`sku-create-narrow.png`：780×900 窄窗口；表格保持横向滚动、操作入口可达，表单正常换行。
- `spu-dark.png`：通过实际主题按钮切换的暗黑列表。

已人工查看关键截图。未要求新页面与旧双模式页逐像素一致。没有改动设计器渲染代码，其既有视觉成果保留；本轮集成操作重新验证了设计器业务和生命周期。

## 既有问题、验证边界与本地交付

- 基线与最终列表集成均出现 **2 条 ResizeObserver** 提示，设计器均出现 **2 条 Vue Flow 参数弃用**提示；未屏蔽警告。新建 SPU/SKU 的独立浏览器检查中没有 pageerror、console error 或 Vue 警告。
- 生产构建仍有大包提示，未因此改加载结构。历史 SPU 展开行的既有 SKU 勾选重置问题不在本轮修复；独立 SKU 页的全选、批量状态及删除保护已实际验证。
- 旧记录如果公共属性与绑定模型本来不一致，新流程不会篡改其历史内容或强行补成合法规格；只能在有效配置下生成。已有身份锁定的记录可维护公开信息，其他规格通过新建兼容 SPU 或追加合法规格处理。
- 验证覆盖 Chrome、桌面及窄窗口、明亮/暗黑主题和已有真实 Excel 样本；未扩展到所有浏览器、移动设备或任意第三方工作簿。后端、跨 SPU 迁移及多人并发持久化不属于本轮。
- 完整本地补丁：`work/spu-sku/spu-sku-full.diff`，包括全部未跟踪的新源码、检查和本报告；`git apply --reverse --check` 用于只读验证补丁与当前工作树一致，未应用。普通 `git diff` 只显示已跟踪文件，审查时还应查看 `git status --short` 中的新文件。
- `work/spu-sku/final-evidence.json` 保存最终分支、HEAD、源码/检查文件 SHA-256 清单和验收摘要。原四轮报告和历史证据没有改写。

本轮可以验收并停止扩展；没有遗留已知阻断创建或数据一致性的本轮问题。READY 不代表全项目所有历史问题均已解决。
