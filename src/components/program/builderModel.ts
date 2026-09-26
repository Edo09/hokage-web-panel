/**
 * Program builder model — shared by the workspace builder (ProgramWorkspace)
 * and the deprecated wizard (LegacyProgramBuilder). Row models are all
 * strings while editing; they're parsed and validated at save time.
 */
import type { LoadQualitative, ProgramStatus, ProgramWithDetail, WeekOverride } from '@/types';
import type { ProgramDayInput, SaveProgramInput } from '@/services/programs';

/* Stored lowercase English; UI shows Spanish. '' = "Día N" only (no weekday). */
export const WEEKDAYS: { value: string; label: string }[] = [
  { value: '', label: 'Sin día fijo' },
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];
export const weekdayLabel = (v: string): string => WEEKDAYS.find((w) => w.value === v)?.label ?? '';

export const STATUSES: { value: ProgramStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
];

export const LOAD_QUAL: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'light', label: 'Ligero' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'heavy', label: 'Pesado' },
];
export const loadQualLabel = (v: string): string => LOAD_QUAL.find((l) => l.value === v)?.label ?? '';

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const toInt = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : null;
};
export const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
// New client programs default to starting tomorrow: the write-time trigger
// rejects a start_date before the server's current_date, and a same-day
// default can land in the past across the UTC boundary.
export const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const rangeText = (min: string, max: string): string => {
  const a = min.trim();
  const b = max.trim();
  if (a && b) return a === b ? a : `${a}–${b}`;
  return a || b || '—';
};

/* ---- builder row models (all strings; parsed at submit) ---- */
export interface ExRow {
  /** DB id of a row loaded from an existing program — sent back on save so
   *  the RPC updates it in place and the client's logged sets stay attached.
   *  Absent on rows added in the builder. */
  id?: string;
  /** The catalog link and name the row was loaded with. While the name is
   *  unchanged the link is kept as-is on save, instead of re-resolving the
   *  name — which would drop the link if the catalog failed to load. */
  loadedExerciseId?: string | null;
  loadedName?: string;
  name: string;
  sets: string;
  repMin: string;
  repMax: string;
  unilateral: boolean;
  rirMin: string;
  rirMax: string;
  loadPct: string;
  loadQual: string;
  tempo: string;
  rest: string;
  notes: string;
  /** UI-only: whether the row's advanced disclosure is expanded. Not sent. */
  advOpen: boolean;
  /** Superset letter ('' = straight set). Optional: drafts saved before
   *  supersets existed don't carry it. */
  superset?: string;
  /** This exercise's own values for specific weeks, keyed by week number. */
  overrides?: Record<string, OverrideRow>;
}

/** One week's override for one exercise, as typed ('' = not overridden). */
export interface OverrideRow {
  sets: string;
  repMin: string;
  repMax: string;
  rirMin: string;
  rirMax: string;
  loadPct: string;
}
export const emptyOverride = (): OverrideRow => ({ sets: '', repMin: '', repMax: '', rirMin: '', rirMax: '', loadPct: '' });
export const overrideHasData = (o: OverrideRow | undefined): boolean =>
  !!o && Object.values(o).some((v) => v.trim() !== '');
/** Week numbers (ascending) this row overrides, within the block. */
export const overriddenWeeks = (x: ExRow, weeks: number): number[] =>
  Object.entries(x.overrides ?? {})
    .filter(([w, o]) => overrideHasData(o) && Number(w) >= 1 && Number(w) <= weeks)
    .map(([w]) => Number(w))
    .sort((a, b) => a - b);
export const SUPERSET_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export interface DayRow {
  /** DB id when loaded from an existing program (see ExRow.id). */
  id?: string;
  label: string;
  weekday: string;
  exercises: ExRow[];
}
export interface WeekRow {
  label: string;
  rirMin: string;
  rirMax: string;
  loadMin: string;
  loadMax: string;
  isDeload: boolean;
  setsOverride: string;
  notes: string;
}

