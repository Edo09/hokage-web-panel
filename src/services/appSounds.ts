/**
 * The coach's «Sonidos de la app» (see src/lib/appSounds.ts). One row for the
 * whole app; RLS: everyone signed in reads it, only the coach (is_coach())
 * changes it. The coach's own sounds go to the public app-sounds bucket,
 * which only the coach writes.
 */
import { supabase } from '@/lib/supabaseClient';
import {
  appSoundsFromRow,
  appSoundsToRow,
  newCustomPath,
  type AppSounds,
  type SoundColumn,
} from '@/lib/appSounds';

const BUCKET = 'app-sounds';
export async function getAppSounds(): Promise<AppSounds> {
  const { data, error } = await supabase
    .from('app_sound_settings')
    .select(
      'rest_start, rest_warn, rest_done, new_record, day_complete, rest_start_file, rest_warn_file, rest_done_file, new_record_file, day_complete_file',
    )
    .maybeSingle();
  if (error) throw error;
  return appSoundsFromRow(data);
}

/** Where to listen to an upload (and where the app downloads it from). */
export const customSoundUrl = (path: string): string =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

/**
 * Save the coach's choice: upload the new sounds first, then the row, then
 * delete the uploads they replaced. If the row can't be saved, the new
 * uploads are deleted again, so a failed save leaves nothing behind.
 */
export async function saveAppSounds(
  current: AppSounds,
  uploads: Partial<Record<SoundColumn, Blob>>,
): Promise<AppSounds> {
  const next: AppSounds = { picks: { ...current.picks }, files: { ...current.files } };
  const added: string[] = [];
  const replaced: string[] = [];
  try {
    for (const [column, wav] of Object.entries(uploads) as [SoundColumn, Blob][]) {
      const path = newCustomPath(column);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, wav, { contentType: 'audio/wav', upsert: false });
      if (error) throw error;
      added.push(path);
      const old = next.files[column];
      if (old != null) replaced.push(old);
      next.files[column] = path;
    }
    const { data, error } = await supabase
      .from('app_sound_settings')
      .update(appSoundsToRow(next))
      .eq('id', true)
      .select('id');
    if (error) throw error;
    // RLS refuses an update by saying nothing: no row comes back.
    if (!data || data.length === 0) throw new Error('No se pudieron guardar los sonidos.');
  } catch (e) {
    if (added.length > 0) void supabase.storage.from(BUCKET).remove(added);
    throw e;
  }
  if (replaced.length > 0) void supabase.storage.from(BUCKET).remove(replaced);
  return next;
}
