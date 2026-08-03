import type { Exercise, ProgramWithDetail } from "@/types";

/**
 * Types + adapters for the mobile program preview. Kept out of the component
 * file so it can export components only (react-refresh/only-export-components).
 */

/* ---------------- normalized shape ---------------- */

export interface PreviewExercise {
  name: string;
  videoUrl: string | null;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  unilateral: boolean;
  rirMin: number | null;
  rirMax: number | null;
  loadPct: number | null;
  loadQual: string | null;
  tempo: string | null;
  rest: number | null;
  notes: string | null;
}
export interface PreviewDay {
  index: number;
  label: string | null;
  weekday: string | null;
  exercises: PreviewExercise[];
}
export interface PreviewWeek {
  number: number;
  label: string | null;
  rirMin: number | null;
  rirMax: number | null;
  loadMin: number | null;
  loadMax: number | null;
  isDeload: boolean;
  setsOverride: number | null;
  notes: string | null;
}
export interface PreviewProgram {
  name: string;
  focus: string | null;
  durationWeeks: number;
  startDate: string;
  progressionRule: string | null;
  tempoDefault: string | null;
  notes: string | null;
  days: PreviewDay[];
  weeks: PreviewWeek[];
}

/** Adapter: a saved program row → preview shape. */
export function programToPreview(p: ProgramWithDetail): PreviewProgram {
  return {
    name: p.name,
    focus: p.focus,
    durationWeeks: p.duration_weeks,
    startDate: p.start_date,
    progressionRule: p.progression_rule,
    tempoDefault: p.tempo_default,
    notes: p.notes,
    days: [...p.program_days]
      .sort((a, b) => a.sort_order - b.sort_order || a.day_index - b.day_index)
      .map((d) => ({
        index: d.day_index,
        label: d.label,
        weekday: d.weekday,
        exercises: [...d.program_exercises]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((e) => ({
            name: e.exercise?.name ?? e.custom_name ?? '—',
            videoUrl: e.exercise?.video_url ?? null,
            sets: e.sets,
            repMin: e.rep_min,
            repMax: e.rep_max,
            unilateral: e.is_unilateral,
            rirMin: e.rir_min,
            rirMax: e.rir_max,
            loadPct: e.load_pct_1rm,
            loadQual: e.load_qualitative,
            tempo: e.tempo,
            rest: e.rest_seconds,
            notes: e.notes,
          })),
      })),
    weeks: [...p.program_weeks]
      .sort((a, b) => a.week_number - b.week_number)
      .map((w) => ({
        number: w.week_number,
        label: w.label,
        rirMin: w.rir_min,
        rirMax: w.rir_max,
        loadMin: w.load_pct_min,
        loadMax: w.load_pct_max,
        isDeload: w.is_deload,
        setsOverride: w.sets_override,
        notes: w.notes,
      })),
  };
}

/* ---------------- formatting (mirrors the app) ---------------- */

const num = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : null;
};
export const range = (a: number | null, b: number | null): string => {
  if (a == null && b == null) return '—';
  if (a != null && b != null) return a === b ? String(a) : `${a}–${b}`;
  return String(a ?? b);
};

/** Builder draft rows → preview shape. `catalog` resolves demo GIFs by name. */
export function draftToPreview(
  header: {
    name: string;
    focus: string;
    durationWeeks: number;
    startDate: string;
    progressionRule: string;
    tempoDefault: string;
    notes: string;
  },
  days: {
    label: string;
    weekday: string;
    exercises: {
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
    }[];
  }[],
  weeks: {
    label: string;
    rirMin: string;
    rirMax: string;
    loadMin: string;
    loadMax: string;
    isDeload: boolean;
    setsOverride: string;
    notes: string;
  }[],
  catalog: Exercise[] | null,
): PreviewProgram {
  const byName = new Map<string, Exercise>();
  for (const e of catalog ?? []) byName.set(e.name.trim().toLowerCase(), e);

  return {
    name: header.name.trim() || 'Programa sin nombre',
    focus: header.focus.trim() || null,
    durationWeeks: header.durationWeeks,
    startDate: header.startDate,
    progressionRule: header.progressionRule.trim() || null,
    tempoDefault: header.tempoDefault.trim() || null,
    notes: header.notes.trim() || null,
    days: days
      .map((d, i) => ({
        index: i + 1,
        label: d.label.trim() || null,
        weekday: d.weekday || null,
        exercises: d.exercises
          .filter((x) => x.name.trim())
          .map((x) => ({
            name: x.name.trim(),
            videoUrl: byName.get(x.name.trim().toLowerCase())?.video_url ?? null,
            sets: num(x.sets) ?? 3,
            repMin: num(x.repMin),
            repMax: num(x.repMax),
            unilateral: x.unilateral,
            rirMin: num(x.rirMin),
            rirMax: num(x.rirMax),
            loadPct: num(x.loadPct),
            loadQual: x.loadQual || null,
            tempo: x.tempo.trim() || null,
            rest: num(x.rest),
            notes: x.notes.trim() || null,
          })),
      }))
      .filter((d) => d.exercises.length > 0),
    weeks: weeks.map((w, i) => ({
      number: i + 1,
      label: w.label.trim() || null,
      rirMin: num(w.rirMin),
      rirMax: num(w.rirMax),
      loadMin: num(w.loadMin),
      loadMax: num(w.loadMax),
      isDeload: w.isDeload,
      setsOverride: num(w.setsOverride),
      notes: w.notes.trim() || null,
    })),
  };
}
