/**
 * Muscle-group math for the client's muscle map: what the active program
 * prescribes per group in a week, and what the client actually did in that
 * same program week. Groups and the body-part mapping match the mobile app's
 * Progreso heat map (hokage-coaching-app src/utils/progress.ts), so coach and
 * client read the same six groups.
 */
import type { ExerciseCompletion, ProgramExercise, ProgramWithDetail, WorkoutSetLog } from '@/types';
import type { BodySlug } from '@/components/muscles/bodyArt';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs' | 'other';

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  arms: 'Brazos',
  core: 'Core',
  legs: 'Piernas',
  other: 'Otros',
};

// The catalog's bodyparts are English (ExerciseDB naming); collapse the ten
// into the six drawn groups. Neck, cardio and custom movements → "other".
const BODY_PART_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  'upper arms': 'arms',
  'lower arms': 'arms',
  waist: 'core',
  'upper legs': 'legs',
  'lower legs': 'legs',
};

export const groupForBodyPart = (name: string | null | undefined): MuscleGroup =>
  (name ? BODY_PART_TO_GROUP[name.trim().toLowerCase()] : undefined) ?? 'other';

/** Drawn muscles per group. The artwork has no abductors; "other" isn't drawn. */
export const GROUP_SLUGS: Record<Exclude<MuscleGroup, 'other'>, BodySlug[]> = {
  chest: ['chest'],
  back: ['trapezius', 'upper-back', 'lower-back'],
  shoulders: ['deltoids'],
  arms: ['biceps', 'triceps', 'forearm'],
  core: ['abs', 'obliques'],
  legs: ['quadriceps', 'hamstring', 'gluteal', 'adductors', 'calves', 'tibialis'],
};

export const SLUG_GROUP = new Map<BodySlug, MuscleGroup>(
  (Object.entries(GROUP_SLUGS) as [MuscleGroup, BodySlug[]][]).flatMap(([g, slugs]) =>
    slugs.map((s) => [s, g] as const),
  ),
);

/** Display order for tables: the drawn groups, then "other". */
export const GROUP_ORDER: MuscleGroup[] = ['legs', 'back', 'chest', 'shoulders', 'arms', 'core', 'other'];

const DAY = 86_400_000;

/** The program week today falls in (1-based, clamped to the block), plus
 *  whether the block hasn't started or is already over. */
export function programWeekNow(p: Pick<ProgramWithDetail, 'start_date' | 'duration_weeks'>, today = new Date()) {
  const [y, m, d] = p.start_date.slice(0, 10).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const raw = Math.floor((t.getTime() - start.getTime()) / DAY / 7) + 1;
  return {
    week: Math.min(Math.max(raw, 1), Math.max(1, p.duration_weeks)),
    notStarted: raw < 1,
    finished: raw > p.duration_weeks,
  };
}

/** Sets prescribed for `week`: the exercise's own override for that week,
 *  else the week's deload count, else its base sets (same precedence as the
 *  app's effectivePrescription). */
export function effectiveSets(ex: ProgramExercise, week: number, p: Pick<ProgramWithDetail, 'program_weeks'>): number {
  const own = ex.week_overrides?.[String(week)]?.sets;
  if (own != null) return own;
  const w = p.program_weeks.find((x) => x.week_number === week);
  return w?.sets_override ?? ex.sets;
}

export type GroupSets = Map<MuscleGroup, number>;

const add = (m: GroupSets, g: MuscleGroup, n: number) => m.set(g, (m.get(g) ?? 0) + n);

/** Every prescription in the program, by id, with its group. */
function prescriptions(p: ProgramWithDetail) {
  const byId = new Map<string, { ex: ProgramExercise; group: MuscleGroup }>();
  for (const day of p.program_days) {
    for (const ex of day.program_exercises) {
      byId.set(ex.id, { ex, group: ex.exercise ? groupForBodyPart(ex.exercise.body_part?.name) : 'other' });
    }
  }
  return byId;
}

/** Sets per group the program prescribes in `week` (all its days). */
export function assignedSets(p: ProgramWithDetail, week: number): GroupSets {
  const out: GroupSets = new Map();
  for (const { ex, group } of prescriptions(p).values()) add(out, group, effectiveSets(ex, week, p));
  return out;
}

/**
 * Sets per group the client did in program `week` of `p`: each logged set
 * counts one; an exercise checked done that week with no logged sets counts
 * its prescribed sets (the app counts the same way). Logs and check-offs
 * carry their program week, so this matches the prescription exactly;
 * detached rows (prescription since removed) aren't counted.
 */
export function doneSets(
  p: ProgramWithDetail,
  week: number,
  logs: Pick<WorkoutSetLog, 'program_exercise_id' | 'week_number'>[],
  completions: Pick<ExerciseCompletion, 'program_exercise_id' | 'week_number'>[],
): GroupSets {
  const byId = prescriptions(p);
  const out: GroupSets = new Map();
  const logged = new Set<string>();
  for (const l of logs) {
    const pr = l.program_exercise_id ? byId.get(l.program_exercise_id) : undefined;
    if (!pr || l.week_number !== week) continue;
    add(out, pr.group, 1);
    logged.add(l.program_exercise_id!);
  }
  for (const c of completions) {
    const pr = c.program_exercise_id ? byId.get(c.program_exercise_id) : undefined;
    if (!pr || c.week_number !== week || logged.has(c.program_exercise_id!)) continue;
    add(out, pr.group, effectiveSets(pr.ex, week, p));
  }
  return out;
}
