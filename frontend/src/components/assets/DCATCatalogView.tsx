import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ExternalLink, Mail } from 'lucide-react'
import { consumeService } from '@/lib/api/services/consumeService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BPNPickerField } from '@/components/assets/BPNPicker'
import type { DCATDataset, DCATResource } from '@/lib/api/types'

// ── Dataset list ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function DatasetCard({
  dataset,
  onSelect,
}: {
  dataset: DCATDataset
  onSelect: (ds: DCATDataset) => void
}) {
  return (
    <Card
      className="flex flex-col cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onSelect(dataset)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm leading-tight">
            {dataset.title ?? <span className="italic text-muted-foreground">Untitled</span>}
          </span>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {dataset.resources.length} {dataset.resources.length === 1 ? 'resource' : 'resources'}
          </Badge>
        </div>
        {dataset.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dataset.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 pt-0 flex-1">
        {dataset.organisation && (
          <span className="text-xs">{dataset.organisation}</span>
        )}
        {dataset.author && (
          <span className="text-xs text-muted-foreground">{dataset.author}</span>
        )}
        {dataset.maintainer && (
          <span className="text-xs text-muted-foreground">
            {dataset.maintainer_email ? (
              <a
                href={`mailto:${dataset.maintainer_email}`}
                className="flex items-center gap-1 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3 w-3 shrink-0" />
                {dataset.maintainer}
              </a>
            ) : (
              dataset.maintainer
            )}
          </span>
        )}
        <div className="flex justify-end mt-auto pt-2">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(dataset) }}
          >
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DatasetList({
  datasets,
  onSelect,
}: {
  datasets: DCATDataset[]
  onSelect: (ds: DCATDataset) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return datasets
    return datasets.filter((ds) =>
      (ds.title ?? '').toLowerCase().includes(s) ||
      (ds.description ?? '').toLowerCase().includes(s) ||
      (ds.organisation ?? '').toLowerCase().includes(s) ||
      (ds.author ?? '').toLowerCase().includes(s) ||
      (ds.maintainer ?? '').toLowerCase().includes(s) ||
      (ds.maintainer_email ?? '').toLowerCase().includes(s) ||
      ds.uri.toLowerCase().includes(s),
    )
  }, [datasets, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search by title, description, organisation…"
        value={search}
        onChange={(e) => { setPage(0); setSearch(e.target.value) }}
        className="max-w-sm"
      />

      {pageData.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">No datasets found.</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {pageData.map((ds) => (
            <DatasetCard key={ds.uri} dataset={ds} onSelect={onSelect} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filtered.length === 0 ? 'No results' : `Showing ${from}–${to} of ${filtered.length}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Resource cards ────────────────────────────────────────────────────────────

function ResourceCard({
  resource,
  onRegister,
}: {
  resource: DCATResource
  onRegister: (r: DCATResource) => void
}) {
  const label = resource.title ?? resource.uri.split('/').pop() ?? resource.uri

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm leading-tight break-all">{label}</span>
          {resource.mimetype && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {resource.mimetype.split('/').pop()}
            </Badge>
          )}
        </div>
        {resource.description && (
          <p className="text-xs text-muted-foreground mt-1">{resource.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0 flex-1">
        {resource.download_url && (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Download URL</p>
            <a
              href={resource.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-xs text-primary hover:underline break-all"
            >
              {resource.download_url}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        )}
        <div className="flex justify-end mt-auto pt-2">
          <Button size="sm" type="button" onClick={() => onRegister(resource)}>
            Register
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Registration form ─────────────────────────────────────────────────────────

const registrationSchema = z.object({
  consumer_bpn: z.string().min(1, 'Consumer BPN is required'),
  full_policy: z.boolean(),
})
type RegistrationValues = z.infer<typeof registrationSchema>

function DCATResourceRegistrationForm({
  edcId,
  dataset,
  resource,
  open,
  onClose,
  onSuccess,
}: {
  edcId: string
  dataset: DCATDataset
  resource: DCATResource
  open: boolean
  onClose: () => void
  onSuccess: (jobId: string) => void
}) {
  "use no memo"
  const {
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { consumer_bpn: '', full_policy: false },
  })

  const consumerBpn = watch('consumer_bpn')
  const fullPolicy = watch('full_policy')

  const mutation = useMutation({
    mutationFn: (data: RegistrationValues) =>
      consumeService.createAsset(edcId, {
        asset_name: resource.title ?? resource.uri,
        asset_description: resource.description ?? dataset.description ?? undefined,
        asset_type: resource.mimetype ?? undefined,
        asset_path: resource.download_url ?? '',
        consumer_bpn: data.consumer_bpn,
        full_policy: data.full_policy,
      }),
    onSuccess: (job) => {
      reset()
      onSuccess(job.id)
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to register asset')
    },
  })

  const resourceLabel = resource.title ?? resource.uri.split('/').pop() ?? resource.uri

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug break-all">
            Register: {resourceLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-md bg-muted p-3 flex flex-col gap-1.5 text-xs">
            <div>
              <span className="font-medium text-muted-foreground">Name: </span>
              {resource.title ?? <span className="italic text-muted-foreground">—</span>}
            </div>
            {resource.description && (
              <div>
                <span className="font-medium text-muted-foreground">Description: </span>
                {resource.description}
              </div>
            )}
            {resource.mimetype && (
              <div>
                <span className="font-medium text-muted-foreground">Type: </span>
                {resource.mimetype}
              </div>
            )}
            {resource.download_url && (
              <div className="break-all">
                <span className="font-medium text-muted-foreground">Path: </span>
                <span className="font-mono">{resource.download_url}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-4 mt-2">
          <BPNPickerField
            edcId={edcId}
            value={consumerBpn}
            onChange={(bpn) => setValue('consumer_bpn', bpn, { shouldValidate: true })}
            error={errors.consumer_bpn?.message}
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="dcat_full_policy"
              checked={fullPolicy}
              onCheckedChange={(checked) => setValue('full_policy', checked === true)}
            />
            <Label htmlFor="dcat_full_policy" className="cursor-pointer">
              Full Policy
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Asset
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface DCATCatalogViewProps {
  edcId: string
  datasets: DCATDataset[]
  onSuccess: (jobId: string) => void
}

export function DCATCatalogView({ edcId, datasets, onSuccess }: DCATCatalogViewProps) {
  const [selectedDataset, setSelectedDataset] = useState<DCATDataset | null>(null)
  const [registrationTarget, setRegistrationTarget] = useState<{
    dataset: DCATDataset
    resource: DCATResource
  } | null>(null)

  function handleRegisterSuccess(jobId: string) {
    setRegistrationTarget(null)
    onSuccess(jobId)
  }

  if (selectedDataset === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} available for registration
        </p>
        <DatasetList datasets={datasets} onSelect={setSelectedDataset} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" type="button" onClick={() => setSelectedDataset(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to datasets
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {selectedDataset.title ?? 'Dataset'}
          </span>
          {selectedDataset.organisation && (
            <span className="text-xs text-muted-foreground">{selectedDataset.organisation}</span>
          )}
        </div>
      </div>

      {selectedDataset.description && (
        <p className="text-sm text-muted-foreground">{selectedDataset.description}</p>
      )}

      {(selectedDataset.maintainer || selectedDataset.landing_page) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {selectedDataset.maintainer && (
            <span className="flex items-center gap-1">
              {selectedDataset.maintainer_email ? (
                <a
                  href={`mailto:${selectedDataset.maintainer_email}`}
                  className="flex items-center gap-1 hover:underline"
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  {selectedDataset.maintainer}
                </a>
              ) : (
                selectedDataset.maintainer
              )}
            </span>
          )}
          {selectedDataset.landing_page && (
            <a
              href={selectedDataset.landing_page}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              Landing page
            </a>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {selectedDataset.resources.length} resource{selectedDataset.resources.length !== 1 ? 's' : ''}
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {selectedDataset.resources.map((resource) => (
          <ResourceCard
            key={resource.uri}
            resource={resource}
            onRegister={(r) => setRegistrationTarget({ dataset: selectedDataset, resource: r })}
          />
        ))}
      </div>

      {registrationTarget && (
        <DCATResourceRegistrationForm
          edcId={edcId}
          dataset={registrationTarget.dataset}
          resource={registrationTarget.resource}
          open={true}
          onClose={() => setRegistrationTarget(null)}
          onSuccess={handleRegisterSuccess}
        />
      )}
    </div>
  )
}
