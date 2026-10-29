import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { PermissionCreate } from '@/lib/api/types'
import { adminService } from '@/lib/api/services/adminService'
import { edcService } from '@/lib/api/services/edcService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PermissionBuilder } from '@/components/admin/roles/PermissionBuilder'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function RoleCreateForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [permissions, setPermissions] = useState<PermissionCreate[]>([])

  const { data: edcs = [] } = useQuery({
    queryKey: ['admin', 'edcs'],
    queryFn: edcService.adminList,
  })

  const edcOptions = edcs.map((e) => ({ id: e.id, display_name: e.display_name }))

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      adminService.createRole({
        name: data.name,
        description: data.description || undefined,
        permissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] })
      toast.success('Role created successfully')
      navigate('/admin/roles')
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to create role'
      toast.error(message)
    },
  })

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" {...register('name')} placeholder="e.g. consumer" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      <PermissionBuilder
        permissions={permissions}
        onChange={setPermissions}
        edcOptions={edcOptions}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => navigate('/admin/roles')} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Role
        </Button>
      </div>
    </form>
  )
}
