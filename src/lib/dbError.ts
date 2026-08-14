/**
 * Turn a Supabase/Postgres failure into something a coach can act on.
 *
 * Two traps this exists to avoid:
 *   1. supabase-js rejects with a PostgrestError — a PLAIN OBJECT, not an
 *      `Error`. Code doing `e instanceof Error ? e.message : 'generic'`
 *      therefore always shows the generic text and hides the real cause.
 *   2. Raw Postgres text ("violates check constraint
 *      program_exercises_sets_check") means nothing to a non-technical user, so
 *      known constraints are mapped to plain Spanish.
 */

/** Constraint / trigger text → what the coach should actually change. */
const CONSTRAINT_MESSAGES: { match: RegExp; message: string }[] = [
  { match: /program_exercises_sets_check/, message: 'Las series de cada ejercicio deben estar entre 1 y 20.' },
  { match: /program_exercises_rep_(min|max)_check/, message: 'Las repeticiones deben estar entre 1 y 100.' },
  { match: /program_exercise_rep_order/, message: 'En algún ejercicio las repeticiones mínimas son mayores que las máximas.' },
  { match: /program_exercises_rir_(min|max)_check/, message: 'El RIR debe estar entre 0 y 10.' },
  { match: /program_exercise_rir_order/, message: 'En algún ejercicio el RIR mínimo es mayor que el máximo.' },
  { match: /program_exercises_load_pct_1rm_check/, message: 'El %1RM debe estar entre 1 y 100.' },
  { match: /program_exercises_rest_seconds_check/, message: 'El descanso debe estar entre 0 y 900 segundos (15 min).' },
  { match: /program_exercise_has_name/, message: 'Hay un ejercicio sin nombre.' },
  { match: /programs_duration_weeks_check/, message: 'La duración debe estar entre 1 y 52 semanas.' },
  { match: /program_weeks_sets_override_check/, message: 'Las series por semana deben estar entre 1 y 20.' },
  { match: /program_weeks_rir_(min|max)_check/, message: 'El RIR de la periodización debe estar entre 0 y 10.' },
  { match: /program_weeks_load_pct_(min|max)_check/, message: 'El % de carga debe estar entre 1 y 100.' },
  { match: /start_date cannot be in the past/, message: 'La fecha de inicio no puede ser anterior a hoy.' },
  { match: /uniq_one_active_program_per_user/, message: 'Ese cliente ya tiene un programa activo.' },
  { match: /exercises_name_lower_idx/, message: 'Ya existe un ejercicio con ese nombre.' },
];

/** Best available human message for any thrown value. */
export function errorMessage(e: unknown, fallback = 'No se pudo completar la operación'): string {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : '';

  if (!raw) return fallback;

  for (const { match, message } of CONSTRAINT_MESSAGES) {
    if (match.test(raw)) return message;
  }
  return raw;
}
