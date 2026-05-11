'use client';

import { useState, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: TData) => void;
  defaultColumnVisibility?: VisibilityState;
  virtualizeRows?: boolean;
  rowHeight?: number;
  maxHeight?: string;
}

export function DataTable<TData>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  onRowClick,
  defaultColumnVisibility,
  virtualizeRows = false,
  rowHeight = 40,
  maxHeight = '500px',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    defaultColumnVisibility || {}
  );
  const [tableMaxHeight, setTableMaxHeight] = useState<string>(maxHeight);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
  });

  const { rows } = table.getRowModel();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 15,
    enabled: virtualizeRows,
  });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {searchKey !== undefined && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto gap-2 h-9">
              Columns
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {typeof column.columnDef.header === 'string'
                    ? column.columnDef.header
                    : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Select value={tableMaxHeight} onValueChange={setTableMaxHeight}>
          <SelectTrigger className="w-[110px] h-9">
            <SelectValue placeholder="Height" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="300px">Short</SelectItem>
            <SelectItem value="500px">Medium</SelectItem>
            <SelectItem value="800px">Tall</SelectItem>
            <SelectItem value="10000px">Full</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {virtualizeRows ? (
          <>
            {/* Virtualized table - div-based header to match div-based rows */}
            <div className="border-b bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <div key={headerGroup.id} className="flex items-center">
                  {headerGroup.headers.map((header) => (
                    <div
                      key={header.id}
                      className="px-2 h-10 flex items-center justify-between text-sm font-medium text-muted-foreground relative group select-none cursor-pointer"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ArrowUp className="h-3 w-3 ml-1 shrink-0" />,
                          desc: <ArrowDown className="h-3 w-3 ml-1 shrink-0" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none bg-border opacity-0 group-hover:opacity-100 ${
                          header.column.getIsResizing() ? 'bg-primary opacity-100' : ''
                        }`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div
              ref={parentRef}
              style={{ maxHeight: tableMaxHeight, overflow: 'auto' }}
            >
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <div
                      key={row.id}
                      className={`absolute top-0 left-0 w-full flex items-center border-b transition-colors ${
                        onRowClick ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/30'
                      }`}
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          className="px-2 text-sm overflow-hidden"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }} className="relative group select-none cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ArrowUp className="h-3 w-3 ml-1" />,
                          desc: <ArrowDown className="h-3 w-3 ml-1" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none bg-border opacity-0 group-hover:opacity-100 ${
                          header.column.getIsResizing() ? 'bg-primary opacity-100' : ''
                        }`}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No results.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={onRowClick ? 'cursor-pointer' : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Row count */}
      <div className="text-xs text-muted-foreground">
        {rows.length} of {data.length} row(s)
        {globalFilter && ` (filtered)`}
      </div>
    </div>
  );
}
