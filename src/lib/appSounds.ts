/**
 * «Sonidos de la app»: which sound the clients' phones play at each moment of
 * a workout. The coach picks, per moment, one of the sets built into the
 * mobile app (its assets/sounds, named in src/utils/sound-sets.ts there) or
 * their own upload («Propio»). The choice is the one row of
 * public.app_sound_settings, and uploads live in the app-sounds bucket as
 * custom/<moment>-<time>.wav (supabase/migrations/20261106150000 and
 * 20261106160000 in the app repo). The built-in files are copied in
 * public/sounds/<set>/<moment>.wav, to listen to here. A new built-in set
 * takes new files in the app, here, and the first migration's check.
 */

export const SOUND_SETS = [
  { value: 'classic', label: 'Clásico', title: 'Los sonidos con los que salió la app' },
  { value: 'bells', label: 'Campanas', title: 'Notas de campanas (glockenspiel)' },
  { value: 'ring', label: 'Boxeo', title: 'Campana de ring de boxeo y bloque de madera' },
  { value: 'arcade', label: 'Arcade', title: 'Sonidos de videojuego de 8 bits' },
] as const;
export type SoundSet = (typeof SOUND_SETS)[number]['value'];
/** A built-in set, or the coach's own upload for that moment. */
export type SoundPick = SoundSet | 'custom';

export const SOUND_MOMENTS = [
  {
    column: 'rest_start',
    fileColumn: 'rest_start_file',
    file: 'start',
    label: 'Empieza el descanso',
    hint: 'Al pulsar «Terminar» o «Descansar».',
    maxSeconds: 1,
  },
  {
    column: 'rest_warn',
    fileColumn: 'rest_warn_file',
    file: 'warn',
    label: 'Quedan 10 segundos',
    hint: 'Diez segundos antes del final, con la app abierta.',
    maxSeconds: 1,
  },
  {
    column: 'rest_done',
    fileColumn: 'rest_done_file',
    file: 'done',
    label: 'Termina el descanso',
    hint: 'También suena en la notificación con la app en segundo plano.',
    maxSeconds: 3,
  },
  {
    column: 'new_record',
    fileColumn: 'new_record_file',
    file: 'record',
    label: 'Nuevo récord',
    hint: 'Una serie supera su mejor marca en ese ejercicio.',
    maxSeconds: 3,
  },
  {
    column: 'day_complete',
    fileColumn: 'day_complete_file',
    file: 'day',
    label: 'Día completado',
    hint: 'Al marcar el último ejercicio del día.',
    maxSeconds: 5,
  },
] as const;
export type SoundColumn = (typeof SOUND_MOMENTS)[number]['column'];

export interface AppSounds {
  picks: Record<SoundColumn, SoundPick>;
  /** Each moment's upload (bucket path), kept when a built-in set is picked. */
  files: Record<SoundColumn, string | null>;
}

const each = <T>(value: T) =>
  Object.fromEntries(SOUND_MOMENTS.map((m) => [m.column, value])) as Record<SoundColumn, T>;

export const DEFAULT_APP_SOUNDS: AppSounds = { picks: each<SoundPick>('classic'), files: each<string | null>(null) };

/** The rules the panel checks an upload against, shown on the card. */
export const UPLOAD_RULES = {
  formats: 'MP3, WAV, M4A u OGG',
  maxMegabytes: 5,
  accept: 'audio/*,.mp3,.wav,.m4a,.aac,.ogg',
} as const;

/** An upload's path in the app-sounds bucket (the database checks it too). */
const CUSTOM_FILE = /^custom\/[A-Za-z0-9_-]+\.wav$/;

const isSoundSet = (value: unknown): value is SoundSet => SOUND_SETS.some((s) => s.value === value);

/** The saved row as the panel shows it: anything unknown reads as classic. */
export function appSoundsFromRow(row: Record<string, unknown> | null | undefined): AppSounds {
  const sounds: AppSounds = { picks: { ...DEFAULT_APP_SOUNDS.picks }, files: { ...DEFAULT_APP_SOUNDS.files } };
  for (const m of SOUND_MOMENTS) {
    const file = row?.[m.fileColumn];
    if (typeof file === 'string' && CUSTOM_FILE.test(file)) sounds.files[m.column] = file;
    const pick = row?.[m.column];
    if (isSoundSet(pick)) sounds.picks[m.column] = pick;
    else if (pick === 'custom' && sounds.files[m.column] != null) sounds.picks[m.column] = 'custom';
  }
  return sounds;
}

/** The row to save. */
export function appSoundsToRow(sounds: AppSounds): Record<string, string | null> {
  const row: Record<string, string | null> = {};
  for (const m of SOUND_MOMENTS) {
    row[m.column] = sounds.picks[m.column];
    row[m.fileColumn] = sounds.files[m.column];
  }
  return row;
}

/** A new upload's path: a new name each time, so phones fetch the new one. */
export const newCustomPath = (column: SoundColumn): string => `custom/${column}-${Date.now()}.wav`;

/** Where to listen to a built-in sound (public/sounds). */
export const soundUrl = (set: SoundSet, file: string): string => `/sounds/${set}/${file}.wav`;
