/**
 * Builder draft ⇄ the JSON the generate-program Edge Function reads and
 * writes (hokage-coaching-app: supabase/functions/generate-program/prompt.ts).
 *
 * Model output is untrusted, so aiToDraft clamps every number to the ranges
 * validateProgram and the DB CHECKs enforce, drops exercises that aren't in
 * the catalog, and maps each kept `ref` back to the builder row it came from.
 * A kept row carries its DB id, so saving updates it in place and the
 * client's logged sets stay attached, exactly as a hand edit would.
 */
import type { LoadQualitative } from '@/types';
import {
  clamp,
  emptyWeek,
  overriddenWeeks,
  overrideHasData,
  SUPERSET_LETTERS,
  toInt,
  WEEKDAYS,
  type DayRow,
  type DraftData,
  type ExRow,
  type OverrideRow,
  type WeekRow,
} from '@/components/program/builderModel';

export interface AiOverride {
  week: number;
  sets?: number;
  rep_min?: number;
  rep_max?: number;
  rir_min?: number;
  rir_max?: number;
  load_pct_1rm?: number;
}
export interface AiExercise {
  ref: string | null;
  name: string;
  superset: string | null;
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  is_unilateral: boolean;
  rir_min: number | null;
  rir_max: number | null;
  load_pct_1rm: number | null;
  load_qualitative: LoadQualitative | null;
  tempo: string | null;
  rest_seconds: number | null;
  notes: string | null;
  overrides: AiOverride[];
}
export interface AiDay {
  ref: string | null;
  label: string;
  weekday: string | null;
  exercises: AiExercise[];
}
export interface AiWeek {
  week_number: number;
  label: string | null;
  rir_min: number | null;
  rir_max: number | null;
  load_pct_min: number | null;
  load_pct_max: number | null;
  is_deload: boolean;
  sets_override: number | null;
  notes: string | null;
}
export interface AiProgram {
  name: string;
  focus: string | null;
  description: string | null;
  duration_weeks: number;
  progression_rule: string | null;
  tempo_default: string | null;
  notes: string | null;
  weeks: AiWeek[];
  days: AiDay[];
}

// Refs are positions in the draft the request was built from — stable for
// the one request/response round trip, which is all they need to be.
const dayRef = (di: number) => `d${di + 1}`;
const exRef = (di: number, xi: number) => `d${di + 1}e${xi + 1}`;

const weeksOf = (durationWeeks: string) => clamp(parseInt(durationWeeks, 10) || 1, 1, 52);

