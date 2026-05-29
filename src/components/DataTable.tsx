import type { ReactNode } from 'react'
import { EmptyState } from './ui'

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T) => ReactNode
  className?: string
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  empty,
}: {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  empty?: ReactNode
}) {
  if (!rows.length) {
    return <div className="card">{empty ?? <EmptyState title="Nothing here yet" />}</div>
  }
  return (
    <div className="card overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
