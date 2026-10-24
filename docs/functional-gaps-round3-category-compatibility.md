# 第三轮定向修复：分类子树、兼容同步与转换输入保护

RESULT：READY（仅本轮 A／B／C／D 范围）。

本轮实现和关键验收通过。第一轮两份历史测试 JSON 的原字节仍未恢复；本轮结果不代表历史原件已经恢复，也不代表全部 ERP 功能完成。

## 1. 工程、基线与原有工作

- 正式工程：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 实际分支：`20261022`。
- 开始／结束 HEAD 均为 `27729d2b1a23e10b1c8f85ae5209ec29a4e8f814`。
- 开工时已有 710 条 `work/` 下已跟踪文件删除记录，来自此前用户明确要求删除整个 work 的操作；本轮保留这些删除，没有还原旧目录。开工时没有其他源码修改或未跟踪文件。
- 阅读了 README、package.json、前两轮报告及相关调用链；检查到的工程与适用祖先目录没有 AGENTS.md。
- 未提交、推送、合并或部署；暂存区为空。未创建分支、worktree、源码副本、全量补丁或新的审计基线。
- 运行目录：`work/functional-gaps-round3/20261024-1840-c72a/`。下文证据短路径均相对此目录。

Category → 显式产品类型 → 模型 → 属性／值 → 合法组合／PLN → MAT 的关系保持。SKU／MAT 身份继续复用现有工具；没有修改 V2 选择器、generateSkuFromModel、规划编号或历史快照算法。没有实施分类双栏、拖拽、节点新增浮层、菜单扩展、后端或其他下一轮工作。

## 2. 修复前复现

证据：`baseline/baseline.json`、`baseline/chrome/result.json`、`baseline/chrome/conversion.png`。

1. **分类**：原快捷入口生成 `category in ['c-host']`。隔离 fixture 中，选择主机得到 0 条，选择手机得到 5 条；属于手机的 `gaps-a` 被父分类漏掉。`in` 本身没有错误，错误在快捷入口用精确匹配表达子树意图。
2. **同步**：甲／乙／丙三个模板来源中，把组外丙人工改为明确不兼容，保留模板 provenance；新版本合并甲乙。旧预览仍返回 `group.canAdopt=true`。根因是只把 `provenance.kind !== 'template'` 当成人工声明。最终浏览器 fixture 进一步使用“甲乙由 Orion A 合并为 Orion B、组外丙人工排除 Orion B”的场景。
3. **转换**：真实 Chrome 选择例外、选择设备、填写未应用依据，再转换旧节点记录。旧代码没有确认就切换例外；原批量依据输入消失。源码另确认 dirty 只看型号选择数量，清空型号会漏掉残留公共字段。

查询层原有的“明确不兼容优先”没有被描述或改成失效。本轮修复的是同步预览／采用遗漏冲突。

## 3. A：分类规则、旧视图与常用筛选

快捷入口现在保存一个 `descendants` 规则，值为用户选择的根分类 ID 数组。例如：

```json
{"kind":"rule","id":"category-quick","field":"category","operator":"descendants","value":["c-host","r3-accessory"]}
```

查询时按当时分类树展开每个根，取并集；不把后代 ID 永久写入视图。父子同时选择不重复 SKU，后来新增子类会自动进入结果。其他筛选及 SPU 路由范围继续取交集。

- 保留 `descendants` 旧字符串值；支持新的多根数组。现有 SkuValue 已支持字符串／字符串数组，无须数据版本迁移。
- `eq`、`in`、`neq`、`notIn` 保持精确语义。加载旧视图不转换条件；用户重新操作快捷树才生成子树条件。旧精确条件会提示“当前精确匹配；重新选择包含下级分类”。
- 新领域助手只识别根级 AND、无子组、至多一条支持的分类规则。复杂 OR、嵌套组或历史分类规则保留原条件，进入高级筛选，不拍平或删除。
- 修改已有分类条件保留原 ruleId；新建时避开已有节点 ID。清空只删除对应分类规则，通过已有 repairQuickFilters 清理悬空引用。
- 侧栏和弹出树都从同一条件树读取选中状态；不增加第二份持久化状态。排序、分组、展示列、冻结配置保持。
- 同步扩展校验、查询、规则编辑器和常用筛选多选控件。既有规范化与摘要已经支持数组，新增测试验证其保存回显。

