# 商城 ERP：功能补齐第一轮

RESULT：PARTIAL。

A、B、C 三项功能已实现，新增领域验证、Chrome / Edge 主流程和相关旧回归通过，类型检查及生产构建通过。整体未标记 READY 的原因是一次执行范围失误：首次运行两个旧检查时遗漏输出目录变量，覆盖了两份历史测试 JSON，未找到可按历史哈希恢复的副本。该问题不影响业务代码运行，但不满足用户“保留已有成果、临时文件仅放本轮目录”的要求，详见第 8 节。

## 1. 实际基线与范围

- 工程：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 分支：`20261022`。
- 开始 HEAD：`438178229f70e8bde782debe781c0431824be34d`，与任务参考提交一致。
- 开始 `git status --short` 为空。未回退分支或覆盖用户未提交源码。
- 已读取 README、package.json、业务闭环及既有工作台实现；项目根目录、src/scripts/docs 和检查到的祖先目录未发现适用 AGENTS.md。
- 保留当前浏览器本地演示存储、普通 HTTP 保存支持及默认双栏导航。
- 未创建源码副本、整套补丁、仓库快照或新的 `_audit-baseline`；原 `_audit-baseline` 保留未动。
- 未提交、推送或部署；未升级依赖。

本轮仅实现常用筛选、结构内关联物料、页面功能与反馈承接。下一轮分类双栏、节点新增浮层、菜单配置未实施。

## 2. A：SKU 常用筛选

### 使用及数据归属

在筛选弹窗的条件行勾选“显示在常用筛选”，点击应用后出现在工作台顶部。弹窗内勾选、修改、复制和删除不会提前改变列表，取消丢弃弹窗草稿。

`SkuViewConfig.quickFilters` 保存有序引用数组：

```ts
type SkuQuickFilterRef =
  | { source: 'condition'; ruleId: string }
  | { source: 'legacy'; filterId: string }
```

顶部控件按引用找到原条件，只修改原条件的 value。条件仍在原 AND/OR 组内，不复制到根部，不按字段名合并同字段多条件。显示组上下文、字段和操作符，可隐藏、前后移动；超过四项默认折叠。无取值操作符展示说明和编辑入口，不生成开关。

隐藏只删除引用；删除原条件时统一清理悬空引用。条件行与条件组复制分配新 ID，复制出来的条件不误引用原外露项。整个视图复制沿用配置内稳定 ID，但数组及配置独立。简单根级分类已经外露时，不再重复显示等价的固定分类控件；SPU 路由范围仍保持独立语义。

### 三层状态与失败处理

- 筛选弹窗：独立副本，应用成功才关闭；应用失败保留弹窗与错误。
- 当前工作配置：沿用 `useSkuWorkbench.apply`，应用不覆盖正式保存视图。
- 正式视图：保存、另存、复制、恢复使用现有工作台命令和持久化协调器。

展示引用进入默认配置、修复、迁移、保存、复制、恢复和 dirty 比较。系统视图继续要求另存；SPU 范围默认不保存，现有显式包含范围机制不变。

顶部文本在 Enter / 失焦时提交，选择控件在选择后提交；日期区间使用有格式提示的起止输入，完整且有效才应用。数值分支复用字段类型及现有校验。无效或未完成输入保存在控件内，就近显示错误，查询继续使用上次有效配置；临时空值不删除条件。

Escape 恢复已应用值。输入法组合期间不提交；保存、另存、恢复、切换视图、复制视图及站内离开前处理待应用输入。未完成输入会阻止相应动作。原生持久化等待期间工作区 inert，重复提交不重复写入，视图切换成功后才更新当前身份。保存成功后的清理使用捕获的工作键，避免清理另一个视图。

失败继续沿用原工作台“当前工作配置保留”的语义：合法配置可以留在当前工作区供重试，但不会假报正式保存成功；输入和就近错误也保留。没有新增业务 localStorage 写入口。

### 历史数据

旧 exposed 字段按实际已有 filter ID 建立引用，同字段多条条件均可建立引用，没有对应条件的字段不创建空条件。缺少 ID 的旧条件首次修复时分配确定、不冲突的 ID，后续读取保留，迁移幂等。

显式空 quickFilters 数组代表用户已隐藏，不会再次从旧 exposed 恢复。旧 `created` 快捷控件映射到 SPU 创建日期的展示/校验口径，执行查询仍保留原 legacy 字段。不能安全按现有类型编辑的旧条件展示原语义入口，不改写其限制。

动态属性通过稳定属性 ID 关联。字段被删除后保留原条件和有效引用，显示失效信息，沿用原无效配置暂停查询机制。

