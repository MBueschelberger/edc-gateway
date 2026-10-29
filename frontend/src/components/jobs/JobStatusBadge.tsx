import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { JobResponse } from '@/lib/api/types'

interface JobStatusBadgeProps {
  status: JobResponse['status']
  phase?: JobResponse['phase']
}

export function JobStatusBadge({ status, phase }: JobStatusBadgeProps) {
  const isSucceeded = status === 'succeeded' || phase === 'Succeeded'
  const isFailed =
    status === 'failed' || phase === 'Failed' || phase === 'Error'
  const isRunning =
    status === 'running' ||
    status === 'pending' ||
    phase === 'Running' ||
    phase === 'Pending'

  if (isSucceeded) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        Succeeded
      </Badge>
    )
  }

  if (isFailed) {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        {phase === 'Error' ? 'Error' : 'Failed'}
      </Badge>
    )
  }

  if (isRunning) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
        <Loader2 className="animate-spin" />
        {status === 'pending' || phase === 'Pending' ? 'Pending' : 'Running'}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary">Unknown</Badge>
  )
}
