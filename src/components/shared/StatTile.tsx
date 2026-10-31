import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'secondary' | 'warning' | 'success';

const ICON: Record<StatTone, string> = {
  primary: 'text-foreground',
  secondary: 'text-secondary',
  warning: 'text-warning',
  success: 'text-success',
};

/** One number the coach checks every morning, with a line of context. */
export function StatTile({
  label,
  value,
  sub,
  subTone = 'muted',
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  subTone?: 'muted' | 'success' | 'warning';
  icon: LucideIcon;
  tone: StatTone;
}) {
  return (
    <Card className="flex min-h-[116px] flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icon className={cn('h-4 w-4 flex-none', ICON[tone])} strokeWidth={2} />
        <span className="truncate">{label}</span>
      </div>
      <div className="display text-[36px] tabular-nums">{value}</div>
      <div
        className={cn(
          'mt-auto text-xs',
          subTone === 'success' && 'text-success',
          subTone === 'warning' && 'text-warning',
          subTone === 'muted' && 'text-muted-foreground',
        )}
      >
        {sub}
      </div>
    </Card>
  );
}
