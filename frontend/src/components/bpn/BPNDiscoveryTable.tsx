import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  originalEntry: BPNDiscoveryEntry
}

interface BPNDiscoveryTableProps {
  entries: BPNDiscoveryEntry[]
  onSelectPartner: (entry: BPNDiscoveryEntry, connectorUrl: string) => void
}

const PAGE_SIZE = 20

const globalFilterFn: FilterFn<FlatRow> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase()
  return (
    row.original.bpn.toLowerCase().includes(search) ||
    row.original.connectorUrl.toLowerCase().includes(search)
  )
}

export function BPNDiscoveryTable({ entries, onSelectPartner }: BPNDiscoveryTableProps) {
  "use no memo"
  const [globalFilter, setGlobalFilter] = useState('')

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = []
    for (const entry of entries) {
      for (const url of entry.connectorEndpoint) {
        rows.push({ bpn: entry.bpn, connectorUrl: url, originalEntry: entry })
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
              onClick={() => onSelectPartner(row.original.originalEntry, row.original.connectorUrl)}
            >
              Select
            </Button>
          </div>
        ),
      },
    ],
    [onSelectPartner],
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
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Filter by BPN or connector URL..."
        value={globalFilter}
        onChange={(e) => {
          table.setPageIndex(0)
          setGlobalFilter(e.target.value)
        }}
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground text-sm py-6">
                No results found.
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
          {totalFiltered === 0
            ? 'No results'
            : `Showing ${from}–${to} of ${totalFiltered}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
