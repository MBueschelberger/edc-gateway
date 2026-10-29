import { useState } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { JobRow } from '@/components/jobs/JobRow'
import { JobDetailPanel } from '@/components/jobs/JobDetailPanel'
import { jobService } from '@/lib/api/services/jobService'
import type { JobResponse } from '@/lib/api/types'

const PAGE_SIZE = 20

interface JobListPanelProps {
  edcId: string
}

export function JobListPanel({ edcId }: JobListPanelProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [selectedJob, setSelectedJob] = useState<JobResponse | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const { data: jobs, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['edcs', edcId, 'jobs', page],
    queryFn: () => jobService.list(edcId, PAGE_SIZE, page * PAGE_SIZE),
  })

  function handleSelect(job: JobResponse) {
    setSelectedJob(job)
  }

  function handlePanelClose() {
    setSelectedJob(null)
  }

  function handleCheck(id: string, checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const allChecked = !!jobs && jobs.length > 0 && jobs.every((j) => checkedIds.has(j.id))
  const someChecked = checkedIds.size > 0

  function handleCheckAll(checked: boolean) {
    if (checked && jobs) setCheckedIds(new Set(jobs.map((j) => j.id)))
    else setCheckedIds(new Set())
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await jobService.bulkDelete(Array.from(checkedIds), edcId)
      toast.success(`${checkedIds.size} job(s) deleted`)
      setCheckedIds(new Set())
      setBulkDeleteOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['edcs', edcId, 'jobs'] })
    } catch {
      toast.error('Failed to delete jobs')
    } finally {
      setBulkDeleting(false)
    }
  }

  const hasPrev = page > 0
  const hasNext = jobs !== undefined && jobs.length === PAGE_SIZE

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Jobs</h2>
        <div className="flex items-center gap-2">
          {someChecked && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete {checkedIds.size} job{checkedIds.size > 1 ? 's' : ''}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'animate-spin mr-2' : 'mr-2'} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load jobs.</p>
      ) : jobs && jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs found for this EDC.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 pr-0">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(c) => handleCheckAll(!!c)}
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs?.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onSelect={handleSelect}
                checked={checkedIds.has(job.id)}
                onCheck={handleCheck}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {/* Job detail dialog */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => { if (!open) handlePanelClose() }}>
        <DialogContent className="w-[min(860px,90vw)] sm:max-w-none p-0 overflow-hidden" showCloseButton>
          <DialogTitle className="sr-only">{selectedJob?.id ?? 'Job Details'}</DialogTitle>
          {selectedJob && (
            <JobDetailPanel job={selectedJob} edcId={edcId} onClose={handlePanelClose} />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete {checkedIds.size} job{checkedIds.size > 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              The selected job records will be removed from the database. Argo workflows in
              Kubernetes are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting && <Loader2 className="animate-spin mr-2 size-3" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {!isLoading && !isError && (hasPrev || hasNext) && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
          >
            <ChevronLeft />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      )}

      {!isLoading && !isError && jobs && jobs.length > 0 && !hasPrev && !hasNext && (
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground">Page 1</span>
        </div>
      )}
    </div>
  )
}
