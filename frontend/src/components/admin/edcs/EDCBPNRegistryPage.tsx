import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { BPNRegistryEntryResponse } from '@/lib/api/types'
import { edcService } from '@/lib/api/services/edcService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

// ── Zod schema ────────────────────────────────────────────────────────────────

const entrySchema = z.object({
  bpn: z.string().min(1, 'BPN is required'),
  connector_endpoints: z
    .array(z.object({ url: z.string().url('Must be a valid URL') }))
    .min(1, 'At least one endpoint is required'),
  did: z.string().optional().or(z.literal('')),
  dsp_suffix: z.string().optional().or(z.literal('')),
})

type EntryFormValues = z.infer<typeof entrySchema>

// ── Entry form dialog ─────────────────────────────────────────────────────────

interface EntryFormDialogProps {
  edcId: string
  editTarget: BPNRegistryEntryResponse | null
  open: boolean
  onClose: () => void
}

function EntryFormDialog({ edcId, editTarget, open, onClose }: EntryFormDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = editTarget !== null

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: editTarget
      ? {
          bpn: editTarget.bpn,
          connector_endpoints: editTarget.connector_endpoints.map((url) => ({ url })),
          did: editTarget.did ?? '',
          dsp_suffix: editTarget.dsp_suffix ?? '',
        }
      : { bpn: '', connector_endpoints: [{ url: '' }], did: '', dsp_suffix: '' },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'connector_endpoints' })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'edcs', edcId, 'bpn-registry'] })

  const createMutation = useMutation({
    mutationFn: (values: EntryFormValues) =>
      edcService.bpnRegistryCreate(edcId, {
        bpn: values.bpn,
        connector_endpoints: values.connector_endpoints.map((e) => e.url),
        did: values.did || null,
        dsp_suffix: values.dsp_suffix || null,
      }),
    onSuccess: () => {
      invalidate()
      toast.success('BPN entry created')
      handleClose()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to create entry'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: EntryFormValues) =>
      edcService.bpnRegistryUpdate(edcId, editTarget!.id, {
        connector_endpoints: values.connector_endpoints.map((e) => e.url),
        did: values.did || null,
        dsp_suffix: values.dsp_suffix || null,
      }),
    onSuccess: () => {
      invalidate()
      toast.success('BPN entry updated')
      handleClose()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update entry'
      toast.error(message)
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function handleClose() {
    reset()
    onClose()
  }

  function onSubmit(values: EntryFormValues) {
    if (isEdit) {
      updateMutation.mutate(values)
    } else {
      createMutation.mutate(values)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit BPN Entry' : 'Add BPN Entry'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update the connector endpoints for BPN ${editTarget.bpn}.`
              : 'Register a new BPN with its connector DSP endpoint URLs.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bpn">BPN</Label>
            <Input
              id="bpn"
              placeholder="BPNL000000000000"
              disabled={isEdit}
              {...register('bpn')}
            />
            {errors.bpn && (
              <p className="text-xs text-destructive">{errors.bpn.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Connector Endpoints</Label>
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input
                    placeholder="https://example.com/api/v1/dsp"
                    {...register(`connector_endpoints.${index}.url`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {errors.connector_endpoints?.root && (
                <p className="text-xs text-destructive">
                  {errors.connector_endpoints.root.message}
                </p>
              )}
              {errors.connector_endpoints && !Array.isArray(errors.connector_endpoints) && (
                <p className="text-xs text-destructive">
                  {(errors.connector_endpoints as { message?: string }).message}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => append({ url: '' })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Endpoint
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="did">DID Base <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="did"
              placeholder="did:web:example.com — overrides edc.base_did"
              {...register('did')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dsp_suffix">DSP Suffix <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="dsp_suffix"
              placeholder="/api/v1/dsp — overrides edc.provider_dsp_suffix"
              {...register('dsp_suffix')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  edcId: string
  entry: BPNRegistryEntryResponse | null
  open: boolean
  onClose: () => void
}

function DeleteDialog({ edcId, entry, open, onClose }: DeleteDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (id: string) => edcService.bpnRegistryDelete(edcId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'edcs', edcId, 'bpn-registry'] })
      toast.success('BPN entry deleted')
      onClose()
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to delete entry'
      toast.error(message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete BPN Entry</DialogTitle>
          <DialogDescription>
            Remove <span className="font-mono text-xs">{entry?.bpn}</span> and all its connector
            endpoints from the registry? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending || !entry}
            onClick={() => { if (entry) mutation.mutate(entry.id) }}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function EDCBPNRegistryPage() {
  const { edcId } = useParams<{ edcId: string }>()
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BPNRegistryEntryResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BPNRegistryEntryResponse | null>(null)

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ['admin', 'edcs', edcId, 'bpn-registry'],
    queryFn: () => edcService.bpnRegistryList(edcId!),
    enabled: !!edcId,
  })

  function openCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(entry: BPNRegistryEntryResponse) {
    setEditTarget(entry)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">BPN Registry</h1>
          <p className="text-sm text-muted-foreground font-mono">{edcId}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">Failed to load BPN registry entries.</p>
      )}

      {entries && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BPN</TableHead>
              <TableHead>Connector Endpoints</TableHead>
              <TableHead>DID Base</TableHead>
              <TableHead>DSP Suffix</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No entries. The external BPN Discovery passthrough is active.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs">{entry.bpn}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    {entry.connector_endpoints.map((url) => (
                      <span key={url} className="font-mono text-xs text-muted-foreground truncate max-w-md">
                        {url}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {entry.did ?? <span className="italic">—</span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {entry.dsp_suffix ?? <span className="italic">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(entry)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EntryFormDialog
        edcId={edcId!}
        editTarget={editTarget}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />

      <DeleteDialog
        edcId={edcId!}
        entry={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
