import { supabase } from '@/lib/supabaseClient';

/**
 * Public URL for a diary photo the CLIENT uploaded from the mobile app.
 *
 * The app stores these in the public `meal-photos` bucket under
 * "<userId>/<uuid>.jpg" (migration 20260705120000_meal_photos.sql) and derives
 * the URL exactly this way — paths carry unguessable UUIDs, and public URLs are
 * synchronous so thumbnails need no extra round trip.
 *
 * Until now the panel stored `photo_path` on MealItem but never rendered it, so
 * the coach's clearest window into what a client actually eats was dark.
 */
export function mealPhotoUrl(path: string): string {
  return supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl;
}
