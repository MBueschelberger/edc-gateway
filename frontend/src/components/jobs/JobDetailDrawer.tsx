import { useState } from 'react'
import { Calendar, CheckCircle2, Clock, Cpu, Hash, Loader2, Play, Terminal } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { JobStatusBadge } from '@/components/jobs/JobStatusBadge'
import { JobLogViewer } from '@/components/jobs/JobLogViewer'
import { ArtifactDownloadBar } from '@/components/jobs/ArtifactDownloadBar'
import { jobService } from '@/lib/api/services/jobService'
import { toast } from 'sonner'
import type { JobResponse } from '@/lib/api/types'

interface JobDetailDrawerProps {
  job: JobResponse | null
  edcId: string
  open: boolean
  onClose: () => void
}

function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center size-5 rounded bg-muted text-muted-foreground">
        <Icon className="size-3" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground self-start pt-0.5">{label}</span>
      <span className="font-mono text-xs text-foreground break-all leading-relaxed">{value ?? '—'}</span>
    </div>
  )
}

export function JobDetailDrawer({ job, edcId, open, onClose }: JobDetailDrawerProps) {
  const [logs, setLogs] = useState<string[] | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)

  async function handleLoadLogs() {
    if (!job) return
    setLogsLoading(true)
    try {
      const result = await jobService.getLogs(job.id, edcId)
      setLogs(result)
    } catch {
      toast.error('Failed to load logs')
    } finally {
      setLogsLoading(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setLogs(null)
      onClose()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[min(860px,90vw)] sm:max-w-none p-0 overflow-hidden flex flex-col">
        <SheetTitle className="sr-only">{job?.id ?? 'Job Details'}</SheetTitle>

        {job && (
          <>
            {/* Fixed header */}
            <div className="bg-muted/40 border-b px-6 py-5 shrink-0">
              <div className="flex items-center gap-2.5 mb-3">
                <JobStatusBadge status={job.status} phase={job.phase} />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {job.operation}
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all leading-relaxed">
                {job.id}
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="flex flex-col divide-y divide-border">

                {/* Details */}
                <div className="px-6 py-5">
                  <SectionLabel icon={Hash}>Details</SectionLabel>
                  <div>
                    <InfoRow label="EDC" value={job.edc_id} />
                    <InfoRow label="Argo Workflow" value={job.argo_workflow_name} />
                    <InfoRow
                      label="Created"
                      value={
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3 shrink-0" />
                          {new Date(job.created_at).toLocaleString()}
                        </span>
                      }
                    />
                    {job.started_at && (
                      <InfoRow
                        label="Started"
                        value={
                          <span className="flex items-center gap-1">
                            <Play className="size-3 shrink-0" />
                            {new Date(job.started_at).toLocaleString()}
                          </span>
                        }
                      />
                    )}
                    {job.finished_at && (
                      <InfoRow
                        label="Finished"
                        value={
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="size-3 shrink-0" />
                            {new Date(job.finished_at).toLocaleString()}
                          </span>
                        }
                      />
                    )}
                    <InfoRow
                      label="Progress"
                      value={
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 shrink-0" />
                          {job.progress ?? '—'}
                        </span>
                      }
                    />
                    {job.message && <InfoRow label="Message" value={job.message} />}
                  </div>
                </div>

                {/* Input parameters */}
                {job.inputs && job.inputs.parameters.length > 0 && (
                  <div className="px-6 py-5">
                    <SectionLabel icon={Cpu}>Input Parameters</SectionLabel>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="grid grid-cols-[200px_1fr] bg-muted/50 border-b border-border">
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Name</div>
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-l border-border">Value</div>
                      </div>
                      {job.inputs.parameters.map((param, i) => (
                        <div
                          key={param.name}
                          className={`grid grid-cols-[200px_1fr] ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                        >
                          <div className="px-3 py-2.5 font-mono text-xs text-foreground font-medium border-b border-border/50 last:border-0 min-w-0 overflow-hidden">
                            {param.name}
                          </div>
                          <div className="px-3 py-2.5 font-mono text-xs text-muted-foreground break-all border-l border-border border-b border-border/50 last:border-0 leading-relaxed min-w-0 overflow-hidden">
                            {param.value ?? <span className="italic text-muted-foreground/50">—</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outputs */}
                {job.outputs &&
                  (job.outputs.artifacts.length > 0 || job.outputs.parameters.length > 0) && (
                    <div className="px-6 py-5">
                      <SectionLabel icon={CheckCircle2}>Outputs</SectionLabel>
                      <ArtifactDownloadBar job={job} edcId={edcId} />
                    </div>
                  )}

                {/* Logs */}
                <div className="px-6 py-5">
                  <SectionLabel icon={Terminal}>Logs</SectionLabel>
                  {logs === null ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadLogs}
                      disabled={logsLoading}
                    >
                      {logsLoading && <Loader2 className="animate-spin mr-2 size-3" />}
                      Load Logs
                    </Button>
                  ) : (
                    <JobLogViewer logs={logs} />
                  )}
                </div>

              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