## 3. B：完整结构内的组合—物料展示

在单模型“结构视图 / 完整结构”增加“显示关联物料”开关。打开后，当前结构工作区直接显示完整组合摘要、PLN、本版本建档状态、实际保存的物料名称和 MAT 编号。展示区可搜索、分页和收起，不需要先打开合法组合弹窗。

- 复用 `legalComboMaterialStatus` 的发布快照、完整 identityKey、规划关联和版本语义。
- 修正读取时只按 PLN 扫描所有 SKU 的问题，使用现有 `createCatalogIdentityContext` 排除销售 SKU。
- 一次查询建立规划身份、MAT、缺失回执和版本名索引，不对每个画布节点重复展开组合。
- 同一 PLN 的多条 MAT 全部保留，同名不同 ID 不合并；名称与编号读取档案原值，不重新命名。
- 当前版本物料与历史物料分开，只有历史关联时本版本仍为未建档。
- 无版本旧档保留既有“来源版本展示”口径并明确异常说明；异版、重复规划、缺失回执、不匹配组合保留诊断。
- 临时规划不进入正式组合关联；销售 SKU 不充作 MAT。
- 发布模式按明确选择的发布快照生成摘要。画布继续显示当前模型，界面明确说明；历史节点与当前结构不一致时不按名称猜测定位。
- 草稿模式按当前结构生成组合；只有与所选发布版本完整身份相同的已有组合可带出其真实关联，草稿新增组合没有虚构 PLN/MAT。
- 点击组合使用全部参与取值节点 ID 高亮，先核对完整组合身份及节点值/属性；不改变业务节点选择、坐标、撤销记录或模型结构。
- 点击 MAT 使用 `/materials/:familyId?sku=:skuId` 进入现有指定档案。

展示不触发发布、对账、编号分配、物料创建或回执生成。浏览器对打开、定位、历史切换、草稿展示前后的业务数据进行了完整相等断言。

组合每页 10 条；每组当前物料、历史物料及异常列表也采用分页。没有将组合或 MAT 生成为 ModelNode。展开时仅让当前工作区可滚动，并保留至少 240px 画布空间，不改外部三栏结构；关闭后恢复原布局。

## 4. C：页面功能清单与反馈

补齐以下真实路由对应说明：

| 页面 | 路由 |
|---|---|
| SPU 列表、新建、详情 | `/spus`、`/spus/new`、`/spus/:id` |
| SKU 工作台、新建、编辑 | `/skus`、`/skus/new`、`/skus/:id` |
| 物料建档、档案 | `/materials/new`、`/materials/:id` |
| 权益包列表、新建、详情 | `/benefit-packages`、`/benefit-packages/new`、`/benefit-packages/:id` |
| 交付清单 | `/benefit-packages/deliveries/:id` |
| 模板兼容和结构物料 | `/specs` 内的实际能力 |

路由匹配先识别 new 和 deliveries，再识别普通详情，不硬编码记录 ID。旧 products 入口及列配置帮助继续可解析。

新功能 ID 使用业务命名空间；旧清单的短 ID 在返回帮助时加稳定页面前缀，消除跨页 create/edit 等重名，修复 specs 内重复 naming ID。已有反馈记录不迁移、不改写，仍按原保存的 ID、名称、标题展示与导出。

PageAssist 使用完整路由作为反馈来源，保留记录 ID、SPU 范围、模型及相关查询参数；功能清单匹配使用规范页面键。未知清单的来源标题回退路由标题，不统一使用“当前页面”。

本机反馈、SKU/MAT 区别、权益包只生成清单的边界明确说明，没有把本机反馈升级为服务器工单，也未宣称支付、扣库存、出库或激活已经实现。

## 5. 修改文件与职责

