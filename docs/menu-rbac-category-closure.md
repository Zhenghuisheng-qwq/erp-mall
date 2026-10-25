# 菜单、RBAC 与分类移动收尾报告

日期：2026-10-25。范围仅为本轮菜单布局、已确认 RBAC 缺陷及分类移动纠正，不代表整个 ERP 验收完成。

## 工作区与执行方式

- 实际分支：`20261022`；开始及交付核对 HEAD：`a4d521eb2ed3a99270338f882b5a3af41a3ea575`。
- 已检查祖先目录及相关源码目录，没有发现适用的 `AGENTS.md`。保留开始时已有的 `docs/rbac-management.md`、导航测试兼容修改和本地证据目录，没有回退工作区。
- 浏览器使用独立 Chrome 上下文、独立源和测试数据，不读取或覆盖用户日常浏览器中的业务数据。本轮未提交、推送或部署。
- 正常开发和生产构建继续为统一超级管理员模式。只有显式设置 `VITE_RBAC_ENFORCEMENT=true` 的隔离进程启用授权检查；没有新增 `.env` 或改变用户的长期开关。
- 菜单、角色、权限、用户页明确显示“RBAC 权限校验尚未启用；角色与授权配置会保留”。旧角色和授权仍保留。

## 修改文件与实现

| 文件 | 本轮变化 |
| --- | --- |
| `src/layouts/RailNav.vue` | 只调整双栏详情模板与样式。直属入口通栏；分组按实际可见配置顺序两列排列，相邻格边线形成十字；奇数末组通栏，无空白格竖线。详情宽度 520px；375px 视口降为单列。单栏及悬浮、固定、折叠、偏好、焦点事件逻辑沿用已有实现。 |
| `src/stores/catalogAccess.ts` | 规范化负索引/省略参数的 splice、length 截断及数组替换检查；变更前同时检查原记录和候选记录的资源身份；sort 在副本上执行。用户与授权数据继续只能通过受控命令提交，拒绝不留下部分修改。 |
| `src/domain/rbac.ts` | 按实际记录区分 SKU/MAT、属性方案/商品模型；词典内部候选按已有词典的 update 检查；品牌、规则的新建/编辑、分类移动、恢复内置权限分别登记命令权限。 |
| `src/domain/accessMode.ts`、`src/components/rbac/RbacModeNotice.vue` 及四个系统管理页面 | 默认模式保持不限权，配置页说明当前模式。角色页增加受控的“恢复内置权限”操作。菜单、角色、权限仍是独立页面。 |
| `src/stores/catalog.ts` | 品牌及必要词典追加在同一候选事务提交；规则受控保存；物料导入逐资源检查候选增删改；分类移动先在副本验证、持久化成功后再切换内存；超级管理员可显式补回已登记内置权限。模拟身份公开引用只读。 |
| `src/stores/catalogSimulation.ts` | 管理员发起模拟时记录返回上下文及受控签发记录；刷新校验目标、来源、签发记录和启用模式，保留明确退出入口；伪造未签发上下文不产生管理员返回能力。存储失败不切换当前身份。 |
| `src/views/BrandView.vue`、`RuleView.vue`、`TemplateView.vue` | 品牌/规则的按钮和提交区分 create/update；复制规则只产生本地草稿。属性方案与模型使用实际归属权限，避免混用。 |
| `src/components/catalog/SpuForm.vue` | 保存错误统一显示；无发布权限或动作抛错均恢复 saving，保留输入并允许重试。 |
| `src/views/CategoryView.vue`、`src/components/category/CategoryBrowsePanel.vue` | 左侧是目标树，暂存后仅隐藏来源及后代；右侧数据仅含本次来源子树，空闲时显示待移动提示。选择左侧目标，右侧显示“移动到：完整路径”，确认后整树提交；取消、关闭不提交；失败保留来源和目标；成功展开目标路径并选中移动根。 |

没有修改业务编号、SKU/PLN/MAT 生成算法、历史快照、V2 选择器或 SPU/SKU 列表源码。列表适配通过受影响浏览器回归核对。

## 已确认问题与修复证据

