# 界面与分类补修验证

本页仅记录本子任务实际执行结果，最终Store/权限领域/生产构建由主代理汇总。

## 表单补修

- BrandView 新建字段和保存按 brand:create，编辑按 brand:update；原始品牌与词典写入均改为 store.saveBrand 事务。开关状态也走同一命令。
- 新品牌名需要同步字典而操作者缺 dictionary:update 时，Store 明确拒绝整个事务，表单显示错误并保留草稿。
- RuleView create/copy 只生成本地草稿，实际保存记录存在才按 update；save/启停走 store.saveRule，复制取消不写入。
- SpuForm 保存统一 try/catch/finally；缺发布权限或动作抛错均显示原错误，恢复 saving，保留输入可重试。
- TemplateView 按 templateAccessResource 分辨普通属性方案与商品模型；对应 read/create/update/delete 不混用，真实模型复制调用原 copyProductModel。
- 四个管理页显示共用 RbacModeNotice（仅未启用RBAC时），RoleView超管行“更多→恢复内置权限”调用受控恢复API。

实际：node scripts/browser-rbac-form-repair.mjs → 退出0，Chrome 156.0.8078.47，4组checks，pageerror=[]。
证据：forms/result.json，brand-create-dependency-denied.png、brand-failure-draft.png、brand-created.png、rule-failure-draft.png、rule-created-copy.png、spu-publish-denied-retry.png。

## 新分类移动

- 左侧仅目标树，暂存后剔除源根及其后代。
- 右侧 props.categories 明确只接收源根和后代（原parentId不改）；rootId只用于预览时将选中根显示为视觉根。
- 右侧未暂存时传[]并显示“从左侧分类行选择移动”；不再是第二份完整树。
- 左侧选择目标完整路径；顶级目标明确为null；右确认区调用 commitCategoryMove，写盘成功后才切换data。
- 取消、右栏关闭不提交；失败保留源、目标和原数据，成功展开目标祖先并选中移动根。
- 非stage原有拖拽before/after保持原域语义，不擅自改成挂入。

实际：node scripts/browser-category-move-repair.mjs → 退出0，6组checks，pageerror=[]。
证据：category/result.json 及 staged-subtree-and-full-target-path.png、failed-move-preserves-source-target-and-data.png、moved-under-expanded-target.png、leaf-moved-to-root-after-refresh.png。

## 旧分类工作区回归适配

CATEGORY_WORKSPACE_OUTPUT=work/rbac-repair/category-workspace node scripts/browser-category-workspace.mjs → 退出0，11组checks，diagnostics=[]。

保留检查与新位置映射：

| 原业务保护 | 当前实际断言 |
| --- | --- |
| 默认查看、浏览不写数据、展开/搜索独立 | 左真实树搜索/展开；右空待移动区按钮不改左状态；暂存/定位/取消都不写 |
| A→B/B→A完整子树 | 左树原生inner移入 + 新stage显式返回，后代父子身份保持 |
| before/after排序及真正no-op | 左实际树原生前/后排序仍断言精确顺序，no-op写0次 |
| 自己后代/产品类型目标拒绝 | 真实拖拽ban样式和提示，抬鼠标后数据不变 |
| Escape、编辑上下文变化、查看模式取消 | 原生drag进行时取消，数据不变 |
| 关闭活动drag面板/拖到header不能移根 | 原生操作保留；关闭源面板取消、header不触发移动 |
| 长列表自动滚动 | 真实左目标树边缘拖拽自动滚动，Escape不提交 |
| 存活面板的选择/滚动保持 | 打开/关闭空待移动区保持左真实树实例、键盘选中和scrollTop |
| 键盘目标/配额失败重试与刷新 | 新stage左键盘选target、右确认；失败原内存和磁盘不变；重试只1次写入；刷新一致 |
| 原位改名/业务不变 | 左树局部改名，右源预览读取新名称，非categories所有数据一致 |
| 复制子树/有子级删除保护/属性方案入口 | 原页面操作保留且真实断言 |
| 深浅色/窄屏/键盘顶级移动 | 显式主题起点、窄屏堆叠，选择根与确认是两个步骤 |

两份完整树的独立搜索、双向跨面板拖拽、同节点双份编辑入口，已由用户新交互明确替换。没有移除其对应的分类身份、后代、排序、拒绝、持久化和业务不变保护。

npm run typecheck、Vue模板编译、git diff --check 均通过。未自动提交、推送或部署。
