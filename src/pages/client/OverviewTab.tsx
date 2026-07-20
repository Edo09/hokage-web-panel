import type { ClientWithMeta } from '@/types';
import { cn, daysDiff, expiryInfo, money } from '@/lib/utils';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { formatWeight } from '@/lib/weightUnit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

export function OverviewTab({ client, onGoTab }: { client: ClientWithMeta; onGoTab: (tab: string) => void }) {
  const { unit } = useWeightUnit();
  // BMI is always computed from the stored kg value — only the DISPLAYED
  // weight below converts to the coach's preferred unit.
  const bmi =
    client.height_cm && client.weight_kg
      ? (client.weight_kg / Math.pow(client.height_cm / 100, 2)).toFixed(1)
      : '—';
  const logs30 = client.logs.filter((l) => daysDiff(l.date) > -30).length;
  const coachRoutines = client.routines.filter((r) => r.assigned_by).length;
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
          <Metric label="Entrenos (30 d)" value={logs30} />
          <Metric label="Rutinas asignadas" value={coachRoutines} />
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
    </div>
  );
}