| 问题 | 修复后的实际结果 | 证据类型 |
| --- | --- | --- |
| 负索引 splice、length 截断和 MAT 替换漏检 | 所有实际受影响记录在变更前鉴权；销售 SKU 权限不能借索引、根数组替换或 mutator 返回链修改 MAT。授权失败及 sort 抛错前后内存一致。 | 真实 Store/代理，默认与启用模式各 6 组 |
| SKU 删除权错误覆盖 MAT、物料导入夹带其它资源 | strict 下仅 SKU 删除权限调用 MAT 删除被拒绝；仅物料导入权限夹带结构合法的 SPU、销售 SKU、兼容声明改动也明确拒绝，内存及磁盘原文不变；合法物料维护仍成功。 | 真实 Store，两种模式分别断言 |
| 收口审查发现同 ID 导入记录漏检 | 原逐 ID 首条比较会漏掉同 ID 的第二条记录。现按身份桶匹配所有出现项；新增/加剧重复身份在提交前拒绝，已有重复原文可保留，但改动其中任意一条仍须逐资源授权。覆盖全部 8 个 creationKeys 的稳定身份。 | 新增真实 Store 回归，两种模式各 3 组 |
| 属性方案/模型、词典内部值、品牌/规则权限混淆 | 方案与模型按真实归属检查；词典内部值更新不要求 create；新建、编辑分别鉴权。空条件规则仍保留原业务语义。 | 代理/Store；品牌和规则另有真实表单验证 |
| 品牌与词典分次落盘、SPU 保存卡在 saving | 品牌及词典成功时精确一次业务写盘；缺词典更新权限或注入写盘失败均不改变两份数据；草稿可重试。SPU 发布拒绝和异常均释放 saving。 | 真实 Store + Chrome 表单 4 组 |
| 合法导入后超级管理员缺少导入/重置恢复权限 | 实际调用 importJson 导入仅保留恢复基础权限的合法备份，再由角色页明确恢复全部登记权限；保留超级角色 ID、其它角色、用户及业务数据。普通角色不能调用该恢复命令。 | 真实 Store + Chrome 角色页 |
| 模拟用户刷新丢失退出入口、公开身份引用可写 | 管理员真实发起模拟后刷新，退出入口和来源上下文保留，明确退出回到原管理员；普通用户伪造匹配的 session 上下文/证明、但无签发记录，仍不能退出到管理员。公开身份引用写入无效。 | 真实 Store + Chrome 刷新/退出/反向验证 |
| 分类左右两栏重复完整目录 | 右侧只含所选根及后代，左侧只含其余目标；暂存、取消、关闭均无业务写盘；失败保留来源/目标/原文，重试提交后 ID、内部父子层级和业务引用不变。 | Chrome 新流程 6 组 + 原工作区 11 组 + Store |

## 实际浏览器验收

使用 Chrome `156.0.8078.47`，所有下表结果为实际页面操作，不以领域函数断言替代页面验收。

| 场景 | 实际步骤及断言 | 结果 / 原始记录 |
| --- | --- | --- |
| 两列十字、直属通栏、主题、动态配置 | 悬浮打开、固定、深浅切换；实际修改菜单改名、排序、隐藏与新增第五组；断言分组矩形及边线。默认顺序来自真实配置，不按名称定位。 | 通过，7 组；`work/closure-rbac-menu/navigation/after/result.json` |
| 悬浮/固定占位与键盘 | 悬浮正文 x=96，固定 x=616，图标固定 x=578，取消后回到 x=96。聚焦模块→ArrowRight 进入详情→鼠标离开，详情保留；Escape 返回模块；纯鼠标离开正常关闭。 | 通过；新 grid 检查、原导航专项 11 组、原焦点/层级检查 6 组 |
| 原导航行为 | 单双栏、折叠、图钉、偏好刷新与 center/icons 迁移、布局弹层键盘、未保存离开取消、权限过滤、缩放、375/900 视口。 | 通过；`work/closure-rbac-menu/navigation/regression/evidence.json`、`work/closure-rbac-menu/navigation/focus-regression/after/navigation-result.json` |
| 默认统一管理员 | 旧低权限/已移除身份配置仍可进入正式页面及保存；系统配置页显示未启用说明；原授权和业务保持。 | 通过，4 组；`work/closure-rbac-menu/default-browser/result.json` |
| 品牌、规则、SPU 表单 | 缺依赖权限拒绝、配额失败保留输入、修正后重试；规则复制不提前落盘；SPU 无发布权限及抛错后重试。 | 通过，4 组；`work/rbac-repair/forms/result.json` |
| 导入后恢复与模拟刷新 | 实际 Store 导入合法部分权限备份→角色页恢复；顶部模拟运营→刷新→明确退出；独立普通用户上下文伪造返回失败。 | 通过，3 组；`work/closure-rbac-menu/session-browser/result.json` |
| 分类移动 | 多级子树暂存、取消、关闭；非法目标；左侧键盘选择完整目标；写盘失败保留原文、重试一次；叶子移到顶级并刷新；只读身份拒绝。 | 通过，6 组；`work/rbac-repair/category/result.json` |
| 原分类工作区 | 原生 before/after 排序、no-op、自己/后代和类型目标保护、拖拽取消、边缘滚动、原位改名、复制、子级删除保护、刷新及窄屏。原双完整树相关操作按新流程改写，保护断言保留。 | 通过，11 组；`work/rbac-repair/category-workspace/result.json` |
| SPU/SKU 列表与导航联动 | 1366/1920/900 宽度、导航固定/取消/图标组合；两页容器矩形跟随布局，横向溢出留在表格内。SKU 既有保存视图、筛选、列宽等工作台回归仍通过。 | 通过，14 个导航矩形记录及 SKU 24 个检查点；`work/closure-rbac-menu/regression/list-navigation/result.json`、`regression/sku/result.json` |
| 导航及筛选联动 | 原导航 11 组及筛选 6 组，原查询用例和非相关页面比较继续断言。 | 通过；`work/closure-rbac-menu/regression/navigation-filter.log` |

