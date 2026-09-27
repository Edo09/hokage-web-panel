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
  isWeakGroup,
  programWeekNow,
  volumeSets,
  type MuscleGroup,
} from '@/lib/muscleMap';

/**
 * Semana: three colours, one question each: is the group assigned that week,
 * and has the client worked it? Worked (any set) wins over assigned. Red is
 * the same "trained" red the client sees in the app's Progreso heat map.
 */
type MapColor = 'unassigned' | 'assigned' | 'worked';

const MAP: Record<MapColor, { color: string; label: string }> = {
  unassigned: { color: 'hsl(var(--border-strong))', label: 'Sin asignar' },
  assigned: { color: 'hsl(var(--secondary))', label: 'Asignado, sin trabajar' },
  worked: { color: 'hsl(var(--primary))', label: 'Trabajado' },
};

const mapColorOf = (assigned: number, done: number): MapColor =>
  done > 0 ? 'worked' : assigned > 0 ? 'assigned' : 'unassigned';

/** Volumen: no sets, then three steps of that red by share of the busiest
 *  group; amber = poco trabajado. Same scale as the app's Volumen view. */
const HEAT = [
  'hsl(var(--border-strong))',
  'hsl(var(--primary) / 0.38)',
  'hsl(var(--primary) / 0.68)',
  'hsl(var(--primary))',
];
const WEAK = 'hsl(var(--warning))';

type View = 'week' | 'volume';
type Days = 14 | 30;

