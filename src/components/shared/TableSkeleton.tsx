import { Skeleton } from '@/components/ui/skeleton';

/** Pulsing table-row placeholders shown while a list loads. */
export function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <div role="status" aria-label="Cargando…">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-3 border-b border-border px-5 py-3.5"
          style={{ gridTemplateColumns: `2fr repeat(${cols - 1}, 1fr)` }}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-3 w-3/5 rounded-md" />
          </div>
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <Skeleton key={c} className="h-3 rounded-md" style={{ width: `${50 + ((r + c) % 3) * 15}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
