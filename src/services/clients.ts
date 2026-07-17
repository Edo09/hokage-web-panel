/**
 * Typed data-access layer, backed by the real Supabase project the mobile
 * app uses (same anon key model, same RLS: docs/ADMIN_WEB_DB_CONNECTION.md).
 * The UI imports ONLY from this file — never queries supabase directly.
 *
 * Requires these migrations applied (mobile app repo, Supabase SQL editor):
 *   20260717150000_profiles_email_sync.sql   — profiles.email + sync trigger
 *   20260717150100_memberships_one_per_client.sql — unique(client_id)
 * plus everything from the coaching-platform migration set.
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Client,
  ClientWithMeta,
  CoachProfile,
  Membership,
  MealWithItems,
  RoutineWithExercises,
  WorkoutLog,
} from '../types';

async function currentCoachId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('No hay sesión activa.');
  return data.user.id;
}

/* ---------------- batched child-collection fetchers ----------------
 * Queried directly against the child table (not embedded from `profiles`)
 * so this never depends on unconfirmed FK metadata for profiles→routines/
 * meals/workout_logs — the mobile app itself always queries these the same
 * way. `.in('user_id', ids)` keeps it to one round trip regardless of how
 * many clients are being loaded. */

async function fetchRoutinesFor(userIds: string[]): Promise<Record<string, RoutineWithExercises[]>> {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('routines')
    .select('*, routine_exercises(*, exercise:exercises(*, body_part:bodyparts(name)))')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .order('sort_order', { referencedTable: 'routine_exercises', ascending: true });
  if (error) throw error;
  const byUser: Record<string, RoutineWithExercises[]> = {};
  for (const r of (data ?? []) as unknown as RoutineWithExercises[]) {
    (byUser[r.user_id] ??= []).push(r);
  }
  return byUser;
}

async function fetchMealsFor(userIds: string[]): Promise<Record<string, MealWithItems[]>> {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('meals')
    .select('*, meal_items(*)')
    .in('user_id', userIds)
    .order('date', { ascending: false });
  if (error) throw error;
  const byUser: Record<string, MealWithItems[]> = {};
  for (const m of (data ?? []) as unknown as MealWithItems[]) {
    (byUser[m.user_id] ??= []).push(m);
  }
  return byUser;
}

async function fetchLogsFor(userIds: string[]): Promise<Record<string, WorkoutLog[]>> {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .in('user_id', userIds)
    .order('date', { ascending: false });
  if (error) throw error;
  const byUser: Record<string, WorkoutLog[]> = {};
  for (const l of (data ?? []) as WorkoutLog[]) {
    (byUser[l.user_id] ??= []).push(l);
  }
  return byUser;
}

async function fetchMembership(clientId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return (data as Membership | null) ?? null;
}

function assemble(
  profile: Record<string, unknown>,
  routinesByUser: Record<string, RoutineWithExercises[]>,
  mealsByUser: Record<string, MealWithItems[]>,
  logsByUser: Record<string, WorkoutLog[]>,
): ClientWithMeta {
  const id = profile.id as string;
  const membershipEmbed = profile.membership as Membership | Membership[] | null;
  return {
    ...(profile as unknown as Client),
    membership: Array.isArray(membershipEmbed) ? (membershipEmbed[0] ?? null) : (membershipEmbed ?? null),
    routines: routinesByUser[id] ?? [],
    meals: mealsByUser[id] ?? [],
    logs: logsByUser[id] ?? [],
  };
}

/* ---------------- reads ---------------- */

export async function listClients(): Promise<ClientWithMeta[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    // Disambiguate the embed: memberships has TWO FKs to profiles
    // (client_id and coach_id) — `!client_id` picks the right one.
    .select('*, membership:memberships!client_id(*)')
    .eq('role', 'user')
    .order('display_name', { ascending: true, nullsFirst: false });
  if (error) throw error;

  const ids = (profiles ?? []).map((p) => p.id as string);
  const [routinesByUser, mealsByUser, logsByUser] = await Promise.all([
    fetchRoutinesFor(ids),
    fetchMealsFor(ids),
    fetchLogsFor(ids),
  ]);

  return (profiles ?? []).map((p) => assemble(p, routinesByUser, mealsByUser, logsByUser));
}

export async function getClient(id: string): Promise<ClientWithMeta | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, membership:memberships!client_id(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const [routinesByUser, mealsByUser, logsByUser] = await Promise.all([
    fetchRoutinesFor([id]),
    fetchMealsFor([id]),
    fetchLogsFor([id]),
  ]);

  return assemble(profile, routinesByUser, mealsByUser, logsByUser);
}

export async function getCoachProfile(): Promise<CoachProfile> {
  const userId = await currentCoachId();
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, whatsapp')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    display_name: data.display_name ?? 'Coach',
    avatar_url: data.avatar_url,
    whatsapp: data.whatsapp ?? '',
  };
}

