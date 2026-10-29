import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Server, Users, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'EDCs', to: '/admin/edcs', icon: Server },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Roles', to: '/admin/roles', icon: ShieldCheck },
]

export function AdminShell() {
  const location = useLocation()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Admin</h1>
        <nav className="flex gap-1 border-b pb-0">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
            const isActive =
              location.pathname === to || location.pathname.startsWith(to + '/')
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div>
        <Outlet />
      </div>
    </div>
  )
}
