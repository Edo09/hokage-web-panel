import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { InfoTip } from '@/components/ui/info-tip';

/**
 * A labelled control. The label is short; anything longer goes in `tip`
 * (behind an ⓘ) — or, if it must stay visible, in a one-line `hint`.
 */
export function Field({
  label,
  htmlFor,
  tip,
  hint,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  tip?: ReactNode;
  hint?: ReactNode;
  /** Marks the field as optional next to its label. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && <span className="text-xs text-faint">opcional</span>}
        {tip && <InfoTip label={typeof label === 'string' ? `Qué es «${label}»` : undefined}>{tip}</InfoTip>}
      </div>
      {children}
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** A section inside a page or editor: a plain title, an optional ⓘ and
 *  actions on the right. No eyebrow, no caps. */
export function SectionHeader({
  title,
  count,
  tip,
  actions,
  className,
  id,
}: {
  title: ReactNode;
  count?: number;
  tip?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold leading-tight">
        {title}
        {count != null && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
        )}
      </h2>
      {tip && <InfoTip label={typeof title === 'string' ? `Sobre «${title}»` : undefined}>{tip}</InfoTip>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
