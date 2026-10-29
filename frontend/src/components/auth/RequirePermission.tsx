import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RequirePermissionProps {
  scope: 'edc' | 'user'
  instance: string
  operation: string
  children: ReactNode
  fallback?: ReactNode
}

export function RequirePermission({
  scope,
  instance,
  operation,
  children,
  fallback,
}: RequirePermissionProps) {
  const { can } = usePermissions()

  if (can(scope, instance, operation as Parameters<typeof can>[2])) {
    return <>{children}</>
  }

  if (fallback !== undefined) {
    return <>{fallback}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="opacity-50 pointer-events-none select-none cursor-not-allowed">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Requires permission: {scope}:{instance}:{operation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
