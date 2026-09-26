/**
 * Pure logic behind the dashboard's attention list and consistency grid:
 * turns the roster's raw activity (services/insights.ts) plus the client
 * summaries into per-client facts, then into prioritized action items.
 */
import type { ClientSummary } from '@/types';
import { keyDaysAgo, toKey, type RosterActivity } from '@/services/insights';

const DAY = 86_400_000;

const daysSinceKey = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - then) / DAY);
};

export interface ClientPulse {
  /** Local date keys (YYYY-MM-DD) with any training activity, last 56 days. */
  activeDays: Set<string>;
  lastActive: string | null;
  program: {
    id: string;
    name: string;
    startDate: string;
    durationWeeks: number;
    daysPerWeek: number;
    /** 1-based week of the block today (can exceed the duration when overdue). */
    week: number;
    /** Days until the block's last day (negative once it's over). */
    daysToEnd: number;
  } | null;
  hasNutritionPlan: boolean;
  lastMeal: string | null;
  /** Best estimated-1RM beaten this week vs. the previous 12 weeks. */
  record: { exercise: string; weightKg: number; reps: number } | null;
}

const e1rm = (w: number, r: number) => w * (1 + r / 30);

export function buildPulse(activity: RosterActivity): Map<string, ClientPulse> {
  const out = new Map<string, ClientPulse>();
  const get = (id: string): ClientPulse => {
    let p = out.get(id);
    if (!p) {
      p = { activeDays: new Set(), lastActive: null, program: null, hasNutritionPlan: false, lastMeal: null, record: null };
      out.set(id, p);
    }
    return p;
  };
  const d56 = keyDaysAgo(56);
  const weekStart = keyDaysAgo(6);

  for (const s of activity.setLogs) if (s.date >= d56) get(s.user_id).activeDays.add(s.date.slice(0, 10));
  for (const c of activity.completions) get(c.user_id).activeDays.add(toKey(new Date(c.completed_at)));
  for (const l of activity.workoutLogs) get(l.user_id).activeDays.add(l.date.slice(0, 10));
  for (const p of out.values()) p.lastActive = [...p.activeDays].sort().at(-1) ?? null;

  for (const m of activity.meals) {
    const p = get(m.user_id);
    if (!p.lastMeal || m.date > p.lastMeal) p.lastMeal = m.date.slice(0, 10);
  }
  for (const id of activity.nutritionPlanUsers) get(id).hasNutritionPlan = true;

  for (const prog of activity.programs) {
    const p = get(prog.user_id);
    const since = daysSinceKey(prog.start_date.slice(0, 10));
    const totalDays = prog.duration_weeks * 7;
    // A client can (rarely) have two active rows; keep the newest start.
    if (p.program && p.program.startDate > prog.start_date) continue;
    p.program = {
      id: prog.id,
      name: prog.name,
      startDate: prog.start_date.slice(0, 10),
      durationWeeks: prog.duration_weeks,
      daysPerWeek: Math.max(1, prog.program_days.length),
      week: since < 0 ? 0 : Math.floor(since / 7) + 1,
      daysToEnd: totalDays - 1 - since,
    };
  }

  // Records: per client and exercise, this week's best e1RM vs. the best before.
  const best = new Map<string, { before: number; week: number; weekSet: { w: number; r: number } | null; name: string }>();
  for (const s of activity.setLogs) {
    if (!s.weight_kg || !s.reps || s.weight_kg <= 0 || s.reps <= 0) continue;
    const name = s.program_exercise?.exercise?.name ?? s.program_exercise?.custom_name ?? s.exercise_name;
    if (!name) continue;
    const key = `${s.user_id}|${name.toLowerCase()}`;
    const v = e1rm(s.weight_kg, s.reps);
    const b = best.get(key) ?? { before: 0, week: 0, weekSet: null, name };
    if (s.date >= weekStart) {
      if (v > b.week) {
        b.week = v;
        b.weekSet = { w: s.weight_kg, r: s.reps };
      }
    } else if (v > b.before) {
      b.before = v;
    }
    best.set(key, b);
  }
  const gain = new Map<string, number>();
  for (const [key, b] of best) {
    if (!b.weekSet || b.before <= 0 || b.week <= b.before) continue;
    const userId = key.split('|')[0];
    const rel = b.week / b.before;
    if (rel > (gain.get(userId) ?? 0)) {
      gain.set(userId, rel);
      get(userId).record = { exercise: b.name, weightKg: b.weekSet.w, reps: b.weekSet.r };
    }
  }
  return out;
}

export type AttentionTone = 'danger' | 'warning' | 'info' | 'success';
export interface AttentionItem {
  client: ClientSummary;
  tone: AttentionTone;
  title: string;
  detail: string;
  action: { label: string; href: string; external?: boolean };
  /** Lower sorts first. */
  rank: number;
}

const firstName = (c: ClientSummary) => (c.display_name ?? c.email).split(' ')[0];

