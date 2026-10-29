import { Navigate, Outlet } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'

export default function AdminPage() {
  const { isAdmin } = usePermissions()

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
