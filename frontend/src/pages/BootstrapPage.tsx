import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { adminService } from '@/lib/api/services/adminService'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function BootstrapPage() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const { can } = usePermissions()

  useEffect(() => {
    if (!isLoading && user && can('user', '*', 'manage')) {
      void navigate('/admin', { replace: true })
    }
  }, [isLoading, user, can, navigate])

  const mutation = useMutation({
    mutationFn: () => adminService.bootstrap(),
    onSuccess: () => {
      toast.success('Admin account initialized successfully.')
      void navigate('/admin', { replace: true })
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        void navigate('/admin', { replace: true })
        return
      }
      const message = err instanceof Error ? err.message : 'Bootstrap failed'
      toast.error(message)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Setup Admin Account</CardTitle>
          <CardDescription>
            Click below to grant admin access to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Initialize Admin
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