// The coach's last view and period, remembered in this browser.
const VIEW_KEY = 'hokage:muscle-map-view';
const DAYS_KEY = 'hokage:muscle-map-days';

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice still applies until the page reloads
  }
}

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
 * The client's muscles, in one of two views the coach switches between (the
 * last one is remembered):
 *  - Semana: one week of the active program. Each muscle's colour says
 *    whether it's assigned that week and whether they've worked it (MAP);
 *    the list names every group with its sets and how far along it is.
 *  - Volumen: sets per group over the last 14 or 30 days, from everything
 *    they trained, as a heat map; amber flags a group far behind the rest.
 * Without an active program only Volumen exists. Hovering a muscle or a row
 * describes it; clicking picks it, fading the rest.
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
  const [view, setViewState] = useState<View | null>(() => {
    const stored = readPref(VIEW_KEY);
    return stored === 'week' || stored === 'volume' ? stored : null;
  });
  const [days, setDaysState] = useState<Days>(() => (readPref(DAYS_KEY) === '30' ? 30 : 14));
  const week = pickedWeek != null && program && pickedWeek <= program.duration_weeks ? pickedWeek : (now?.week ?? 1);

  const assigned = useMemo(() => (program ? assignedSets(program, week) : new Map()), [program, week]);
  const done = useMemo(
    () => (program ? doneSets(program, week, logs.data ?? [], completions.data ?? []) : new Map()),
    [program, week, logs.data, completions.data],
  );
  const volume = useMemo(
    () =>
      volumeSets(
        {
          programs: programs.data ?? [],
          logs: logs.data ?? [],
          completions: completions.data ?? [],
          routines: client.routines,
          routineLogs: client.logs,
        },
        days,
      ),
    [programs.data, logs.data, completions.data, client.routines, client.logs, days],
  );

  const setView = (v: View) => {
    setViewState(v);
    writePref(VIEW_KEY, v);
  };
  const setDays = (d: Days) => {
    setDaysState(d);
    writePref(DAYS_KEY, String(d));
  };

  const firstName = (client.display_name ?? client.email).split(' ')[0];

  if (programs.isPending || (!program && (logs.isPending || completions.isPending))) {
    return (
      <Card className="p-5">
        <div className="text-[13px] text-faint">Cargando músculos…</div>
      </Card>
    );
  }
  const trainedEver = (logs.data?.length ?? 0) + (completions.data?.length ?? 0) + client.logs.length > 0;
  if (!program && !trainedEver) {
    return (
      <Card className="p-5">
        <h2 className="font-heading text-[18px]">Músculos</h2>
        <p className="mt-1 text-[12.5px] text-faint">
          {firstName} no tiene un programa activo ni entrenos registrados. Asígnale uno para ver qué músculos le toca
          trabajar y cuáles ha trabajado.
        </p>
      </Card>
    );
  }

  // The last view picked; Semana until the coach chooses, when there's a
  // program to show.
  const mode: View = program && now ? (view ?? 'week') : 'volume';
  const gender = client.sex === 'female' ? 'female' : 'male';
  const pick = (g: MuscleGroup | null) => setSelected((cur) => (g == null || g === cur ? null : g));
  const focus = hovered ?? selected;

  // Semana
  const weekStatus: WeekStatus = !now
    ? 'current'
    : now.finished || week < now.week
      ? 'past'
      : week === now.week && !now.notStarted
        ? 'current'
        : 'future';
  const a = (g: MuscleGroup) => assigned.get(g) ?? 0;
  const d = (g: MuscleGroup) => done.get(g) ?? 0;
  const color = (g: MuscleGroup) => mapColorOf(a(g), d(g));
  const weekRows = GROUP_ORDER.filter((g) => a(g) > 0 || d(g) > 0);
  const totalA = weekRows.reduce((s, g) => s + a(g), 0);
  const totalD = weekRows.reduce((s, g) => s + d(g), 0);

  const describeWeek = (g: MuscleGroup) => {
    if (a(g) === 0 && d(g) === 0) return `${GROUP_LABEL[g]}: no asignado esta semana.`;
    if (a(g) === 0) return `${GROUP_LABEL[g]}: no asignado, pero hizo ${series(d(g))}.`;
    if (weekStatus === 'future') return `${GROUP_LABEL[g]}: ${series(a(g))} asignadas.`;
    return `${GROUP_LABEL[g]}: ${d(g)} de ${series(a(g))} hechas (${Math.round((d(g) / a(g)) * 100)}%).`;
  };

  // Volumen: every drawn group (an untrained one shows as 0), "other" only
  // when it has sets; busiest first, "other" last.
  const v = (g: MuscleGroup) => volume.get(g) ?? 0;
  const volRows = GROUP_ORDER.filter((g) => g !== 'other' || v(g) > 0).sort((x, y) =>
    x === 'other' ? 1 : y === 'other' ? -1 : v(y) - v(x),
  );
  const maxV = Math.max(1, ...volRows.map(v));
  const top = volRows.reduce((best, g) => (v(g) > v(best) ? g : best), volRows[0]);
  const totalV = volRows.reduce((s, g) => s + v(g), 0);
  const anyWeak = volRows.some((g) => isWeakGroup(g, v(g), maxV));

  const volumeFill = (g: MuscleGroup) => {
    const sets = v(g);
    if (sets === 0) return HEAT[0];
    if (isWeakGroup(g, sets, maxV)) return WEAK;
    const share = sets / maxV;
    return HEAT[share > 2 / 3 ? 3 : share > 1 / 3 ? 2 : 1];
  };

  const describeVolume = (g: MuscleGroup) => {
    const sets = v(g);
    if (sets === 0) return `${GROUP_LABEL[g]}: sin series en los últimos ${days} días.`;
    if (g === top) return `${GROUP_LABEL[g]}: ${series(sets)} en ${days} días, el grupo más trabajado.`;
    const vsTop = `${GROUP_LABEL[top]} (${series(maxV)})`;
    if (isWeakGroup(g, sets, maxV)) return `${GROUP_LABEL[g]}: ${series(sets)} en ${days} días, poco frente a ${vsTop}.`;
    return `${GROUP_LABEL[g]}: ${series(sets)} en ${days} días, ${Math.round((sets / maxV) * 100)}% de ${vsTop}.`;
  };

  const fillFor = (g: MuscleGroup) => (mode === 'week' ? MAP[color(g)].color : volumeFill(g));
  const statusLabel = { past: 'Semana terminada', current: 'Semana en curso', future: 'Aún no empieza' }[weekStatus];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[18px]">Músculos</h2>
          <p className="mt-0.5 text-[12.5px] text-faint">
            {mode === 'week' && program ? (
              <>
                Semana {week} de {program.duration_weeks} de {program.name}.{' '}
                <span className={cn('font-semibold', weekStatus === 'current' ? 'text-primary' : 'text-muted-foreground')}>
                  {statusLabel}
                </span>
              </>
            ) : (
              <>
                Series por grupo en los últimos {days} días, con todo lo que ha entrenado.
                {!program && ` ${firstName} no tiene un programa activo.`}
              </>
            )}
          </p>
        </div>
        {program && now && (
          <Segmented
            label="Vista del mapa"
            options={[
              { value: 'week', label: 'Semana' },
              { value: 'volume', label: 'Volumen' },
            ]}
            value={mode}
            onChange={setView}
          />
        )}
      </div>

      <div className="mt-3">
        {mode === 'week' && program && now ? (
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
                    {n === now.week && !now.notStarted && !now.finished ? 'Actual' : meta?.is_deload ? 'Descarga' : ' '}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Segmented
            label="Periodo"
            options={[
              { value: 14, label: '14 días' },
              { value: 30, label: '30 días' },
            ]}
            value={days}
            onChange={setDays}
            className="w-fit"
          />
        )}
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
                fillFor={fillFor}
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
        {mode === 'week' ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <p className="text-[15px] font-bold tabular-nums">
                {weekStatus === 'future' ? `${series(totalA)} asignadas` : `${totalD} de ${series(totalA)} hechas`}
                {weekStatus !== 'future' && totalA > 0 && (
                  <span className="ml-1.5 font-semibold text-muted-foreground">
                    ({Math.round((totalD / totalA) * 100)}%)
                  </span>
                )}
              </p>
              {/* What's under the pointer, else what's picked */}
              <p className="min-h-[1.25rem] text-[12.5px] text-muted-foreground" aria-live="polite">
                {focus != null
                  ? describeWeek(focus)
                  : 'Pasa el cursor por un músculo para ver sus series, o haz clic para resaltarlo.'}
              </p>
            </div>

            {weekRows.length === 0 ? (
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
                  {weekRows.map((g) => (
                    <GroupRow
                      key={g}
                      group={g}
                      swatch={MAP[color(g)].color}
                      selected={selected}
                      onHover={setHovered}
                      onPick={pick}
                    >
                      <td className="py-2 text-right tabular-nums">{a(g)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{weekStatus === 'future' ? '—' : d(g)}</td>
                      <td className="py-2 pl-4 text-[12px] text-muted-foreground">
                        {progressText(a(g), d(g), weekStatus)}
                      </td>
                    </GroupRow>
                  ))}
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
              Hecho cuenta cada serie registrada; un ejercicio marcado como hecho sin series registradas cuenta sus
              series asignadas.
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <p className="text-[15px] font-bold tabular-nums">
                {series(totalV)} en {days} días
              </p>
              <p className="min-h-[1.25rem] text-[12.5px] text-muted-foreground" aria-live="polite">
                {focus != null
                  ? describeVolume(focus)
                  : 'Pasa el cursor por un músculo para ver sus series, o haz clic para resaltarlo.'}
              </p>
            </div>

            {totalV === 0 ? (
              <p className="text-[12.5px] text-faint">
                {firstName} no ha entrenado en los últimos {days} días.
              </p>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[11px] text-faint">
                    <th className="pb-1.5 font-semibold">Grupo</th>
                    <th className="pb-1.5 text-right font-semibold">Series</th>
                    <th className="w-1/2 pb-1.5 pl-4 font-semibold">
                      <span className="sr-only">Frente al grupo con más series</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {volRows.map((g) => {
                    const sets = v(g);
                    return (
                      <GroupRow
                        key={g}
                        group={g}
                        swatch={volumeFill(g)}
                        selected={selected}
                        onHover={setHovered}
                        onPick={pick}
                      >
                        <td className="py-2 text-right font-semibold tabular-nums">{sets}</td>
                        <td className="py-2 pl-4">
                          <div className="h-2 w-full bg-muted" aria-hidden="true">
                            {sets > 0 && (
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.max(3, (sets / maxV) * 100)}%`,
                                  background: isWeakGroup(g, sets, maxV) ? WEAK : 'hsl(var(--primary))',
                                }}
                              />
                            )}
                          </div>
                        </td>
                      </GroupRow>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Legend: the heat steps, and amber when a group is flagged */}
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                Menos
                {HEAT.map((c) => (
                  <span key={c} className="h-3 w-3 flex-none" style={{ background: c }} aria-hidden="true" />
                ))}
                Más
              </li>
              {anyWeak && (
                <li className="flex items-center gap-1.5">
                  <span className="h-3 w-3 flex-none" style={{ background: WEAK }} aria-hidden="true" />
                  Poco trabajado (menos de un cuarto del grupo con más series)
                </li>
              )}
            </ul>
            <p className="text-[11.5px] text-faint">
              Suma sus programas y rutinas: cada serie registrada cuenta una; un ejercicio marcado como hecho sin series
              registradas cuenta sus series asignadas.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

/** A table row for one group: its colour and name (click picks it), then
 *  the view's own cells. */
function GroupRow({
  group,
  swatch,
  selected,
  onHover,
  onPick,
  children,
}: {
  group: MuscleGroup;
  swatch: string;
  selected: MuscleGroup | null;
  onHover: (g: MuscleGroup | null) => void;
  onPick: (g: MuscleGroup) => void;
  children: React.ReactNode;
}) {
  const active = selected === group;
  return (
    <tr
      onMouseEnter={() => onHover(group)}
      onMouseLeave={() => onHover(null)}
      className={cn('border-t border-border transition-opacity', selected != null && !active && 'opacity-50')}
    >
      <td className="py-2">
        <button
          type="button"
          onClick={() => onPick(group)}
          aria-pressed={active}
          className={cn(
            'flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'font-bold' : 'font-medium',
          )}
        >
          <span className="h-3 w-3 flex-none" style={{ background: swatch }} aria-hidden="true" />
          {GROUP_LABEL[group]}
        </button>
      </td>
      {children}
    </tr>
  );
}

/** Two or three mutually exclusive options, styled like Settings' pickers. */
function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1 rounded-xl border border-border bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
