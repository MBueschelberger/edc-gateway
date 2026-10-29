import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { CatalogDataset } from '@/lib/api/types'
import { consumeService } from '@/lib/api/services/consumeService'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

interface ConsumeOptions {
  debug: boolean
}

interface Step4SubmitProps {
  dataset: CatalogDataset
  edcId: string
  providerBpn: string
  providerDspUrl: string
  options: ConsumeOptions
  onJobCreated: (jobId: string) => void
  onBack: () => void
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function Step4Submit({
  dataset,
  edcId,
  providerBpn,
  providerDspUrl,
  options,
  onJobCreated,
  onBack,
}: Step4SubmitProps) {
  const assetName = dataset.name ?? dataset.id ?? dataset['@id']
  const assetId = dataset['@id']

  const policies = Array.isArray(dataset['odrl:hasPolicy'])
    ? dataset['odrl:hasPolicy']
    : [dataset['odrl:hasPolicy']]
  const offerId = policies[0]?.['@id'] ?? ''

  const mutation = useMutation({
    mutationFn: () =>
      consumeService.consumeAsset(edcId, {
        asset_id: assetId,
        provider_bpn: providerBpn,
        provider_dsp_url: providerDspUrl,
        debug: options.debug,
      }),
    onSuccess: (job) => {
      onJobCreated(job.id)
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Failed to start consume job'
      toast.error(message)
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Summary
        </p>

        <SummaryRow label="Asset Name">
          <span className="font-semibold">{assetName}</span>
        </SummaryRow>

        <SummaryRow label="Asset ID">
          <span className="font-mono text-xs break-all bg-muted rounded px-1.5 py-0.5 inline-block w-full">
            {assetId}
          </span>
        </SummaryRow>

        {offerId && (
          <SummaryRow label="Offer ID">
            <span className="font-mono text-xs break-all bg-muted rounded px-1.5 py-0.5 inline-block w-full">
              {offerId}
            </span>
          </SummaryRow>
        )}

        <Separator />

        <SummaryRow label="Provider BPN">
          <span className="font-mono text-xs">{providerBpn}</span>
        </SummaryRow>

        <SummaryRow label="Provider DSP URL">
          <span className="font-mono text-xs break-all">{providerDspUrl}</span>
        </SummaryRow>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Options</p>
          <div className="flex gap-2 flex-wrap">
            {options.debug && (
              <Badge variant="secondary">Debug mode</Badge>
            )}
            {!options.debug && (
              <span className="text-xs text-muted-foreground italic">None</span>
            )}
          </div>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">
          {mutation.error instanceof Error
            ? mutation.error.message
            : 'An error occurred. Please try again.'}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={mutation.isPending}>
          Back
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Start Consume
        </Button>
      </div>
    </div>
  )
}
