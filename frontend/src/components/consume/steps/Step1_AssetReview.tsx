import type { CatalogDataset } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

interface Step1AssetReviewProps {
  dataset: CatalogDataset
  onNext: () => void
  onCancel: () => void
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function Step1AssetReview({ dataset, onNext, onCancel }: Step1AssetReviewProps) {
  const assetName = dataset.name ?? dataset.id ?? dataset['@id']
  const assetId = dataset['@id']

  const policies = Array.isArray(dataset['odrl:hasPolicy'])
    ? dataset['odrl:hasPolicy']
    : [dataset['odrl:hasPolicy']]
  const offerId = policies[0]?.['@id'] ?? ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {/* Name */}
        <DetailRow label="Asset Name">
          <span className="font-semibold">{assetName}</span>
        </DetailRow>

        {/* Description */}
        {dataset.description && (
          <DetailRow label="Description">
            <span className="text-muted-foreground">{dataset.description}</span>
          </DetailRow>
        )}

        {/* Content type */}
        {dataset.contenttype && (
          <DetailRow label="Content Type">
            <Badge variant="secondary">{dataset.contenttype}</Badge>
          </DetailRow>
        )}

        <Separator />

        {/* Asset ID */}
        <DetailRow label="Asset ID">
          <span className="font-mono text-xs break-all bg-muted rounded px-1.5 py-0.5 inline-block w-full">
            {assetId}
          </span>
        </DetailRow>

        {/* Offer ID */}
        {offerId && (
          <DetailRow label="Offer ID">
            <span className="font-mono text-xs break-all bg-muted rounded px-1.5 py-0.5 inline-block w-full">
              {offerId}
            </span>
          </DetailRow>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onNext} disabled={!offerId}>
          Next
        </Button>
      </div>
    </div>
  )
}
