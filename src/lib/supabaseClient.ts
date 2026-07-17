import { createClient } from '@supabase/supabase-js';

/**
 * Same Supabase project the mobile app uses. Only the anon key ships here —
 * every request is still authorized by RLS against the signed-in user's JWT
 * (see docs/ADMIN_WEB_DB_CONNECTION.md). The service-role key never touches
 * this file; it lives only in the create-client Edge Function's secrets.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
