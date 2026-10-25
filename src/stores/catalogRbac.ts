import { RBAC_ENFORCEMENT_ENABLED } from '../domain/accessMode'
import type { AppData, AppUser } from '../domain/types'
import type { RbacRole, RbacPermission } from '../domain/rbac'
import { effectivePermissions, isSuperAdmin, rbacProblems } from '../domain/rbac'

/** All authorization edits operate on an isolated candidate and use the catalog transaction. */
export function createRbacCommands(data: AppData, actor: () => string, can: (code:string)=>boolean, commit: (next:AppData)=>{ok:boolean;message?:string}, id:()=>string) {
  const clone = () => JSON.parse(JSON.stringify(data)) as AppData
  const denied = (message:string) => ({ok:false,message})
  function finish(next:AppData) { const problems=rbacProblems(next);return problems.length?denied(problems.join(' ')):commit(next) }
  function grantable(codes:string[]) { if(!RBAC_ENFORCEMENT_ENABLED)return true;const own=effectivePermissions(data,actor());return codes.every(code=>own.has(code)) }
  function saveRbacRole(input:RbacRole) {
    const next=clone(),old=next.rbac!.roles.find(r=>r.id===input.id)
    if(!can(old?'system:role:update':'system:role:create'))return denied('没有维护此角色的权限。')
    if(!input.name?.trim()||!input.code?.trim()||!/^[a-zA-Z0-9:_-]+$/.test(input.code))return denied('请填写角色名称和合法稳定编码。')
    if(next.rbac!.roles.some(r=>r.id!==input.id&&r.code===input.code))return denied('角色编码已存在。')
    if(old&&old.code!==input.code)return denied('角色编码创建后不能更换。')
    if(old?.superAdmin||input.superAdmin||input.id==='role:super-admin')return denied('受保护的超级管理员角色不能编辑、复制为超级身份或停用。')
    if(!old&&(input.builtIn||input.id?.startsWith('role:')))return denied('不能创建伪造的内置角色。')
    const codes=old?.permissionCodes||input.permissionCodes||[]
    if(!old&&codes.length&&(!can('system:role:grant')||!grantable(codes)))return denied('复制授权需要配置权限且不得超过委派范围。')
    if(old&&!grantable(old.permissionCodes))return denied('不能修改超出操作者委派范围的角色。')
    const record:RbacRole={id:old?.id||input.id||id(),code:input.code.trim(),name:input.name.trim(),description:input.description||'',enabled:input.enabled===true,permissionCodes:codes,...(old?.builtIn?{builtIn:true}:{})}
    if(old)Object.assign(old,record);else next.rbac!.roles.push(record)
    return finish(next)
  }
  function grantRbacRole(roleId:string,codes:string[]) {
    if(!can('system:role:grant'))return denied('没有配置角色授权的权限。')
    const next=clone(),role=next.rbac!.roles.find(r=>r.id===roleId)
    if(!role||role.superAdmin)return denied('角色不存在或属于受保护的超级管理员。')
    if(!Array.isArray(codes)||!grantable(codes))return denied('不能委派操作者自身不拥有的权限。')
    // Revoking privileges of a more privileged role is also delegation.
    if(!grantable(role.permissionCodes))return denied('此角色包含超出操作者委派范围的权限。')
    role.permissionCodes=[...new Set(codes)]
    return finish(next)
  }
  function removeRbacRole(roleId:string) {
    if(!can('system:role:delete'))return denied('没有删除角色的权限。')
    const next=clone(),role=next.rbac!.roles.find(r=>r.id===roleId)
    if(!role||role.builtIn||role.superAdmin)return denied('内置角色不可删除。')
    const users=next.users.filter(u=>u.roleIds?.includes(roleId))
    if(users.length)return denied(`角色仍被 ${users.map(u=>u.displayName).join('、')} 引用，请先调整用户绑定。`)
    next.rbac!.roles=next.rbac!.roles.filter(r=>r.id!==roleId);return finish(next)
  }
  function saveRbacPermission(input:RbacPermission) {
    if(!can('system:permission:update'))return denied('没有维护权限目录的权限。')
    const next=clone(),old=next.rbac!.permissions.find(p=>p.code===input.code)
    if(old&&old.enabled!==input.enabled&&!isSuperAdmin(data,actor())&&!can(old.code))return denied('不能改变超出操作者委派范围的权限状态。')
    if(!old||!input.name?.trim())return denied('只能维护已登记的内置权限，请填写名称。')
    if(['code','module','resource','action','kind','route','builtIn'].some(k=>JSON.stringify((old as any)[k])!==JSON.stringify((input as any)[k])))return denied('权限身份、编码和执行绑定不可修改。')
    if(!input.enabled&&next.rbac!.roles.some(r=>!r.superAdmin&&r.permissionCodes.includes(old.code)))return denied('权限仍被业务角色引用，不能停用或删除；请先撤销相应授权。')
    old.name=input.name.trim();old.description=input.description||'';old.enabled=input.enabled===true;return finish(next)
  }
  function saveRbacUser(input:AppUser) {
    const next=clone(),old=next.users.find(u=>u.id===input.id)
    if(!can(old?'system:user:update':'system:user:create'))return denied('没有维护此用户的权限。')
    if(!input.username?.trim()||!input.displayName?.trim()||!Array.isArray(input.roleIds))return denied('请填写账号、姓名并选择角色。')
    if(JSON.stringify(old?.roleIds||[])!==JSON.stringify(input.roleIds)&&!can('system:user:bind'))return denied('没有绑定用户角色的权限。')
    if(next.users.some(u=>u.id!==input.id&&u.username===input.username.trim()))return denied('账号已存在。')
    const own=effectivePermissions(data,actor()),before=new Set(old?.roleIds||[])
    for(const roleId of input.roleIds){const r=next.rbac!.roles.find(r=>r.id===roleId);if(!r)return denied('绑定角色不存在。');if(!before.has(roleId)&&(r.superAdmin&&!isSuperAdmin(data,actor())||!r.permissionCodes.every(c=>own.has(c))))return denied('不能绑定超出操作者委派范围的角色。')}
    if(RBAC_ENFORCEMENT_ENABLED&&old?.id===actor()&&isSuperAdmin(data,actor())&&(!input.enabled||!input.roleIds.includes('role:super-admin')))return denied('请先切换到另一位有效超级管理员，再停用或调整当前超级管理员。')
    if(RBAC_ENFORCEMENT_ENABLED&&old&&isSuperAdmin(data,old.id)&&!isSuperAdmin(data,actor()))return denied('普通角色不能修改超级管理员用户。')
    const record:AppUser={id:old?.id||input.id||id(),username:input.username.trim(),displayName:input.displayName.trim(),enabled:input.enabled===true,role:old?.role||'operator',roleIds:[...new Set(input.roleIds)]}
    if(old)Object.assign(old,record);else next.users.push(record)
    return finish(next)
  }
  function removeRbacUser(userId:string){if(RBAC_ENFORCEMENT_ENABLED&&userId===actor()&&isSuperAdmin(data,actor()))return denied('请先切换其他有效管理员，再删除当前超级管理员。');if(!can('system:user:delete'))return denied('没有删除用户的权限。');const next=clone();if(RBAC_ENFORCEMENT_ENABLED&&isSuperAdmin(data,userId)&&!isSuperAdmin(data,actor()))return denied('普通角色不能删除超级管理员。');next.users=next.users.filter(u=>u.id!==userId);return finish(next)}
  return {saveRbacRole,grantRbacRole,removeRbacRole,saveRbacPermission,saveRbacUser,removeRbacUser}
}
