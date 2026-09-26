import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ClientWithMeta } from '@/types';
import { qk } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { listProgramsForClient } from '@/services/programs';
import { getClientCompletions, getClientSetLogs } from '@/services/tracking';
import { Card } from '@/components/ui/card';
import { BodyFigure } from '@/components/muscles/BodyFigure';
import {
  assignedSets,
  doneSets,
  GROUP_LABEL,
  GROUP_ORDER,
  programWeekNow,
  type GroupSets,
  type MuscleGroup,
} from '@/lib/muscleMap';

const SLATE = 'hsl(var(--border-strong))';
const AMBER = 'hsl(var(--warning))';
const INK = 'hsl(var(--foreground))';
/** Untrained, then three steps of brand red by share of the busiest group. */
const SCALE = [SLATE, 'hsl(var(--primary) / 0.38)', 'hsl(var(--primary) / 0.68)', 'hsl(var(--primary))'];

const shade = (sets: number, max: number): string =>
  sets <= 0 ? SCALE[0] : SCALE[sets / max > 2 / 3 ? 3 : sets / max > 1 / 3 ? 2 : 1];

const total = (m: GroupSets) => [...m.values()].reduce((a, n) => a + n, 0);

/** "Behind" = a finished week where the client did under half the sets. */
const isBehind = (assigned: number, done: number) => assigned > 0 && done < 0.5 * assigned;

/**
 * The client's muscles for one week of their active program, side by side:
 * what the program assigns and what they did. Both figures share one scale,
 * so a fully done week looks the same on both. In a finished week, a group
 * under half its assigned sets turns amber on the "Hecho" figure. Clicking a
 * muscle (or a table row) picks its group in both figures and the table.
 *
 * Default export: loaded lazily (the body artwork is ~100 KB).
 */
