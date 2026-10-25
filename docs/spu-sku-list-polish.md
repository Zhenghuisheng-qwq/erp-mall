# SPU / SKU 列表展示优化报告

RESULT：本轮两页展示优化完成，针对性浏览器断言、相关列表回归、类型检查及生产构建通过。未提交、推送、部署；未进入新业务轮次。

## 工作区与范围

开始时实际 HEAD 为 `9e6b4b4`（分支 `20261022`），工作区干净；已核对祖先与项目适用 AGENTS.md。此前导航实现已在当前工程中，本轮未改导航源码，亦未回退既有实现。回归产生的导航截图已恢复为本轮开始时的原证据，新的列表证据单独存放。

本条请求未附带可读取的两张截图，因此以当前真实页面、同一份隔离数据、同尺寸浏览器建立优化前后对照；不宣称逐像素复现未收到的附件。

## 修改说明

| 文件 | 调整 |
| --- | --- |
| src/views/SkuWorkbenchView.vue | 自动列不再全部固定 160px；显式 width 优先，状态/日期/编号合理定宽，名称/规格/所属 SPU 弹性分配；内容内部横向滚动；数量字段右对齐；舒适/紧凑行高；单一当前视图入口；视图工具在第一层、搜索筛选在第二层；已生效条件标签保留；行内只留编辑和更多 |
| src/views/ProductListView.vue | 视图栏移至搜索前；原自动保存语义保留并明确提示，另存与恢复默认列放在同组；读取保存的列宽/冻结元数据；商品名左对齐突出；数量右对齐；物料摘要简化；编辑/新增 SKU/更多；动态快捷条件最多展示三个，全部条件仍在更多筛选及标签中 |
| src/components/product-list/SkuSummary.vue | 两行摘要；点击名称或完整规格打开按属性/值排列的弹层；显示原名称与完整文本；复制原内容，剪贴板不可用时可在只读文本框选择复制；不解析摘要推导身份 |
| src/components/product-list/columnPresentation.ts | 仅展示层列宽默认值；不写入配置、不更改系统默认字段或旧保存视图 |
| scripts/browser-list-polish.mjs | 同夹具前后截图及容器/行高、复制、菜单删除保护、导航变宽、完整 Store 不变性断言 |
| scripts/browser-r02-repair.mjs | 仅把旧长摘要文字断言更新为新计数摘要，保留 3→4→3、MAT 不变及反查等实际操作断言 |

SPU 保持既有即时保存方式，没有增加新的草稿/提交流程；“恢复默认列”只表示原有列恢复操作，不冒充 SKU 的“恢复已保存配置”。SKU 保存、另存、恢复工作配置及轻量未保存标记保持原逻辑。未改变数据迁移、编号、状态、历史快照或任何业务算法。

### 两个品牌字段的核查

`brand` 的现有读取来自 `familyBrandValues`：先读主体公共品牌属性，缺失时可汇总正式发布物料的规划来源；不是新增的独立主数据品牌绑定。`attr:参数ID` 是属性条件。页面显示为“商品品牌汇总”和“规格属性 · 品牌”，字段 ID、取值来源、AND/OR 与所有条件保持原样。未按同名合并或删除。

### 操作入口保留

SPU 更多保留适用关系、管理物料、复制、删除及手工排序插入前后。SKU 更多保留适用配件/主机、查看 SPU、管理员主机组权益包、删除、手工排序插入前后。原角色条件、确认逻辑和路由参数保持。原展开区未删除。

## 同尺寸对照与实际证据

证据目录：`work/list-polish/before/`、`work/list-polish/after/`，共用 benefit-package 隔离夹具，并给同一个真实销售 SKU 设置长名称和 12 个长规格属性。未使用用户浏览器数据。