export const emptyEx = (): ExRow => ({
  name: '',
  sets: '4',
  repMin: '8',
  repMax: '12',
  unilateral: false,
  rirMin: '',
  rirMax: '',
  loadPct: '',
  loadQual: '',
  tempo: '',
  rest: '90',
  notes: '',
  advOpen: false,
  superset: '',
  overrides: {},
});
export const emptyDay = (): DayRow => ({ label: '', weekday: '', exercises: [emptyEx()] });
export const emptyWeek = (): WeekRow => ({
  label: '',
  rirMin: '',
  rirMax: '',
  loadMin: '',
  loadMax: '',
  isDeload: false,
  setsOverride: '',
  notes: '',
});

export const resizeWeeks = (prev: WeekRow[], n: number): WeekRow[] => {
  if (prev.length === n) return prev;
  if (prev.length < n) return [...prev, ...Array.from({ length: n - prev.length }, emptyWeek)];
  return prev.slice(0, n);
};

/** A short one-liner of a row's extra prescription for the review step. */
export const exExtras = (x: ExRow): string => {
  const parts: string[] = [];
  if (x.loadQual) parts.push(loadQualLabel(x.loadQual));
  if (x.loadPct.trim()) parts.push(`${x.loadPct}% 1RM`);
  const rir = rangeText(x.rirMin, x.rirMax);
  if (rir !== '—') parts.push(`RIR ${rir}`);
  if (x.unilateral) parts.push('por lado');
  if (x.rest.trim()) parts.push(`desc. ${x.rest}s`);
  return parts.join(' · ');
};
/** What's set behind a collapsed "Avanzado" — shown next to the toggle so
 *  configured values are never invisible. */
export const advSummary = (x: ExRow): string => {
  const parts: string[] = [];
  const rir = rangeText(x.rirMin, x.rirMax);
  if (rir !== '—') parts.push(`RIR ${rir}`);
  if (x.loadPct.trim()) parts.push(`${x.loadPct}% 1RM`);
  if (x.tempo.trim()) parts.push(`tempo ${x.tempo.trim()}`);
  if (x.unilateral) parts.push('por lado');
  if (x.notes.trim()) parts.push('con nota');
  return parts.join(' · ');
};

/** Everything the builder needs to restore itself from localStorage. */
export interface DraftData {
  name: string;
  focus: string;
  description: string;
  durationWeeks: string;
  startDate: string;
  status: ProgramStatus;
  progressionRule: string;
  tempoDefault: string;
  notes: string;
  days: DayRow[];
  weeks: WeekRow[];
}

/**
 * Mirrors every CHECK constraint in 20260717120000_coach_programs.sql. Without
 * this the DB rejects the whole save and the coach only learns something was
 * wrong — not which field. Returns the step to jump to plus the message.
 *
 * Keep in sync with the migration: sets 1–20, reps 1–100, RIR 0–10,
 * %1RM 1–100, rest 0–900, and min ≤ max on reps and RIR.
 */
export const checkRange = (
  raw: string,
  lo: number,
  hi: number,
  label: string,
): string | null => {
  const v = toInt(raw);
  if (v == null) return null; // empty is allowed — it's stored as null
  return v < lo || v > hi ? `${label} debe estar entre ${lo} y ${hi}.` : null;
};

export interface ProgramInvalid {
  /** Legacy wizard step: 1 = días y ejercicios, 2 = periodización. */
  step: 1 | 2;
  message: string;
  dayIndex?: number;
  weekIndex?: number;
}

