import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { UserResponse } from '@/lib/api/types'
import { adminService } from '@/lib/api/services/adminService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

interface UserRoleAssignDialogProps {
  user: UserResponse
  open: boolean
  onClose: () => void
}

export function UserRoleAssignDialog({ user, open, onClose }: UserRoleAssignDialogProps) {
  const queryClient = useQueryClient()

  const { data: allRoles, isLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: adminService.listRoles,
    enabled: open,
  })

  const currentRoleIds = user.roles.map((r) => r.id)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentRoleIds))
  const [wasOpen, setWasOpen] = useState(false)

  if (open && !wasOpen) {
    setSelectedIds(new Set(user.roles.map((r) => r.id)))
  }
  if (open !== wasOpen) {
    setWasOpen(open)
  }

  const mutation = useMutation({
    mutationFn: () =>
      adminService.assignRoles(user.id, { role_ids: Array.from(selectedIds) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Roles updated')
      onClose()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to assign roles'
      toast.error(message)
    },
  })

  function toggleRole(roleId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Roles</DialogTitle>
          <DialogDescription>
            Select roles for {user.email ?? user.sub}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 min-h-[4rem]">
          {isLoading && (
            <>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </>
          )}

          {allRoles && allRoles.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No roles available.</p>
          )}

          {allRoles?.map((role) => (
            <div key={role.id} className="flex items-center gap-3 py-1">
              <Checkbox
                id={`role-${role.id}`}
                checked={selectedIds.has(role.id)}
                onCheckedChange={() => toggleRole(role.id)}
              />
              <Label htmlFor={`role-${role.id}`} className="cursor-pointer flex flex-col gap-0.5">
                <span className="font-medium">{role.name}</span>
                {role.description && (
                  <span className="text-xs text-muted-foreground">{role.description}</span>
                )}
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || isLoading}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