/** wa.me link with a prefilled message, or null when the client has no number. */
export function whatsappLink(c: ClientSummary, text: string): string | null {
  const digits = (c.whatsapp ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function buildAttention(clients: ClientSummary[], pulse: Map<string, ClientPulse>): AttentionItem[] {
  const items: AttentionItem[] = [];
  const page = (c: ClientSummary, tab?: string) => `/clients/${c.id}${tab ? `?tab=${tab}` : ''}`;

  for (const c of clients) {
    const p = pulse.get(c.id);
    const m = c.membership;
    const status = m?.status;
    const name = firstName(c);

    // Membership: expired, or expiring within a week.
    if (m?.expires_at && status !== 'cancelled') {
      const left = -daysSinceKey(m.expires_at.slice(0, 10));
      if (status === 'expired' || left < 0) {
        items.push({ client: c, tone: 'danger', rank: 0, title: 'Membresía vencida', detail: `${m.plan_name ?? 'Plan'} · venció hace ${-left} d`, action: { label: 'Renovar', href: page(c, 'membership') } });
      } else if (left <= 7 && status === 'active') {
        items.push({ client: c, tone: 'warning', rank: 3, title: left === 0 ? 'Membresía vence hoy' : `Membresía vence en ${left} d`, detail: m.plan_name ?? 'Plan', action: { label: 'Renovar', href: page(c, 'membership') } });
      }
    }

    // Only chase training for clients who are currently being coached.
    const coached = status === 'active' || status == null;
    if (!coached) continue;

    const prog = p?.program;
    if (!prog) {
      if (status === 'active') {
        items.push({ client: c, tone: 'warning', rank: 4, title: 'Sin programa asignado', detail: 'Tiene membresía activa pero ningún bloque activo', action: { label: 'Asignar', href: page(c, 'programs') } });
      }
    } else if (prog.week > 0) {
      const since = p?.lastActive ? daysSinceKey(p.lastActive) : daysSinceKey(prog.startDate);
      if (since >= 4) {
        const wa = whatsappLink(c, `Hola ${name}, ¿cómo vas? Hace ${since} días que no registras entreno. ¿Todo bien?`);
        items.push({
          client: c,
          tone: since >= 7 ? 'danger' : 'warning',
          rank: since >= 7 ? 1 : 2,
          title: `${since} días sin entrenar`,
          detail: `${prog.name} · semana ${Math.min(prog.week, prog.durationWeeks)} de ${prog.durationWeeks}`,
          action: wa ? { label: 'WhatsApp', href: wa, external: true } : { label: 'Ver ficha', href: page(c) },
        });
      }
      if (prog.daysToEnd < 0) {
        items.push({ client: c, tone: 'warning', rank: 3, title: 'Bloque terminado', detail: `${prog.name} acabó hace ${-prog.daysToEnd} d`, action: { label: 'Siguiente bloque', href: page(c, 'programs') } });
      } else if (prog.daysToEnd <= 7) {
        items.push({ client: c, tone: 'info', rank: 5, title: 'Termina su bloque esta semana', detail: `${prog.name} · semana ${prog.week} de ${prog.durationWeeks}`, action: { label: 'Siguiente bloque', href: page(c, 'programs') } });
      }
    }

    if (p?.hasNutritionPlan) {
      const since = p.lastMeal ? daysSinceKey(p.lastMeal) : null;
      if (since == null || since >= 4) {
        items.push({ client: c, tone: 'info', rank: 6, title: since == null ? 'Sin comidas registradas' : `${since} días sin registrar comidas`, detail: 'Tiene plan nutricional asignado', action: { label: 'Ver nutrición', href: page(c, 'nutrition') } });
      }
    }

    if (p?.record) {
      const r = p.record;
      const wa = whatsappLink(c, `¡Enhorabuena ${name}! Nuevo récord en ${r.exercise}: ${r.weightKg} kg × ${r.reps}. Sigue así.`);
      items.push({
        client: c,
        tone: 'success',
        rank: 7,
        title: `Nuevo récord en ${r.exercise}`,
        detail: `${r.weightKg} kg × ${r.reps} esta semana`,
        action: wa ? { label: 'Felicitar', href: wa, external: true } : { label: 'Ver seguimiento', href: page(c, 'tracking') },
      });
    }
  }
  return items.sort((a, b) => a.rank - b.rank);
}

/** Last `n` day keys, oldest first (the consistency grid's columns). */
export const lastDays = (n: number): string[] => Array.from({ length: n }, (_, i) => keyDaysAgo(n - 1 - i));

/** Share of planned sessions done over the last 7 days, across clients on a program. */
export function weeklyAdherence(pulse: Map<string, ClientPulse>): { done: number; planned: number } {
  const week = new Set(lastDays(7));
  let done = 0;
  let planned = 0;
  for (const p of pulse.values()) {
    if (!p.program || p.program.week < 1) continue;
    planned += p.program.daysPerWeek;
    done += Math.min(p.program.daysPerWeek, [...p.activeDays].filter((d) => week.has(d)).length);
  }
  return { done, planned };
}