export function validateProgram(days: DayRow[], weeks: WeekRow[]): ProgramInvalid | null {
  for (const [di, d] of days.entries()) {
    for (const [xi, x] of d.exercises.entries()) {
      if (!x.name.trim()) continue; // blank rows are dropped before saving
      const where = `Día ${di + 1}, ejercicio ${xi + 1}`;

      const sets = toInt(x.sets);
      if (sets != null && (sets < 1 || sets > 20)) {
        return { step: 1, dayIndex: di, message: `${where}: las series deben estar entre 1 y 20.` };
      }
      for (const [raw, label] of [
        [x.repMin, 'las repeticiones mínimas'],
        [x.repMax, 'las repeticiones máximas'],
      ] as const) {
        const err = checkRange(raw, 1, 100, label);
        if (err) return { step: 1, dayIndex: di, message: `${where}: ${err}` };
      }
      const repMin = toInt(x.repMin);
      const repMax = toInt(x.repMax);
      if (repMin != null && repMax != null && repMin > repMax) {
        return { step: 1, dayIndex: di, message: `${where}: las repeticiones van de menor a mayor (${repMin}–${repMax}).` };
      }

      for (const [raw, label] of [
        [x.rirMin, 'el RIR mínimo'],
        [x.rirMax, 'el RIR máximo'],
      ] as const) {
        const err = checkRange(raw, 0, 10, label);
        if (err) return { step: 1, dayIndex: di, message: `${where}: ${err}` };
      }
      const rirMin = toInt(x.rirMin);
      const rirMax = toInt(x.rirMax);
      if (rirMin != null && rirMax != null && rirMin > rirMax) {
        return { step: 1, dayIndex: di, message: `${where}: el RIR va de menor a mayor (${rirMin}–${rirMax}).` };
      }

      for (const [wk, o] of Object.entries(x.overrides ?? {})) {
        if (!overrideHasData(o)) continue;
        const at = `${where}, ajuste de la semana ${wk}`;
        for (const [raw, label, lo, hi] of [
          [o.sets, 'las series', 1, 20],
          [o.repMin, 'las repeticiones mínimas', 1, 100],
          [o.repMax, 'las repeticiones máximas', 1, 100],
          [o.rirMin, 'el RIR mínimo', 0, 10],
          [o.rirMax, 'el RIR máximo', 0, 10],
          [o.loadPct, 'el %1RM', 1, 100],
        ] as const) {
          const err = checkRange(raw, lo, hi, label);
          if (err) return { step: 1, dayIndex: di, message: `${at}: ${err}` };
        }
        const a = toInt(o.repMin);
        const b = toInt(o.repMax);
        if (a != null && b != null && a > b) return { step: 1, dayIndex: di, message: `${at}: las repeticiones van de menor a mayor.` };
        const c = toInt(o.rirMin);
        const e = toInt(o.rirMax);
        if (c != null && e != null && c > e) return { step: 1, dayIndex: di, message: `${at}: el RIR va de menor a mayor.` };
      }

      const pct = checkRange(x.loadPct, 1, 100, 'el %1RM');
      if (pct) return { step: 1, dayIndex: di, message: `${where}: ${pct}` };
      const rest = checkRange(x.rest, 0, 900, 'el descanso (en segundos)');
      if (rest) return { step: 1, dayIndex: di, message: `${where}: ${rest}` };
    }
  }

  for (const [wi, w] of weeks.entries()) {
    const where = `Semana ${wi + 1}`;
    for (const [raw, label, lo, hi] of [
      [w.rirMin, 'el RIR mínimo', 0, 10],
      [w.rirMax, 'el RIR máximo', 0, 10],
      [w.loadMin, 'el % de carga mínimo', 1, 100],
      [w.loadMax, 'el % de carga máximo', 1, 100],
      [w.setsOverride, 'las series', 1, 20],
    ] as const) {
      const err = checkRange(raw, lo, hi, label);
      if (err) return { step: 2, weekIndex: wi, message: `${where}: ${err}` };
    }
  }
  return null;
}

export const weekHasData = (w: WeekRow): boolean =>
  !!(w.label.trim() || w.rirMin || w.rirMax || w.loadMin || w.loadMax || w.isDeload || w.setsOverride || w.notes.trim());