已验证父分类、叶子、多根并集、父子重叠、取消一项、空分类、SPU 交集、新子类、旧精确条件、复杂组保护、稳定 ruleId、清空引用、查询无业务写入。Chrome／Edge 均实际操作两个分类入口、另存、保存、恢复、刷新及常用筛选外露／编辑／隐藏。

## 4. B：实际保护状态与最终候选校验

可由模板安全管理的声明同时满足：来源为 managed、声明仍为模板 managed、originKey 对应、实际内容等于上次模板基线、商品来源 stamp 一致。其余当前声明进入保护检查，包括人工创建、模板来源但被改动、人工保留、来源过期及没有有效管理基线的声明。

预览合并／拆分组时检查组外仍会保留的受保护声明。显示具体商品／物料、阻塞声明 ID、主机、范围、能力和相反结论，并提供现有“维护此商品声明”入口。组内保护保持；独立人工相同内容也不被认领。

新增最终候选校验按照本次选择汇总实际移除／替换的旧声明，再检查保留声明与所有新结果、以及新结果之间的冲突。复用原有 target kind、主机身份、型号／精确 PLN 范围和能力重叠判断。仅改变部分同步项而留下相反结论会被拒绝；合法替换全部相关旧声明不会把它们误算为保留结果。

实际采用入口重新生成预览并核对 basis／items，再做候选校验，全部通过后才开始修改或分配 ID。旧计划、被改写的计划或冲突均在写入前拒绝，没有部分写入。

移除了原单项采用中“顺带删除 blockingIds”的逻辑。独立人工拒绝不能通过模板采用按钮取消或覆盖；先到现有维护页明确处理，再重新预览。既有受保护来源的逐项决定语义保持，组内人工保护不能整组覆盖。

已验证组外 modified／manual／kept／stale、普通人工拒绝、组内保护、合法合并／拆分、不同主机／目标／能力、最终选择组合、旧预览原子拒绝、处理后重试、重复同步与历史不变。兼容查询的 19 组回归覆盖精确 PLN、型号范围、不同 SKU／MAT、条件、基本／快充维度及不兼容优先。

## 5. C：两阶段转换与完整 dirty

转换流程为：捕获当前上下文和输入 → 用现有纯领域函数生成候选 → 必要时确认 → 重新核对上下文和候选 → 同步应用草稿及目标选择 → 最后清理获准放弃的旧输入。

- 捕获模型、版本、当前例外、待转换 ID、草稿、两处批量输入、已保存配置及上下文 epoch。
- epoch 跟随模型／版本／只读权限／弹窗状态／选中例外／store generation／数据替换失效。确认后还会重算旧记录转换候选，发现结构或记录变化便拒绝。
- “继续填写”不转换、不切换、不清理；“放弃输入并转换”只在重验通过且成功提交草稿后清理。
- 转换忙碌期间阻止重复触发，旧记录转换标记防止再次生成。它仍然只是本次草稿，保存继续经过原持久化协调器。
- 切换例外、新增例外、定位其他例外复用小型批量确认方法；确认只取得用户决定，转换不会调用会提前清空输入的切换方法。

共享编辑器的签名包含型号集合、能力、结论、核验、依据和条件文本。清空型号但仍有公共字段改动时，输入区继续可见且 dirty 保持；改回原始状态可以恢复干净。成功应用到声明后，在清空型号的同时推进已应用基准，保留公共字段供下一批复用，不产生永久 dirty。没有有效新增设备时不会假装应用成功。

