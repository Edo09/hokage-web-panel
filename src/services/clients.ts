/**
 * Typed data-access layer. The UI imports ONLY from this file,
 * never from mockData directly — so swapping to Supabase later means
 * editing this file alone, e.g.:
 *
 *   const { data } = await supabase
 *     .from('profiles')
 *     .select('*, memberships(*), routines(*, exercises(*))');
 *
 * All functions are async and include a small artificial delay so the
 * loading skeletons are visible during development.
 */
import type { Client, ClientWithMeta, CoachProfile, Membership, Routine } from '../types';
import { MOCK_CLIENTS, MOCK_CLIENT_TREND, MOCK_COACH } from './mockData';

const delay = (ms = 450) => new Promise<void>((r) => setTimeout(r, ms));

// In-memory store (mutated by the write operations below)
let clients: ClientWithMeta[] = [...MOCK_CLIENTS];
let coach: CoachProfile = { ...MOCK_COACH };

/* ---------------- reads ---------------- */

export async function listClients(): Promise<ClientWithMeta[]> {
  await delay();
  return clients;
}

export async function getClient(id: string): Promise<ClientWithMeta | null> {
  await delay(250);
  return clients.find((c) => c.id === id) ?? null;
}

export async function getCoachProfile(): Promise<CoachProfile> {
  await delay(200);
  return coach;
}

export async function getClientTrend(): Promise<number[]> {
  return MOCK_CLIENT_TREND;
}

/* ---------------- writes ---------------- */

export async function createClient(input: { display_name: string; email: string }): Promise<ClientWithMeta> {
  await delay(300);
  const id = `c${Date.now()}`;
  const c: ClientWithMeta = {
    id,
    display_name: input.display_name,
    email: input.email,
    avatar_url: null,
    age: null,
    sex: null,
    height_cm: null,
    weight_kg: null,
    activity_level: 'moderado',
    calorie_goal: 2000,
    onboarding_completed: false,
    membership: {
      id: `m${Date.now()}`,
      client_id: id,
      plan_name: 'Sin plan',
      status: 'paused',
      price: 0,
      currency: 'DOP',
      started_at: new Date().toISOString(),
      expires_at: null,
      notes: '',
    },
    routines: [],
    meals: [],
    logs: [],
  };
  clients = [c, ...clients];
  return c;
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  await delay(250);
  clients = clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
}

export async function assignRoutine(
  clientId: string,
  routine: Omit<Routine, 'id' | 'user_id' | 'assigned_by'>,
): Promise<void> {
  await delay(300);
  clients = clients.map((c) =>
    c.id === clientId
      ? {
          ...c,
          routines: [{ ...routine, id: `r${Date.now()}`, user_id: clientId, assigned_by: 'coach' }, ...c.routines],
        }
      : c,
  );
}

export async function updateMembership(clientId: string, patch: Partial<Membership>): Promise<void> {
  await delay(250);
  clients = clients.map((c) => (c.id === clientId ? { ...c, membership: { ...c.membership, ...patch } } : c));
}

export async function renewMembership(clientId: string, days = 30): Promise<Membership> {
  await delay(250);
  const c = clients.find((x) => x.id === clientId);
  if (!c) throw new Error('Cliente no encontrado');
  const now = new Date();
  const base =
    c.membership.expires_at && new Date(c.membership.expires_at) > now ? new Date(c.membership.expires_at) : now;
  const expires_at = new Date(base.getTime() + days * 86_400_000).toISOString();
  const updated: Membership = { ...c.membership, status: 'active', expires_at };
  clients = clients.map((x) => (x.id === clientId ? { ...x, membership: updated } : x));
  return updated;
}

export async function updateCoachProfile(patch: Partial<CoachProfile>): Promise<CoachProfile> {
  await delay(250);
  coach = { ...coach, ...patch };
  return coach;
}
