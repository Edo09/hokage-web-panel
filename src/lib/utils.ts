import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------- domain helpers shared across screens ---------- */

import type { ActivityLevel, Membership, MembershipStatus, ProfileGoal } from '@/types';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const fmtDate = (d: string | Date | null): string => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

export const fmtShort = (d: string | Date): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

export const toDateInput = (d: string | null): string => {
  if (!d) return '';
  const date = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};

export const fromDateInput = (v: string): string | null => {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

/** Whole days from today to `d` (negative = past). */
export const daysDiff = (d: string | Date): number => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return Math.round((date.getTime() - Date.now()) / 86_400_000);
};

export const relTime = (d: string | Date): string => {
  const n = -daysDiff(d);
  return n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : `hace ${n} d`;
};

export const money = (n: number | null): string => `RD$ ${Number(n || 0).toLocaleString('en-US')}`;

export const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Per-client accent color for initials avatars. */
const AVATAR_COLORS = ['#ef4444', '#3b82f6', '#a78bfa', '#f59e0b', '#34d399', '#f472b6', '#22d3ee'];

export const avatarColor = (id: string): string => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: 'Activa',
  expired: 'Vencida',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

export interface ExpiryInfo {
  label: string;
  tone: 'normal' | 'warning' | 'danger' | 'muted';
}

export const expiryInfo = (m: Membership | null): ExpiryInfo => {
  if (!m || !m.expires_at) return { label: '—', tone: 'muted' };
  const d = daysDiff(m.expires_at);
  if (m.status === 'active' && d >= 0 && d <= 7) return { label: `Vence en ${d} d`, tone: 'warning' };
  if (m.status === 'expired' || d < 0) return { label: `Venció ${fmtShort(m.expires_at)}`, tone: 'danger' };
  return { label: fmtDate(m.expires_at), tone: 'normal' };
};

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario',
  active: 'Activo',
  very_active: 'Muy activo',
};

export const activityLabel = (a: ActivityLevel | null): string => (a ? ACTIVITY_LABELS[a] : '—');

export const GOAL_LABELS: Record<ProfileGoal, string> = {
  lose_weight: 'Perder peso',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantener',
};

export const goalLabel = (g: ProfileGoal | null): string | null => (g ? GOAL_LABELS[g] : null);
