import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { EDCResponse } from '@/lib/api/types'
import { edcService } from '@/lib/api/services/edcService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface EDCDeleteDialogProps {
  edc: EDCResponse | null
  open: boolean
  onClose: () => void
  onDeleted: () => void
}

export function EDCDeleteDialog({ edc, open, onClose, onDeleted }: EDCDeleteDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: string) => edcService.adminDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'edcs'] })
      toast.success('EDC deleted')
      onDeleted()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to delete EDC'
      toast.error(message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete EDC</DialogTitle>
          <DialogDescription>
            Delete EDC &quot;{edc?.id}&quot;? This also deletes the Kubernetes secret{' '}
            <span className="font-mono text-xs">{edc?.k8s_secret_name}</span>. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending || edc === null}
            onClick={() => {
              if (edc) mutation.mutate(edc.id)
            }}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
