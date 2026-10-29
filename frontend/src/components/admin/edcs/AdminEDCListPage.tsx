import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
import type { EDCResponse } from '@/lib/api/types'
import { edcService } from '@/lib/api/services/edcService'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EDCDeleteDialog } from '@/components/admin/edcs/EDCDeleteDialog'

export function AdminEDCListPage() {
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<EDCResponse | null>(null)

  const { data: edcs, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'edcs'],
    queryFn: edcService.adminList,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">EDC Connectors</h1>
        <Button onClick={() => navigate('/admin/edcs/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New EDC
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
        <p className="text-sm text-destructive">Failed to load EDCs.</p>
      )}

      {edcs && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Consumer URL</TableHead>
              <TableHead>Provider BPN</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {edcs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No EDCs configured.
                </TableCell>
              </TableRow>
            )}
            {edcs.map((edc) => (
              <TableRow key={edc.id}>
                <TableCell className="font-mono text-xs">{edc.id}</TableCell>
                <TableCell className="font-medium">{edc.display_name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-xs">
                  {edc.consumer_url}
                </TableCell>
                <TableCell className="font-mono text-xs">{edc.provider_bpn}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/edcs/${edc.id}/bpn-registry`)}
                      title="BPN Registry"
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/edcs/${edc.id}/edit`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(edc)}
                      className="text-destructive hover:text-destructive"
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

      <EDCDeleteDialog
        edc={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null)
          refetch()
        }}
      />
    </div>
  )
}
