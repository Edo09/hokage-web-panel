/**
 * Read-only browse of the shared, coach-managed exercise catalog — used by
 * the routine builder's exercise picker (routine_exercises.exercise_id is a
 * required FK; free-text exercise names are no longer possible against the
 * real schema). A full catalog CRUD screen is future scope.
 */
import { supabase } from '@/lib/supabaseClient';
import type { Exercise } from '@/types';

export async function listExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*, body_part:bodyparts(name)')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Exercise[];
}

export interface ExerciseUpdate {
  name?: string;
  video_url?: string | null;
  instructions_en?: string[] | null;
  instructions_es?: string[] | null;
}

/** Edit a catalog exercise (coach-managed). RLS "coach manages exercises"
 *  already grants this. Live-referenced by every routine/program, so an edit
 *  here updates the name/demo/instructions everywhere it's assigned. */
export async function updateExercise(id: string, patch: ExerciseUpdate): Promise<void> {
  const { error } = await supabase.from('exercises').update(patch).eq('id', id);
  if (error) throw error;
}