Chrome／Edge 验收覆盖取消、明确放弃、转换候选在确认期间失效、generation 变化导致迟到确认拒绝、保留旧记录选择后重试、清空型号仍保护、公共字段恢复干净、成功应用后保存、配额失败重试、双击不重复、只读查看禁止转换。转换保存前不产生正式声明；保存后的正式关系和历史快照仍与 fixture 一致。

## 6. 修改文件与职责

| 文件 | 职责 |
|---|---|
| src/domain/skuCategoryFilter.ts | 快捷分类条件识别、稳定 ID 更新和引用清理 |
| src/domain/skuWorkbenchQuery.ts | 多根 descendants 校验与实时子树并集 |
| src/views/SkuWorkbenchView.vue | 两处分类树接入同一状态及语义提示 |
| src/components/product-list/sku/SkuRuleEditor.vue、SkuQuickFilters.vue | 分类子树数组编辑与旧字符串回显 |
| src/domain/templateCompatibilitySync.ts | 实际保护状态、组外阻塞、最终候选与提交前校验 |
| src/components/template-compatibility/TemplateCompatibilitySyncDialog.vue | 阻塞详情、维护入口、当前决策候选提示与按钮保护 |
| src/components/template-compatibility/TemplateCompatibilityDialog.vue | 转换准备／确认／重验／提交，异步上下文与重复保护 |
| src/components/template-compatibility/TemplateClaimSetEditor.vue | 全字段 dirty、清空型号后保留输入、成功应用推进基准 |
| scripts/functional-gaps-round3-check.ts、round3-repro.ts | 新领域回归与修复前复现 |
| scripts/browser-functional-gaps-round3.mjs、browser-round3-category-sync.mjs | 独立 Chrome／Edge 实际交互验收 |
| scripts/compatibility-refinement-sync-check.ts | 增加可选输出文件路径，相关 fixture 输出随目录隔离 |
| scripts/browser-template-compatibility.mjs | 原“模板采用可删除人工拒绝”断言改为本轮要求的禁止覆盖断言 |
| .gitignore | 定向忽略可重建测试缓存和生成的编译配置 |
| docs/functional-gaps-round3-category-compatibility*.{md,json} | 详细报告与精简机器摘要 |

原工程已有另外用途的 `scripts/round3-check.ts` 与 `scripts/browser-round3.mjs`。新脚本最终采用上表名称；这两个旧脚本已核对 Git 内容，最终无差异，没有替换其原功能。

## 7. 实际验证和证据

| 检查 | 结果 | 证据短路径 |
|---|---|---|
| 新增领域回归 | PASS，11 组 | `domain-accepted/domain.json` |
| SKU 查询 | PASS，23 组 | `regression/sku-workbench-query-check/output.txt` |
| SKU 视图状态 | PASS，6 组 | `regression/sku-workbench-state-check/output.txt` |
| 模板兼容领域 | PASS，21 组 | `regression/template-compatibility-domain-check/domain-evidence.json` |
| 模板编辑／存储状态 | PASS，14 场景 | `regression/template-compatibility-state-check/evidence.json` |
| 来源合并／拆分同步 | PASS，19 组 | `regression/compatibility-refinement-sync-check/sync.json` |
| 第一轮领域 | PASS，4 组 | `regression/functional-gaps-check/output.txt` |
| 第二轮设计器保护领域 | PASS，7 组 | `regression/editor-safety-check/output.txt` |
| 兼容查询作用域与能力 | PASS，19 组 | `accessory-query/query-result.json` |
| 第一轮 Chrome 浏览器 | PASS，10 组 | `round1-regression/chrome/chrome-result.json` |
| 既有模板兼容 Chrome 浏览器 | PASS，14 组 | `template-browser-regression/result.json` |
| 分类／同步 Chrome | PASS，4 组 | `category-accepted/chrome/result.json` |
| 分类／同步 Edge | PASS，4 组 | `category-quick-final/msedge/result.json` |
| 转换输入保护 Chrome | PASS，5 组 | `conversion-final/chrome/result.json` |
| 转换输入保护 Edge | PASS，5 组 | `conversion-final/msedge/result.json` |
| 类型检查 | PASS；独立 typecheck 及最终构建内检查 | `build-output.txt` |
| 生产构建 | PASS；构建产物验完删除 | `build-output.txt` |
| git diff --check | PASS，退出码 0 | 本轮终端核对及机器摘要 |
| 忽略规则 | 缓存／dist 忽略，源码／脚本／报告／新证据不忽略 | `ignore-check.json` |

