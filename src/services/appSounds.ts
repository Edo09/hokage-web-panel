/**
 * The coach's «Sonidos de la app» (see src/lib/appSounds.ts). One row for the
 * whole app; RLS: everyone signed in reads it, only the coach (is_coach())
 * changes it, and only the five sound columns.
 */
import { supabase } from '@/lib/supabaseClient';
import { appSoundsFromRow, type AppSounds } from '@/lib/appSounds';

const COLUMNS = 'rest_start, rest_warn, rest_done, new_record, day_complete';

export async function getAppSounds(): Promise<AppSounds> {
  const { data, error } = await supabase.from('app_sound_settings').select(COLUMNS).maybeSingle();
  if (error) throw error;
  return appSoundsFromRow(data);
}

export async function saveAppSounds(sounds: AppSounds): Promise<void> {
  const { data, error } = await supabase
    .from('app_sound_settings')
    .update(sounds)
    .eq('id', true)
    .select('id');
  if (error) throw error;
  // RLS refuses an update by saying nothing: no row comes back.
  if (!data || data.length === 0) throw new Error('No se pudieron guardar los sonidos.');
}
