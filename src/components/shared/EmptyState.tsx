import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-5 py-14 text-center', className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-dashed border-border-strong text-faint">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <div className="text-sm font-semibold">{title}</div>
      <p className="max-w-[300px] text-[12.5px] text-faint">{description}</p>
      {children}
    </div>
  );
}
