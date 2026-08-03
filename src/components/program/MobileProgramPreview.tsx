import { useState } from 'react';
import { range } from '@/components/program/previewModel';
import type { PreviewExercise, PreviewProgram } from '@/components/program/previewModel';

/**
 * "How will this look in the client's app?" — a faithful replica of the mobile
 * Programa screen, rendered from either a saved program or the builder's
 * unsaved draft.
 *
 * FIDELITY RULES (mirrored from the app's utils/program.ts effectivePrescription
 * — keep in sync if that changes):
 *   - the ONLY thing a week modulates per row is `sets_override` (deload);
 *   - the week's global RIR / %load is shown ONCE in the week summary, never
 *     repeated on each exercise row;
 *   - a row shows only the exercise's OWN pinned %1RM or qualitative load.
 *
 * Colours are hard-coded to the app's dark palette on purpose: this simulates a
 * device, so it must not follow the panel's light/dark theme.
 */

const APP = {
  bg: '#0E1116',
  surface: '#171B22',
  elevated: '#1E242D',
  border: '#2A313B',
  primary: '#E5484D',
  primarySoft: 'rgba(229,72,77,0.14)',
  text: '#ECEEF1',
  secondary: '#C2C8D2',
  tertiary: '#9AA4B2',
  muted: '#6B727E',
  info: '#5B9DF9',
  infoSoft: 'rgba(91,157,249,0.14)',
  accent: '#F0B23A',
  accentSoft: 'rgba(240,178,58,0.14)',
  warn: '#F0B23A',
  warnSoft: 'rgba(240,178,58,0.14)',
};

const WEEKDAY_ES: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};
const LOAD_QUAL_ES: Record<string, string> = {
  light: 'ligero',
  moderate: 'moderado',
  heavy: 'pesado',
};
const IS_IMG = /\.(gif|apng|webp|png|jpe?g)$/i;

/* ---------------- the phone ---------------- */

