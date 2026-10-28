> 当前生效策略：按本次补充要求，统一作为超级管理员运行，RBAC 权限限制暂不启用（`src/domain/accessMode.ts`）。旧权限配置原样保留，过时权限码、目录差异和旧模拟身份不再阻塞启动或业务操作。下文是此前 RBAC 实现阶段记录，不表示当前已启用这些限制；以后须在用户明确要求后再启用并核对兼容迁移。
>
> 当前模式已通过 5 组真实 Store 检查、4 组隔离 Chrome 检查、导航及 6 组筛选回归、类型检查和生产构建。证据位于 `work/unrestricted-access/`；真正的业务结构损坏和持久化冲突保护继续保留。

# 系统管理 RBAC 与管理页面优化

RESULT：本轮前端 Mock RBAC 已接通，可进入用户操作审查。三个系统管理页面独立可操作，用户多角色联动、统一路由/按钮/Store 授权、旧数据迁移及保护均有实际断言与浏览器证据。没有提交、推送或部署。

## 基线与保留范围

- 实际分支 `20261022`，开始时 HEAD `29e755559bdb1c77e541b05cfceed927d0f9a96f`，工作区干净。
- 已检查祖先目录、工程及 src/scripts 下适用 AGENTS.md，未发现额外指令。
- 保留导航层级、键盘焦点保护、悬浮/固定/折叠及主题偏好。导航仅接入授权读取和系统入口图标，没有重新设计。
- SPU/SKU 的自动列宽、摘要、更多菜单、保存视图、手动列宽和冻结等保持；业务界面新增明确权限判断，没有改 SKU/PLN/MAT 算法或历史快照生成逻辑。
- 所有浏览器均为独立 context 和测试数据；证据写入 `work/rbac/`，旧验收证据没有覆盖。

## 页面与实际操作

