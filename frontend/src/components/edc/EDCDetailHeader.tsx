import type { EDCResponse } from '@/lib/api/types'
import { Badge } from '@/components/ui/badge'

interface EDCDetailHeaderProps {
  edc: EDCResponse
}

export function EDCDetailHeader({ edc }: EDCDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">{edc.display_name}</h1>
        <Badge variant="outline" className="font-mono text-xs">
          {edc.id}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          BPN: <span className="font-mono">{edc.provider_bpn}</span>
        </span>
        <span className="truncate max-w-[280px]" title={edc.consumer_url}>
          Consumer: <span className="font-mono">{edc.consumer_url}</span>
        </span>
        <span className="truncate max-w-[280px]" title={edc.provider_url}>
          Provider: <span className="font-mono">{edc.provider_url}</span>
        </span>
      </div>
    </div>
  )
}
