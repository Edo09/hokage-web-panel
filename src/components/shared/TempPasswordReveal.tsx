import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';

/**
 * Success step shared by "Añadir cliente" and "Restablecer contraseña": shows
 * the one-time temporary password an Edge Function just generated, with a
 * copy button. It cannot be retrieved again once the dialog closes.
 */
export function TempPasswordReveal({
  title,
  description,
  password,
  onDone,
}: {
  title: string;
  description: ReactNode;
  password: string;
  onDone: () => void;
}) {
  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Contraseña copiada');
    } catch {
      toast.error('No se pudo copiar — selecciónala manualmente');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 px-1.5 py-3.5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
      </span>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription className="max-w-[320px]">{description}</DialogDescription>
      <div className="flex w-full max-w-[300px] items-center gap-2">
        <code className="flex-1 select-all rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-[15px] font-semibold tracking-wide">
          {password}
        </code>
        <Button variant="outline" size="sm" onClick={() => void copyPassword()} aria-label="Copiar contraseña">
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        </Button>
      </div>
      <p className="max-w-[300px] text-[11.5px] text-faint">Se muestra una sola vez — cópiala antes de cerrar.</p>
      <Button className="mt-1 px-6" onClick={onDone}>
        Listo
      </Button>
    </div>
  );
}
