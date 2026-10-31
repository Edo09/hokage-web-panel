import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** Shown as the button's tooltip — for icon-only segments, its name. */
  title?: string;
  disabled?: boolean;
}

/**
 * A choice between a few options, all visible at once (instead of a
 * dropdown). Arrow keys move the choice, like native radios.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'default',
  stretch,
  className,
  ...aria
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: 'default' | 'sm';
  /** Fill the container width, splitting it evenly. */
  stretch?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    for (let k = 1; k <= options.length; k++) {
      const j = (i + step * k + options.length) % options.length;
      if (!options[j].disabled) {
        onChange(options[j].value);
        refs.current[j]?.focus();
        return;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      {...aria}
      className={cn(
        'inline-flex max-w-full items-stretch gap-1 rounded-lg bg-muted p-1',
        stretch && 'flex w-full',
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
              stretch && 'flex-1',
              active
                ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4 flex-none" strokeWidth={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
