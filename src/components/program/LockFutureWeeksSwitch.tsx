import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { InfoTip } from '@/components/ui/info-tip';
import { cn } from '@/lib/utils';

/**
 * «Solo semana actual» (programs.lock_future_weeks, migration 20260929120000
 * in the mobile repo): the client can only check trainings of the week they
 * are in and of past weeks. The app enforces it; the database never rejects a
 * write. Shared by the builder and every assign dialog, so the wording is the
 * same everywhere.
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
    <div className={cn('flex items-center gap-2.5', className)}>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      <Label htmlFor={id} className={cn('cursor-pointer text-sm text-foreground', disabled && 'cursor-default opacity-60')}>
        Solo semana actual
      </Label>
      <InfoTip label="Qué hace «Solo semana actual»">
        El cliente solo puede marcar los entrenos de la semana en curso y de las pasadas. Las siguientes las ve, pero se
        abren en su fecha. Antes del inicio no puede marcar nada.
      </InfoTip>
    </div>
  );
}
