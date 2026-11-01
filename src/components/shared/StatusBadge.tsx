import type { MembershipStatus } from '@/types';
import { cn, STATUS_LABELS } from '@/lib/utils';

const STYLES: Record<MembershipStatus, string> = {
  active: 'bg-success/15 text-success',
  expired: 'bg-destructive/15 text-destructive',
  paused: 'bg-warning/15 text-warning',
  cancelled: 'bg-muted text-muted-foreground',
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

/** Coach (ink) vs Propia (blue) — who owns a routine or meal. */
export function OwnerBadge({ assignedBy, className }: { assignedBy: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex flex-none rounded-full px-2 py-0.5 text-xs font-semibold',
        assignedBy ? 'bg-muted text-foreground' : 'bg-secondary/15 text-secondary',
        className,
      )}
    >
      {assignedBy ? 'Coach' : 'Propia'}
    </span>
  );
}
