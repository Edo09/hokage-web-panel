import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * «Solo semana actual» (programs.lock_future_weeks, migration 20260929120000
 * in the mobile repo): the client can only check trainings of the week they
 * are in and of past weeks. The app enforces it; the database never rejects a
 * write. Shared by both builders and both assign-template dialogs, so the
 * wording is the same everywhere.
 */
export function LockFutureWeeksSwitch({
  checked,
  onCheckedChange,
  id = 'lock-future-weeks',
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  /** The assign dialogs keep it off until a template is picked (the template
   *  pre-sets it). */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5', className)}>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={`${id}-help`}
      />
      <div className="min-w-0">
        <Label htmlFor={id} className={cn('text-[13px]', disabled && 'opacity-60')}>
          Solo semana actual
        </Label>
        <p id={`${id}-help`} className="mt-0.5 text-[12px] text-faint">
          El cliente solo puede marcar los entrenos de la semana en curso y de semanas pasadas. Las
          siguientes las ve, pero se abren en su fecha. Antes del inicio no puede marcar nada.
        </p>
      </div>
    </div>
  );
}
