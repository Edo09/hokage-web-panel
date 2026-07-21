/**
 * Coach-program data access. Multi-week periodized blocks (see
 * supabase/migrations/20260717120000_coach_programs.sql). Writes go through the
 * transactional save_coach_program RPC (20260720130000) so a program's whole
 * graph — header + days + exercises + weekly periodization — is created or
 * rewritten atomically. Reads pull the nested graph in one query.
 *
 * Requires migration 20260720130000_save_coach_program_rpc.sql applied.
 */
import { supabase } from '@/lib/supabaseClient';
import type { LoadQualitative, ProgramStatus, ProgramWithDetail } from '@/types';

/* ---------------- reads ---------------- */

export async function listProgramsForClient(clientId: string): Promise<ProgramWithDetail[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(
      '*, program_days(*, program_exercises(*, exercise:exercises(*, body_part:bodyparts(name)))), program_weeks(*)',
    )
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .order('day_index', { referencedTable: 'program_days', ascending: true })
    .order('week_number', { referencedTable: 'program_weeks', ascending: true });
  if (error) throw error;

  const programs = (data ?? []) as unknown as ProgramWithDetail[];
  // Sort each day's exercises by sort_order (nested-of-nested ordering isn't
  // expressible in the PostgREST embed above).
  for (const p of programs) {
    for (const d of p.program_days) {
      d.program_exercises.sort((a, b) => a.sort_order - b.sort_order);
    }
  }
  return programs;
}

/* ---------------- writes ---------------- */

export interface ProgramExerciseInput {
  exercise_id: string | null;
  custom_name: string | null;
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
  sort_order: number;
}

export interface ProgramDayInput {
  day_index: number;
  label: string | null;
  /** Stored lowercase English ('monday'..'sunday'), or null for "Día N" only. */
  weekday: string | null;
  sort_order: number;
  exercises: ProgramExerciseInput[];
}

export interface ProgramWeekInput {
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

export interface SaveProgramInput {
  name: string;
  description: string | null;
  focus: string | null;
  duration_weeks: number;
  start_date: string; // ISO date (YYYY-MM-DD)
  status: ProgramStatus;
  progression_rule: string | null;
  tempo_default: string | null;
  notes: string | null;
  days: ProgramDayInput[];
  weeks: ProgramWeekInput[];
}

/** Create (programId null) or rewrite (id set) a coach program atomically. */
async function saveCoachProgram(
  programId: string | null,
  clientId: string,
  input: SaveProgramInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_coach_program', {
    p_program_id: programId,
    p_client_id: clientId,
    p_header: {
      name: input.name,
      description: input.description,
      focus: input.focus,
      duration_weeks: input.duration_weeks,
      start_date: input.start_date,
      status: input.status,
      progression_rule: input.progression_rule,
      tempo_default: input.tempo_default,
      notes: input.notes,
    },
    p_days: input.days,
    p_weeks: input.weeks,
  });
  if (error) throw error;
  return data as string;
}

export async function createProgram(clientId: string, input: SaveProgramInput): Promise<string> {
  return saveCoachProgram(null, clientId, input);
}

export async function updateProgram(
  programId: string,
  clientId: string,
  input: SaveProgramInput,
): Promise<string> {
  return saveCoachProgram(programId, clientId, input);
}

/** Removes a program; days/exercises/weeks cascade (FK on delete cascade). */
export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await supabase.from('programs').delete().eq('id', programId);
  if (error) throw error;
}

/**
 * Set a program's status. Only one program per client may be 'active' — setting
 * one active auto-archives the client's previous active program (enforced by the
 * trg_enforce_single_active_program trigger, migration 20260721130000), so the
 * coach can switch which block is live in one call. The status-only UPDATE never
 * touches start_date, so the past-start guard doesn't fire on a running block.
 */
export async function setProgramStatus(programId: string, status: ProgramStatus): Promise<void> {
  const { error } = await supabase.from('programs').update({ status }).eq('id', programId);
  if (error) throw error;
}

/**
 * How many prescribed exercise-weeks a client has checked off, per program. A
 * program is "finished" when this reaches (exercises across all days) ×
 * duration_weeks. Returned as { [programId]: doneCount }; programs with no
 * completions are simply absent.
 */
export async function getProgramCompletionCounts(clientId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('program_exercise_completions')
    .select('program_exercise:program_exercises(program_day:program_days(program_id))')
    .eq('user_id', clientId);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as unknown as CompletionProgramRow[]) {
    const programId = row.program_exercise?.program_day?.program_id;
    if (programId) counts[programId] = (counts[programId] ?? 0) + 1;
  }
  return counts;
}

interface CompletionProgramRow {
  program_exercise: { program_day: { program_id: string } | null } | null;
}
