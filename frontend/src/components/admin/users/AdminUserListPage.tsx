import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserCog } from 'lucide-react'
import type { UserResponse } from '@/lib/api/types'
import { adminService } from '@/lib/api/services/adminService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { UserRoleAssignDialog } from '@/components/admin/users/UserRoleAssignDialog'

export function AdminUserListPage() {
  const [assignTarget, setAssignTarget] = useState<UserResponse | null>(null)

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminService.listUsers,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">Failed to load users.</p>
      )}

      {users && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email / Subject</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{user.email ?? user.sub}</span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                        {user.sub}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">No roles</span>
                    ) : (
                      user.roles.map((role) => (
                        <Badge key={role.id} variant="secondary">
                          {role.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAssignTarget(user)}
                  >
                    <UserCog className="mr-1 h-4 w-4" />
                    Assign Roles
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {assignTarget && (
        <UserRoleAssignDialog
          user={assignTarget}
          open={assignTarget !== null}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  )
}
