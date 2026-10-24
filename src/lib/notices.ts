/**
 * How the bell words a coach notice: the same titles as the Dashboard's
 * attention list (lib/insights.ts), so a notice and its «Atención» row read
 * alike, and the client page tab that acts on it.
 */
import type { CoachNotification } from '@/types';
import type { AttentionTone } from '@/lib/insights';
import { fmtShort, relTime } from '@/lib/utils';

export interface NoticeView {
  tone: AttentionTone;
  title: string;
  detail: string;
  href: string;
}

export const noticeClientName = (n: CoachNotification): string =>
  n.client?.display_name ?? n.client?.email ?? 'Cliente';

export function describeNotice(n: CoachNotification): NoticeView {
  const page = (tab?: string) => `/clients/${n.client_id}${tab ? `?tab=${tab}` : ''}`;
  switch (n.kind) {
    case 'day_completed':
      return {
        tone: 'success',
        title: 'Completó un día de entreno',
        detail: `${n.data.day_label} · semana ${n.data.week} · ${n.data.program_name}`,
        href: page('tracking'),
      };
    case 'inactive':
      return {
        tone: n.data.days >= 7 ? 'danger' : 'warning',
        title: `${n.data.days} días sin entrenar`,
        detail: n.data.last_trained
          ? `Último entreno el ${fmtShort(n.data.last_trained)} · ${n.data.program_name}`
          : `Sin entrenos desde que empezó ${n.data.program_name}`,
        href: page(),
      };
    case 'block_ending':
      return {
        tone: 'info',
        title: 'Termina su bloque esta semana',
        detail: `${n.data.program_name} · termina el ${fmtShort(n.data.end_date)}`,
        href: page('programs'),
      };
    case 'block_ended':
      return {
        tone: 'warning',
        title: 'Bloque terminado',
        detail: `${n.data.program_name} · acabó el ${fmtShort(n.data.end_date)}`,
        href: page('programs'),
      };
  }
}

/** «Ahora», «hace 12 min», «hace 3 h» today; then «Ayer», «hace 4 d». */
export function noticeTime(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins} min`;
  const day = relTime(createdAt);
  return day === 'Hoy' ? `hace ${Math.floor(mins / 60)} h` : day;
}
