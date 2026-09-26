import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell, Ruler } from 'lucide-react';
import type { BodyMeasurement, ClientWithMeta } from '@/types';
import { getClientMeasurements } from '@/services/tracking';
import { qk } from '@/lib/queryClient';
import { daysDiff, fmtShort } from '@/lib/utils';
import { kgToDisplay, type WeightUnit } from '@/lib/weightUnit';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrendAreaChart, WeeklyBarChart, type WeekBar } from '@/components/shared/charts';

export function ProgressTab({ client }: { client: ClientWithMeta }) {
  const { bars, total, avg, recent } = useMemo(() => {
    const bars: WeekBar[] = Array.from({ length: 6 }, (_, i) => {
      const value = client.logs.filter((l) => {
        const d = -daysDiff(l.date);
        return d >= (5 - i) * 7 - 6 && d <= (5 - i) * 7;
      }).length;
      return { label: i === 5 ? 'Esta' : `-${5 - i}`, value, current: i === 5 };
    });
    const total = client.logs.length;
    const avg = total ? Math.round(client.logs.reduce((a, l) => a + (l.duration_minutes ?? 0), 0) / total) : 0;
    const recent = [...client.logs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    return { bars, total, avg, recent };
  }, [client]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,1.1fr)_minmax(320px,1.6fr)]">
      <MeasurementsCard client={client} />

      <Card>
        <CardHeader className="flex-row items-baseline justify-between space-y-0">
          <CardTitle>Frecuencia semanal</CardTitle>
          <span className="text-xs text-faint">6 semanas</span>
        </CardHeader>
        <CardContent>
          <WeeklyBarChart data={bars} height={130} />
          <div className="mt-4 flex gap-4 border-t border-border pt-3.5">
            <div>
              <div className="text-[11.5px] font-semibold text-faint">Total registrado</div>
              <div className="font-heading text-lg font-bold">{total} entrenos</div>
            </div>
            <div>
              <div className="text-[11.5px] font-semibold text-faint">Duración media</div>
              <div className="font-heading text-lg font-bold">{avg} min</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de entrenos</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="Aún sin entrenos"
              description={`Cuando ${(client.display_name ?? client.email).split(' ')[0]} registre entrenos en la app, aparecerán aquí.`}
              className="py-9"
            />
          ) : (
            <div className="flex flex-col">
              {recent.map((lg) => (
                <div key={lg.id} className="flex gap-3.5 border-b border-border py-[11px]">
                  <div className="w-16 flex-none pt-0.5 text-[11.5px] font-semibold text-faint">
                    {fmtShort(lg.date)}
                  </div>
                  <div className="flex w-2 flex-none flex-col items-center pt-[5px]">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{lg.routine_name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {lg.duration_minutes ?? '—'} min
                      </span>
                    </div>
                    {lg.notes && <p className="mt-0.5 text-xs text-faint">{lg.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type MetricKey = 'weight_kg' | 'body_fat_pct' | 'waist_cm' | 'chest_cm' | 'arm_cm' | 'thigh_cm';

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'weight_kg', label: 'Peso' },
  { key: 'body_fat_pct', label: 'Grasa corporal' },
  { key: 'waist_cm', label: 'Cintura' },
  { key: 'chest_cm', label: 'Pecho' },
  { key: 'arm_cm', label: 'Brazo' },
  { key: 'thigh_cm', label: 'Muslo' },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A metric in display units: weight follows the coach's kg/lb choice. */
function displayValue(key: MetricKey, value: number, unit: WeightUnit): { value: number; suffix: string } {
  if (key === 'weight_kg') return { value: round1(kgToDisplay(value, unit)), suffix: unit };
  if (key === 'body_fat_pct') return { value: round1(value), suffix: '%' };
  return { value: round1(value), suffix: 'cm' };
}

/** Latest value of each metric, with the change since the first time it was
 *  measured. Metrics the client never logged are left out. */
function summarize(rows: BodyMeasurement[]) {
  return METRICS.flatMap(({ key, label }) => {
    const points = rows.filter((r) => r[key] != null);
    if (points.length === 0) return [];
    const first = points[0];
    const last = points[points.length - 1];
    return [{ key, label, latest: last[key]!, delta: last[key]! - first[key]!, since: first.measured_on, on: last.measured_on }];
  });
}

function MeasurementsCard({ client }: { client: ClientWithMeta }) {
  const { unit } = useWeightUnit();
  const { data: rows, isLoading, isError } = useQuery({
    queryKey: qk.measurements(client.id),
    queryFn: () => getClientMeasurements(client.id),
  });

  const weights = useMemo(
    () => (rows ?? []).filter((r) => r.weight_kg != null).map((r) => round1(kgToDisplay(r.weight_kg!, unit))),
    [rows, unit],
  );
  const metrics = useMemo(() => summarize(rows ?? []), [rows]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>Medidas corporales</CardTitle>
        {metrics.length > 0 && (
          <span className="text-xs text-faint">
            {rows!.length} registro{rows!.length === 1 ? '' : 's'} · desde {fmtShort(rows![0].measured_on)}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[150px] rounded-xl" />
        ) : isError ? (
          <p className="py-6 text-center text-[13px] text-faint">No se pudieron cargar las medidas.</p>
        ) : metrics.length === 0 ? (
          <EmptyState
            icon={Ruler}
            title="Aún sin medidas"
            description={`Cuando ${(client.display_name ?? client.email).split(' ')[0]} registre su peso o medidas en la app, aparecerán aquí.`}
            className="py-9"
          />
        ) : (
          <div className="flex flex-col gap-4">
            {weights.length >= 2 && (
              <div>
                <div className="mb-1 text-[11.5px] font-semibold text-faint">Tendencia de peso ({unit})</div>
                <TrendAreaChart data={weights} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {metrics.map((m) => {
                const latest = displayValue(m.key, m.latest, unit);
                const delta = displayValue(m.key, m.delta, unit).value;
                return (
                  <div key={m.key} className="rounded-xl border border-border px-3 py-2.5">
                    <div className="text-[11.5px] font-semibold text-faint">{m.label}</div>
                    <div className="font-heading text-lg font-bold">
                      {latest.value} <span className="text-xs font-semibold text-muted-foreground">{latest.suffix}</span>
                    </div>
                    <div className="text-[11px] text-faint">
                      {delta === 0 ? 'Sin cambio' : `${delta > 0 ? '+' : ''}${delta} ${latest.suffix}`} desde{' '}
                      {fmtShort(m.since)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
