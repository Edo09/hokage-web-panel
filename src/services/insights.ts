/**
 * Coach-wide reads for the dashboard's attention list and consistency grid:
 * every client's active program, recent program activity, recent meals and
 * active nutrition plans, in a handful of queries (not one per client).
 * RLS: the coach reads all of these via is_coach() policies.
 */
import { supabase } from '@/lib/supabaseClient';

const DAY = 86_400_000;
export const toKey = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const keyDaysAgo = (n: number): string => toKey(new Date(Date.now() - n * DAY));

export interface ActiveProgramRow {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  duration_weeks: number;
  program_days: { id: string }[];
}
export interface SetLogRow {
  user_id: string;
  date: string;
  weight_kg: number | null;
  reps: number | null;
  exercise_name: string | null;
  program_exercise: { custom_name: string | null; exercise: { name: string } | null } | null;
}
export interface RosterActivity {
  programs: ActiveProgramRow[];
  setLogs: SetLogRow[];
  completions: { user_id: string; completed_at: string }[];
  workoutLogs: { user_id: string; date: string }[];
  meals: { user_id: string; date: string }[];
  nutritionPlanUsers: string[];
}

/** PostgREST caps a response at 1000 rows — page until a short page. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

/** Activity windows: 56 days for "did they train" (8 weekly bars), 90 for
 *  set logs so a record this week can be compared with the weeks before. */
export async function getRosterActivity(): Promise<RosterActivity> {
  const d56 = keyDaysAgo(56);
  const d90 = keyDaysAgo(90);
  const d14 = keyDaysAgo(14);

  const [programs, setLogs, completions, workoutLogs, meals, plans] = await Promise.all([
    supabase
      .from('programs')
      .select('id, user_id, name, start_date, duration_weeks, program_days(id)')
      .eq('status', 'active')
      .eq('is_template', false)
      .not('user_id', 'is', null),
    fetchAll<SetLogRow>((from, to) =>
      supabase
        .from('workout_set_logs')
        .select('user_id, date, weight_kg, reps, exercise_name, program_exercise:program_exercises(custom_name, exercise:exercises(name))')
        .gte('date', d90)
        .order('date', { ascending: false })
        .range(from, to),
    ),
    fetchAll<{ user_id: string; completed_at: string }>((from, to) =>
      supabase
        .from('program_exercise_completions')
        .select('user_id, completed_at')
        .gte('completed_at', d56)
        .order('completed_at', { ascending: false })
        .range(from, to),
    ),
    fetchAll<{ user_id: string; date: string }>((from, to) =>
      supabase.from('workout_logs').select('user_id, date').gte('date', d56).order('date', { ascending: false }).range(from, to),
    ),
    fetchAll<{ user_id: string; date: string }>((from, to) =>
      supabase.from('meals').select('user_id, date').gte('date', d14).order('date', { ascending: false }).range(from, to),
    ),
    supabase.from('nutrition_plans').select('user_id').eq('status', 'active').not('user_id', 'is', null),
  ]);
  if (programs.error) throw programs.error;
  if (plans.error) throw plans.error;

  return {
    programs: (programs.data ?? []) as unknown as ActiveProgramRow[],
    setLogs,
    completions,
    workoutLogs,
    meals,
    nutritionPlanUsers: [...new Set(((plans.data ?? []) as { user_id: string }[]).map((p) => p.user_id))],
  };
}
