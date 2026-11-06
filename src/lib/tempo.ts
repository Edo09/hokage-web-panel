/**
 * A tempo is four phases in seconds, written 3-1-2-0: lowering, pause at the
 * bottom, lifting, pause at the top; "X" is explosive. The app reads exactly
 * these (parseTempo in hokage-coaching-app's src/utils/program.ts: keep the
 * two in sync) and spells the phases out during the workout; a tempo written
 * any other way it only shows as written.
 */

/** For the coach: what to type, in one line. */
export const TEMPO_FORMAT = 'el tempo va como 3-1-2-0: segundos de bajada, pausa abajo, subida y pausa arriba (X = explosiva)';

const PHASE = /^(\d{1,2}|X)$/;

/** "3-1-2-0" for any way of writing the four phases ("3120", "3 1 2 0",
 *  "3/1/2/0", a lowercase x), or null when it isn't four phases. */
export function normalizeTempo(text: string | null | undefined): string | null {
  const flat = (text ?? '').trim().toUpperCase();
  const parts = /^[\dX]{4}$/.test(flat) ? flat.split('') : flat.split(/[\s\-–—/.,]+/);
  return parts.length === 4 && parts.every((x) => PHASE.test(x)) ? parts.join('-') : null;
}