export default function MuscleMapCard({ client }: { client: ClientWithMeta }) {
  const programs = useQuery({ queryKey: qk.programs(client.id), queryFn: () => listProgramsForClient(client.id) });
  const logs = useQuery({ queryKey: qk.setLogs(client.id), queryFn: () => getClientSetLogs(client.id) });
  const completions = useQuery({ queryKey: qk.completions(client.id), queryFn: () => getClientCompletions(client.id) });

  const program = programs.data?.find((p) => p.status === 'active') ?? null;
  const now = program ? programWeekNow(program) : null;
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const week = pickedWeek != null && program && pickedWeek <= program.duration_weeks ? pickedWeek : (now?.week ?? 1);

  const assigned = useMemo(() => (program ? assignedSets(program, week) : new Map()), [program, week]);
  const done = useMemo(
    () => (program ? doneSets(program, week, logs.data ?? [], completions.data ?? []) : new Map()),
    [program, week, logs.data, completions.data],
  );

  const firstName = (client.display_name ?? client.email).split(' ')[0];

  if (programs.isPending) {
    return (
      <Card className="p-5">
        <div className="text-[13px] text-faint">Cargando músculos…</div>
      </Card>
    );
  }
  if (!program || !now) {
    return (
      <Card className="p-5">
        <h2 className="font-heading text-[18px]">Músculos</h2>
        <p className="mt-1 text-[12.5px] text-faint">
          {firstName} no tiene un programa activo. Asígnale uno para ver qué músculos le toca trabajar y cuáles ha trabajado.
        </p>
      </Card>
    );
  }

  const status: 'past' | 'current' | 'future' =
    now.finished || week < now.week ? 'past' : week === now.week && !now.notStarted ? 'current' : 'future';
  const statusLabel = { past: 'Semana terminada', current: 'Semana en curso', future: 'Aún no empieza' }[status];

  // One scale for both figures, from the drawn groups only.
  const drawn = GROUP_ORDER.filter((g) => g !== 'other');
  const max = Math.max(1, ...drawn.flatMap((g) => [assigned.get(g) ?? 0, done.get(g) ?? 0]));

  const rows = GROUP_ORDER.filter((g) => (assigned.get(g) ?? 0) > 0 || (done.get(g) ?? 0) > 0);
  const anyBehind = status === 'past' && rows.some((g) => g !== 'other' && isBehind(assigned.get(g) ?? 0, done.get(g) ?? 0));
  const gender = client.sex === 'female' ? 'female' : 'male';
  const pick = (g: MuscleGroup | null) => setSelected((cur) => (g == null || g === cur ? null : g));
  const setsText = (n: number) => `${n} ${n === 1 ? 'serie' : 'series'}`;

  const figures = (kind: 'assigned' | 'done') => {
    const data = kind === 'assigned' ? assigned : done;
    const fillFor = (g: MuscleGroup) => {
      const n = data.get(g) ?? 0;
      if (kind === 'done' && status === 'past' && isBehind(assigned.get(g) ?? 0, n)) return AMBER;
      return shade(n, max);
    };
    const titleFor = (g: MuscleGroup) => {
      const a = assigned.get(g) ?? 0;
      return `${GROUP_LABEL[g]}: ${done.get(g) ?? 0} de ${a} ${a === 1 ? 'serie hecha' : 'series hechas'}`;
    };
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-bold">{kind === 'assigned' ? 'Asignado' : 'Hecho'}</h3>
          <span className="text-[12px] tabular-nums text-faint">{setsText(total(data))}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['front', 'back'] as const).map((side) => (
            <div key={side} className="flex flex-col items-center gap-1">
              <BodyFigure
                gender={gender}
                side={side}
                label={`${kind === 'assigned' ? 'Asignado' : 'Hecho'}, ${side === 'front' ? 'frente' : 'espalda'}`}
                fillFor={fillFor}
                outlineFor={(g) => (g === selected ? INK : null)}
                titleFor={titleFor}
                onPick={pick}
                className="max-w-[112px]"
              />
              <span className="text-[11px] text-faint">{side === 'front' ? 'Frente' : 'Espalda'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[18px]">Músculos</h2>
          <p className="mt-0.5 text-[12.5px] text-faint">
            Semana {week} de {program.duration_weeks} de {program.name}.{' '}
            <span className={cn('font-semibold', status === 'current' ? 'text-primary' : 'text-muted-foreground')}>
              {statusLabel}
            </span>
          </p>
        </div>
        {/* Week picker */}
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1" role="group" aria-label="Semana del programa">
          {Array.from({ length: program.duration_weeks }, (_, i) => i + 1).map((n) => {
            const meta = program.program_weeks.find((w) => w.week_number === n);
            const active = n === week;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setPickedWeek(n)}
                aria-pressed={active}
                title={meta?.label ?? undefined}
                className={cn(
                  'flex min-w-[46px] flex-none flex-col items-center border px-2 py-1 text-[12px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-border-strong',
                )}
              >
                S{n}
                <span className={cn('text-[9.5px] font-semibold', active ? 'text-primary-foreground/85' : 'text-faint')}>
                  {n === now.week && !now.notStarted && !now.finished ? 'Actual' : meta?.is_deload ? 'Descarga' : ' '}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,240px)_minmax(0,240px)_minmax(0,1fr)]">
        {figures('assigned')}
        {figures('done')}

        {/* The numbers, and a way to pick a group from the keyboard */}
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          {rows.length === 0 ? (
            <p className="text-[12.5px] text-faint">Esta semana no tiene ejercicios asignados.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-faint">
                  <th className="pb-1.5 font-semibold">Grupo</th>
                  <th className="pb-1.5 text-right font-semibold">Asignado</th>
                  <th className="pb-1.5 text-right font-semibold">Hecho</th>
                  <th className="w-[38%] pb-1.5 pl-3 font-semibold">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const a = assigned.get(g) ?? 0;
                  const d = done.get(g) ?? 0;
                  const pct = a > 0 ? Math.round((d / a) * 100) : null;
                  const behind = status === 'past' && g !== 'other' && isBehind(a, d);
                  const active = selected === g;
                  return (
                    <tr
                      key={g}
                      className={cn('border-t border-border', selected != null && !active && 'opacity-50')}
                    >
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={() => pick(g)}
                          aria-pressed={active}
                          className={cn(
                            'text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active ? 'font-bold' : 'font-medium',
                          )}
                        >
                          {GROUP_LABEL[g]}
                        </button>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{a}</td>
                      <td className={cn('py-1.5 text-right font-semibold tabular-nums', behind && 'text-warning')}>
                        {status === 'future' ? '—' : d}
                      </td>
                      <td className="py-1.5 pl-3">
                        {pct != null && status !== 'future' ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden bg-muted">
                              <div
                                className={cn('h-full', behind ? 'bg-warning' : 'bg-primary')}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11.5px] text-faint">
            Hecho cuenta cada serie registrada; un ejercicio marcado como hecho sin series registradas cuenta sus series
            asignadas.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-faint">
        <span className="flex items-center gap-1.5">
          Menos
          {SCALE.map((c) => (
            <span key={c} className="h-2.5 w-2.5" style={{ background: c }} />
          ))}
          Más series
        </span>
        {anyBehind && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5" style={{ background: AMBER }} />
            Menos de la mitad de lo asignado
          </span>
        )}
        <span>Pasa el cursor por un músculo para ver sus series; haz clic para resaltar su grupo.</span>
      </div>
    </Card>
  );
}
