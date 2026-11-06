/**
 * «Sonidos de la app»: which sound the clients' phones play at each moment of
 * a workout. The sets are built into the mobile app (its assets/sounds, named
 * in src/utils/sound-sets.ts there); the coach picks one per moment, and the
 * choice is the one row of public.app_sound_settings
 * (supabase/migrations/20261106150000_app_sound_settings.sql in the app
 * repo). The same files are in public/sounds/<set>/<moment>.wav, to listen to
 * here. A new set takes new files in the app, here, and that migration's check.
 */

export const SOUND_SETS = [
  { value: 'classic', label: 'Clásico', title: 'Los sonidos con los que salió la app' },
  { value: 'bells', label: 'Campanas', title: 'Notas de campanas (glockenspiel)' },
  { value: 'ring', label: 'Boxeo', title: 'Campana de ring de boxeo y bloque de madera' },
  { value: 'arcade', label: 'Arcade', title: 'Sonidos de videojuego de 8 bits' },
] as const;
export type SoundSet = (typeof SOUND_SETS)[number]['value'];

export const SOUND_MOMENTS = [
  {
    column: 'rest_start',
    file: 'start',
    label: 'Empieza el descanso',
    hint: 'Al pulsar «Terminar» o «Descansar».',
  },
  {
    column: 'rest_warn',
    file: 'warn',
    label: 'Quedan 10 segundos',
    hint: 'Diez segundos antes del final, con la app abierta.',
  },
  {
    column: 'rest_done',
    file: 'done',
    label: 'Termina el descanso',
    hint: 'También suena en la notificación con la app en segundo plano.',
  },
  {
    column: 'new_record',
    file: 'record',
    label: 'Nuevo récord',
    hint: 'Una serie supera su mejor marca en ese ejercicio.',
  },
  {
    column: 'day_complete',
    file: 'day',
    label: 'Día completado',
    hint: 'Al marcar el último ejercicio del día.',
  },
] as const;
export type SoundColumn = (typeof SOUND_MOMENTS)[number]['column'];
export type AppSounds = Record<SoundColumn, SoundSet>;

export const DEFAULT_APP_SOUNDS: AppSounds = {
  rest_start: 'classic',
  rest_warn: 'classic',
  rest_done: 'classic',
  new_record: 'classic',
  day_complete: 'classic',
};

const isSoundSet = (value: unknown): value is SoundSet => SOUND_SETS.some((s) => s.value === value);

/** The saved row as the panel shows it: anything unknown reads as classic. */
export function appSoundsFromRow(row: Record<string, unknown> | null | undefined): AppSounds {
  const sounds = { ...DEFAULT_APP_SOUNDS };
  for (const m of SOUND_MOMENTS) {
    const value = row?.[m.column];
    if (isSoundSet(value)) sounds[m.column] = value;
  }
  return sounds;
}

export const sameSounds = (a: AppSounds, b: AppSounds): boolean =>
  SOUND_MOMENTS.every((m) => a[m.column] === b[m.column]);

/** Where to listen to one sound (public/sounds). */
export const soundUrl = (set: SoundSet, file: string): string => `/sounds/${set}/${file}.wav`;
