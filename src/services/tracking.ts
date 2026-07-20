/**
 * Coach tracking reads: a client's actual logged sets (workout_set_logs) and
 * exercise completions (program_exercise_completions) — a client can check an
 * exercise done without logging weight/reps, so completions are tracked and
 * shown separately from set logs, not inferred from them. Both join back to
 * the prescription for context. RLS: "coach reads all set logs" / "coach
 * reads all completions" (is_coach()) already grant this — see
 * supabase/migrations/20260717120000_coach_programs.sql and
 * 20260717130000_program_exercise_completions.sql.
 */
import { supabase } from '@/lib/supabaseClient';
import type { ActivityItem, ExerciseCompletionWithContext, ProgramExerciseContext, SetLogWithContext } from '@/types';

const PROGRAM_EXERCISE_CONTEXT =
  'program_exercise:program_exercises(id, sets, rep_min, rep_max, is_unilateral, rir_min, rir_max, load_pct_1rm, custom_name, exercise:exercises(name), program_day:program_days(label, program:programs(id, name)))';

const exerciseNameOf = (pe: ProgramExerciseContext | null): string =>
  pe?.exercise?.name ?? pe?.custom_name ?? 'un ejercicio';

/** All of a client's logged sets, newest first, with prescription context. */
export async function getClientSetLogs(clientId: string): Promise<SetLogWithContext[]> {
  const { data, error } = await supabase
    .from('workout_set_logs')
    .select(`*, ${PROGRAM_EXERCISE_CONTEXT}`)
    .eq('user_id', clientId)
    .order('date', { ascending: false })
    .order('set_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SetLogWithContext[];
}

/** All of a client's exercise-done checks, newest first, with prescription
 *  context. Independent of set logs — a client can mark a day done without
 *  entering any weight/reps. */
export async function getClientCompletions(clientId: string): Promise<ExerciseCompletionWithContext[]> {
  const { data, error } = await supabase
    .from('program_exercise_completions')
    .select(`*, ${PROGRAM_EXERCISE_CONTEXT}`)
    .eq('user_id', clientId)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ExerciseCompletionWithContext[];
}

interface ActivityRow {
  user_id: string;
  profile: { display_name: string | null; email: string } | null;
  program_exercise: ProgramExerciseContext | null;
}

/** Recent program activity across EVERY client (not scoped to one), for the
 *  dashboard feed. The dashboard previously only showed legacy routine
 *  completions (workout_logs) — coaches assigning programs saw no activity
 *  there even while clients were checking off exercises and logging sets, since
 *  those live in separate tables this never queried. Merges two sources:
 *   - program_exercise_completions: one feed line per check-off.
 *   - workout_set_logs: grouped by (client, exercise, date) so a 4-set session
 *     doesn't produce 4 duplicate lines.
 *  Same coach-wide RLS as the per-client reads above (is_coach()), just
 *  without the .eq('user_id', ...) scope. */
export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
  const [completionsRes, setLogsRes] = await Promise.all([
    supabase
      .from('program_exercise_completions')
      .select(`user_id, completed_at, profile:profiles!user_id(display_name, email), ${PROGRAM_EXERCISE_CONTEXT}`)
      .order('completed_at', { ascending: false })
      .limit(limit),
    supabase
      .from('workout_set_logs')
      .select(
        `user_id, program_exercise_id, date, created_at, profile:profiles!user_id(display_name, email), ${PROGRAM_EXERCISE_CONTEXT}`,
      )
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 4), // several rows per logged session — deduped below
  ]);
  if (completionsRes.error) throw completionsRes.error;
  if (setLogsRes.error) throw setLogsRes.error;

  const completions = (completionsRes.data ?? []) as unknown as (ActivityRow & { completed_at: string })[];
  const setLogs = (setLogsRes.data ?? []) as unknown as (ActivityRow & {
    program_exercise_id: string;
    date: string;
    created_at: string;
  })[];

  const items: ActivityItem[] = completions.map((c) => ({
    clientId: c.user_id,
    clientName: c.profile?.display_name ?? c.profile?.email ?? 'Cliente',
    kind: 'completion',
    exerciseName: exerciseNameOf(c.program_exercise),
    at: c.completed_at,
  }));

  // One feed line per (client, exercise, date) session — rows arrive
  // date-DESC then created_at-DESC, so the first row per key is the latest.
  const seen = new Set<string>();
  for (const s of setLogs) {
    const key = `${s.user_id}|${s.program_exercise_id}|${s.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      clientId: s.user_id,
      clientName: s.profile?.display_name ?? s.profile?.email ?? 'Cliente',
      kind: 'set_log',
      exerciseName: exerciseNameOf(s.program_exercise),
      at: s.date,
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}
