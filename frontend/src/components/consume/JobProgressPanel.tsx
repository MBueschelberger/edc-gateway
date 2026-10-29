import { Calendar, CheckCircle2, Clock, Cpu, Hash, Loader2, Play, Terminal, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JobStatusBadge } from '@/components/jobs/JobStatusBadge'
import { JobLogViewer } from '@/components/jobs/JobLogViewer'
import { ArtifactDownloadBar } from '@/components/jobs/ArtifactDownloadBar'
import { useJobPolling } from '@/hooks/useJobPolling'

interface JobProgressPanelProps {
  jobId: string | null
  edcId: string
  onClose: () => void
}

function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
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
    <div className="grid grid-cols-[130px_1fr] gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground self-start pt-0.5">{label}</span>
      <span className="font-mono text-xs text-foreground break-all leading-relaxed">{value ?? '—'}</span>
    </div>
  )
}

export function JobProgressPanel({ jobId, edcId, onClose }: JobProgressPanelProps) {
  const { job, logs, error } = useJobPolling(jobId, edcId)

  const isDone = job?.status === 'succeeded' || job?.status === 'failed'
  const isRunning = !isDone && !error

  return (
    <div className="flex flex-col gap-4">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        {job?.status === 'succeeded' && <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0" />}
        {(job?.status === 'failed' || error) && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
        <span className="text-sm font-medium">
          {error
            ? error
            : !job
              ? 'Starting…'
              : job.status === 'succeeded'
                ? 'Completed successfully'
                : job.status === 'failed'
                  ? `Failed${job.phase ? ` — ${job.phase}` : ''}`
                  : job.phase
                    ? `Running — ${job.phase}`
                    : 'Running'}
        </span>
      </div>

      {/* Detail sections */}
      {job && (
        <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden rounded-md border divide-y divide-border">
          {/* Details */}
          <div className="px-4 py-4">
            <SectionLabel icon={Hash}>Details</SectionLabel>
            <div className="mb-2">
              <JobStatusBadge status={job.status} phase={job.phase} />
            </div>
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

          {/* Input Parameters */}
          {job.inputs && job.inputs.parameters.length > 0 && (
            <div className="px-4 py-4">
              <SectionLabel icon={Cpu}>Input Parameters</SectionLabel>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[160px_1fr] bg-muted/50 border-b border-border">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Name</div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-l border-border">Value</div>
                </div>
                {job.inputs.parameters.map((param, i) => (
                  <div
                    key={param.name}
                    className={`grid grid-cols-[160px_1fr] ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
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
          {job.outputs && (job.outputs.artifacts.length > 0 || job.outputs.parameters.length > 0) && (
            <div className="px-4 py-4">
              <SectionLabel icon={CheckCircle2}>Outputs</SectionLabel>
              <ArtifactDownloadBar job={job} edcId={edcId} />
            </div>
          )}

          {/* Logs — auto-loaded when done */}
          {isDone && (
            <div className="px-4 py-4">
              <SectionLabel icon={Terminal}>Logs</SectionLabel>
              {logs === null ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Loading logs…
                </div>
              ) : (
                <JobLogViewer logs={logs} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Close button when terminal */}
      {(isDone || error) && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
