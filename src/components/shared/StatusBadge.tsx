import type { MembershipStatus } from '@/types';
import { cn, STATUS_LABELS } from '@/lib/utils';

const STYLES: Record<MembershipStatus, string> = {
  active: 'bg-success/15 text-success',
  expired: 'bg-primary/10 text-primary dark:bg-primary/15',
  paused: 'bg-warning/15 text-warning',
  cancelled: 'bg-muted text-faint',
};

export function StatusBadge({ status, className }: { status: MembershipStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold',
        STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** COACH (red) vs PROPIA (blue) — who owns a routine or meal. */
export function OwnerBadge({ assignedBy, className }: { assignedBy: string | null; className?: string }) {
  return assignedBy ? (
    <span
      className={cn(
        'inline-flex flex-none rounded-full bg-primary/10 px-2 py-[3px] text-[10.5px] font-bold tracking-wide text-primary dark:bg-primary/15',
        className,
      )}
    >
      COACH
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex flex-none rounded-full bg-secondary/10 px-2 py-[3px] text-[10.5px] font-bold tracking-wide text-secondary dark:bg-secondary/15',
        className,
      )}
    >
      PROPIA
    </span>
  );
}
