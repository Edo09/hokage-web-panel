import { useState } from 'react';
import { resetClientPassword } from '@/services/clients';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TempPasswordReveal } from '@/components/shared/TempPasswordReveal';

/**
 * "Restablecer contraseña" — for a client who forgot theirs (the app has no
 * self-service recovery). Confirms first, because the client's current
 * password stops working, then shows the new one-time temporary password.
 */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  clientName,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientId: string;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setError('');
      setSaving(false);
      setTempPassword(null);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      setTempPassword(await resetClientPassword(clientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {tempPassword === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Restablecer contraseña</DialogTitle>
              <DialogDescription>
                Se genera una contraseña temporal nueva para {clientName}. La actual deja de funcionar
                al instante.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-[12.5px] text-primary">{error}</p>}
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void submit()} disabled={saving}>
                {saving ? 'Restableciendo…' : 'Restablecer'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <TempPasswordReveal
            title="Contraseña restablecida"
            description={
              <>
                Comparte esta contraseña temporal con {clientName} (WhatsApp). Podrá cambiarla en la app
                en <span className="font-semibold">Ajustes</span>.
              </>
            }
            password={tempPassword}
            onDone={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