/* ---- edit prefill ---- */
export const daysFrom = (p: ProgramWithDetail): DayRow[] =>
  p.program_days.length === 0
    ? [emptyDay()]
    : [...p.program_days]
        .sort((a, b) => a.day_index - b.day_index)
        .map((d) => ({
          id: d.id,
          label: d.label ?? '',
          weekday: d.weekday ?? '',
          exercises:
            d.program_exercises.length === 0
              ? [emptyEx()]
              : d.program_exercises.map((e) => ({
                  id: e.id,
                  loadedExerciseId: e.exercise_id,
                  loadedName: e.exercise?.name ?? e.custom_name ?? '',
                  name: e.exercise?.name ?? e.custom_name ?? '',
                  sets: String(e.sets),
                  repMin: e.rep_min != null ? String(e.rep_min) : '',
                  repMax: e.rep_max != null ? String(e.rep_max) : '',
                  unilateral: e.is_unilateral,
                  rirMin: e.rir_min != null ? String(e.rir_min) : '',
                  rirMax: e.rir_max != null ? String(e.rir_max) : '',
                  loadPct: e.load_pct_1rm != null ? String(e.load_pct_1rm) : '',
                  loadQual: e.load_qualitative ?? '',
                  tempo: e.tempo ?? '',
                  rest: e.rest_seconds != null ? String(e.rest_seconds) : '',
                  notes: e.notes ?? '',
                  superset: e.superset_group ?? '',
                  overrides: Object.fromEntries(
                    Object.entries(e.week_overrides ?? {}).map(([w, o]) => [
                      w,
                      {
                        sets: o.sets != null ? String(o.sets) : '',
                        repMin: o.rep_min != null ? String(o.rep_min) : '',
                        repMax: o.rep_max != null ? String(o.rep_max) : '',
                        rirMin: o.rir_min != null ? String(o.rir_min) : '',
                        rirMax: o.rir_max != null ? String(o.rir_max) : '',
                        loadPct: o.load_pct_1rm != null ? String(o.load_pct_1rm) : '',
                      },
                    ]),
                  ),
                  advOpen:
                    e.rir_min != null ||
                    e.rir_max != null ||
                    e.load_pct_1rm != null ||
                    e.is_unilateral ||
                    !!e.tempo ||
                    !!e.notes,
                })),
        }));
export const weeksFrom = (p: ProgramWithDetail): WeekRow[] => {
  const rows = [...p.program_weeks]
    .sort((a, b) => a.week_number - b.week_number)
    .map((w) => ({
      label: w.label ?? '',
      rirMin: w.rir_min != null ? String(w.rir_min) : '',
      rirMax: w.rir_max != null ? String(w.rir_max) : '',
      loadMin: w.load_pct_min != null ? String(w.load_pct_min) : '',
      loadMax: w.load_pct_max != null ? String(w.load_pct_max) : '',
      isDeload: w.is_deload,
      setsOverride: w.sets_override != null ? String(w.sets_override) : '',
      notes: w.notes ?? '',
    }));
  return resizeWeeks(rows, clamp(p.duration_weeks, 1, 52));
};

/* ---- save payload ---- */

/** Everything the header form holds, as typed. */
export interface HeaderFields {
  name: string;
  focus: string;
  description: string;
  durationWeeks: string;
  startDate: string;
  status: ProgramStatus;
  progressionRule: string;
  tempoDefault: string;
  notes: string;
}

/** Builds the save_coach_program payload from the builder rows. Blank rows are
 *  dropped, and a day left with no exercises is dropped with them.
 *  `resolveId` maps a typed name to its catalog id (null = custom movement). */
