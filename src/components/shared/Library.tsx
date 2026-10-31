import type { ReactNode } from 'react';
import { Archive, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/** Search over a shelf — shown once there's enough on it to search. */
export function LibrarySearch({
  query,
  onQuery,
  placeholder,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-[340px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <Input type="search" aria-label={placeholder} placeholder={placeholder} value={query} onChange={(e) => onQuery(e.target.value)} className="pl-9" />
    </div>
  );
}

export function LibraryGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function LibrarySkeleton() {
  return (
    <LibraryGrid>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[196px] rounded-xl" />
      ))}
    </LibraryGrid>
  );
}

/** The archived shelf: out of the way until asked for. */
export function ArchivedToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-fit items-center gap-2 rounded-md px-1 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Archive className="h-4 w-4" />
      Archivados ({count})
      <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
    </button>
  );
}