| 页面 | 实现 | 主要证据 |
| --- | --- | --- |
| `/menus` 菜单管理 | 名称/类型/显示筛选、树表、中心/分组/页面图标、展开收起、编辑抽屉、新增下级、合法改挂、同级排序；路由只选正式登记入口；用户权限只读预览；恢复只重置菜单结构 | pages/menus.png、menus-narrow-dark.png |
| `/roles` 角色管理 | 列表、编码唯一稳定、编辑/复制/启停、用户引用、独立授权抽屉；模块→资源→动作树，搜索/半选/仅已选/计数，保存前新增撤销和影响用户数 | pages/roles.png、role-grants.png、grant-narrow-dark.png |
| `/permissions` 权限管理 | 实际内置目录、关键词/模块/类型/状态筛选、弱化技术信息、名称说明编辑、引用查看、复制权限码；执行身份/编码/路由/依赖不可变 | pages/permissions.png、permission-disabled.png |
| `/users` 用户管理 | 多角色标签、启用状态、有效权限摘要、编辑抽屉及受控角色绑定；没有原记录 v-model 写入 | pages/users.png |
| `/forbidden` | 未授权、身份停用或失权的明确反馈；不自动改回管理员 | access/*-denied.png、pages/revoked-access-draft-left.png |

取消、路由离开与关闭抽屉保护不污染已保存内容；保存失败保留字段和错误，允许重试。当前页面已失权时允许进入无权限页，不让“继续编辑”阻止权限收回。

被业务角色引用的权限不能直接停用，需先调整角色授权。只有超级管理员目录引用的非恢复权限可明确停用/启用，实际 can 立即变化；恢复路径权限始终受保护。内置权限不提供任意新增码或物理删除入口，避免制造没有执行能力的假权限。

## 单一授权数据模型

AppData 升级为版本 **16**，新增可独立识别的 `rbac.version = 1`：

```text
AppData.users[]
  id / username / displayName / enabled / roleIds[]
  role（旧字段，仅备份兼容，不参与新授权）
AppData.rbac
  version: 1
  roles[]: id / code / name / description / enabled /
           builtIn / superAdmin / permissionCodes[]
  permissions[]: code / name / module / resource / action /
                 kind / route / description / enabled / builtIn / dependsOn[]
```

用户有效权限是其所有启用角色中有效权限的并集；被停用的权限及其缺失依赖的动作均失效。分组勾选只提交当前叶子权限码，不保存通配符，不授权未来新增能力。依赖要求显式选择，不暗中补齐。

- `role:super-admin`：受保护的内置超级管理员；`isAdmin` 仅表达此有效身份。
- `role:operator`：旧运营迁移为只读运营。
- 普通角色的名称不参与授权，拥有 SPU 编辑权限不会获得模型、物料或系统权限。
- 授权数据和用户记录不能经公开 data 引用直接写入；只能由受控命令克隆候选、校验、在统一事务中写盘成功后替换内存。
- 旧业务原位编辑器由深层数据写保护覆盖，避免绕过按钮写入不属于自己的资源；冻结快照/来源记录只由受控命令维护。

## 迁移、导入和恢复

1. 旧无 RBAC 数据先规范化为隔离候选，再读取旧菜单作为一次迁移来源。旧 admin/operator 用户迁移到稳定内置角色，并将单角色补为 roleIds。
2. 运营页面授权取叶子、分组、中心旧角色限制的交集，并保留旧管理员专属限制。隐藏只影响展示，不撤销页面权限。
3. 已有 RBAC 的结构、身份、稳定绑定、权限依赖、用户引用和恢复路径完整校验；损坏记录明确拒绝，保留原始字符串，不用种子替换。
4. 候选通过校验并一次持久化成功后才启用新授权。失败时内存不启用半套 RBAC，主入口进入原恢复界面；迁移幂等。
5. 菜单名称、排序、隐藏、自定义分组和导航偏好保留。旧 MenuNode.roles 只用于迁移及兼容读取，正式导航使用统一 canRoute，不再形成第二套授权。
6. 导入始终使用导入前操作者。RBAC/用户绑定变更需要相应系统权限及委派范围；业务字段还逐项要求真实 create/update/delete/publish 等权限。仅 SPU 编辑+导入不能绕过发布或 SKU/MAT 身份权限。
7. 导入不替换当前模拟会话，旧 activeRole 镜像也不从备份覆盖。授权变化导致失权时保持原用户标识并进入无权限页。
8. JSON 备份包含 RBAC/用户绑定；菜单结构继续沿用独立菜单存储，恢复备份不会擅自重置当前菜单。

## 模拟用户与保护

模拟用户标识位于独立的 `iyge-rbac-simulated-user` 会话存储，并用同名独立本机记录作为新标签页的初始身份；不放入业务 AppData。低权限用户打开新标签页不会变成默认管理员。

- 只有已有超级管理员模拟会话能切换其他用户；普通角色不能通过此入口取得超级身份。
- 权限预览使用独立 previewUserId，不修改用户角色绑定或当前基础身份；管理员有明确退出入口。
- 停用用户不可作为有效身份；失权不静默回到管理员。
- 当前超级管理员需先切换到另一位有效管理员，才能停用/移除自己的受保护身份；最后一个有效超级管理员及授权恢复路径不能被移除。
- 超范围授予或绑定角色被拒绝；用户引用中的角色不能删除；超级管理员标记不能由普通角色伪造。
- 跨页授权改变后，旧页失效并拒绝操作；原 compare-and-swap 持久化冲突保护仍保留。

## 实际权限接入矩阵

完整机器可读矩阵：`work/rbac/permission-matrix.json`，含 **97 个登记权限点、71 个公开写命令的映射**，以及正式路由、动态 ID、旧别名和 query 特殊入口示例。未知路由和未知写命令默认拒绝。

| 资源 | 页面访问 | 真实操作提交 |
| --- | --- | --- |
| SPU | `product:spu:read`，详情同源，新建另需 create | saveSpu/saveBundle、删除；create/update/delete；上下架变更额外 publish |
| SKU | `product:sku:read`，新建另需 create | appendSkus/editSku/patchSku/setSkuStatus/removeSku；create/update/delete |
| 物料 | `product:material:read`；旧带 SKU 参数别名按实际 MAT 身份解析 | createMaterial/createTemporary、关联/解绑、更新、改名、导入；不能靠 SKU 权限维护 MAT |
| 模型/设计 | model:read 与 model-designer:read 分别登记，避免扩大旧访问范围 | 创建/复制/草稿/节点配置/模板兼容/发布/删除，各按真实动作 |
| 分类/类型/词典/属性方案/规则/品牌/分组 | 各自 read | 既有命令及原位编辑深层写保护，各自 create/update/delete；业务校验语义保留 |
| 适用关系/型号 | compatibility:read | 声明 add/edit/remove，设备绑定/型号维护及同步，按 create/update/delete |
| 列表视图 | 原列表 read 允许个人查询工作配置；独立列配置入口需 view:read | commitSkuPage 限本机页面配置；独立视图维护 view:update，不能写其他业务字段 |
| 全量及商品导入导出 | import:read/execute、export:execute | importJson/exportJson；导入逐字段及对象检查旧操作者权限 |
| 用户 | system:user:read | 受控 create/update/delete、roleIds 改变另需 bind |
| 角色 | system:role:read | create/update/delete/grant，授权不超过操作者可委派范围 |
| 权限 | system:permission:read | 受控 update；稳定身份/执行/依赖不可改；停用有引用及恢复保护 |
| 菜单 | system:menu:read | saveMenuStructure/resetMenuStructure，不能以菜单结构授予角色权限 |
| 反馈 | system:feedback:read | 原编辑/删除保护；ZIP import/export 经受控命令保存，重复 ID 保留本机原文 |
| 重置 | system:data:reset 且受保护超级身份 | resetAll/resetModule；不通过恢复菜单重置角色授权 |

旧 meta.admin、业务 isAdmin 和 activeRole 分散判断已替换。保留的 isAdmin 仅用于受保护超管操作或系统展示；正式授权由 can/canRoute/统一命令矩阵决定。没有“任意编辑权限即管理员”的映射。

## 实际测试结果

| 验证 | 实际结果与证据 |
| --- | --- |
| 领域 | rbac-domain-check.ts：5 组通过，迁移幂等/父级限制/隐藏语义/依赖停用/路由与命令默认拒绝/恢复保护 |
| 真实 Store | rbac-store-check.ts：10 组通过，五身份、SPU合法保存及越权拒绝、多角色停用、委派/引用/最后超管、find/map/迭代及数组返回链保护、冻结历史、导入发布保护、合法恢复及迁移/写盘失败原子性；store-final.log |
| 系统页面 | browser-rbac-pages.mjs：11 组真实操作通过，新增/复制/启停角色、显式授权树、半选/搜索/仅已选、取消、双角色绑定、菜单结构操作、权限维护/启停/引用保护、失败草稿与重试、失权离开、900px暗色；pages/result.json |
| 五身份页面一致性 | browser-rbac-access.mjs：4 组通过，超管/只读运营/仅SPU编辑/仅模型/多角色；真实路由、新建、详情保存按钮、旧别名 query、直接无权命令、数据原文不变、新标签身份、跨页失效；access/result.json |
| 原导航/筛选回归 | 导航专项及6组 SPU/复杂筛选回归通过；仅把旧角色选择断言更新到模拟用户和明确无权限页，保留关键断言；regression/navigation、regression/filters |
| 原 SKU 工作台 | 24 项通过，保存视图/手动宽度/冻结/分组/筛选/范围隔离/失败重试/横滚；regression/sku |
| 列表+导航组合 | 两页1366/1920/900及14组固定/取消/折叠矩形通过，完整 Store、视图与原始持久化内容不变；regression/list-navigation |
| 类型与构建 | 最终 npm run build 包含类型检查与生产构建，通过；build.log |
| 代码检查 | git diff --check 通过；45个业务模板语法检查和字面量权限码目录核对无未知码 |

系统/身份浏览器结果的 pageerror 均为空。没有将静态页面存在当作授权接通证据。

## 修改文件与核查入口

- 领域与模型：src/domain/rbac.ts、types.ts、menuConfig.ts。
- 执行边界：src/stores/catalog.ts、catalogRbac.ts、catalogAccess.ts。
- 路由/会话：src/router/index.ts、src/main.ts、src/layouts/AdminLayout.vue；RailNav.vue 和 navigationIcons.ts 仅授权入口衔接。
- 系统页面：MenuConfigView.vue、RoleView.vue、PermissionView.vue、UserView.vue、ForbiddenView.vue；共用 src/components/rbac/。
- 业务页面/组件：明确的权限属性与保存入口保护，保留原 UI 和算法；实际完整文件清单见 work/rbac/changed-files.txt。
- 新测试：rbac-domain-check.ts、rbac-store-check.ts、browser-rbac-pages.mjs、browser-rbac-access.mjs；旧导航/列表回归只更新必要的模拟身份入口/独立输出目录。

## 剩余问题和能力边界

- 这是前端 Mock 的一致授权与防误操作机制，没有真实登录、服务器鉴权、令牌、安全审计或多租户隔离。能任意改 DevTools/本机脚本/LocalStorage 的人不在可防御的后端安全边界内；不宣称可直接用于生产鉴权。
- 已按矩阵接入代码并完成上述代表性 Store/页面回归；没有逐一手工执行全部97个权限与71个命令的所有组合。业务页面其余细分按钮主要有静态接入及统一边界覆盖，不标成逐按钮浏览器通过。
- 未重跑全部183项商品业务验收；没有验证真实后端、订单/支付/库存、Safari/Firefox或实体设备。
- 系统页及连续表格调整仍出现既有 ResizeObserver 开发通知，日志保留；实际功能、矩形、数据断言通过。构建仍有大于500kB分包提示，未扩展到拆包改造。
- 后续新增真实功能需要明确登记权限及版本迁移，不会因角色勾选过分组而自动授权。

完成本轮后停止；可进入用户亲自操作与审查。