## Store、领域与构建

以下是 Store/领域测试，不声称是独立页面操作：

- `scripts/catalog-access-check.ts`：默认及 `VITE_RBAC_ENFORCEMENT=true` 各 6 组。结果位于 `work/rbac-repair/proxy-default/`、`proxy-enforced/`。
- `scripts/closure-store-repair-check.ts`：两种模式各 9 组；包含真实 importJson、未授权调用、内存与持久化原文对照、精确写盘次数、故障后重试。结果位于 `work/closure-rbac-menu/store/{default,strict}/result.json`，最终日志为 `store-default-final.log`、`store-strict-final.log`。
- `scripts/material-import-identity-check.ts`：两种模式各 3 组；新增重复、加剧已有重复均原子拒绝；历史同 ID 记录原文保留可导入，数量不变但修改第二条不能越权。结果位于 `work/closure-rbac-menu/material-identity/{default,strict}/result.json`。
- 原 RBAC 领域 5 组、Store 10 组在启用模式通过；默认分支明确按统一管理员约定断言。异步初始化、迁移和只读预览入口已适配，没有去掉原迁移、越权、写盘失败、历史保护断言。
- R01 两个领域检查、R02 关系（默认/启用两模式）、R02 兼容、权益包领域 30 组、分类领域 9 组、列表展示及 SKU 工作台状态检查通过。日志在 `work/closure-rbac-menu/regression/`。
- `npm run build` 包含 `node scripts/run-typecheck.mjs`，类型检查与生产构建通过。日志：`work/closure-rbac-menu/build.log`。`git diff --check` 通过。

测试适配文件包括 `scripts/rbac-{domain,store}-check.ts`、`r02-relations-check.ts`、`browser-category-workspace.mjs`、`browser-navigation-special.mjs`、`browser-ui-finish.mjs`、`browser-unrestricted-access.mjs`；新增专项脚本按上表名称保留在 `scripts/`，便于复跑。

## 截图

同尺寸菜单前后记录在 `work/closure-rbac-menu/navigation/before/` 与 `after/`（1366×900）。

- [浅色固定，两列十字](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/default-pinned-light.png)
- [浅色悬浮](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/default-floating-light.png)
- [深色悬浮](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/default-floating-dark.png)
- [深色固定](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/default-pinned-dark.png)
- [自定义第五组](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/custom-five-light.png)、[深色](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/custom-five-dark.png)
- [改名与排序](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/renamed-reordered.png)、[隐藏后奇数组](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/hidden-three.png)
- [375 窄屏](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/mobile-375.png)、[900 窄屏](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/navigation/after/narrow-900.png)
- [分类仅暂存来源子树和完整目标路径](D:/单子/商城erp/mock/iyge-v2-mock/work/rbac-repair/category/staged-subtree-and-full-target-path.png)
- [移动失败仍保留来源与目标](D:/单子/商城erp/mock/iyge-v2-mock/work/rbac-repair/category/failed-move-preserves-source-target-and-data.png)
- [移动成功展开目标并高亮](D:/单子/商城erp/mock/iyge-v2-mock/work/rbac-repair/category/moved-under-expanded-target.png)
- [模拟刷新后仍可退出](D:/单子/商城erp/mock/iyge-v2-mock/work/closure-rbac-menu/session-browser/simulation-refresh-return-visible.png)

## 限制与未验证项

- 本轮为前端 Mock，没有真实登录、服务端鉴权或防篡改存储。模拟返回保护覆盖受控命令和未签发上下文；任意同源脚本或 DevTools 若能改写全部业务及签发存储，超出此 Mock 的信任边界。
- 浏览器验证为桌面 Chrome 独立上下文及模拟窄屏/缩放；真实手机设备、Safari、Firefox 未验证。
- 列表布局回归日志记录到 2 次 `ResizeObserver loop completed with undelivered notifications`，所有矩形和功能断言通过，未出现未处理的页面异常。生产构建保留大于 500 kB 的 chunk 提示；未在本轮扩展构建拆包工作。
- 未重复全部 183 项业务验收；本报告只覆盖本轮变更和受影响回归。没有据此宣称所有业务或老板原始完整需求已经满足。

RESULT：本轮通过。已确认缺陷均已修复；重复身份补修后再次执行默认/启用模式 Store 检查、启用模式 R02 关系检查及生产构建，均退出 0。没有遗留已确认的阻断问题。未验证项和 Mock 边界如上，不扩大为整个 ERP 完成结论。完成本轮后停止，等待用户审查。
