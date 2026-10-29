import { Link, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { edcService } from '@/lib/api/services/edcService'
import { useUIStore } from '@/lib/store'
import { usePermissions } from '@/hooks/usePermissions'
import { EDCCard } from '@/components/edc/EDCCard'
import { Skeleton } from '@/components/ui/skeleton'

export function Sidebar() {
  const navigate = useNavigate()
  const { selectedEDCId, setSelectedEDCId } = useUIStore()
  const { isAdmin } = usePermissions()

  const { data: edcs, isLoading, isError } = useQuery({
    queryKey: ['edcs'],
    queryFn: edcService.list,
  })

  const handleEDCClick = (id: string) => {
    setSelectedEDCId(id)
    navigate(`/edcs/${id}/jobs`)
  }

  return (
    <aside className="w-full flex flex-col bg-sidebar h-full overflow-y-auto">
      <div className="flex-1 px-2 py-4 space-y-1">
        <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Connectors
        </p>

        {isLoading && (
          <>
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </>
        )}

        {isError && (
          <p className="px-3 py-2 text-sm text-destructive">Failed to load EDCs</p>
        )}

        {edcs && edcs.map((edc) => (
          <EDCCard
            key={edc.id}
            edc={edc}
            isSelected={edc.id === selectedEDCId}
            onClick={() => handleEDCClick(edc.id)}
          />
        ))}
      </div>

      {isAdmin && (
        <div className="px-2 py-3 border-t bg-sidebar">
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Shield className="size-4 shrink-0" />
            Admin
          </Link>
        </div>
      )}
    </aside>
  )
}
