import { useState } from 'react';
import { toast } from 'sonner';
import { Dumbbell } from 'lucide-react';
import type { ClientWithMeta } from '@/types';
import { cn, expiryInfo, money } from '@/lib/utils';
import { updateClient } from '@/services/clients';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { formatWeight } from '@/lib/weightUnit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TONE_CLASS = {
  normal: 'text-foreground',
  warning: 'text-warning',
  danger: 'text-primary',
  muted: 'text-faint',
} as const;

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted px-3.5 py-3">
      <div className="text-[11.5px] font-semibold text-faint">{label}</div>
      <div className="mt-0.5 font-heading text-xl font-bold">{value}</div>
    </div>
  );
}

/* available_days is stored 3-letter Monday-first ("Mon".."Sun") — must match the
   mobile app (app/(tabs)/profile.tsx DAY_VALUES) so the client sees the same set. */
const WEEK_DAYS: { value: string; label: string }[] = [
  { value: 'Mon', label: 'Lun' },
  { value: 'Tue', label: 'Mar' },
  { value: 'Wed', label: 'Mié' },
  { value: 'Thu', label: 'Jue' },
  { value: 'Fri', label: 'Vie' },
  { value: 'Sat', label: 'Sáb' },
  { value: 'Sun', label: 'Dom' },
];
const clampInt = (s: string, lo: number, hi: number): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
};

// Coach-assigned training plan — the same "Plan de entrenamiento" the client
// sees in their mobile profile (days/week, session length, available days).
// These drive the Progress dashboard's weekly session goal + day dots, so the
// coach owning them keeps the client's targets aligned with the assigned block.
function TrainingPlanCard({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [dpw, setDpw] = useState(client.days_per_week != null ? String(client.days_per_week) : '');
  const [dur, setDur] = useState(client.session_duration != null ? String(client.session_duration) : '');
  const [days, setDays] = useState<string[]>(client.available_days ?? []);
  const [saving, setSaving] = useState(false);

  const baseDays = client.available_days ?? [];
  const dirty =
    dpw !== (client.days_per_week != null ? String(client.days_per_week) : '') ||
    dur !== (client.session_duration != null ? String(client.session_duration) : '') ||
    days.length !== baseDays.length ||
    days.some((d) => !baseDays.includes(d));

  const toggleDay = (v: string) =>
    setDays((prev) => (prev.includes(v) ? prev.filter((d) => d !== v) : [...prev, v]));

  const save = async () => {
    setSaving(true);
    try {
      await updateClient(client.id, {
        days_per_week: clampInt(dpw, 1, 7),
        session_duration: clampInt(dur, 5, 240),
        // Keep stored order Monday-first regardless of click order.
        available_days: WEEK_DAYS.filter((d) => days.includes(d.value)).map((d) => d.value),
      });
      onChanged();
      toast.success('Plan de entrenamiento actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gridColumn: '1 / -1' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" strokeWidth={2.25} />
          Plan de entrenamiento
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-[12.5px] text-muted-foreground">
          Lo que el cliente ve en su perfil. Define su meta semanal de sesiones y los días de entreno.
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="flex w-28 flex-col gap-1.5">
            <Label htmlFor="tp-dpw">Días por semana</Label>
            <Input
              id="tp-dpw"
              type="number"
              min={1}
              max={7}
              value={dpw}
              onChange={(e) => setDpw(e.target.value)}
            />
          </div>
          <div className="flex w-36 flex-col gap-1.5">
            <Label htmlFor="tp-dur">Duración por sesión</Label>
            <div className="relative">
              <Input
                id="tp-dur"
                type="number"
                min={5}
                max={240}
                className="pr-12"
                value={dur}
                onChange={(e) => setDur(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-faint">
                min
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Días disponibles</Label>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((d) => {
              const on = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'h-9 min-w-[52px] rounded-lg border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Guardando…' : 'Guardar plan'}
          </Button>
          {days.length > 0 && (
            <span className="text-[12px] text-faint">
              {days.length} {days.length === 1 ? 'día' : 'días'} seleccionados
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({
  client,
  onGoTab,
  onChanged,
}: {
  client: ClientWithMeta;
  onGoTab: (tab: string) => void;
  onChanged: () => void;
}) {
  const { unit } = useWeightUnit();
  // BMI is always computed from the stored kg value — only the DISPLAYED
  // weight below converts to the coach's preferred unit.
  const bmi =
    client.height_cm && client.weight_kg
      ? (client.weight_kg / Math.pow(client.height_cm / 100, 2)).toFixed(1)
      : '—';
  const exp = expiryInfo(client.membership);
  const per = client.membership?.plan_name?.includes('Trimestral') ? ' / trim' : ' / mes';

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <Card>
        <CardHeader>
          <CardTitle>Métricas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Metric label="Peso actual" value={formatWeight(client.weight_kg, unit)} />
          <Metric label="IMC" value={bmi} />
          <Metric label="Días/semana" value={client.days_per_week ?? '—'} />
          <Metric
            label="Duración sesión"
            value={client.session_duration ? `${client.session_duration} min` : '—'}
          />
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Meta de calorías</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-[34px] font-bold text-primary">
              {(client.calorie_goal ?? 0).toLocaleString('en-US')}
            </span>
            <span className="text-[13px] text-faint">kcal / día</span>
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Visible para el cliente en la app móvil. Edítala en la pestaña Nutrición.
          </p>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="mt-3.5 w-fit" onClick={() => onGoTab('nutrition')}>
            Editar meta
          </Button>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Membresía</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Plan</span>
              <span className="font-semibold">{client.membership?.plan_name ?? 'Sin plan'}</span>
            </div>
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Precio</span>
              <span className="font-semibold">{money(client.membership?.price ?? null) + per}</span>
            </div>
            <div className="flex justify-between gap-2.5">
              <span className="text-faint">Vence</span>
              <span className={cn('font-semibold', TONE_CLASS[exp.tone])}>{exp.label}</span>
            </div>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="mt-3.5 w-fit" onClick={() => onGoTab('membership')}>
            Gestionar
          </Button>
        </CardContent>
      </Card>

      <TrainingPlanCard client={client} onChanged={onChanged} />
    </div>
  );
}