| 文件 | 职责 |
|---|---|
| `src/domain/skuWorkbenchTypes.ts` | 常用筛选引用类型 |
| `src/domain/skuQuickFilters.ts` | 稳定引用解析、去重、迁移、隐藏及条件遍历 |
| `src/domain/skuWorkbenchState.ts` | 默认值、修复、legacy 引用迁移及缺失 ID 修复 |
| `src/components/product-list/useSkuWorkbench.ts` | 统一引用清理、pending 保护及切换/保存上下文 |
| `src/components/product-list/sku/SkuRuleEditor.vue` | 条件复制及外露勾选 |
| `src/components/product-list/sku/SkuFilterDialog.vue` | 草稿外露、复制、异步应用及失败保留 |
| `src/components/product-list/sku/SkuQuickFilters.vue` | 顶部取值控件、本地输入、验证、IME/Escape、排序和隐藏 |
| `src/views/SkuWorkbenchView.vue` | 快捷输入与保存/切换/路由流程协调、避免等价分类重复入口 |
| `src/domain/comboMaterialStatus.ts` | MAT 身份过滤、调用内索引、参与节点只读投影 |
| `src/components/model-editor/StructureMaterials.vue` | 发布/草稿组合—物料展示、分页、定位和档案跳转 |
| `src/views/SpecConfigView.vue` | 开关、工作区布局及不写业务数据的高亮 |
| `src/domain/pageFeatures.ts` | 新页面功能、动态路由、稳定唯一功能 ID |
| `src/components/PageAssist.vue`、`src/layouts/AdminLayout.vue` | 完整反馈来源和标题承接 |
| `.gitignore` | 忽略本轮临时验收输出 |
| `scripts/functional-gaps-fixture.ts` | 独立合成样本，非线上商品 |
| `scripts/functional-gaps-check.ts` | 新语义领域检查 |
| `scripts/browser-functional-gaps.mjs` | 真实 Chrome/Edge 流程与失败场景 |

`ProductModelSelector.vue`、`logic.ts`（含 generateSkuFromModel）、`planning.ts`、`material.ts`、命名算法、发布快照业务及模板兼容/权益包算法未修改。类型、分类和 SPU 没有合并；未新增价格、库存、支付、BOM 等能力。

## 6. 实际验证

环境：Windows；Node v22.18.0；Chrome 156.0.8078.47；Edge 156.0.4314.42。浏览器使用独立 BrowserContext，不清空日常浏览器数据。最初沙箱阻止访问本机测试服务，随后在获准的本机执行环境完成浏览器验证。

### 新增检查

```powershell
node scripts/run-domain-check.mjs scripts/functional-gaps-check.ts
node scripts/browser-functional-gaps.mjs
$env:BROWSER_CHANNEL='msedge'; node scripts/browser-functional-gaps.mjs
```

领域检查通过：引用展示不改变查询顺序；OR 组及同字段多条件；复制独立；旧创建日期；缺失 ID 稳定修复；重复迁移；失效属性；SPU 范围；同级属性组合；同名多 MAT；销售 SKU 排除；当前/历史/无版本/异版；只读数据；动态路由及功能 ID 唯一性。

Chrome、Edge 的新流程通过：

- 弹窗外露取消/应用、顶部隐藏和顺序、原条件同步。
- 无效输入保持查询、Escape、组合输入事件期间不提交。
- 保存、另存、复制、恢复、刷新和 SPU 临时范围。
- 不完整日期和动态属性直接编辑。
- 配额失败保留及重试；同源双标签页冲突保留输入。
- 实际 Web Lock 持锁期间重复提交仅一次写入，等待期间禁止切换操作。
- 两条同名 MAT 可见、完整组合全部取值节点高亮、准确档案 query。
- 历史版只有历史物料仍为未建；草稿新增组合不伪造 PLN/MAT；展示不写业务数据。
- 实际进入 SPU、SKU、物料、权益包、已保存权益包详情和真实生成的交付清单页面检查帮助。
- 实际保存具体功能反馈，断言页面、功能 ID、功能名及 `/skus/gaps-a?spu=gaps-spu` 完整来源。

大样本复用已有模板兼容 fixture（8 款式 × 32 颜色 × 16 包装）：4096 组合，每页 10 行，实际画布 291 节点；打开及翻页断言通过。原始耗时在 browser 结果中，属于本机单次观测，不是旧实现对比或性能承诺。

### 已有回归

实际执行以下入口，退出码均为 0：

```text
node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-state-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-migration-fix-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-restore-fix-check.ts
node scripts/run-domain-check.mjs scripts/spu-sku-check.ts
node scripts/run-domain-check.mjs scripts/product-list-query-check.ts
node scripts/run-domain-check.mjs scripts/planning-check.ts
node scripts/run-domain-check.mjs scripts/material-check.ts
node scripts/run-domain-check.mjs scripts/template-compatibility-domain-check.ts
node scripts/run-domain-check.mjs scripts/template-compatibility-state-check.ts
node scripts/run-domain-check.mjs scripts/benefit-package-domain-check.ts
node scripts/browser-sku-workbench.mjs
npm run typecheck
npm run build
git diff --check
```

`product-list-query-check` 复用原命名、组合物料、档案、列表及视图断言。未机械运行依赖独立历史基线的全部旧视觉脚本。旧 SKU 浏览器流程包含已保存视图、范围、失败、字段、排序、分组、明暗及窄屏等原检查。

