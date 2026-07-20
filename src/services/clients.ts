/**
 * Typed data-access layer, backed by the real Supabase project the mobile
 * app uses (same anon key model, same RLS: docs/ADMIN_WEB_DB_CONNECTION.md).
 * The UI imports ONLY from this file — never queries supabase directly.
 *
 * Requires these migrations applied (mobile app repo, Supabase SQL editor):
 *   20260717150000_profiles_email_sync.sql   — profiles.email + sync trigger
 *   20260717150100_memberships_one_per_client.sql — unique(client_id)
 *   20260720120000_save_coach_routine_rpc.sql — transactional routine writes
 * plus everything from the coaching-platform migration set.
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  Client,
  ClientSummary,
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

/* --- lightweight list fetchers (counts + recent activity, no nested graph) --- */

async function fetchRoutineFlags(
  userIds: string[],
): Promise<Record<string, { coach: number; self: number }>> {
  if (!userIds.length) return {};
  // Two columns, no exercise/catalog embed — the lists only need the split.
  const { data, error } = await supabase.from('routines').select('user_id, assigned_by').in('user_id', userIds);
  if (error) throw error;
  const by: Record<string, { coach: number; self: number }> = {};
  for (const r of (data ?? []) as { user_id: string; assigned_by: string | null }[]) {
    const f = (by[r.user_id] ??= { coach: 0, self: 0 });
    if (r.assigned_by) f.coach += 1;
    else f.self += 1;
  }
  return by;
}

async function fetchRecentLogs(
  userIds: string[],
): Promise<Record<string, { date: string; routine_name: string }[]>> {
  if (!userIds.length) return {};
  // Three columns instead of full rows; still date-DESC so [0] is the newest.
  const { data, error } = await supabase
    .from('workout_logs')
    .select('user_id, date, routine_name')
    .in('user_id', userIds)
    .order('date', { ascending: false });
  if (error) throw error;
  const by: Record<string, { date: string; routine_name: string }[]> = {};
  for (const l of (data ?? []) as { user_id: string; date: string; routine_name: string }[]) {
    (by[l.user_id] ??= []).push({ date: l.date, routine_name: l.routine_name });
  }
  return by;
}

/** List-screen read: every client with membership, routine counts, and recent
 *  logs — but NONE of the routine exercises, meals, or meal items the old
 *  listClients pulled for every row. The detail screen (getClient) still loads
 *  the full graph on demand. */
export async function listClientSummaries(): Promise<ClientSummary[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*, membership:memberships!client_id(*)')
    .eq('role', 'user')
    .order('display_name', { ascending: true, nullsFirst: false });
  if (error) throw error;

  const ids = (profiles ?? []).map((p) => p.id as string);
  const [routineFlags, recentLogs] = await Promise.all([fetchRoutineFlags(ids), fetchRecentLogs(ids)]);

  return (profiles ?? []).map((p) => {
    const id = p.id as string;
    const membershipEmbed = (p as Record<string, unknown>).membership as Membership | Membership[] | null;
    const flags = routineFlags[id] ?? { coach: 0, self: 0 };
    return {
      ...(p as unknown as Client),
      membership: Array.isArray(membershipEmbed) ? (membershipEmbed[0] ?? null) : (membershipEmbed ?? null),
      coachRoutineCount: flags.coach,
      selfRoutineCount: flags.self,
      logs: recentLogs[id] ?? [],
    };
  });
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
 *  supabase/functions/create-client). Requires that function deployed.
 *
 *  Returns the one-time temporary password the coach must hand to the client
 *  (WhatsApp); it is NOT retrievable again. The client signs in with it and
 *  changes it from the app's Ajustes screen. */
export async function createClient(input: {
  display_name: string;
  email: string;
}): Promise<{ client: ClientWithMeta; tempPassword: string }> {
  const { data, error } = await supabase.functions.invoke<{
    user_id?: string;
    temp_password?: string;
    error?: string;
  }>('create-client', {
    body: { email: input.email, display_name: input.display_name },
  });
  if (error) throw new Error(error.message);
  if (!data?.user_id || !data.temp_password) {
    throw new Error(data?.error ?? 'No se pudo crear el cliente.');
  }

  // handle_new_user + the email-sync trigger run in the same transaction as
  // the Edge Function's admin.createUser call, so the profile should already
  // exist — but allow one short retry in case of read-replica lag.
  const client = (await getClient(data.user_id)) ?? (await wait(500).then(() => getClient(data.user_id!)));
  if (!client) throw new Error('Cliente creado, pero tardó en aparecer. Refresca la lista.');
  return { client, tempPassword: data.temp_password };
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

/** Assign (p_routine_id null) or rewrite (id set) a coach routine + its
 *  exercises atomically. Wraps the save_coach_routine RPC, which does the
 *  whole write in ONE transaction — the old browser path used 2–3 separate
 *  calls with no rollback, so a mid-write failure could leave a routine with
 *  no exercises (the edit path had no compensation). See the migration
 *  supabase/migrations/20260720120000_save_coach_routine_rpc.sql (mobile repo). */
async function saveCoachRoutine(
  routineId: string | null,
  clientId: string,
  input: AssignRoutineInput,
): Promise<void> {
  const { error } = await supabase.rpc('save_coach_routine', {
    p_routine_id: routineId,
    p_client_id: clientId,
    p_name: input.name,
    p_description: input.description,
    p_day_of_week: input.day_of_week,
    p_exercises: input.exercises,
  });
  if (error) throw error;
}

export async function assignRoutine(clientId: string, input: AssignRoutineInput): Promise<void> {
  await saveCoachRoutine(null, clientId, input);
}

export async function updateRoutine(
  routineId: string,
  clientId: string,
  input: AssignRoutineInput,
): Promise<void> {
  await saveCoachRoutine(routineId, clientId, input);
}

/** Removes an assigned routine; routine_exercises rows cascade (FK). */
export async function deleteRoutine(routineId: string): Promise<void> {
  const { error } = await supabase.from('routines').delete().eq('id', routineId);
  if (error) throw error;
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
