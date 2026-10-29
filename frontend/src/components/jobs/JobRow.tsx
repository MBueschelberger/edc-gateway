import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { JobStatusBadge } from '@/components/jobs/JobStatusBadge'
import type { JobResponse } from '@/lib/api/types'

interface JobRowProps {
  job: JobResponse
  onSelect: (job: JobResponse) => void
  selected?: boolean
  checked?: boolean
  onCheck?: (id: string, checked: boolean) => void
}

function formatLocalDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function JobRow({ job, onSelect, selected, checked, onCheck }: JobRowProps) {
  const progressText = job.progress ?? '—'

  return (
    <TableRow
      className={`cursor-pointer${selected ? ' bg-muted/50' : ''}`}
      onClick={() => onSelect(job)}
    >
      {onCheck !== undefined && (
        <TableCell className="w-8 pr-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={checked ?? false}
            onCheckedChange={(c) => onCheck(job.id, !!c)}
          />
        </TableCell>
      )}
      <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}</TableCell>
      <TableCell>
        {job.operation === 'consume' ? (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            consume
          </Badge>
        ) : job.operation === 'delete_asset' ? (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            delete_asset
          </Badge>
        ) : (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            create_asset
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <JobStatusBadge status={job.status} phase={job.phase} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{progressText}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatLocalDateTime(job.created_at)}
      </TableCell>
    </TableRow>
  )
}
