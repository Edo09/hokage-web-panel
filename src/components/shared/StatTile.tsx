import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'secondary' | 'warning' | 'success';

const CHIP: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary dark:bg-primary/15',
  secondary: 'bg-secondary/10 text-secondary dark:bg-secondary/15',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
};

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
    <Card className="flex min-h-[118px] flex-col gap-2.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
        <span className={cn('flex h-8 w-8 flex-none items-center justify-center rounded-[10px]', CHIP[tone])}>
          <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
        </span>
      </div>
      <div className="font-heading text-[28px] font-bold leading-none">{value}</div>
      <div
        className={cn(
          'text-xs',
          subTone === 'success' && 'text-success',
          subTone === 'warning' && 'text-warning',
          subTone === 'muted' && 'text-faint',
        )}
      >
        {sub}
      </div>
    </Card>
  );
}