export function MobileProgramPreview({ program }: { program: PreviewProgram }) {
  const [week, setWeek] = useState(1);
  const w = program.weeks.find((x) => x.number === week) ?? null;
  const weekNumbers = Array.from({ length: Math.max(1, program.durationWeeks) }, (_, i) => i + 1);

  const startLabel = (() => {
    const [y, m, d] = program.startDate.split('-').map(Number);
    if (!y || !m || !d) return program.startDate;
    return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  })();

  return (
    <div className="mx-auto w-[336px] flex-none">
      {/* device shell */}
      <div
        className="overflow-hidden rounded-[34px] border-[9px] shadow-2xl"
        style={{ borderColor: '#23262C', background: APP.bg }}
      >
        {/* status bar / notch */}
        <div
          className="flex items-center justify-center py-1.5"
          style={{ background: APP.bg }}
        >
          <span className="h-1 w-16 rounded-full" style={{ background: '#2E3440' }} />
        </div>

        <div className="h-[560px] overflow-y-auto px-3 pb-4" style={{ background: APP.bg }}>
          {/* program header card */}
          <Panel accent>
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-[11px]"
                style={{ background: APP.primarySoft, color: APP.primary }}
              >
                ★
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: APP.text }}>
                {program.name}
              </span>
              <span
                className="flex-none text-[9px] font-bold tracking-widest"
                style={{ color: APP.primary }}
              >
                COACH
              </span>
            </div>
            {program.focus && (
              <p className="mt-1.5 text-[12px]" style={{ color: APP.secondary }}>
                {program.focus}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: APP.tertiary }}>
              <span>▦ Bloque de {program.durationWeeks} semanas</span>
              <span>⚑ Empieza {startLabel}</span>
            </div>
          </Panel>

          {/* week navigator */}
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {weekNumbers.map((n) => {
              const active = n === week;
              const label = program.weeks.find((x) => x.number === n)?.label;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWeek(n)}
                  className="flex min-w-[62px] flex-none flex-col items-center rounded-xl border px-2 py-1.5"
                  style={{
                    background: active ? APP.primary : APP.surface,
                    borderColor: active ? APP.primary : APP.border,
                  }}
                >
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: active ? '#fff' : APP.secondary }}
                  >
                    Sem {n}
                  </span>
                  {n === 1 ? (
                    <span
                      className="text-[8px] font-semibold"
                      style={{ color: active ? 'rgba(255,255,255,.9)' : APP.primary }}
                    >
                      Actual
                    </span>
                  ) : (
                    label && (
                      <span
                        className="max-w-[62px] truncate text-[8px]"
                        style={{ color: active ? 'rgba(255,255,255,.8)' : APP.muted }}
                      >
                        {label}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>

          {/* week summary — where the week's global RIR / %load lives */}
          {w != null && (
            <Panel className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold" style={{ color: APP.text }}>
                  {w.label ?? `Semana ${w.number}`}
                </span>
                {w.isDeload && (
                  <span
                    className="rounded-full px-2 py-[1px] text-[10px] font-semibold"
                    style={{ background: APP.warnSoft, color: APP.warn }}
                  >
                    Descarga
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: APP.secondary }}>
                {(w.rirMin != null || w.rirMax != null) && <span>RIR {range(w.rirMin, w.rirMax)}</span>}
                {(w.loadMin != null || w.loadMax != null) && (
                  <span>Carga {range(w.loadMin, w.loadMax)}%</span>
                )}
                {w.setsOverride != null && <span>{w.setsOverride} series esta semana</span>}
              </div>
              {w.notes && (
                <p className="mt-1 text-[11px]" style={{ color: APP.tertiary }}>
                  {w.notes}
                </p>
              )}
            </Panel>
          )}

          {/* days */}
          {program.days.length === 0 ? (
            <Panel className="mt-2.5">
              <p className="py-3 text-center text-[12px]" style={{ color: APP.muted }}>
                Añade días y ejercicios para verlos aquí.
              </p>
            </Panel>
          ) : (
            program.days.map((d) => (
              <Panel key={d.index} className="mt-2.5">
                <div className="flex items-start justify-between gap-2 pb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold" style={{ color: APP.primary }}>
                        DÍA {d.index}
                      </span>
                      {d.weekday && (
                        <span
                          className="text-[9px] font-medium uppercase tracking-wider"
                          style={{ color: APP.muted }}
                        >
                          {WEEKDAY_ES[d.weekday] ?? d.weekday}
                        </span>
                      )}
                    </div>
                    {d.label && (
                      <div className="pt-0.5 text-[14px] font-bold" style={{ color: APP.text }}>
                        {d.label}
                      </div>
                    )}
                  </div>
                  <span
                    className="flex-none rounded-full px-2 py-[2px] text-[10px] font-bold"
                    style={{ background: APP.elevated, color: APP.tertiary }}
                  >
                    0/{d.exercises.length}
                  </span>
                </div>

                {d.exercises.map((ex, i) => (
                  <ExRowPreview
                    key={i}
                    ex={ex}
                    setsOverride={w?.setsOverride ?? null}
                    first={i === 0}
                  />
                ))}
              </Panel>
            ))
          )}

          {/* coach notes */}
          {(program.progressionRule || program.tempoDefault || program.notes) && (
            <Panel className="mt-2.5">
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: APP.tertiary }}
              >
                Notas del coach
              </div>
              <div className="mt-1.5 flex flex-col gap-1 text-[11px]" style={{ color: APP.secondary }}>
                {program.tempoDefault && (
                  <p>
                    <b style={{ color: APP.text }}>Tempo:</b> {program.tempoDefault}
                  </p>
                )}
                {program.progressionRule && (
                  <p>
                    <b style={{ color: APP.text }}>Progresión:</b> {program.progressionRule}
                  </p>
                )}
                {program.notes && (
                  <p>
                    <b style={{ color: APP.text }}>Notas:</b> {program.notes}
                  </p>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({
  children,
  className = '',
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${className}`}
      style={{
        background: APP.surface,
        borderColor: accent ? 'rgba(229,72,77,0.35)' : APP.border,
      }}
    >
      {children}
    </div>
  );
}

function ExRowPreview({
  ex,
  setsOverride,
  first,
}: {
  ex: PreviewExercise;
  setsOverride: number | null;
  first: boolean;
}) {
  // Only the set count is modulated by the week (deload) — see fidelity note.
  const sets = setsOverride ?? ex.sets;
  const reps = range(ex.repMin, ex.repMax);
  const setsReps = ex.unilateral ? `${sets} × ${reps} / lado` : `${sets} × ${reps}`;
  const rir = range(ex.rirMin, ex.rirMax);
  const isGif = ex.videoUrl != null && IS_IMG.test(ex.videoUrl.split('?')[0]);

  return (
    <div
      className="flex items-start gap-2.5 py-2"
      style={first ? undefined : { borderTop: `1px solid ${APP.border}` }}
    >
      {isGif ? (
        <img
          src={ex.videoUrl!}
          alt=""
          loading="lazy"
          className="h-14 w-14 flex-none rounded-lg object-cover"
          style={{ background: APP.bg }}
        />
      ) : (
        <span
          className="flex h-14 w-14 flex-none items-center justify-center rounded-lg text-[15px]"
          style={{ background: APP.bg, color: APP.muted }}
        >
          ⛊
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold" style={{ color: APP.text }}>
          {ex.name}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium tabular-nums" style={{ color: APP.secondary }}>
            {setsReps}
          </span>
          {ex.loadPct != null && (
            <Tag bg={APP.infoSoft} fg={APP.info}>
              {ex.loadPct}%
            </Tag>
          )}
          {ex.loadPct == null && ex.loadQual && (
            <Tag bg={APP.elevated} fg={APP.tertiary}>
              {LOAD_QUAL_ES[ex.loadQual] ?? ex.loadQual}
            </Tag>
          )}
          {rir !== '—' && (
            <Tag bg={APP.accentSoft} fg={APP.accent}>
              RIR {rir}
            </Tag>
          )}
        </div>
        {(ex.tempo || ex.rest != null || ex.notes) && (
          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px]" style={{ color: APP.muted }}>
            {ex.tempo && <span>Tempo {ex.tempo}</span>}
            {ex.rest != null && <span>{ex.rest}s descanso</span>}
            {ex.notes && <span>{ex.notes}</span>}
          </div>
        )}
      </div>

      <span
        className="mt-0.5 h-5 w-5 flex-none rounded-full border-2"
        style={{ borderColor: APP.border }}
      />
    </div>
  );
}

function Tag({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      className="rounded-md px-1.5 py-[1px] text-[10px] font-semibold"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}