/** "Active clients" trend, last 12 weeks. No historical membership-status
 *  snapshot table exists, so this uses the real signal that does exist:
 *  distinct clients with ≥1 workout log per week. */
export async function getClientTrend(): Promise<number[]> {
  const since = new Date(Date.now() - 12 * 7 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('workout_logs').select('user_id, date').gte('date', since);
  if (error) throw error;

  const mondayOf = (d: Date) => {
    const day = (d.getDay() + 6) % 7; // Monday-based
    const m = new Date(d);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - day);
    return m.getTime();
  };
  const thisWeekStart = mondayOf(new Date());
  const WEEK = 7 * 86_400_000;

  return Array.from({ length: 12 }, (_, i) => {
    const start = thisWeekStart - (11 - i) * WEEK;
    const end = start + WEEK;
    const ids = new Set(
      (data ?? [])
        .filter((l) => {
          const t = new Date(l.date).getTime();
          return t >= start && t < end;
        })
        .map((l) => l.user_id),
    );
    return ids.size;
  });
}

/* ---------------- writes ---------------- */

/** Creates the auth account via the create-client Edge Function (needs the
 *  service-role key, which never touches the browser — see
 *  supabase/functions/create-client). Requires that function deployed. */
export async function createClient(input: { display_name: string; email: string }): Promise<ClientWithMeta> {
  const { data, error } = await supabase.functions.invoke<{ user_id?: string; error?: string }>('create-client', {
    body: { email: input.email, display_name: input.display_name },
  });
  if (error) throw new Error(error.message);
  if (!data?.user_id) throw new Error(data?.error ?? 'No se pudo crear el cliente.');

  // handle_new_user + the email-sync trigger run in the same transaction as
  // the Edge Function's admin.createUser call, so the profile should already
  // exist — but allow one short retry in case of read-replica lag.
  const client = (await getClient(data.user_id)) ?? (await wait(500).then(() => getClient(data.user_id!)));
  if (!client) throw new Error('Cliente creado, pero tardó en aparecer. Refresca la lista.');
  return client;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

export interface AssignRoutineExerciseInput {
  exercise_id: string;
  sets: number;
  reps: number;
  weight_kg: number | null;
  rest_seconds: number;
  sort_order: number;
  notes?: string | null;
}

export interface AssignRoutineInput {
  name: string;
  description: string | null;
  /** Stored lowercase English ('monday'..'sunday') — matches the mobile
   *  app's convention (src/utils/day-label.ts); the UI shows Spanish labels. */
  day_of_week: string | null;
  exercises: AssignRoutineExerciseInput[];
}

export async function assignRoutine(clientId: string, input: AssignRoutineInput): Promise<void> {
  const coachId = await currentCoachId();
  const { data: routine, error } = await supabase
    .from('routines')
    .insert({
      user_id: clientId,
      assigned_by: coachId,
      source: 'coach',
      name: input.name,
      description: input.description,
      day_of_week: input.day_of_week,
    })
    .select()
    .single();
  if (error) throw error;

  if (input.exercises.length > 0) {
    const { error: exErr } = await supabase.from('routine_exercises').insert(
      input.exercises.map((ex) => ({
        routine_id: routine.id,
        user_id: clientId,
        exercise_id: ex.exercise_id,
        sets: ex.sets,
        reps: ex.reps,
        weight_kg: ex.weight_kg,
        rest_seconds: ex.rest_seconds,
        sort_order: ex.sort_order,
        notes: ex.notes ?? null,
      })),
    );
    if (exErr) throw exErr;
  }
}

export async function updateMembership(clientId: string, patch: Partial<Membership>): Promise<void> {
  const coachId = await currentCoachId();
  const { error } = await supabase
    .from('memberships')
    // onConflict targets the unique(client_id) constraint — updates the
    // client's one canonical membership row instead of inserting a new one.
    .upsert({ client_id: clientId, coach_id: coachId, ...patch }, { onConflict: 'client_id' });
  if (error) throw error;
}

const toDateOnly = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export async function renewMembership(clientId: string, days = 30): Promise<Membership> {
  const current = await fetchMembership(clientId);
  const now = new Date();
  const base = current?.expires_at && new Date(current.expires_at) > now ? new Date(current.expires_at) : now;
  const expires_at = toDateOnly(new Date(base.getTime() + days * 86_400_000));

  const coachId = await currentCoachId();
  const { data, error } = await supabase
    .from('memberships')
    .upsert(
      { client_id: clientId, coach_id: coachId, status: 'active', expires_at },
      { onConflict: 'client_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as Membership;
}

export async function updateCoachProfile(patch: Partial<CoachProfile>): Promise<CoachProfile> {
  const userId = await currentCoachId();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('display_name, avatar_url, whatsapp')
    .single();
  if (error) throw error;
  return {
    display_name: data.display_name ?? 'Coach',
    avatar_url: data.avatar_url,
    whatsapp: data.whatsapp ?? '',
  };
}
