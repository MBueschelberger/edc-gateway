import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { bpnService } from '@/lib/api/services/bpnService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BPNDiscoveryEntry } from '@/lib/api/types'

interface FlatRow {
  bpn: string
  connectorUrl: string
}

interface BPNPickerProps {
  edcId: string
  value: string
  onChange: (bpn: string) => void
  error?: string
}

const PAGE_SIZE = 10

const globalFilterFn: FilterFn<FlatRow> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase()
  return (
    row.original.bpn.toLowerCase().includes(search) ||
    row.original.connectorUrl.toLowerCase().includes(search)
  )
}

function BPNFreeTextInput({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="BPNL000000000000"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function BPNTable({
  entries,
  onSelect,
}: {
  entries: BPNDiscoveryEntry[]
  onSelect: (bpn: string) => void
}) {
  "use no memo"
  const [globalFilter, setGlobalFilter] = useState('')

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const entry of entries) {
      for (const url of entry.connectorEndpoint) {
        rows.push({ bpn: entry.bpn, connectorUrl: url })
      }
    }
    return rows
  }, [entries])

  const columns = useMemo<ColumnDef<FlatRow>[]>(
    () => [
      {
        accessorKey: 'bpn',
        header: 'BPN',
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'connectorUrl',
        header: 'Connector Endpoint',
        cell: ({ row }) => (
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-xs break-all min-w-0">{row.original.connectorUrl}</span>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              type="button"
              onClick={() => onSelect(row.original.bpn)}
            >
              Select
            </Button>
          </div>
        ),
      },
    ],
    [onSelect],
  )

  const table = useReactTable({
    data: flatRows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE, pageIndex: 0 } },
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length
  const from = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, totalFiltered)

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Filter by BPN or connector URL..."
        value={globalFilter}
        onChange={(e) => {
          table.setPageIndex(0)
          setGlobalFilter(e.target.value)
        }}
      />
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground text-sm py-4">
                No results.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cell.column.id === 'connectorUrl' ? 'whitespace-normal' : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {totalFiltered === 0 ? 'No results' : `Showing ${from}–${to} of ${totalFiltered}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function BPNPicker({ edcId, value, onChange, error }: BPNPickerProps) {
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['edcs', edcId, 'bpn-discovery'],
    queryFn: () => bpnService.fetchAll(edcId),
    retry: false,
  })

  const is403 = isAxiosError(queryError) && queryError.response?.status === 403

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs px-2 py-1">
            {value}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-6 w-6 p-0"
            onClick={() => onChange('')}
            aria-label="Clear BPN"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-muted-foreground">Loading BPN discovery…</div>
      </div>
    )
  }

  if (is403 || (isError && !data)) {
    return (
      <div className="flex flex-col gap-1.5">
        {is403 && (
          <p className="text-xs text-muted-foreground">
            BPN discovery not accessible — enter BPN manually.
          </p>
        )}
        <BPNFreeTextInput value={value} onChange={onChange} error={error} />
      </div>
    )
  }

  if (data && data.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <BPNTable entries={data} onSelect={onChange} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return <BPNFreeTextInput value={value} onChange={onChange} error={error} />
}

export function BPNPickerField({
  edcId,
  value,
  onChange,
  error,
}: BPNPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        Consumer BPN <span className="text-destructive">*</span>
      </Label>
      <BPNPicker edcId={edcId} value={value} onChange={onChange} error={error} />
    </div>
  )
}
