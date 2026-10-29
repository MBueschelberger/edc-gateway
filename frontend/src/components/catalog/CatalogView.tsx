import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogAssetCard } from '@/components/catalog/CatalogAssetCard'
import { catalogService, extractEdcErrorMessage } from '@/lib/api/services/catalogService'
import type { CatalogDataset } from '@/lib/api/types'

interface CatalogViewProps {
  edcId: string
  providerBpn: string
  providerDspUrl: string
  onConsumeAsset: (dataset: CatalogDataset, offerId: string) => void
  canConsume: boolean
}

export function CatalogView({
  edcId,
  providerBpn,
  providerDspUrl,
  onConsumeAsset,
  canConsume,
}: CatalogViewProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['edcs', edcId, 'catalog', providerBpn, providerDspUrl],
    queryFn: () =>
      catalogService.fetch(edcId, {
        provider_bpn: providerBpn,
        provider_dsp_url: providerDspUrl,
      }),
    enabled: !!edcId && !!providerBpn && !!providerDspUrl,
    staleTime: 60000,
  })

  if (isLoading) {
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError) {
    const edcMessage =
      isAxiosError(error) && extractEdcErrorMessage(error.response?.data)
    return (
      <p className="text-sm text-destructive">
        Failed to load catalog:{' '}
        {edcMessage || (error instanceof Error ? error.message : 'Unknown error')}
      </p>
    )
  }

  if (!data) return null

  const edcError = extractEdcErrorMessage(data)
  if (edcError) {
    return (
      <p className="text-sm text-destructive">Failed to load catalog: {edcError}</p>
    )
  }

  const datasets: CatalogDataset[] = Array.isArray(data['dcat:dataset'])
    ? data['dcat:dataset']
    : [data['dcat:dataset']]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} found
      </p>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {datasets.map((dataset) => (
          <CatalogAssetCard
            key={dataset['@id']}
            dataset={dataset}
            onConsume={canConsume ? onConsumeAsset : undefined}
          />
        ))}
      </div>
    </div>
  )
}
