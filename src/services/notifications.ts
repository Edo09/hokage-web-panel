/**
 * The coach's notices (the bell in the top bar). The database writes them —
 * a client finishing a training day as it happens, and once a day the clients
 * idle for days and the blocks ending or ended — see
 * supabase/migrations/20261024130000_coach_notifications.sql in the mobile app
 * repo. Here they are only read, marked read, and heard over Realtime while
 * the panel is open. RLS: the coach (is_coach()) reads and updates them.
 */
import { supabase } from '@/lib/supabaseClient';
import type { CoachNotification } from '@/types';

/** How many the bell lists, newest first; older ones stay in the table. */
const LIST_LIMIT = 50;

export interface CoachNotificationFeed {
  items: CoachNotification[];
  /** Every unread notice, not only the listed ones. */
  unread: number;
}

export async function getCoachNotifications(): Promise<CoachNotificationFeed> {
  const [list, unread] = await Promise.all([
    supabase
      .from('coach_notifications')
      .select('id, client_id, kind, data, read_at, created_at, client:profiles(display_name, email)')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase.from('coach_notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
  ]);
  if (list.error) throw list.error;
  if (unread.error) throw unread.error;
  return {
    items: (list.data ?? []) as unknown as CoachNotification[],
    unread: unread.count ?? 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('coach_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

/** Calls `onChange` for every notice added, read or deleted (this tab or
 *  another). Returns the unsubscribe. */
export function subscribeToNotifications(onChange: () => void): () => void {
  const channel = supabase
    .channel('coach-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_notifications' }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
