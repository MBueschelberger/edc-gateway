import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Lazy-loaded pages and components
const EDCDashboardPage = lazy(() => import('@/pages/EDCDashboardPage'))
const BootstrapPage = lazy(() => import('@/pages/BootstrapPage'))
const AdminShell = lazy(() =>
  import('@/components/admin/AdminShell').then((m) => ({ default: m.AdminShell })),
)
const AdminEDCListPage = lazy(() =>
  import('@/components/admin/edcs/AdminEDCListPage').then((m) => ({
    default: m.AdminEDCListPage,
  })),
)
const EDCCreateForm = lazy(() =>
  import('@/components/admin/edcs/EDCCreateForm').then((m) => ({
    default: m.EDCCreateForm,
  })),
)
const EDCEditForm = lazy(() =>
  import('@/components/admin/edcs/EDCEditForm').then((m) => ({
    default: m.EDCEditForm,
  })),
)
const EDCBPNRegistryPage = lazy(() =>
  import('@/components/admin/edcs/EDCBPNRegistryPage').then((m) => ({
    default: m.EDCBPNRegistryPage,
  })),
)
const AdminUserListPage = lazy(() =>
  import('@/components/admin/users/AdminUserListPage').then((m) => ({
    default: m.AdminUserListPage,
  })),
)
const AdminRoleListPage = lazy(() =>
  import('@/components/admin/roles/AdminRoleListPage').then((m) => ({
    default: m.AdminRoleListPage,
  })),
)
const RoleCreateForm = lazy(() =>
  import('@/components/admin/roles/RoleCreateForm').then((m) => ({
    default: m.RoleCreateForm,
  })),
)
const RoleEditForm = lazy(() =>
  import('@/components/admin/roles/RoleEditForm').then((m) => ({
    default: m.RoleEditForm,
  })),
)

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Bootstrap / setup route — no shell */}
          <Route path="/bootstrap" element={<BootstrapPage />} />

          {/* Main app shell */}
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/edcs" replace />} />

            <Route path="edcs">
              <Route
                index
                element={
                  <p className="text-sm text-muted-foreground">
                    Select an EDC from the sidebar
                  </p>
                }
              />
              <Route path=":edcId/*" element={<EDCDashboardPage />} />
            </Route>

            {/* Admin section */}
            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/edcs" replace />} />
              <Route path="edcs" element={<AdminEDCListPage />} />
              <Route path="edcs/new" element={<EDCCreateForm />} />
              <Route path="edcs/:edcId/edit" element={<EDCEditForm />} />
              <Route path="edcs/:edcId/bpn-registry" element={<EDCBPNRegistryPage />} />
              <Route path="users" element={<AdminUserListPage />} />
              <Route path="roles" element={<AdminRoleListPage />} />
              <Route path="roles/new" element={<RoleCreateForm />} />
              <Route path="roles/:roleId/edit" element={<RoleEditForm />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
