import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';
import { useCoach } from '@/hooks/useCoach';
import { initials } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Settings() {
  const { coach, save } = useCoach();
  const [name, setName] = useState(coach.display_name);
  const [whatsapp, setWhatsapp] = useState(coach.whatsapp);
  const [saving, setSaving] = useState(false);

  // Sync once the profile loads
  useEffect(() => {
    setName(coach.display_name);
    setWhatsapp(coach.whatsapp);
  }, [coach]);

  const previewName = name.trim() || 'Coach';
  const previewPhone =
    whatsapp.length > 7
      ? `+${whatsapp.slice(0, whatsapp.length - 7)} ${whatsapp.slice(-7, -4)} ${whatsapp.slice(-4)}`
      : `+${whatsapp || '—'}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await save({ display_name: name.trim() || 'Coach', whatsapp });
    setSaving(false);
    toast.success('Perfil actualizado');
  };

  return (
    <div
      className="grid max-w-[980px] animate-fade-up items-start gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Perfil del coach</CardTitle>
          <CardDescription>Esta información se muestra a tus clientes en la app móvil.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 flex-none items-center justify-center rounded-[20px] bg-primary/10 font-heading text-[22px] font-bold text-primary dark:bg-primary/15"
            >
              {initials(previewName)}
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">Foto de perfil</div>
              <p className="max-w-[240px] text-xs text-faint">
                Por ahora usa tus iniciales; podrás subir una foto al conectar el backend.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coach-name">Nombre visible</Label>
              <Input id="coach-name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="coach-whatsapp">WhatsApp</Label>
              <Input
                id="coach-whatsapp"
                type="tel"
                inputMode="numeric"
                placeholder="18095551234"
                className="tracking-wide"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 15))}
              />
              <span className="text-[11.5px] font-medium text-faint">
                Solo dígitos, con código de país incluido. Ej.: 18095551234
              </span>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vista previa en la app</CardTitle>
          <CardDescription>Así ven tu contacto los clientes. La app usa tema oscuro.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Always-dark mini mock of the mobile app */}
          <div className="rounded-[18px] border border-slate-700 bg-slate-900 p-[18px]">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full font-heading text-[15px] font-bold text-red-500"
                style={{ background: 'rgba(239,68,68,.16)' }}
              >
                {initials(previewName)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">{previewName}</div>
                <div className="text-xs text-slate-400">Tu coach</div>
              </div>
            </div>
            <div className="mt-3.5 flex min-w-0 items-center justify-center gap-2 rounded-xl bg-green-500 px-3.5 py-[11px] text-[13px] font-bold text-green-950">
              <Phone className="h-3.5 w-3.5 flex-none" strokeWidth={2} />
              <span className="truncate">WhatsApp · {previewPhone}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
