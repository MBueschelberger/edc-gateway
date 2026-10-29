import { UserMenu } from '@/components/layout/UserMenu'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Separator } from '@/components/ui/separator'
import { Cpu } from 'lucide-react'

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-7 rounded-md bg-primary">
          <Cpu className="size-4 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold tracking-tight">EDC Gateway</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Separator orientation="vertical" className="h-4 mx-1" />
        <UserMenu />
      </div>
    </header>
  )
}