浏览器为本机 Chrome **156.0.8078.47** 和 Edge **156.0.4314.42**，均 headless、独立 BrowserContext、zh-CN，桌面 1440×1000，窄屏 780／850×900。第一轮与旧模板回归沿用各自视口。

采用真实 DOM、鼠标和键盘操作，没有调用页面处理函数冒充点击。标记的故障准备包括 Storage.setItem 配额异常、旧节点来源修改、editorGeneration 外部失效；不会读取或覆盖日常浏览器 localStorage。确认期间的失效专门由记录修改和 generation 注入验证；真实模型路由切换／未保存守卫另由既有模板浏览器回归覆盖，不声称逐一模拟所有可能的外部系统事件。

已人工查看关键截图：

- `category-accepted/chrome/category-sidebar-dark.png`、`category-popover-light-narrow.png`。
- `category-accepted/chrome/sync-protected.png`、`sync-after-maintenance.png`。
- `conversion-final/chrome/conversion-dark.png`、`conversion-light-narrow.png`；Edge 对应证据也保留。

弹窗内容区滚动、底部按钮可达；主题变量沿用原有体系。窄屏列表继续使用既有横向表格滚动。早期主题过渡中的截图未作为最终明亮截图，最终截图经过真实主题切换及重新打开／刷新核实。

## 8. 执行命令与输出隔离

未执行 npm 串联旧审计聚合入口，未运行旧 SKU migration／restore 检查。执行前检查所选脚本及 fixture 的写文件位置。以下列出实际使用的入口；复跑请换新的运行目录。

```powershell
$run='work/functional-gaps-round3/<新的唯一目录>'
$env:ROUND3_OUTPUT="$run/domain"
$env:DOMAIN_CHECK_CACHE_DIR="$run/domain/cache"
node scripts/run-domain-check.mjs scripts/functional-gaps-round3-check.ts

# 所有有文件输出的旧检查必须先设置这些路径：
$env:TEMPLATE_COMPATIBILITY_OUTPUT_DIR="$run/template-domain-state"
$env:SYNC_REFINEMENT_OUTPUT="$run/sync/sync.json"
$env:SYNC_REFINEMENT_PHASE='round3'
$env:ACCESSORY_OUTPUT_DIR="$run/accessory-query"
node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts
node scripts/run-domain-check.mjs scripts/sku-workbench-state-check.ts
node scripts/run-domain-check.mjs scripts/template-compatibility-domain-check.ts
node scripts/run-domain-check.mjs scripts/template-compatibility-state-check.ts
node scripts/run-domain-check.mjs scripts/compatibility-refinement-sync-check.ts
node scripts/run-domain-check.mjs scripts/functional-gaps-check.ts
node scripts/run-domain-check.mjs scripts/editor-safety-check.ts
node scripts/run-domain-check.mjs scripts/accessory-compatibility-query-check.ts

$env:BROWSER_CHANNEL='chrome' # 另一轮为 msedge
$env:ROUND3_OUTPUT="$run/conversion/$env:BROWSER_CHANNEL"
node scripts/browser-functional-gaps-round3.mjs
$env:ROUND3_OUTPUT="$run/category-sync/$env:BROWSER_CHANNEL"
node scripts/browser-round3-category-sync.mjs

$env:FUNCTIONAL_GAPS_OUTPUT_DIR="$run/round1-regression"
node scripts/browser-functional-gaps.mjs
$env:TEMPLATE_BROWSER_OUTPUT="$run/template-browser-regression"
node scripts/browser-template-compatibility.mjs

$env:CHECK_OUTPUT_DIR="$run/typecheck"
npm run typecheck
$env:CHECK_OUTPUT_DIR="$run/build"
npm run build -- --outDir "$run/build/dist"
git -c safe.directory=D:/单子/商城erp/mock/iyge-v2-mock diff --check
```

