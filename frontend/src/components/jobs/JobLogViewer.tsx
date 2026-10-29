import { ScrollArea } from '@/components/ui/scroll-area'

interface JobLogViewerProps {
  logs: string[]
}

export function JobLogViewer({ logs }: JobLogViewerProps) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No logs available</p>
    )
  }

  return (
    <ScrollArea className="h-[400px] w-full rounded-md">
      <pre className="bg-black text-green-400 font-mono text-xs p-4 min-h-full">
        {logs.map((line, i) => (
          <code key={i} className="block whitespace-pre-wrap break-all">
            {line}
          </code>
        ))}
      </pre>
    </ScrollArea>
  )
}
