import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { buildCan } from '@/lib/permissions'

export function usePermissions() {
  const { user } = useAuth()
  const can = useMemo(() => buildCan(user), [user])
  return { can, isAdmin: can('user', '*', 'manage') }
}