领域脚本实际分别设置 `TEMPLATE_COMPATIBILITY_OUTPUT_DIR`、`SYNC_REFINEMENT_OUTPUT`（文件路径）、`ACCESSORY_OUTPUT_DIR` 到各自隔离目录。同步回归使用 `SYNC_REFINEMENT_PHASE=round3`，不生成不需要的完整浏览器 fixture。Git safe.directory 仅作单次命令参数，没有改全局配置。

过程失败没有当作通过：早期新增测试使用错 repairSkuConfig 参数顺序、构造了已被模板规则提前判无效的测试样本；浏览器遇到 Element Plus 隐藏原生控件／重新进入时已预选目标，均修正测试准备或定位后重跑。失败截图保留；最终业务断言没有因定位问题放宽。并行领域加载的一次开发 HMR 端口占用提示不影响断言；浏览器采用隔离服务，最终没有新的运行异常。

## 9. 清理与忽略规则

本轮删除 **1,064.0 个可重建文件，356.00 MiB**，详见 `cleanup.json`：

- 本轮运行目录中的 Vite cache／vite-cache、构建 dist、增量缓存及三个生成的 tsconfig。
- 工程根 `dist/` 的既有构建输出，以及 `node_modules/.tmp/` 的两份编译缓存。
- 已被最终截图取代、未作为必要证据引用的早期成功截图；失败图、修复前证据、关键最终截图及小型结果摘要保留。

删除前逐项解析绝对路径，限定到正式工程和上述可生成目录，检查没有目录链接／reparse point。没有再次整目录删除 work，没有动 backups 或工程外 _audit-baseline，没有运行 git clean 或改写历史。

已有 710 条 work 删除仍原样保留，其中按路径识别的缓存／构建文件为 633 个、约 270 MiB；这些是前次用户删除，**不计入本轮 1,064 个清理数字**。其余 77 个既有删除包含旧证据等，不冒称是本轮定向清理。

新增忽略仅针对 work 下 cache、*-cache、.vite、tsbuildinfo 和生成 tsconfig；dist 沿用已有忽略。实测生产源码、脚本、docs、新验收 JSON／PNG 不会被屏蔽。本轮最终证据约 3.8 MiB，没有 node_modules 副本或全量源码备份。后续普通修改继续使用 Git，不复制源码审计基线。

## 10. 限制、历史缺失与停止范围

- 本轮未完成缺陷：无；READY 仅覆盖上述定向修复和实际验收。
- Vue Flow options 弃用警告与构建大 chunk 提示仍存在，没有扩展到无关重构。
- 保留普通 HTTP 的现有本页保存队列；没有增加无 Web Locks 环境下的跨标签页原子保证。本轮双浏览器主流程运行于 localhost。
- 未验证 Windows 原生输入法候选窗、人工系统 DPI 切换或真实后端；本轮均未实现这些能力。
- 第一轮历史文件 `work/sku-workbench-fixes/migration/after-result.json`、`work/sku-workbench-fixes/restore-after.json` 的原字节仍未恢复。本轮没有运行这些旧检查生成替身，也没有删除或改写前两轮报告中的缺失说明。
- 此前用户删除 work 后，前两轮报告里的旧 work 证据路径不能再当作当前存在的附件；报告文本和 Git 历史继续保留。本轮证据为新目录中真实执行所得，不冒充旧证据。

本轮到此停止，不自动开展下一轮功能；未提交、推送、合并或部署。
