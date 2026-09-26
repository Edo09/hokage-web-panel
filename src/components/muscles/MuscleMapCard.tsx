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
 * Three colours, one question each: is the group assigned this week, and
 * has the client worked it? Worked (any set) wins over assigned. Red is the
 * same "trained" red the client sees in the app's Progreso heat map.
 */
type MapColor = 'unassigned' | 'assigned' | 'worked';

const MAP: Record<MapColor, { color: string; label: string }> = {
  unassigned: { color: 'hsl(var(--border-strong))', label: 'Sin asignar' },
  assigned: { color: 'hsl(var(--secondary))', label: 'Asignado, sin trabajar' },
  worked: { color: 'hsl(var(--primary))', label: 'Trabajado' },
};

const mapColorOf = (assigned: number, done: number): MapColor =>
  done > 0 ? 'worked' : assigned > 0 ? 'assigned' : 'unassigned';

type WeekStatus = 'past' | 'current' | 'future';

/** How far along a group is, in words, for the list (the figure only says
 *  worked or not). "Se quedó corto" only once the week is over. */
function progressText(assigned: number, done: number, week: WeekStatus): string {
  if (week === 'future') return 'Por hacer';
  if (assigned === 0) return 'Extra, no asignado';
  if (done >= assigned) return 'Completado';
  if (done === 0) return week === 'past' ? 'No lo trabajó' : 'Sin trabajar';
  return week === 'past' && done < 0.5 * assigned ? 'Se quedó corto' : 'A medias';
}

const series = (n: number) => `${n} ${n === 1 ? 'serie' : 'series'}`;

/**
 * The client's muscles for one week of their active program. Each muscle's
 * colour says whether it's assigned that week and whether they've worked it
 * (see MAP); the list beside the figures names every group with its sets
 * and how far along it is.
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
  const color = (g: MuscleGroup) => mapColorOf(a(g), d(g));
  const rows = GROUP_ORDER.filter((g) => a(g) > 0 || d(g) > 0);
  const totalA = rows.reduce((s, g) => s + a(g), 0);
  const totalD = rows.reduce((s, g) => s + d(g), 0);

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
                fillFor={(g) => MAP[color(g)].color}
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
                          <span className="h-3 w-3 flex-none" style={{ background: MAP[color(g)].color }} aria-hidden="true" />
                          {GROUP_LABEL[g]}
                        </button>
                      </td>
                      <td className="py-2 text-right tabular-nums">{a(g)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {weekStatus === 'future' ? '—' : d(g)}
                      </td>
                      <td className="py-2 pl-4 text-[12px] text-muted-foreground">
                        {progressText(a(g), d(g), weekStatus)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Legend: what each colour means */}
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
            {(Object.keys(MAP) as MapColor[]).map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className="h-3 w-3 flex-none" style={{ background: MAP[c].color }} aria-hidden="true" />
                {MAP[c].label}
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
