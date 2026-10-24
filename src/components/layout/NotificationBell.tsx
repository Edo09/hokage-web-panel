import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import type { CoachNotification } from '@/types';
import { qk } from '@/lib/queryClient';
import { cn, initials } from '@/lib/utils';
import { describeNotice, noticeClientName, noticeTime } from '@/lib/notices';
import type { AttentionTone } from '@/lib/insights';
import {
  getCoachNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type CoachNotificationFeed,
} from '@/services/notifications';
import { Skeleton } from '@/components/ui/skeleton';

/** The Dashboard attention list's tiles (components/dashboard/AttentionPanels). */
const TILE: Record<AttentionTone, string> = {
  danger: 'bg-primary/15 text-primary',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-secondary/15 text-secondary',
  success: 'bg-success/15 text-success',
};

/** Fallback when Realtime can't connect: the badge still catches up. */
const POLL_MS = 5 * 60_000;

const PANEL_WIDTH = 380;
/** Kept between the list and the window's edges. */
const GUTTER = 16;

type Anchor = { top: number; right: number };

/** Under the bell, right-aligned to it, but never past the window's left
 *  edge (the list is as wide as the window allows, up to PANEL_WIDTH). */
function anchorUnder(button: HTMLElement): Anchor {
  const r = button.getBoundingClientRect();
  const vw = window.innerWidth;
  const width = Math.min(PANEL_WIDTH, vw - 2 * GUTTER);
  return { top: r.bottom + 8, right: Math.min(vw - r.right, vw - width - GUTTER) };
}

/**
 * The bell in the top bar: unread count, and a list of the latest notices.
 * Opening one marks it read and goes to the client page that acts on it.
 */
export function NotificationBell() {
  /** Where the list sits (viewport px); null = closed. */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = anchor !== null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const feedQuery = useQuery({
    queryKey: qk.coachNotifications,
    queryFn: getCoachNotifications,
    refetchInterval: POLL_MS,
  });
  const feed = feedQuery.data;
  const unread = feed?.unread ?? 0;

  useEffect(
    () => subscribeToNotifications(() => void queryClient.invalidateQueries({ queryKey: qk.coachNotifications })),
    [queryClient],
  );

  const toggle = () => {
    const button = buttonRef.current;
    setAnchor(open || !button ? null : anchorUnder(button));
  };

  // Outside click or Escape closes it; a resize (a phone's toolbar hiding
  // too) moves it with the bell.
  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const follow = () => {
      if (buttonRef.current) setAnchor(anchorUnder(buttonRef.current));
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', follow);
    };
  }, [open]);

  /** Show the read state at once; the refetch after the write settles it.
   *  id null = all. */
  const setRead = (id: string | null) =>
    queryClient.setQueryData<CoachNotificationFeed>(qk.coachNotifications, (prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      const items = prev.items.map((n) => (n.read_at || (id !== null && n.id !== id) ? n : { ...n, read_at: now }));
      const marked = items.filter((n, i) => n !== prev.items[i]).length;
      return { items, unread: id === null ? 0 : Math.max(0, prev.unread - marked) };
    });
  const refetch = () => queryClient.invalidateQueries({ queryKey: qk.coachNotifications });

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onMutate: (id: string) => setRead(id),
    onSettled: refetch,
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => setRead(null),
    onSettled: refetch,
  });

  const openNotice = (n: CoachNotification) => {
    if (!n.read_at) markOne.mutate(n.id);
    setAnchor(null);
    navigate(describeNotice(n).href);
  };

  // A failed background refetch keeps showing what is already loaded.
  const list = !feed ? (
    feedQuery.isError ? (
      <p className="px-4 py-6 text-center text-[12.5px] text-faint">No se pudieron cargar los avisos.</p>
    ) : (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[54px] rounded-lg" />
        ))}
      </div>
    )
  ) : feed.items.length === 0 ? (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <BellOff className="h-6 w-6 text-faint" strokeWidth={1.8} />
      <p className="text-[13px] font-semibold">Sin avisos</p>
      <p className="text-[12px] text-faint">
        Aquí verás cuando un cliente complete un día de entreno, lleve días sin entrenar o termine su bloque.
      </p>
    </div>
  ) : (
    <ul>
      {feed.items.map((n) => {
        const v = describeNotice(n);
        const name = noticeClientName(n);
        return (
          <li key={n.id} className="border-b border-border last:border-b-0">
            <button
              onClick={() => openNotice(n)}
              className={cn(
                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                !n.read_at && 'bg-primary/[0.04]',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[12px] font-extrabold', TILE[v.tone])}
              >
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[13px] leading-snug', n.read_at ? 'font-medium' : 'font-bold')}>
                  {name} · {v.title}
                </span>
                <span className="block truncate text-[12px] text-faint">{v.detail}</span>
                <span className="mt-0.5 block text-[11px] text-faint">{noticeTime(n.created_at)}</span>
              </span>
              {!n.read_at && <span aria-label="Sin leer" className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={unread > 0 ? `Avisos: ${unread} sin leer` : 'Avisos'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Avisos"
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'border-primary text-primary',
        )}
      >
        <Bell className="h-4 w-4" strokeWidth={1.8} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-bold leading-none text-primary-foreground"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Portaled: the top bar clips its overflow in the poster theme. */}
      {anchor &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Avisos"
            style={{ top: anchor.top, right: anchor.right, width: PANEL_WIDTH, maxWidth: `calc(100vw - ${2 * GUTTER}px)` }}
            className="fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-foreground shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <span className="text-[13.5px] font-bold">Avisos</span>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-[12px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Marcar todo como leído
                </button>
              )}
            </div>
            <div className="max-h-[440px] overflow-y-auto">{list}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
