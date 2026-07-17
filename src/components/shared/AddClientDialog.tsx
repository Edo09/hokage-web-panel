import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/services/clients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * "Añadir cliente" modal — email + display name (the app login gets linked
 * later), with a success state.
 */
export function AddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setError('');
    setSuccess(false);
    setSaving(false);
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) reset();
  };

  const submit = async () => {
    const n = name.trim();
    const e = email.trim();
    if (!n) return setError('Escribe el nombre del cliente.');
    if (!e.includes('@') || !e.includes('.')) return setError('Escribe un correo válido.');
    setSaving(true);
    try {
      await createClient({ display_name: n, email: e });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    handleOpenChange(false);
    onCreated();
    toast.success('Cliente añadido a la lista');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {!success ? (
          <>
            <DialogHeader>
              <DialogTitle>Añadir cliente</DialogTitle>
              <DialogDescription>Crea el perfil ahora; el acceso a la app se vincula después.</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-name">Nombre</Label>
                <Input
                  id="add-name"
                  placeholder="Ej. Juan Pérez"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-email">Correo electrónico</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="cliente@correo.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                />
              </div>
              {error && <p className="text-[12.5px] text-primary">{error}</p>}
              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creando…' : 'Crear cliente'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-1.5 py-3.5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
            </span>
            <DialogTitle>Cliente creado</DialogTitle>
            <DialogDescription className="max-w-[300px]">
              {name} ya aparece en tu lista. Podrás vincular su acceso a la app más adelante.
            </DialogDescription>
            <Button className="mt-2 px-6" onClick={done}>
              Listo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