/** The builder's current draft as the model's `current_program`. */
export function draftToAi(d: DraftData): AiProgram {
  const weeksN = weeksOf(d.durationWeeks);
  return {
    name: d.name.trim(),
    focus: d.focus.trim() || null,
    description: d.description.trim() || null,
    duration_weeks: weeksN,
    progression_rule: d.progressionRule.trim() || null,
    tempo_default: d.tempoDefault.trim() || null,
    notes: d.notes.trim() || null,
    weeks: d.weeks.slice(0, weeksN).map((w, wi) => ({
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
    days: d.days
      .map((day, di) => ({
        ref: dayRef(di),
        label: day.label.trim(),
        weekday: day.weekday || null,
        exercises: day.exercises.flatMap((x, xi) =>
          x.name.trim()
            ? [
                {
                  ref: exRef(di, xi),
                  name: x.name.trim(),
                  superset: x.superset?.trim() || null,
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
                  overrides: overriddenWeeks(x, weeksN).map((w) => {
                    const o = x.overrides![String(w)];
                    const out: AiOverride = { week: w };
                    const put = (k: Exclude<keyof AiOverride, 'week'>, raw: string) => {
                      const n = toInt(raw);
                      if (n != null) out[k] = n;
                    };
                    put('sets', o.sets);
                    put('rep_min', o.repMin);
                    put('rep_max', o.repMax);
                    put('rir_min', o.rirMin);
                    put('rir_max', o.rirMax);
                    put('load_pct_1rm', o.loadPct);
                    return out;
                  }),
                },
              ]
            : [],
        ),
      }))
      .filter((day) => day.exercises.length > 0),
  };
}

/* ---- model output → builder rows ---- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

/** A whole number clamped into [lo, hi], or null when absent/not a number. */
const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : null;
};
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const str = (n: number | null): string => (n == null ? '' : String(n));
/** A min/max pair in order — the DB rejects min > max. */
const ordered = (a: number | null, b: number | null): [string, string] =>
  a != null && b != null && a > b ? [str(b), str(a)] : [str(a), str(b)];

const LOAD_QUALS = ['light', 'moderate', 'heavy'];
const WEEKDAY_VALUES = WEEKDAYS.map((w) => w.value).filter(Boolean);

export interface AiDraft {
  header: Pick<DraftData, 'name' | 'focus' | 'description' | 'durationWeeks' | 'progressionRule' | 'tempoDefault' | 'notes'>;
  days: DayRow[];
  weeks: WeekRow[];
  /** What the model says it did, for the coach. */
  summary: string;
  /** Exercise names that weren't in the catalog and were left out. */
  dropped: string[];
}

/**
 * The model's program → builder rows, or null if nothing usable is left.
 *
 * `before` is the draft the request was built from (edit mode) — its rows are
 * what the refs point at. `isKnown` says whether an exercise name may be used
 * (in the catalog, or a custom movement the coach already had).
 */
export function aiToDraft(raw: unknown, before: DayRow[] | null, isKnown: (name: string) => boolean): AiDraft | null {
  if (!isObj(raw)) return null;

  const weeksN =
    int(raw.duration_weeks, 1, 52) ?? clamp(list(raw.weeks).length || 4, 1, 52);

  // Refs → the rows they came from. Each ref can be claimed once: a model
  // that repeats one gets a new row the second time, not a shared id.
  const dayByRef = new Map<string, DayRow>();
  const exByRef = new Map<string, ExRow>();
  before?.forEach((d, di) => {
    dayByRef.set(dayRef(di), d);
    d.exercises.forEach((x, xi) => exByRef.set(exRef(di, xi), x));
  });
  const claimed = new Set<string>();
  const claim = <T,>(map: Map<string, T>, ref: unknown): T | undefined => {
    if (typeof ref !== 'string' || claimed.has(ref)) return undefined;
    const hit = map.get(ref);
    if (hit) claimed.add(ref);
    return hit;
  };

  const dropped: string[] = [];
  const usedWeekdays = new Set<string>();

  const days: DayRow[] = list(raw.days).flatMap((d) => {
    const exercises = list(d.exercises).flatMap((x): ExRow[] => {
      const name = text(x.name, 120);
      if (!name) return [];
      if (!isKnown(name)) {
        dropped.push(name);
        return [];
      }
      const orig = claim(exByRef, x.ref);
      const [repMin, repMax] = ordered(int(x.rep_min, 1, 100), int(x.rep_max, 1, 100));
      const [rirMin, rirMax] = ordered(int(x.rir_min, 0, 10), int(x.rir_max, 0, 10));
      const loadQual = typeof x.load_qualitative === 'string' && LOAD_QUALS.includes(x.load_qualitative) ? x.load_qualitative : '';
      const letter = text(x.superset, 1).toUpperCase();
      const row: ExRow = {
        ...(orig?.id ? { id: orig.id, loadedExerciseId: orig.loadedExerciseId, loadedName: orig.loadedName } : {}),
        name,
        sets: str(int(x.sets, 1, 20) ?? 3),
        repMin,
        repMax,
        unilateral: x.is_unilateral === true,
        rirMin,
        rirMax,
        loadPct: str(int(x.load_pct_1rm, 1, 100)),
        loadQual,
        tempo: text(x.tempo, 200),
        rest: str(int(x.rest_seconds, 0, 900)),
        notes: text(x.notes, 500),
        advOpen: false,
        superset: SUPERSET_LETTERS.includes(letter) ? letter : '',
        overrides: overridesFrom(x.overrides, weeksN),
      };
      row.advOpen = !!(row.rirMin || row.rirMax || row.loadPct || row.unilateral || row.tempo || row.notes);
      return [row];
    });
    if (exercises.length === 0) return [];

    // A superset needs a partner: a letter on a single row means nothing.
    const count = new Map<string, number>();
    for (const x of exercises) if (x.superset) count.set(x.superset, (count.get(x.superset) ?? 0) + 1);
    for (const x of exercises) if (x.superset && count.get(x.superset)! < 2) x.superset = '';

    let weekday = typeof d.weekday === 'string' && WEEKDAY_VALUES.includes(d.weekday) ? d.weekday : '';
    if (weekday && usedWeekdays.has(weekday)) weekday = '';
    if (weekday) usedWeekdays.add(weekday);

    const orig = claim(dayByRef, d.ref);
    return [{ ...(orig?.id ? { id: orig.id } : {}), label: text(d.label, 80), weekday, exercises }];
  });
  if (days.length === 0) return null;

  const weeks: WeekRow[] = Array.from({ length: weeksN }, emptyWeek);
  const filled = new Set<number>();
  for (const w of list(raw.weeks)) {
    const n = typeof w.week_number === 'number' ? Math.round(w.week_number) : NaN;
    if (!(n >= 1 && n <= weeksN) || filled.has(n)) continue;
    filled.add(n);
    const [rirMin, rirMax] = ordered(int(w.rir_min, 0, 10), int(w.rir_max, 0, 10));
    const [loadMin, loadMax] = ordered(int(w.load_pct_min, 1, 100), int(w.load_pct_max, 1, 100));
    weeks[n - 1] = {
      label: text(w.label, 80),
      rirMin,
      rirMax,
      loadMin,
      loadMax,
      isDeload: w.is_deload === true,
      setsOverride: str(int(w.sets_override, 1, 20)),
      notes: text(w.notes, 500),
    };
  }

  return {
    header: {
      name: text(raw.name, 80),
      focus: text(raw.focus, 80),
      description: text(raw.description, 500),
      durationWeeks: String(weeksN),
      progressionRule: text(raw.progression_rule, 300),
      tempoDefault: text(raw.tempo_default, 200),
      notes: text(raw.notes, 1000),
    },
    days,
    weeks,
    summary: text(raw.summary, 600),
    dropped: [...new Set(dropped)],
  };
}

/** Model overrides (a list) → the builder's map keyed by week. Weeks outside
 *  the block are dropped, not clamped: week 7 of a 5-week block isn't week 5. */
function overridesFrom(v: unknown, weeksN: number): Record<string, OverrideRow> {
  const out: Record<string, OverrideRow> = {};
  for (const o of list(v)) {
    const w = typeof o.week === 'number' ? Math.round(o.week) : NaN;
    if (!(w >= 1 && w <= weeksN) || out[String(w)]) continue;
    const [repMin, repMax] = ordered(int(o.rep_min, 1, 100), int(o.rep_max, 1, 100));
    const [rirMin, rirMax] = ordered(int(o.rir_min, 0, 10), int(o.rir_max, 0, 10));
    const row: OverrideRow = {
      sets: str(int(o.sets, 1, 20)),
      repMin,
      repMax,
      rirMin,
      rirMax,
      loadPct: str(int(o.load_pct_1rm, 1, 100)),
    };
    if (overrideHasData(row)) out[String(w)] = row;
  }
  return out;
}
