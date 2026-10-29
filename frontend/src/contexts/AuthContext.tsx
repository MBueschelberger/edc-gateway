import { createContext, useContext, useEffect, useState } from 'react'
import { adminService } from '@/lib/api/services/adminService'
import type { UserResponse } from '@/lib/api/types'

interface AuthContextValue {
  user: UserResponse | null
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refetch: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = () => {
    setIsLoading(true)
    adminService
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    adminService
      .getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch: loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => useContext(AuthContext)
