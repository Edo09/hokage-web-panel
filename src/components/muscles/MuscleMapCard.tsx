import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ClientWithMeta } from '@/types';
import { qk } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { listProgramsForClient } from '@/services/programs';
import { getClientCompletions, getClientSetLogs } from '@/services/tracking';
import { Card } from '@/components/ui/card';
import { BodyFigure } from '@/components/muscles/BodyFigure';
import { assignedSets, doneSets, GROUP_LABEL, GROUP_ORDER, programWeekNow, type MuscleGroup } from '@/lib/muscleMap';

/**
 * Where a group stands in the chosen week. One colour per state, so the
 * figure alone answers "what's assigned, and what did they do?".
 */
type GroupState = 'none' | 'pending' | 'partial' | 'done' | 'short';

const STATE: Record<GroupState, { color: string; label: string }> = {
  none: { color: 'hsl(var(--border-strong))', label: 'No asignado' },
  pending: { color: 'hsl(var(--primary) / 0.26)', label: 'Asignado, sin hacer' },
  partial: { color: 'hsl(var(--primary) / 0.62)', label: 'A medias' },
  done: { color: 'hsl(var(--primary))', label: 'Completado' },
  short: { color: 'hsl(var(--warning))', label: 'Se quedó corto' },
};

type WeekStatus = 'past' | 'current' | 'future';

/** "Se quedó corto" only once the week is over — mid-week everything is
 *  still pending, and that's not a problem yet. */
function stateOf(assigned: number, done: number, week: WeekStatus): GroupState {
  if (assigned === 0) return done > 0 ? 'done' : 'none';
  if (done >= assigned) return 'done';
  if (week === 'past' && done < 0.5 * assigned) return 'short';
  return done === 0 ? 'pending' : 'partial';
}

const series = (n: number) => `${n} ${n === 1 ? 'serie' : 'series'}`;

