import type { UserResponse } from '@/lib/api/types'

export type PermissionScope = 'edc' | 'user'
export type EDCOp = 'manage' | 'consume' | 'create_asset' | 'catalog' | 'status' | 'bpn-discovery' | 'inspect'
export type UserOp = 'manage'

function resolvePermissions(user: UserResponse): Set<string> {
  const keys = new Set<string>()
  for (const role of user.roles) {
    for (const perm of role.permissions) {
      keys.add(`${perm.scope}:${perm.instance}:${perm.operation}`)
    }
  }
  return keys
}

export function buildCan(user: UserResponse | null) {
  if (!user) return () => false
  const perms = resolvePermissions(user)
  return (scope: PermissionScope, instance: string, operation: EDCOp | UserOp): boolean =>
    perms.has(`${scope}:*:${operation}`) || perms.has(`${scope}:${instance}:${operation}`)
}
