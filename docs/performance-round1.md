RESULT: READY

2026-10-22，第一轮规格组合预览与规划计算优化。实际基线分支为 `20261019`，HEAD 为 `8721e572e3a2f9010bcd6a6a9f60489733d56904`。开始时工作区干净，直接使用当前检出；没有覆盖用户改动，没有提交、推送、合并或部署。

已读取 README、`docs/商品配置闭环.md`，检查仓库和父目录，未找到适用的 AGENTS.md。README 和业务说明仍写数据版本 1，源码实际为 13；本轮没有调整持久化格式或这部分历史说明。

**源码核查与改动**

预览调用链：`SpecConfigView.vue` 的 `draftPreview` computed → `previewDraftCombinations` → `legalPlanningCombinations`；原预览随后调用 `reconcilePlanningRecords`，再次展开同一份草稿。存在上一发布版本时，另有一次上一版本快照展开。

发布调用链：页面 `publish` → store `publishSpecModel` → `alignPlanning` → `reconcilePlanningRecords`。发布仍从对应版本的 `nodesSnapshot` 计算，返回完整的新记录数组。页面和 store 调用方式没有修改。

V2 共用链：`logic.ts` 的 `planSkuLines` → `expandVariantPaths` → `expandFilteredPaths`。本轮只改共享展开函数内部的查找方式；`logic.ts`、`ProductModelSelector.vue` 和 `generateSkuFromModel` 均未修改。

| 确认的问题 | 修改 | 预期收益和保留的行为 |
|---|---|---|
| 预览重复展开草稿，再做完整规划对账 | `draftComboPreview.ts` 改用 `summarizePlanningCombinations`，传入已经展开的组合 | 草稿合法组合只展开一次；不复制规划档、不试分配 PLN，不写业务数据 |
| 每次递归过滤整个节点数组找子节点 | `planning.ts` 的 `expandFilteredPaths` 在调用内建立父子索引 | 按父节点访问子列表；同 sort 的稳定顺序、accepts/labelOf 调用顺序、同级相乘和条件分支不变 |
| 每个组合步骤重新找属性名、绑定角色和祖先 | 属性名和方案角色索引；每个取值节点的元数据仅解析一次 | 字典/绑定仍取首项；节点角色优先；每个输出 step 仍是独立对象 |
| 每个组合线性扫描规划池 | identityKey 对应有序候选列表，仍按 planningId 的 used 集合找首个未用记录 | 重复身份、重复 PLN、停用恢复、记录顺序与旧实现一致；临时档仍排除 |
| 每个新增 PLN 重新扫描最大号 | 首次新增时扫描一次最大号，此后按原组合顺序递增 | 仍扫描全部模型的记录；编号格式、非数字编号处理和全局编号顺序不变 |

全部索引和复用数据都是本次函数调用的局部变量，调用结束即可释放，没有跨调用缓存和失效机制。对同一个输入对象修改属性值后再次计算，也进行了对照验证。

以下工作有意保留：

- `planningIdentityKey`、去重及结果顺序不变；正式对账继续复制所有输入规划档，保持返回对象独立的原契约。
- 上一版本仍单独展开一次，保证 `previousCount` 反映快照，不能用现存规划数量代替。
- `specPublishProblems` 内的旧 `specCombinationsFrom` 是根到叶路径校验，和本轮的同级组合算法契约不同，没有合并或替换。
- 预览行的旧 `known` Map 对重复身份展示最后一个编号，而正式对账取首个未用编号。这一既有差异已固定测试并保留，本轮没有更改业务语义。
- 界面、布局、快捷键、样式、持久化结构、历史快照及 MAT/SKU/PLN 身份逻辑不变，没有限制组合数量。

**性能证据**

环境：Windows `10.0.26200`，Node `v22.18.0`，AMD Ryzen 9 9950X（32 逻辑处理器），系统内存约 47.1 GiB。使用本地安装的 Vite SSR 加载 TypeScript；原实现由固定基线提交 `git show` 读取，不手工改写参考算法。浏览器验证使用 Chrome `155.0.8059.85`，1440×900。

独立合成数据：条件树为型号 → 容量 → 颜色，另有同级包装属性参与相乘；包括显式角色、方案角色和缺省角色。树深度从根属性算 1，均为 6。历史规划中一半当前组合有匹配记录，包含停用档；其余是当前模型及其他模型的历史身份。每次测量输入不变。

| 样本 | 节点数 | 深度 | 合法组合数 | 历史规划数 | 每轮调用次数 |
|---|---:|---:|---:|---:|---:|
| 小 | 24 | 6 | 16 | 32 | 20 |
| 中 | 162 | 6 | 384 | 1,500 | 3 |
| 大 | 610 | 6 | 3,456 | 12,000 | 1 |

每项先预热 2 轮，再测 7 轮，交替原版和优化版顺序；每轮开始在计时外执行 GC。表中为 7 个“每轮总耗时 / 调用次数”的中位数，单位 ms。数据创建、模块加载、断言和调用次数插桩均在计时外；最后一轮测量没有并发运行其他本任务的检查。原始 7 轮数据保存在 `performance-round1-evidence.json`。

| 样本 | 合法组合展开：原版 → 优化 | 完整草稿预览：原版 → 优化 | 完整规划对账：原版 → 优化 |
|---|---:|---:|---:|
| 小 | 0.072 → 0.057 | 0.269 → 0.152 | 0.102 → 0.076 |
| 中 | 1.150 → 0.756 | 20.432 → 2.423 | 17.002 → 1.796 |
| 大 | 14.663 → 8.274 | 1264.380 → 32.836 | 1209.354 → 26.673 |

这是领域计算的耗时，完整预览包含原来的发布校验及前一快照计数；不等于浏览器的整页响应耗时，没有测量 DOM 绘制或 Vue 响应式代理开销。保留所有合法组合，输出规模仍会影响耗时和内存。

