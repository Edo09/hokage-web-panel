import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Moon, Phone, Sun } from 'lucide-react';
import { useCoach } from '@/hooks/useCoach';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { useTheme } from '@/hooks/useTheme';
import { initials } from '@/lib/utils';
import type { WeightUnit } from '@/lib/weightUnit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';

export default function Settings() {
  const { coach, save } = useCoach();
  const { unit, setUnit } = useWeightUnit();
  const { theme, toggle } = useTheme();
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
  const dirty = name !== coach.display_name || whatsapp !== coach.whatsapp;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await save({ display_name: name.trim() || 'Coach', whatsapp });
    setSaving(false);
    toast.success('Perfil guardado');
  };

  return (
    <div className="grid max-w-[1000px] animate-fade-up items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Tu perfil</CardTitle>
          <CardDescription>Lo ven tus clientes en la app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Nombre visible" htmlFor="coach-name">
              <Input id="coach-name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="WhatsApp"
              htmlFor="coach-whatsapp"
              tip="Solo números, con el código de país. Ej.: 18095551234"
            >
              <Input
                id="coach-whatsapp"
                type="tel"
                inputMode="numeric"
                placeholder="18095551234"
                className="tracking-wide"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 15))}
              />
            </Field>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? 'Guardando…' : 'Guardar perfil'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        {/* Always-dark mini mock of the mobile app's contact card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Así te ven</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full font-display text-[17px] text-red-500"
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
                <span className="truncate">WhatsApp {previewPhone}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Preferencias</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Pesos en" tip="Cómo ves y escribes los pesos en el panel. Siempre se guardan en kilogramos.">
              <Segmented<WeightUnit>
                aria-label="Unidad de peso"
                stretch
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'kg', label: 'Kilogramos' },
                  { value: 'lb', label: 'Libras' },
                ]}
              />
            </Field>
            <Field label="Tema">
              <Segmented<'dark' | 'light'>
                aria-label="Tema"
                stretch
                value={theme}
                onChange={(v) => v !== theme && toggle()}
                options={[
                  { value: 'dark', label: 'Oscuro', icon: Moon },
                  { value: 'light', label: 'Claro', icon: Sun },
                ]}
              />
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
