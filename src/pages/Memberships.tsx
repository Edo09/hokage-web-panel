import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard, Pause, Play, RotateCw } from 'lucide-react';
import type { ClientWithMeta, MembershipStatus } from '@/types';
import { listClients, renewMembership, updateMembership } from '@/services/clients';
import { avatarColor, cn, daysDiff, expiryInfo, fmtDate, money } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FilterId = 'all' | 'active' | 'expiring' | 'expired' | 'paused';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'expiring', label: 'Por vencer' },
  { id: 'expired', label: 'Vencidas' },
  { id: 'paused', label: 'Pausadas' },
];

const GRID =
  'grid gap-3 [grid-template-columns:minmax(200px,1.9fr)_minmax(115px,1.1fr)_minmax(85px,0.8fr)_minmax(85px,0.8fr)_minmax(125px,1.1fr)_92px]';

const TONE_CLASS = {
  normal: 'text-muted-foreground',
  warning: 'text-warning',
  danger: 'text-primary',
  muted: 'text-faint',
} as const;

interface RowMeta {
  c: ClientWithMeta;
  d: number;
  isExpiring: boolean;
  isExpired: boolean;
  weight: number;
}

export default function Memberships() {
  const [clients, setClients] = useState<ClientWithMeta[] | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [pauseTarget, setPauseTarget] = useState<ClientWithMeta | null>(null);
  const navigate = useNavigate();

  const load = () => void listClients().then(setClients);
  useEffect(() => {
    load();
  }, []);

  const all: RowMeta[] = useMemo(() => {
    if (!clients) return [];
    return clients
      .map((c) => {
        const m = c.membership;
        const d = m.expires_at ? daysDiff(m.expires_at) : 9999;
        const isExpiring = m.status === 'active' && !!m.expires_at && d >= 0 && d <= 7;
        const isExpired = m.status === 'expired';
        const weight = isExpired ? 0 : isExpiring ? 1 : m.status === 'paused' ? 2 : m.status === 'active' ? 3 : 4;
        return { c, d, isExpiring, isExpired, weight };
      })
      .sort((a, b) => a.weight - b.weight || a.d - b.d);
  }, [clients]);

  const matches = (x: RowMeta, id: FilterId) =>
    id === 'all' ? true : id === 'expiring' ? x.isExpiring : x.c.membership.status === id;

  const rows = all.filter((x) => matches(x, filter));

  const doRenew = async (c: ClientWithMeta) => {
    const m = await renewMembership(c.id);
    load();
    toast.success(`Membresía de ${c.display_name.split(' ')[0]} renovada hasta ${fmtDate(m.expires_at)}`);
  };

  const doPause = async (c: ClientWithMeta) => {
    await updateMembership(c.id, { status: 'paused' as MembershipStatus });
    setPauseTarget(null);
    load();
    toast.success('Membresía pausada');
  };

  const doResume = async (c: ClientWithMeta) => {
    await updateMembership(c.id, { status: 'active' as MembershipStatus });
    load();
    toast.success(`Membresía de ${c.display_name.split(' ')[0]} reactivada`);
  };

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-transparent bg-primary/10 text-primary dark:bg-primary/15'
                  : 'border-border text-muted-foreground hover:border-border-strong',
              )}
            >
              {f.label} <span className="text-[11px] opacity-70">{all.filter((x) => matches(x, f.id)).length}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[810px]">
            <div
              className={cn(
                GRID,
                'border-b border-border px-5 py-3 text-[11.5px] font-bold uppercase tracking-wider text-faint',
              )}
            >
              <span>Cliente</span>
              <span>Plan</span>
              <span>Precio</span>
              <span>Estado</span>
              <span>Vencimiento</span>
              <span className="text-right">Acciones</span>
            </div>

            {!clients ? (
              <TableSkeleton cols={6} rows={5} />
            ) : (
              rows.map(({ c, isExpiring, isExpired }) => {
                const m = c.membership;
                const exp = expiryInfo(m);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      GRID,
                      'items-center border-b border-border px-5 py-[11px] text-[13px]',
                      isExpired && 'bg-primary/[0.06]',
                      isExpiring && 'bg-warning/[0.07]',
                    )}
                  >
                    <button
                      onClick={() => navigate(`/clients/${c.id}?tab=membership`)}
                      title="Ver membresía del cliente"
                      className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar name={c.display_name} color={avatarColor(c.id)} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold">{c.display_name}</span>
                        <span className="block truncate text-xs text-faint">{c.email}</span>
                      </span>
                    </button>
                    <span className="truncate text-[12.5px] text-muted-foreground">{m.plan_name}</span>
                    <span className="whitespace-nowrap text-[12.5px] font-semibold">{money(m.price)}</span>
                    <span>
                      <StatusBadge status={m.status} />
                    </span>
                    <span className={cn('whitespace-nowrap text-[12.5px]', TONE_CLASS[exp.tone])}>{exp.label}</span>
                    <span className="flex justify-end gap-1.5">
                      <button
                        onClick={() => void doRenew(c)}
                        title="Renovar 30 días"
                        aria-label="Renovar 30 días"
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground transition-colors hover:border-success hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <RotateCw className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                      {m.status === 'active' && (
                        <button
                          onClick={() => setPauseTarget(c)}
                          title="Pausar"
                          aria-label="Pausar membresía"
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground transition-colors hover:border-warning hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pause className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                      {m.status === 'paused' && (
                        <button
                          onClick={() => void doResume(c)}
                          title="Reanudar"
                          aria-label="Reanudar membresía"
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground transition-colors hover:border-success hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Play className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {clients && rows.length === 0 && (
          <EmptyState icon={CreditCard} title="Nada por aquí" description="No hay membresías con este estado." />
        )}
      </div>

      {clients && <div className="text-xs text-faint">{rows.length} membresías</div>}

      <AlertDialog open={!!pauseTarget} onOpenChange={(o) => !o && setPauseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar membresía</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Pausar la membresía de {pauseTarget?.display_name}? El cliente conserva su acceso a la app pero se
              marca en pausa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pauseTarget && void doPause(pauseTarget)}>Pausar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
