import { useMemo, useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { EmptyState } from './ui'

export type SortValue = string | number | boolean | null | undefined

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  className?: string
  /** Force-enable/disable sorting. Defaults to on when the column maps to a primitive field. */
  sortable?: boolean
  /** Comparable value for sorting; defaults to row[key]. Use for computed/looked-up columns. */
  sortAccessor?: (row: T) => SortValue
}

type SortState = { key: string; dir: 'asc' | 'desc' }

function compareValues(a: SortValue, b: SortValue): number {
  if (a == null) return b == null ? 0 : 1
  if (b == null) return -1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  empty,
  defaultSort,
}: {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  empty?: ReactNode
  /** Initial sort, also the resting state a column cycles back to after asc → desc. */
  defaultSort?: { key: string; dir?: 'asc' | 'desc' }
}) {
  const initialSort: SortState | null = defaultSort ? { key: defaultSort.key, dir: defaultSort.dir ?? 'asc' } : null
  const [sort, setSort] = useState<SortState | null>(initialSort)

  // Resolve a row's comparable value for `key`: prefer the column's accessor, else read the raw
  // field. `col` may be undefined when sorting by a key with no visible column (e.g. updatedAt).
  const getSortValue = (key: string, col: Column<T> | undefined, row: T): SortValue =>
    col?.sortAccessor ? col.sortAccessor(row) : ((row as Record<string, unknown>)[key] as SortValue)

  const canSort = (col: Column<T>): boolean => {
    if (col.sortable === false) return false
    if (col.sortable === true || col.sortAccessor) return true
    if (!col.header) return false
    const sample = rows.find((r) => (r as Record<string, unknown>)[col.key] != null)
    const v = sample ? (sample as Record<string, unknown>)[col.key] : undefined
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => factor * compareValues(getSortValue(sort.key, col, a), getSortValue(sort.key, col, b)))
    // `columns` is intentionally omitted: callers rebuild it inline every render (new identity),
    // which would defeat the memo and re-sort on every render. rows + sort are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])

  const onSort = (col: Column<T>) => {
    if (!canSort(col)) return
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' }
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' }
      return initialSort
    })
  }

  if (!rows.length) {
    return <div className="card">{empty ?? <EmptyState title="Nothing here yet" />}</div>
  }
  return (
    <div className="card overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => {
              const sortable = canSort(c)
              const active = sort?.key === c.key
              return (
                <th key={c.key} className={c.className}>
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(c)}
                      className="group inline-flex items-center gap-1 -mx-1 px-1 rounded hover:text-ink dark:hover:text-ink-dark transition-colors"
                      aria-label={`Sort by ${typeof c.header === 'string' ? c.header : c.key}`}
                    >
                      {c.header}
                      {active ? (
                        sort?.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : (
                        <ChevronsUpDown size={12} className="text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
