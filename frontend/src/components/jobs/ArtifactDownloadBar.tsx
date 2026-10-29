import { useState } from 'react'
import { Download, Eye, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { jobService } from '@/lib/api/services/jobService'
import { toast } from 'sonner'
import type { JobResponse } from '@/lib/api/types'

interface ArtifactDownloadBarProps {
  job: JobResponse
  edcId: string
}

export function ArtifactDownloadBar({ job, edcId }: ArtifactDownloadBarProps) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<{ name: string; text: string } | null>(null)

  const artifacts = job.outputs?.artifacts ?? []
  const parameters = job.outputs?.parameters ?? []

  const hasContent = artifacts.length > 0 || parameters.length > 0
  if (!hasContent) return null

  async function handleDownload(artifactName: string) {
    setDownloading(artifactName)
    try {
      const blob = await jobService.downloadArtifact(job.id, artifactName, edcId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = artifactName
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(`Failed to download ${artifactName}`)
    } finally {
      setDownloading(null)
    }
  }

  async function handlePreview(artifactName: string) {
    if (previewContent?.name === artifactName) {
      setPreviewContent(null)
      return
    }
    setPreviewing(artifactName)
    try {
      const blob = await jobService.downloadArtifact(job.id, artifactName, edcId)
      const text = await blob.text()
      setPreviewContent({ name: artifactName, text })
    } catch {
      toast.error(`Failed to preview ${artifactName}`)
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <div className="space-y-3">
      {parameters.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Output Parameters</p>
          <div className="space-y-1">
            {parameters.map((param) => {
              const isUrl = param.value != null && /^https?:\/\//i.test(param.value)
              return (
                <div key={param.name} className="flex gap-2 text-xs">
                  <span className="font-mono text-muted-foreground min-w-[120px] truncate">
                    {param.name}
                  </span>
                  <span className="font-mono text-foreground break-all">
                    {param.value == null ? '—' : isUrl ? (
                      <a
                        href={param.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        {param.value}
                      </a>
                    ) : param.value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {artifacts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Artifacts</p>
          <div className="flex flex-wrap gap-2">
            {artifacts.map((artifact) => (
              <div key={artifact.name} className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloading === artifact.name}
                  onClick={() => handleDownload(artifact.name)}
                >
                  {downloading === artifact.name ? (
                    <Loader2 className="mr-1 animate-spin" />
                  ) : (
                    <Download className="mr-1" />
                  )}
                  {artifact.name}
                </Button>
                <Button
                  variant={previewContent?.name === artifact.name ? 'secondary' : 'ghost'}
                  size="sm"
                  disabled={previewing === artifact.name}
                  onClick={() => handlePreview(artifact.name)}
                  title="Preview artifact"
                >
                  {previewing === artifact.name ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : previewContent?.name === artifact.name ? (
                    <X className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {previewContent && (
            <ScrollArea className="h-[400px] w-full rounded-md mt-3">
              <pre className="bg-black text-green-400 font-mono text-xs p-4 min-h-full">
                <code className="block whitespace-pre-wrap break-all">{previewContent.text}</code>
              </pre>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  )
}