计时完成后，用另一套模块实例插桩中样本，避免计数影响性能结果：

| 工作量 | 原版 | 优化 |
|---|---:|---:|
| 一次预览内草稿合法组合展开 | 2 | 1 |
| 一次预览内全部合法组合展开（含上一快照） | 3 | 2 |
| 预览调用完整对账 / 复制规划条数 / 试分配编号数 | 1 / 1,500 / 192 | 0 / 0 / 0 |
| 正式对账的整表最大编号扫描次数 | 192 | 1 |
| 正式对账的编号记录检查次数 | 306,336 | 1,500 |
| 正式对账的匹配候选检查次数 | 241,152 | 192 |
| 正式对账展开时的子节点条件检查次数 | 26,406 | 162 |
| 正式对账的取值祖先解析次数 | 1,536 | 130 |

候选匹配计数不包括一次性建立规划索引的遍历；子节点检查不包括一次遍历 162 个节点建立索引。对应原始计数也保存在证据 JSON。正式对账的记录复制仍为 1,500 条。

**实际检查与复现**

先在修改前运行规划、草稿、物料和 V2 等相关检查，再在修改后运行相同脚本。真实 Excel 的 round3 检查另外使用 `--baseline` 加载固定基线实现复核。原有检查内容和期望均未修改。

| 现有脚本（`scripts/<名称>-check.ts`） | 基线通过 | 优化后通过 |
|---|---:|---:|
| planning | 18 | 18 |
| draft-combo | 10 | 10 |
| material | 12 | 12 |
| material-archive | 8 | 8 |
| consistency | 9 | 9 |
| combo-material-status | 42 | 42 |
| round1 | 24 | 24 |
| round2 | 6 | 6 |
| round3（真实 Excel） | 16 | 16 |
| round5 | 27 | 27 |
| naming | 24 | 24 |
| grade | 13 | 13 |
| compatibility | 15 | 15 |
| excel-import | 20 | 20 |
| 合计 | 244 | 244 |

实际执行的领域检查命令为以下循环形式，每个脚本在独立进程运行，均 exit 0；`verify.ts` 在两版均通过。原始日志位于忽略的 `work/performance-round1/`。

```powershell
$checks = @('planning','draft-combo','material','material-archive','consistency','combo-material-status','round1','round2','round5','naming','grade','compatibility','excel-import')
foreach ($check in $checks) { node scripts/run-domain-check.mjs "scripts/$check-check.ts" }
node scripts/run-domain-check.mjs scripts/verify.ts
node scripts/run-domain-check.mjs scripts/round3-check.ts --baseline
node scripts/run-domain-check.mjs scripts/round3-check.ts
node --expose-gc scripts/planning-performance-check.mjs
node scripts/planning-performance-browser.mjs
npm run build
git diff --check
```

- 新增对照脚本：53 组通过，涵盖条件分支和同级相乘、ATTRIBUTE → ATTRIBUTE、COMMON/VARIANT 角色优先与回退、稳定排序、重复身份和重复 PLN、临时记录排除、停用恢复、新旧组合混合、快照追溯、空/无效草稿、重复节点的旧回退行为、40 组固定随机种子案例，以及 V2 `planSkuLines`。完整对象深比较保留数组顺序；冻结输入并验证输出 step 不共享对象；固定对账时间 `2026-10-22T04:00:00.000Z` 和初始编号。
- 浏览器对照：原版与优化版在独立上下文运行，冻结时间。实际点击合法组合管理和发布按钮，验证 4 → 5 条条件组合预览、预计新增 1/沿用 4、发布后 PLN、新旧版本关联、重复发布、刷新和 V2 新增商品页面。两版 UI 文本和完整业务状态深比较相同，无 pageerror。
- `npm run build` 在两版均 exit 0，包括 `vue-tsc -b` 类型检查和 Vite 生产构建。新增 mjs 文件也执行了 `node --check`，通过。
- 原浏览器脚本 `node scripts/browser-smoke.mjs` 在基线失败：等待已不存在的 `.combo-toggle` 入口 30 秒超时。原脚本未改动；新增浏览器检查通过当前“管理合法组合”入口完成上述验证。该旧脚本还硬编码版本 12，而当前数据版本为 13，本轮没有改其期望以使它通过。

**变更文件与边界**

生产代码仅修改 `src/domain/planning.ts` 和 `src/domain/draftComboPreview.ts`。新增 `scripts/run-domain-check.mjs`（复用本地 Vite 执行现有 TS 检查）、`scripts/planning-performance-fixtures.mjs`（固定基线及独立数据）、`scripts/planning-performance-check.mjs`（对照、计时、独立插桩）、`scripts/planning-performance-browser.mjs`（当前界面端到端对照）。`.gitignore` 仅增加本轮临时证据目录；本说明与证据 JSON 用于审查。没有新增依赖或修改锁文件。

没有因依赖、浏览器或真实 Excel 缺失而跳过上述检查。浏览器脚本使用本机已有的 `D:/tmp/pw` 中的 playwright-core；在其他机器可通过 `PLAYWRIGHT_PACKAGE_JSON` 指向已有安装。基线对照需要 Git 中保留该基线提交对象。

未验证非 Chromium 浏览器、低配设备、全页面绘制性能和峰值内存。原有大 chunk 构建提示、Vue Flow 的 options 弃用提示仍存在。当前预览展示最后匹配编号与正式对账取首个未用编号的差异仍保留。

下一轮建议先更新过时的浏览器冒烟脚本，再对 `specPublishProblems` 的重复节点扫描及实际浏览器长任务做独立测量。本轮到此停止，不涉及列表、画布、保存防抖、依赖升级或后端。
