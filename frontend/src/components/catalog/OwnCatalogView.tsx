import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CatalogAssetCard } from '@/components/catalog/CatalogAssetCard'
import { catalogService, extractEdcErrorMessage } from '@/lib/api/services/catalogService'
import { consumeService } from '@/lib/api/services/consumeService'
import type { CatalogDataset } from '@/lib/api/types'

interface OwnCatalogViewProps {
  edcId: string
  onConsumeAsset: (dataset: CatalogDataset, offerId: string) => void
  canConsume: boolean
  canDelete: boolean
}

export function OwnCatalogView({ edcId, onConsumeAsset, canConsume, canDelete }: OwnCatalogViewProps) {
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<CatalogDataset | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (dataset: CatalogDataset) =>
      consumeService.deleteAsset(edcId, { asset_id: dataset['@id'] }),
    onSuccess: () => {
      toast.success('Asset deletion job submitted')
      setPendingDelete(null)
      void queryClient.invalidateQueries({ queryKey: ['edcs', edcId, 'catalog', 'own'] })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to submit deletion'
      toast.error(message)
    },
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['edcs', edcId, 'catalog', 'own'],
    queryFn: () => catalogService.fetch(edcId, {}),
    enabled: !!edcId,
    staleTime: 60000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground italic">Viewing your own EDC catalog</p>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    const edcMessage =
      isAxiosError(error) && extractEdcErrorMessage(error.response?.data)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground italic">Viewing your own EDC catalog</p>
        <p className="text-sm text-destructive">
          Failed to load catalog:{' '}
          {edcMessage || (error instanceof Error ? error.message : 'Unknown error')}
        </p>
      </div>
    )
  }

  if (!data) return null

  const edcError = extractEdcErrorMessage(data)
  if (edcError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground italic">Viewing your own EDC catalog</p>
        <p className="text-sm text-destructive">Failed to load catalog: {edcError}</p>
      </div>
    )
  }

  const datasets: CatalogDataset[] = Array.isArray(data['dcat:dataset'])
    ? data['dcat:dataset']
    : [data['dcat:dataset']]

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground italic">Viewing your own EDC catalog</p>
        <p className="text-sm text-muted-foreground">
          {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} found
        </p>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {datasets.map((dataset) => (
            <CatalogAssetCard
              key={dataset['@id']}
              dataset={dataset}
              onConsume={canConsume ? onConsumeAsset : undefined}
              onDelete={canDelete ? setPendingDelete : undefined}
            />
          ))}
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate active negotiations, retire contract agreements, and permanently delete the asset, policies, and contract definition from the EDC.
              <br /><br />
              <span className="font-mono text-xs break-all">{pendingDelete?.['@id']}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
