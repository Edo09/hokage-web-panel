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
