import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import type { ClientWithMeta, ExerciseCompletionWithContext, ProgramExerciseContext, SetLogWithContext } from '@/types';
import { getClientCompletions, getClientSetLogs } from '@/services/tracking';
import { qk } from '@/lib/queryClient';
import { fmtShort } from '@/lib/utils';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { formatWeight } from '@/lib/weightUnit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';

/** Epley estimated 1RM; unilateral sets count the same load per side. */
const e1rm = (weight: number, reps: number): number => Math.round(weight * (1 + reps / 30));

const repRange = (a: number | null, b: number | null): string =>
  a != null && b != null ? (a === b ? `${a}` : `${a}–${b}`) : a != null ? `${a}+` : b != null ? `≤${b}` : '—';

interface ExGroup {
  key: string;
  name: string;
  program: string | null;
  presc: string;
  isUnilateral: boolean;
  /** Coach-prescribed RIR for this exercise ("2", "1–2" or "—"). Clients no
   *  longer report RIR — it's the target, so the set table shows that. */
  rirTarget: string;
  sets: SetLogWithContext[];
  /** Weeks the client checked this exercise done — independent of whether any
   *  set in that week has logged numbers (a client can check a day done
   *  without entering weight/reps). */
  completedWeeks: number[];
  lastDate: number;
  best: { weight: number; reps: number; e1rm: number } | null;
}

function ensureGroup(map: Map<string, ExGroup>, key: string, pe: ProgramExerciseContext | null): ExGroup {
  let g = map.get(key);
  if (!g) {
    const rir = repRange(pe?.rir_min ?? null, pe?.rir_max ?? null);
    const parts = [`${pe?.sets ?? '—'}×${repRange(pe?.rep_min ?? null, pe?.rep_max ?? null)}`];
    if (rir !== '—') parts.push(`RIR ${rir}`);
    if (pe?.load_pct_1rm != null) parts.push(`${pe.load_pct_1rm}% 1RM`);
    g = {
      key,
      name: pe?.exercise?.name ?? pe?.custom_name ?? 'Ejercicio',
      program: pe?.program_day?.program?.name ?? null,
      presc: parts.join(' · '),
      isUnilateral: pe?.is_unilateral ?? false,
      rirTarget: rir,
      sets: [],
      completedWeeks: [],
      lastDate: 0,
      best: null,
    };
    map.set(key, g);
  }
  return g;
}

function buildGroups(
  logs: SetLogWithContext[],
  completions: ExerciseCompletionWithContext[],
): ExGroup[] {
  const map = new Map<string, ExGroup>();
  for (const log of logs) {
    const g = ensureGroup(map, log.program_exercise_id, log.program_exercise);
    g.sets.push(log);
    // Bare 'YYYY-MM-DD' — fine for RELATIVE ordering (grouping sort only,
    // never displayed), unlike the display-path bug fixed in the summary below.
    const t = new Date(log.date).getTime();
    if (t > g.lastDate) g.lastDate = t;
    if (log.weight_kg != null && log.reps != null) {
      const est = e1rm(log.weight_kg, log.reps);
      if (!g.best || est > g.best.e1rm) g.best = { weight: log.weight_kg, reps: log.reps, e1rm: est };
    }
  }
  for (const c of completions) {
    const g = ensureGroup(map, c.program_exercise_id, c.program_exercise);
    g.completedWeeks.push(c.week_number);
    const t = new Date(c.completed_at).getTime(); // real timestamptz instant
    if (t > g.lastDate) g.lastDate = t;
  }
  for (const g of map.values()) g.completedWeeks.sort((a, b) => a - b);
  return [...map.values()].sort((a, b) => b.lastDate - a.lastDate);
}

const SET_GRID = 'grid gap-1.5 [grid-template-columns:64px_46px_44px_1fr_44px_44px]';