/**
 * The client's muscles for one week of their active program. Each muscle's
 * colour says whether it's assigned that week and how much of it they did
 * (see STATE); the list beside the figures names every group with its sets.
 * Hovering a muscle or a row describes it; clicking picks it, fading the
 * rest.
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
  const [hovered, setHovered] = useState<MuscleGroup | null>(null);
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

  const weekStatus: WeekStatus =
    now.finished || week < now.week ? 'past' : week === now.week && !now.notStarted ? 'current' : 'future';
  const statusLabel = { past: 'Semana terminada', current: 'Semana en curso', future: 'Aún no empieza' }[weekStatus];

  const a = (g: MuscleGroup) => assigned.get(g) ?? 0;
  const d = (g: MuscleGroup) => done.get(g) ?? 0;
  const state = (g: MuscleGroup) => stateOf(a(g), d(g), weekStatus);
  const rows = GROUP_ORDER.filter((g) => a(g) > 0 || d(g) > 0);
  const totalA = rows.reduce((s, g) => s + a(g), 0);
  const totalD = rows.reduce((s, g) => s + d(g), 0);
  const usedStates = new Set<GroupState>(['none', ...rows.map(state)]);

  const gender = client.sex === 'female' ? 'female' : 'male';
  const pick = (g: MuscleGroup | null) => setSelected((cur) => (g == null || g === cur ? null : g));
  const focus = hovered ?? selected;

  const describe = (g: MuscleGroup) => {
    if (a(g) === 0 && d(g) === 0) return `${GROUP_LABEL[g]}: no asignado esta semana.`;
    if (a(g) === 0) return `${GROUP_LABEL[g]}: no asignado, pero hizo ${series(d(g))}.`;
    if (weekStatus === 'future') return `${GROUP_LABEL[g]}: ${series(a(g))} asignadas.`;
    return `${GROUP_LABEL[g]}: ${d(g)} de ${series(a(g))} hechas (${Math.round((d(g) / a(g)) * 100)}%).`;
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[18px]">Músculos</h2>
          <p className="mt-0.5 text-[12.5px] text-faint">
            Semana {week} de {program.duration_weeks} de {program.name}.{' '}
            <span className={cn('font-semibold', weekStatus === 'current' ? 'text-primary' : 'text-muted-foreground')}>
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

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* The body — kept together (centred) when it stacks above the list */}
        <div className="mx-auto grid w-full max-w-[380px] grid-cols-2 gap-4">
          {(['front', 'back'] as const).map((side) => (
            <div key={side} className="flex flex-col items-center gap-1.5">
              <BodyFigure
                gender={gender}
                side={side}
                label={`Músculos de ${firstName}, ${side === 'front' ? 'frente' : 'espalda'}`}
                fillFor={(g) => STATE[state(g)].color}
                fadedFor={(g) => selected != null && g !== selected}
                onHover={setHovered}
                onPick={pick}
                className="max-w-[170px]"
              />
              <span className="text-[11.5px] text-faint">{side === 'front' ? 'Frente' : 'Espalda'}</span>
            </div>
          ))}
        </div>

        {/* The names and numbers */}
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <p className="text-[15px] font-bold tabular-nums">
              {weekStatus === 'future'
                ? `${series(totalA)} asignadas`
                : `${totalD} de ${series(totalA)} hechas`}
              {weekStatus !== 'future' && totalA > 0 && (
                <span className="ml-1.5 font-semibold text-muted-foreground">
                  ({Math.round((totalD / totalA) * 100)}%)
                </span>
              )}
            </p>
            {/* What's under the pointer, else what's picked */}
            <p className="min-h-[1.25rem] text-[12.5px] text-muted-foreground" aria-live="polite">
              {focus != null ? describe(focus) : 'Pasa el cursor por un músculo para ver sus series, o haz clic para resaltarlo.'}
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="text-[12.5px] text-faint">Esta semana no tiene ejercicios asignados.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-faint">
                  <th className="pb-1.5 font-semibold">Grupo</th>
                  <th className="pb-1.5 text-right font-semibold">Asignado</th>
                  <th className="pb-1.5 text-right font-semibold">Hecho</th>
                  <th className="pb-1.5 pl-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const st = state(g);
                  const active = selected === g;
                  return (
                    <tr
                      key={g}
                      onMouseEnter={() => setHovered(g)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn('border-t border-border transition-opacity', selected != null && !active && 'opacity-50')}
                    >
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => pick(g)}
                          aria-pressed={active}
                          className={cn(
                            'flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            active ? 'font-bold' : 'font-medium',
                          )}
                        >
                          <span className="h-3 w-3 flex-none" style={{ background: STATE[st].color }} aria-hidden="true" />
                          {GROUP_LABEL[g]}
                        </button>
                      </td>
                      <td className="py-2 text-right tabular-nums">{a(g)}</td>
                      <td className={cn('py-2 text-right font-semibold tabular-nums', st === 'short' && 'text-warning')}>
                        {weekStatus === 'future' ? '—' : d(g)}
                      </td>
                      <td className={cn('py-2 pl-4 text-[12px]', st === 'short' ? 'text-warning' : 'text-muted-foreground')}>
                        {weekStatus === 'future' ? 'Por hacer' : STATE[st].label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Legend: what each colour means */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
            {(Object.keys(STATE) as GroupState[])
              .filter((s) => usedStates.has(s) || s === 'pending' || s === 'done')
              .map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 flex-none" style={{ background: STATE[s].color }} aria-hidden="true" />
                  {STATE[s].label}
                  {s === 'short' && ' (menos de la mitad)'}
                </li>
              ))}
          </ul>
          <p className="text-[11.5px] text-faint">
            Hecho cuenta cada serie registrada; un ejercicio marcado como hecho sin series registradas cuenta sus series
            asignadas.
          </p>
        </div>
      </div>
    </Card>
  );
}
