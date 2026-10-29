import { keycloak } from '@/lib/keycloak'
import { useAuthContext } from '@/contexts/AuthContext'

export function useAuth() {
  const { user, isLoading, refetch } = useAuthContext()
  return { keycloak, user, isLoading, refetch }
}
