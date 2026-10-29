import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { consumeService } from '@/lib/api/services/consumeService'
import { DCATCatalogView } from '@/components/assets/DCATCatalogView'
import { CreateAssetForm } from '@/components/assets/CreateAssetForm'

interface RegisterAssetPanelProps {
  edcId: string
  onSuccess: (jobId: string) => void
}

export function RegisterAssetPanel({ edcId, onSuccess }: RegisterAssetPanelProps) {
  const { data: datasets, isLoading, isError } = useQuery({
    queryKey: ['edcs', edcId, 'dcat-catalog'],
    queryFn: () => consumeService.fetchDCATCatalog(edcId),
    retry: false,
    throwOnError: false,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading asset catalog…
      </div>
    )
  }

  if (isError || !datasets) {
    return <CreateAssetForm edcId={edcId} onSuccess={onSuccess} />
  }

  return <DCATCatalogView edcId={edcId} datasets={datasets} onSuccess={onSuccess} />
}
