import { useState } from 'react'
import { Copy, Check, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PolicyBadge } from '@/components/catalog/PolicyBadge'
import type { CatalogDataset, OdrlConstraint, OdrlPermission, OdrlOffer } from '@/lib/api/types'

interface CatalogAssetCardProps {
  dataset: CatalogDataset
  onConsume?: (dataset: CatalogDataset, offerId: string) => void
  onDelete?: (dataset: CatalogDataset) => void
}

function extractConstraints(offer: OdrlOffer): OdrlConstraint[] {
  const permissions = Array.isArray(offer['odrl:permission'])
    ? offer['odrl:permission']
    : [offer['odrl:permission']]

  const constraints: OdrlConstraint[] = []

  for (const perm of permissions) {
    const raw = (perm as OdrlPermission)['odrl:constraint']
    if (!raw) continue

    // Single constraint
    if ('odrl:leftOperand' in raw) {
      constraints.push(raw as OdrlConstraint)
      continue
    }

    // Constraint group with odrl:and
    if ('odrl:and' in raw && Array.isArray(raw['odrl:and'])) {
      constraints.push(...raw['odrl:and'])
      continue
    }

    // Constraint group with odrl:or
    if ('odrl:or' in raw && Array.isArray(raw['odrl:or'])) {
      constraints.push(...raw['odrl:or'])
    }
  }

  return constraints
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

export function CatalogAssetCard({ dataset, onConsume, onDelete }: CatalogAssetCardProps) {
  const assetName = dataset.name ?? dataset.id ?? dataset['@id']
  const assetId = dataset['@id']

  // Normalize odrl:hasPolicy to array, use first offer
  const policies = Array.isArray(dataset['odrl:hasPolicy'])
    ? dataset['odrl:hasPolicy']
    : [dataset['odrl:hasPolicy']]
  const firstOffer = policies[0]
  const offerId = firstOffer?.['@id'] ?? ''

  const constraints = firstOffer ? extractConstraints(firstOffer) : []

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm leading-tight break-all">{assetName}</span>
          {dataset.contenttype && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {dataset.contenttype}
            </Badge>
          )}
        </div>
        {dataset.description && (
          <p className="text-xs text-muted-foreground mt-1">{dataset.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-0 flex-1">
        {/* Asset ID */}
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Asset ID</p>
          <div className="flex items-center">
            <span className="font-mono text-xs truncate max-w-[280px]" title={assetId}>
              {assetId}
            </span>
            <CopyButton value={assetId} />
          </div>
        </div>

        {/* Offer ID */}
        {offerId && (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Offer ID</p>
            <div className="flex items-center">
              <span className="font-mono text-xs truncate max-w-[280px]" title={offerId}>
                {offerId}
              </span>
              <CopyButton value={offerId} />
            </div>
          </div>
        )}

        {/* Policies */}
        {constraints.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Policies</p>
            <div className="flex flex-wrap gap-1.5">
              {constraints.map((constraint, idx) => (
                <PolicyBadge key={idx} constraint={constraint} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {(onConsume || onDelete) && (
          <div className="flex items-center justify-between mt-auto pt-2">
            <div>
              {onDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(dataset)}
                  aria-label="Delete asset"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div>
              {onConsume && (
                <Button
                  size="sm"
                  onClick={() => onConsume(dataset, offerId)}
                  disabled={!offerId}
                >
                  Consume
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