后续重跑应设置：`SKU_WORKBENCH_OUTPUT_DIR`、`SKU_MIGRATION_FIX_OUTPUT`、`SKU_RESTORE_FIX_OUTPUT_DIR`、`TEMPLATE_COMPATIBILITY_OUTPUT_DIR`、`BENEFIT_DOMAIN_OUTPUT_DIR` 至 `work/functional-gaps-round1/` 下对应目录。新增浏览器脚本已固定在本轮目录按浏览器隔离输出。

## 7. 少量关键截图与结果

已查看截图，覆盖暗色 1366×768、明亮较窄 980×768、明亮 125% CSS 缩放等效场景。旧 SKU 浏览器回归另覆盖 780×900。125% 是脚本设置 CSS zoom，不冒称操作系统 DPI / 浏览器工具栏缩放全覆盖。

- `work/functional-gaps-round1/browser/chrome/quick-dark-1366.png`
- `work/functional-gaps-round1/browser/chrome/quick-light-980.png`
- `work/functional-gaps-round1/browser/chrome/structure-light-125.png`
- `work/functional-gaps-round1/browser/chrome/chrome-result.json`
- `work/functional-gaps-round1/browser/msedge/msedge-result.json`
- `work/functional-gaps-round1/sku-regression/result.json`

截图辅助判断布局，业务通过依据是数据、路由、身份和失败保留断言。

## 8. 问题与限制

### 既有问题

- Vue Flow 的 options 参数弃用警告仍存在；新脚本单独列入 knownWarnings，没有屏蔽运行错误。
- 生产构建保留大于 500kB 的 chunk 提示，未借此扩大打包改造。
- 无 Web Locks 的普通 HTTP 仍沿用现有本页队列，不宣称可保证跨标签页原子事务。

### 本轮修复的问题

- 修复新元数据在历史迁移时因默认空数组导致不迁移的情况，补幂等及隐藏不复活断言。
- 修正新分页控件使用旧 small 属性带来的弃用警告，使用 size="small"。
- 修正视图切换提前更改 activeId 以及保存后按可变 activeId 清理工作配置的边界。
- 修复复制视图入口绕过尚未完成快捷输入处理的问题。
- Element Plus 隐藏原生 checkbox、select 标签遮盖输入及合成 IME 事件的测试定位问题已调整，没有放宽业务断言。

### 未完成的历史产物保全

首次运行旧脚本漏设环境变量，实际覆盖：

1. `work/sku-workbench-fixes/migration/after-result.json`
2. `work/sku-workbench-fixes/restore-after.json`

这两项是 Git 忽略的旧验收产物，非生产源码。此前审计记录中的最后 SHA256 分别为：

- migration：`94f598851f27b35de77700f1976a9eb7d7ef4b649a60e5b404b05330d13f3184`
- restore：`9469339dda06e4753b1b35a8cfd7a7e060b1211ca5d0c5a98655e960e10d71c7`

当前产物与这些历史哈希不同，搜索现有同名副本未找到匹配项。因为本轮没有开工前的原文备份，不能证明或恢复开工时原始字节，未用重新生成内容冒充恢复。后续输出已隔离。这是本轮执行失误，不是用户要求的清理，也没有删除整个旧目录。

因此功能完成与成果保全分别报告；整体 RESULT 为 PARTIAL，未完成项仅为上述旧产物原字节恢复，不能宣称所有旧成果完整保留。

### 未验证项及实际边界

- 输入法通过真实浏览器的 CompositionEvent/InputEvent 验证防误提交，没有人工操作所有 Windows IME。
- 当前字段目录没有可对用户暴露的规范数字/布尔业务字段；控件保留类型分支，未虚构价格/库存字段，也不声称这些不存在的业务字段完成了端到端验收。
- 未覆盖所有浏览器、屏幕、操作系统 DPI 或原生打印对话框；没有新增打印逻辑。
- 历史快照与当前画布结构不同的情况下，只定位仍有完整身份匹配的节点；不会为展示改写当前模型或加载历史节点覆盖草稿。

## 9. 下一轮范围与停止点

下一轮仍为分类双栏、节点新增浮层、菜单配置，本轮没有提前实施。继续普通变更依靠 Git，不复制整套源码作为审计基线。

当前源码、报告及验证工具保留在正式工程；本轮验证产物位于 work/functional-gaps-round1，除第 8 节披露的两份误覆盖产物外，没有将本轮产物写入商城 ERP 根目录。未执行 git add、commit、push、merge 或部署。