export function SeguimientoTab({ client }: { client: ClientWithMeta }) {
  const logsQuery = useQuery({ queryKey: qk.setLogs(client.id), queryFn: () => getClientSetLogs(client.id) });
  const complQuery = useQuery({
    queryKey: qk.completions(client.id),
    queryFn: () => getClientCompletions(client.id),
  });

  const { unit } = useWeightUnit();
  const logs = logsQuery.data;
  const completions = complQuery.data;
  const isPending = logsQuery.isPending || complQuery.isPending;
  const isError = logsQuery.isError || complQuery.isError;
  const refetchAll = () => {
    void logsQuery.refetch();
    void complQuery.refetch();
  };

  const groups = useMemo(() => (logs && completions ? buildGroups(logs, completions) : []), [logs, completions]);
  const summary = useMemo(() => {
    if (!logs || !completions || (logs.length === 0 && completions.length === 0)) return null;
    // Set-log dates are bare 'YYYY-MM-DD'; completion dates are full
    // timestamptz instants — mixed formats, so compare via real Date parsing
    // (fine for ORDERING only) but keep and display each row's ORIGINAL
    // string. Round-tripping the winner through `new Date(...).toISOString()`
    // is what caused the previous off-by-one-day display bug.
    let lastStr: string | null = null;
    let lastMs = -Infinity;
    for (const l of logs) {
      const ms = new Date(l.date).getTime();
      if (ms > lastMs) {
        lastMs = ms;
        lastStr = l.date;
      }
    }
    for (const c of completions) {
      const ms = new Date(c.completed_at).getTime();
      if (ms > lastMs) {
        lastMs = ms;
        lastStr = c.completed_at;
      }
    }
    return { totalSets: logs.length, totalCompletions: completions.length, exercises: groups.length, last: lastStr };
  }, [logs, completions, groups]);

  if (isError) {
    return (
      <Card className="shadow-none">
        <EmptyState icon={AlertCircle} title="No se pudo cargar" description="Hubo un problema al cargar el seguimiento.">
          <Button variant="outline" onClick={refetchAll} className="mt-1">
            Reintentar
          </Button>
        </EmptyState>
      </Card>
    );
  }
  if (isPending) {
    return (
      <Card className="shadow-none">
        <div className="p-6 text-center text-[13px] text-faint">Cargando seguimiento…</div>
      </Card>
    );
  }
  if (groups.length === 0) {
    return (
      <Card className="border-dashed border-border-strong shadow-none">
        <EmptyState
          icon={Activity}
          title="Aún sin registros"
          description={`Cuando ${(client.display_name ?? client.email).split(' ')[0]} marque un ejercicio como hecho o registre sus series en la app, verás aquí su progreso real frente a lo prescrito.`}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="flex flex-wrap gap-2 text-[12px]">
          <Chip>{summary.totalSets} series registradas</Chip>
          <Chip>{summary.totalCompletions} ejercicios marcados como hechos</Chip>
          <Chip>{summary.exercises} ejercicios</Chip>
          {summary.last && <Chip>Última actividad {fmtShort(summary.last)}</Chip>}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {groups.map((g) => {
          const shown = g.sets.slice(0, 8);
          return (
            <Card key={g.key} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-sm font-semibold">{g.name}</span>
                    {g.isUnilateral && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        POR LADO
                      </span>
                    )}
                  </div>
                  {g.program && <div className="mt-0.5 text-[11.5px] text-faint">{g.program}</div>}
                </div>
                {g.best && (
                  <span className="flex flex-none items-center gap-1 rounded-lg bg-success-soft px-2 py-1 text-[11px] font-bold text-success">
                    <TrendingUp className="h-3 w-3" strokeWidth={2.25} />
                    1RM est. {formatWeight(g.best.e1rm, unit)}
                  </span>
                )}
              </div>

              <div className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-[11.5px] font-semibold text-muted-foreground">
                Prescrito: {g.presc}
              </div>

              {g.completedWeeks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.completedWeeks.map((wk) => (
                    <span
                      key={wk}
                      className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-bold text-success"
                    >
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} />
                      Sem {wk} hecho
                    </span>
                  ))}
                </div>
              )}

              {g.sets.length === 0 ? (
                <p className="mt-3 text-[12px] text-faint">
                  Marcado como hecho — sin peso ni repeticiones registradas.
                </p>
              ) : (
                <>
                  <div className={`${SET_GRID} mt-3 border-b border-border pb-1 text-[10px] font-bold uppercase tracking-wide text-faint`}>
                    <span>Fecha</span>
                    <span className="text-center">Sem</span>
                    <span className="text-center">Serie</span>
                    <span className="text-right">Peso</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">RIR obj.</span>
                  </div>
                  {shown.map((s) => (
                    <div key={s.id} className={`${SET_GRID} items-center border-b border-border py-[6px] text-[12.5px]`}>
                      <span className="text-faint">{fmtShort(s.date)}</span>
                      <span className="text-center text-muted-foreground">{s.week_number}</span>
                      <span className="text-center text-muted-foreground">{s.set_index}</span>
                      <span className="text-right font-semibold">{formatWeight(s.weight_kg, unit)}</span>
                      <span className="text-center text-muted-foreground">{s.reps ?? '—'}</span>
                      {/* The coach's target, not a client report — RIR is
                          prescribed, never entered in the app. */}
                      <span className="text-center text-faint">{g.rirTarget}</span>
                    </div>
                  ))}
                  {g.sets.length > shown.length && (
                    <div className="pt-2 text-[11.5px] text-faint">+ {g.sets.length - shown.length} series más</div>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">{children}</span>
  );
}