| 验收 | 结果/证据 |
| --- | --- |
| 1366 SKU 自动宽度 | 容器 1196px，表格内容 1196px；不再保留无用途右侧空白；after/result.json |
| 1920 SKU 自动宽度 | 容器 1750px，表格内容 1750px；剩余宽度分配给内容列 |
| 900 窄屏 | 容器 730px，表格内容 1192px，在表格内滚动；断言 document 宽度不超过视口 |
| 长文本 | SKU 舒适行高 80px；目标长规格摘要高度不超过 40px、两行；点击查看属性 11 等末尾字段；复制内容包含完整原名称；complete-spec.png |
| 数据保护 | 展示/查看/复制/取消删除后的完整 Store 与开始时深比较相等；导航固定/取消前后保存视图数据相等；历史规格快照亦保持 |
| SPU 行操作 | 更多中复制及删除可到达；已发布商品继续明确拒绝直接删除，不越过原下架规则 |
| SKU 行操作 | 更多中查看 SPU 可到达，删除显示原确认弹窗，取消后数据不变 |
| 物料摘要与来源 | R02 页面回归实际关联/解绑后摘要 3→4→3，始终 1 MAT；原档案反查、完整来源与刷新仍可到达；material-regression/digest-3.png、digest-4.png |
| 保存视图与条件 | 24 个 SKU 工作台浏览器检查通过：AND/OR、临时搜索、分组、列宽/冻结保存和刷新、收藏/默认/复制/删除、范围隔离、失败重试、条件失效保护等 |
| SPU 筛选与导航 | 分类包含下级/多选、复杂条件、标签清除、范围隔离、账户像素不变、深浅主题与 1100/900/780 适配回归通过；导航专项亦通过 |
| 主题与尺寸 | 两页均拍摄 1366/1920/900；深浅主题、SKU 导航固定后重排截图已生成 |

主要对照文件：

- SPU：`before/spus-1366.png` → `after/spus-1366.png`，另有同名 1920/900。
- SKU：`before/skus-1366.png` → `after/skus-1366.png`，另有同名 1920/900。
- 完整规格及复制：`after/complete-spec.png`。
- 导航固定重排：`after/skus-pinned.png`。
- 深色：`after/spus-dark.png`、`after/skus-dark.png`。

## 实际执行

- `node scripts/browser-list-polish.mjs --before`：修改前完成同夹具截图与尺寸记录。
- `node scripts/browser-list-polish.mjs`：最终通过，证据 after/result.json；包括完整 Store 不变性和长规格行高断言。
- `node scripts/browser-sku-workbench.mjs`：24 项通过，日志 sku-regression.log。
- `node scripts/browser-navigation-filter.mjs`：导航专项及 6 组 SPU/筛选回归通过，日志 spu-regression.log。
- `node scripts/browser-r02-repair.mjs`：通过，日志 material-regression.log；仅更新被本轮替代的摘要文字，保留关键断言。
- 领域检查：sku-workbench-query-check.ts、sku-workbench-state-check.ts、product-list-presentation-check.ts、navigation-filter-check.ts 全部通过。
- `npm run typecheck`：通过；最后 `npm run build` 再次内含类型检查和生产构建，通过，build.log。
- `git diff --check`：通过。

## 剩余限制与诊断

- Chromium/Chrome 隔离上下文实际执行。未验证 Safari/Firefox、实体触屏和未提供的两张附件。
- 缩放/重排过程中开发日志记录两条 `ResizeObserver loop completed with undelivered notifications.`，未隐藏；最终尺寸、行高、操作及数据断言通过，但本轮不将其标为零诊断。日志 browser.log 可查。
- R02 复验包含原 Vue Flow options 参数弃用提示；构建包含大于 500kB 分包提示。没有因此忽略失败断言，也没有扩展业务拆包或画布升级。
- SPU 旧视图已展示较多字段时仍在表格内横向滚动，不擅自隐藏用户保存的字段。显式手动列宽不会因自动适配被覆盖。

可进入本轮两页的用户操作审查；完成后停止。
