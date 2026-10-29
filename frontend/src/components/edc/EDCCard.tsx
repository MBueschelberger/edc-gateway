import { Network } from 'lucide-react'
import type { EDCResponse } from '@/lib/api/types'
import { cn } from '@/lib/utils'

interface EDCCardProps {
  edc: EDCResponse
  isSelected: boolean
  onClick: () => void
}

export function EDCCard({ edc, isSelected, onClick }: EDCCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      className={cn(
        'px-3 py-3 rounded-lg cursor-pointer transition-all',
        isSelected
          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent hover:border-border/60',
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Network className={cn('size-3.5 shrink-0', isSelected ? 'text-sidebar-primary-foreground/60' : 'text-muted-foreground')} />
        <div className={cn('text-sm font-semibold truncate', isSelected ? 'text-sidebar-primary-foreground' : 'text-foreground')}>
          {edc.display_name}
        </div>
      </div>
      <div className={cn('text-xs truncate pl-5', isSelected ? 'text-sidebar-primary-foreground/60' : 'text-muted-foreground')}>
        {edc.id}
      </div>
    </div>
  )
}