export function buildPayload(
  header: HeaderFields,
  days: DayRow[],
  weeks: WeekRow[],
  resolveId: (name: string) => string | null,
): SaveProgramInput {
  const outDays: ProgramDayInput[] = days
    .map((d, di) => ({
      id: d.id,
      day_index: di + 1,
      label: d.label.trim() || null,
      weekday: d.weekday || null,
      sort_order: di,
      exercises: d.exercises
        .filter((x) => x.name.trim())
        .map((x, xi) => {
          // A catalog-linked row whose name the coach didn't touch keeps its
          // link; everything else resolves by name (which also links a custom
          // movement once it exists in the catalog).
          const keptId = x.name.trim() === x.loadedName?.trim() ? (x.loadedExerciseId ?? null) : null;
          const exerciseId = keptId ?? resolveId(x.name.trim());
          return {
            id: x.id,
            exercise_id: exerciseId,
            custom_name: exerciseId ? null : x.name.trim(),
            sets: toInt(x.sets) ?? 3,
            rep_min: toInt(x.repMin),
            rep_max: toInt(x.repMax),
            is_unilateral: x.unilateral,
            rir_min: toInt(x.rirMin),
            rir_max: toInt(x.rirMax),
            load_pct_1rm: toInt(x.loadPct),
            load_qualitative: (x.loadQual || null) as LoadQualitative | null,
            tempo: x.tempo.trim() || null,
            rest_seconds: toInt(x.rest),
            notes: x.notes.trim() || null,
            sort_order: xi,
            superset_group: x.superset?.trim() || null,
            week_overrides: overridesPayload(x, clamp(parseInt(header.durationWeeks, 10) || 1, 1, 52)),
          };
        }),
    }))
    .filter((d) => d.exercises.length > 0);

  return {
    name: header.name.trim(),
    description: header.description.trim() || null,
    focus: header.focus.trim() || null,
    duration_weeks: clamp(parseInt(header.durationWeeks, 10) || 1, 1, 52),
    start_date: header.startDate,
    status: header.status,
    progression_rule: header.progressionRule.trim() || null,
    tempo_default: header.tempoDefault.trim() || null,
    notes: header.notes.trim() || null,
    days: outDays,
    weeks: weeks.map((w, wi) => ({
      week_number: wi + 1,
      label: w.label.trim() || null,
      rir_min: toInt(w.rirMin),
      rir_max: toInt(w.rirMax),
      load_pct_min: toInt(w.loadMin),
      load_pct_max: toInt(w.loadMax),
      is_deload: w.isDeload,
      sets_override: toInt(w.setsOverride),
      notes: w.notes.trim() || null,
    })),
  };
}

/** Typed overrides → stored jsonb: only weeks inside the block, only the
 *  fields the coach filled in. */
function overridesPayload(x: ExRow, weeks: number): Record<string, WeekOverride> {
  const out: Record<string, WeekOverride> = {};
  for (const w of overriddenWeeks(x, weeks)) {
    const o = x.overrides![String(w)];
    const v: WeekOverride = {};
    const set = (k: keyof WeekOverride, raw: string) => {
      const n = toInt(raw);
      if (n != null) v[k] = n;
    };
    set('sets', o.sets);
    set('rep_min', o.repMin);
    set('rep_max', o.repMax);
    set('rir_min', o.rirMin);
    set('rir_max', o.rirMax);
    set('load_pct_1rm', o.loadPct);
    if (Object.keys(v).length > 0) out[String(w)] = v;
  }
  return out;
}

/* ---- catalog body parts (stored in English by the seed) ---- */
const BODY_PART_ES: Record<string, string> = {
  back: 'Espalda',
  cardio: 'Cardio',
  chest: 'Pecho',
  'lower arms': 'Antebrazos',
  'lower legs': 'Pantorrillas',
  neck: 'Cuello',
  shoulders: 'Hombros',
  'upper arms': 'Brazos',
  'upper legs': 'Piernas',
  waist: 'Core',
};
export const bodyPartLabel = (name: string | null | undefined): string =>
  name ? (BODY_PART_ES[name.trim().toLowerCase()] ?? name) : 'Otros';
