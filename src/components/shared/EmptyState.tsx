import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** An empty or failed view: what's missing, in a line, and what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-5 py-12 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-1">
        <div className="text-[15px] font-semibold">{title}</div>
        {description && <p className="mx-auto max-w-[320px] text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
