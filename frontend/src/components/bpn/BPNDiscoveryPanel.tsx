import { RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BPNDiscoveryTable } from '@/components/bpn/BPNDiscoveryTable'
import { bpnService } from '@/lib/api/services/bpnService'
import type { BPNDiscoveryEntry } from '@/lib/api/types'

interface BPNDiscoveryPanelProps {
  edcId: string
  onPartnerSelected: (bpn: string, connectorUrl: string) => void
}

export function BPNDiscoveryPanel({ edcId, onPartnerSelected }: BPNDiscoveryPanelProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['edcs', edcId, 'bpn-discovery'],
    queryFn: () => bpnService.fetchAll(edcId),
    staleTime: 5 * 60 * 1000,
  })

  function handleSelectPartner(entry: BPNDiscoveryEntry, connectorUrl: string) {
    onPartnerSelected(entry.bpn, connectorUrl)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">BPN Discovery</h2>
          {data !== undefined && (
            <span className="text-xs text-muted-foreground">
              {data.length} {data.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? 'animate-spin mr-2' : 'mr-2'} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Failed to load BPN discovery entries:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      ) : data && data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No BPN discovery entries found.</p>
      ) : data ? (
        <BPNDiscoveryTable entries={data} onSelectPartner={handleSelectPartner} />
      ) : null}
    </div>
  )
}
