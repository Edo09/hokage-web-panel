/**
 * Read-only browse of the shared, coach-managed exercise catalog — used by
 * the routine builder's exercise picker (routine_exercises.exercise_id is a
 * required FK; free-text exercise names are no longer possible against the
 * real schema). A full catalog CRUD screen is future scope.
 */
import { supabase } from '@/lib/supabaseClient';
import type { BodyPart, Exercise } from '@/types';

/** Muscle groups for the catalog's body_part_id. Read-only reference data. */
export async function listBodyParts(): Promise<BodyPart[]> {
  const { data, error } = await supabase
    .from('bodyparts')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BodyPart[];
}

/** PostgREST returns at most 1000 rows per request (the project's max_rows)
 *  and the catalog is past that, so read it in pages. */
const PAGE = 1000;

export async function listExercises(): Promise<Exercise[]> {
  const all: Exercise[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('exercises')
      .select('*, body_part:bodyparts(name)')
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as unknown as Exercise[]));
    if (!data || data.length < PAGE) return all;
  }
}

export interface ExerciseUpdate {
  name?: string;
  video_url?: string | null;
  body_part_id?: string | null;
  target_muscle?: string | null;
  instructions_en?: string[] | null;
  instructions_es?: string[] | null;
}

/** The catalog has a unique index on lower(name) so the same movement can't be
 *  entered twice — turn that Postgres error into something a coach can act on. */
function friendlyError(e: { code?: string; message: string }): Error {
  if (e.code === '23505') return new Error('Ya existe un ejercicio con ese nombre.');
  return new Error(e.message);
}

/** Add a coach-authored exercise to the shared catalog. */
export async function createExercise(input: ExerciseUpdate & { name: string }): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: input.name,
      video_url: input.video_url ?? null,
      body_part_id: input.body_part_id ?? null,
      target_muscle: input.target_muscle ?? null,
      instructions_en: input.instructions_en ?? null,
      instructions_es: input.instructions_es ?? null,
    })
    .select('*, body_part:bodyparts(name)')
    .single();
  if (error) throw friendlyError(error);
  return data as unknown as Exercise;
}

/** Edit a catalog exercise (coach-managed). RLS "coach manages exercises"
 *  already grants this. Live-referenced by every routine/program, so an edit
 *  here updates the name/demo/instructions everywhere it's assigned. */
export async function updateExercise(id: string, patch: ExerciseUpdate): Promise<void> {
  const { error } = await supabase.from('exercises').update(patch).eq('id', id);
  if (error) throw friendlyError(error);
}
