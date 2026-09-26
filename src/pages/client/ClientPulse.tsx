import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ClientWithMeta, SetLogWithContext } from '@/types';
import { listProgramsForClient } from '@/services/programs';
import { getClientCompletions, getClientMeasurements, getClientSetLogs, getClientSupplementDays } from '@/services/tracking';
import { keyDaysAgo, toKey } from '@/services/insights';
import { qk } from '@/lib/queryClient';
import { cn, fmtShort } from '@/lib/utils';
import { formatWeight, kgToDisplay } from '@/lib/weightUnit';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendAreaChart } from '@/components/shared/charts';

/*
 * The client at a glance, on top of Resumen: where they are in their block,
 * what they did last session against the prescription, how consistent the
 * last 4 weeks were, and where their weight is going. Reads the same queries
 * the Programas / Seguimiento / Progreso tabs use, so the data is shared.
 */

const DAY = 86_400_000;
const keyToDate = (k: string) => {
  const [y, m, d] = k.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function ClientPulse({ client, onGoTab }: { client: ClientWithMeta; onGoTab: (tab: string) => void }) {
  const programs = useQuery({ queryKey: qk.programs(client.id), queryFn: () => listProgramsForClient(client.id) });
  const setLogs = useQuery({ queryKey: qk.setLogs(client.id), queryFn: () => getClientSetLogs(client.id) });
  const completions = useQuery({ queryKey: qk.completions(client.id), queryFn: () => getClientCompletions(client.id) });
  const measurements = useQuery({ queryKey: qk.measurements(client.id), queryFn: () => getClientMeasurements(client.id) });
  const supplementDays = useQuery({
    queryKey: qk.supplementDays(client.id),
    queryFn: () => getClientSupplementDays(client.id, keyDaysAgo(27)),
  });

  const program = programs.data?.find((p) => p.status === 'active') ?? null;

  /** Every day with program or legacy training activity. */
  const activeDays = useMemo(() => {
    const s = new Set<string>();
    for (const l of setLogs.data ?? []) s.add(l.date.slice(0, 10));
    for (const c of completions.data ?? []) s.add(toKey(new Date(c.completed_at)));
    for (const l of client.logs) s.add(l.date.slice(0, 10));
    return s;
  }, [setLogs.data, completions.data, client.logs]);

  const loading = programs.isPending || setLogs.isPending || completions.isPending;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <BlockTimeline program={program} activeDays={activeDays} loading={loading} onGoTab={onGoTab} />
        <LastSession logs={setLogs.data} loading={setLogs.isPending} onGoTab={onGoTab} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Adherence
          client={client}
          daysPerWeek={program ? Math.max(1, program.program_days.length) : client.days_per_week}
          activeDays={activeDays}
          supplementDays={supplementDays.data ?? null}
          hasSupplementPlan={client.supplementPlans.some((p) => p.status === 'active')}
          loading={loading}
        />
        <WeightCard data={measurements.data} loading={measurements.isPending} onGoTab={onGoTab} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- timeline */

function BlockTimeline({
  program,
  activeDays,
  loading,
  onGoTab,
}: {
  program: { name: string; start_date: string; duration_weeks: number; program_days: unknown[]; program_weeks: { week_number: number; label: string | null; is_deload: boolean }[] } | null;
  activeDays: Set<string>;
  loading: boolean;
  onGoTab: (tab: string) => void;
}) {
  if (loading) return <Skeleton className="h-[170px] rounded-2xl" />;
  if (!program) {
    return (
      <Card>
        <CardHeader className="flex-row items-baseline justify-between space-y-0">
          <CardTitle>Sin bloque activo</CardTitle>
          <button type="button" onClick={() => onGoTab('programs')} className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary hover:underline">
            Asignar programa →
          </button>
        </CardHeader>
        <CardContent className="text-[12.5px] text-faint">Asigna un programa para seguir su progreso semana a semana.</CardContent>
      </Card>
    );
  }

  const start = keyToDate(program.start_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = Math.floor((today.getTime() - start.getTime()) / DAY / 7) + 1;
  const perWeek = Math.max(1, program.program_days.length);
  const weeks = Array.from({ length: program.duration_weeks }, (_, i) => {
    const from = new Date(start.getTime() + i * 7 * DAY);
    let done = 0;
    for (let d = 0; d < 7; d++) if (activeDays.has(toKey(new Date(from.getTime() + d * DAY)))) done++;
    const meta = program.program_weeks.find((w) => w.week_number === i + 1);
    return { n: i + 1, done, label: meta?.label ?? null, deload: meta?.is_deload ?? false };
  });

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate">{program.name}</CardTitle>
          <p className="mt-1 text-[12px] text-faint">
            {current < 1
              ? `Empieza el ${fmtShort(program.start_date)}`
              : current > program.duration_weeks
                ? `Terminó · ${program.duration_weeks} semanas`
                : `Semana ${current} de ${program.duration_weeks} · empezó el ${fmtShort(program.start_date)}`}
          </p>
        </div>
        <button type="button" onClick={() => onGoTab('programs')} className="flex-none text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary hover:underline">
          Ver / editar →
        </button>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(weeks.length, 8)}, minmax(0, 1fr))` }}>
          {weeks.map((w) => {
            const past = w.n < current;
            const now = w.n === current;
            const good = w.done >= perWeek;
            return (
              <li
                key={w.n}
                className={cn(
                  'flex flex-col gap-0.5 rounded-lg border p-2',
                  now ? 'border-2 border-primary bg-primary/10' : past ? (good ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10') : 'border-border bg-background',
                  w.deload && !now && 'border-dashed',
                )}
              >
                <span className="font-heading text-[15px] leading-none">Sem {w.n}</span>
                <span className={cn('text-[11.5px] font-bold tabular-nums', past ? (good ? 'text-success' : 'text-warning') : now ? 'text-foreground' : 'text-faint')}>
                  {past || now ? `${w.done}/${perWeek} días` : w.deload ? 'Descarga' : (w.label ?? '—')}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------ last session */

const exName = (l: SetLogWithContext) => l.program_exercise?.exercise?.name ?? l.program_exercise?.custom_name ?? l.exercise_name ?? 'Ejercicio';

function LastSession({ logs, loading, onGoTab }: { logs: SetLogWithContext[] | undefined; loading: boolean; onGoTab: (tab: string) => void }) {
  const { unit } = useWeightUnit();
  if (loading) return <Skeleton className="h-[220px] rounded-2xl" />;
  const withData = (logs ?? []).filter((l) => l.weight_kg != null || l.reps != null);
  if (withData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Última sesión</CardTitle>
        </CardHeader>
        <CardContent className="text-[12.5px] text-faint">Aún no ha registrado series en la app.</CardContent>
      </Card>
    );
  }

  const lastDate = withData.reduce((m, l) => (l.date > m ? l.date : m), withData[0].date);
  const session = withData.filter((l) => l.date === lastDate);
  const groups = new Map<string, SetLogWithContext[]>();
  for (const l of session) {
    const k = exName(l);
    groups.set(k, [...(groups.get(k) ?? []), l].sort((a, b) => a.set_index - b.set_index));
  }

  /** Best weight for the same exercise the last time it was done in an
   *  EARLIER program week (progression is week over week); falls back to the
   *  most recent earlier day for logs without a comparable week. */
  const previousBest = (name: string, week: number): number | null => {
    const same = withData.filter((l) => exName(l) === name && l.date < lastDate && l.weight_kg != null);
    const prevWeeks = same.filter((l) => l.week_number < week);
    const earlier = prevWeeks.length > 0 ? prevWeeks : same;
    if (earlier.length === 0) return null;
    const d = earlier.reduce((m, l) => (l.date > m ? l.date : m), earlier[0].date);
    return Math.max(...earlier.filter((l) => l.date === d).map((l) => l.weight_kg!));
  };

  const w = (kg: number | null) => (kg == null ? '—' : String(Math.round(kgToDisplay(kg, unit) * 10) / 10));

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>Última sesión vs. plan</CardTitle>
        <span className="text-xs text-faint">{fmtShort(lastDate)}</span>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-faint">
              <th className="py-2 pr-3 font-extrabold">Ejercicio</th>
              <th className="py-2 pr-3 font-extrabold">Plan</th>
              <th className="py-2 pr-3 font-extrabold">Hecho ({unit})</th>
              <th className="py-2 font-extrabold">Vs. semana anterior</th>
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([name, sets]) => {
              const pe = sets[0].program_exercise;
              const reps = pe ? (pe.rep_min != null && pe.rep_max != null && pe.rep_min !== pe.rep_max ? `${pe.rep_min}–${pe.rep_max}` : String(pe.rep_max ?? pe.rep_min ?? '—')) : '—';
              const top = Math.max(...sets.map((s) => s.weight_kg ?? 0));
              const prev = previousBest(name, sets[0].week_number);
              const delta = prev != null && top > 0 ? kgToDisplay(top - prev, unit) : null;
              return (
                <tr key={name} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-bold">{name}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{pe ? `${pe.sets} × ${reps}${pe.is_unilateral ? ' / lado' : ''}` : '—'}</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {w(sets[0].weight_kg)} × {sets.map((s) => s.reps ?? '—').join(', ')}
                  </td>
                  <td className={cn('py-2.5 font-extrabold tabular-nums', delta == null ? 'text-faint' : delta > 0 ? 'text-success' : delta < 0 ? 'text-warning' : 'text-muted-foreground')}>
                    {delta == null ? '—' : delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10} ${unit}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={() => onGoTab('tracking')} className="mt-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary hover:underline">
          Ver todo el seguimiento →
        </button>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- adherence */

function Adherence({
  client,
  daysPerWeek,
  activeDays,
  supplementDays,
  hasSupplementPlan,
  loading,
}: {
  client: ClientWithMeta;
  daysPerWeek: number | null;
  activeDays: Set<string>;
  supplementDays: string[] | null;
  hasSupplementPlan: boolean;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-[170px] rounded-2xl" />;
  const window28 = new Set(Array.from({ length: 28 }, (_, i) => keyDaysAgo(i)));
  const trained = [...activeDays].filter((d) => window28.has(d)).length;
  const planned = daysPerWeek ? daysPerWeek * 4 : null;
  const pct = planned ? Math.min(100, Math.round((trained / planned) * 100)) : null;
  const mealDays = new Set(client.meals.filter((m) => window28.has(m.date.slice(0, 10))).map((m) => m.date.slice(0, 10))).size;

  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adherencia · 4 semanas</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={pct != null ? `Adherencia ${pct} %` : 'Sin plan de días'} className="flex-none">
          <circle cx="56" cy="56" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          {pct != null && (
            <circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              stroke={pct >= 80 ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(C * pct) / 100} ${C}`}
              transform="rotate(-90 56 56)"
            />
          )}
          <text x="56" y="62" textAnchor="middle" className="fill-foreground font-heading" fontSize="24">
            {pct != null ? `${pct}%` : '—'}
          </text>
        </svg>
        <dl className="flex min-w-0 flex-1 flex-col gap-2 text-[13px]">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Entrenos</dt>
            <dd className="font-extrabold tabular-nums">{planned ? `${trained} / ${planned}` : trained}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Días con comidas</dt>
            <dd className="font-extrabold tabular-nums">{mealDays} / 28</dd>
          </div>
          {hasSupplementPlan && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Días con suplementos</dt>
              <dd className="font-extrabold tabular-nums">{supplementDays ? `${supplementDays.length} / 28` : '—'}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ weight */

function WeightCard({
  data,
  loading,
  onGoTab,
}: {
  data: { measured_on: string; weight_kg: number | null }[] | undefined;
  loading: boolean;
  onGoTab: (tab: string) => void;
}) {
  const { unit } = useWeightUnit();
  if (loading) return <Skeleton className="h-[190px] rounded-2xl" />;
  const rows = (data ?? []).filter((r) => r.weight_kg != null);
  const latest = rows.at(-1);
  const cutoff = keyDaysAgo(30);
  const base = rows.find((r) => r.measured_on >= cutoff) ?? rows[0];
  const delta = latest && base && latest !== base ? kgToDisplay(latest.weight_kg! - base.weight_kg!, unit) : null;
  const series = rows.slice(-12).map((r) => Math.round(kgToDisplay(r.weight_kg!, unit) * 10) / 10);

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>Peso corporal</CardTitle>
        {delta != null && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums">
            {delta > 0 ? '+' : ''}
            {Math.round(delta * 10) / 10} {unit} · 30 d
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!latest ? (
          <p className="text-[12.5px] text-faint">Aún no ha registrado su peso.</p>
        ) : (
          <>
            <div className="font-heading text-[30px] leading-none">{formatWeight(latest.weight_kg, unit)}</div>
            <div className="mt-1 text-[11.5px] text-faint">Último registro: {fmtShort(latest.measured_on)}</div>
            {series.length >= 2 && (
              <div className="mt-2">
                <TrendAreaChart data={series} />
              </div>
            )}
          </>
        )}
        <button type="button" onClick={() => onGoTab('progress')} className="mt-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary hover:underline">
          Ver medidas →
        </button>
      </CardContent>
    </Card>
  );
}
