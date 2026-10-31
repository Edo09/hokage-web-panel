import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CreditCard, Pause, Play, RotateCw } from 'lucide-react';
import type { ClientSummary, MembershipStatus } from '@/types';
import { listClientSummaries, renewMembership, updateMembership } from '@/services/clients';
import { qk } from '@/lib/queryClient';
import { avatarColor, cn, daysDiff, expiryInfo, fmtDate, money } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

// A table from md up; on phones a row is the client, their status and the actions.
const GRID =
  'md:grid md:gap-3 md:[grid-template-columns:minmax(200px,1.9fr)_minmax(115px,1.1fr)_minmax(85px,0.8fr)_minmax(85px,0.8fr)_minmax(125px,1.1fr)_92px]';

const TONE_CLASS = {
  normal: 'text-muted-foreground',
  warning: 'text-warning',
  danger: 'text-destructive',
  muted: 'text-faint',
} as const;

interface RowMeta {
  c: ClientSummary;
  d: number;
  isExpiring: boolean;
  isExpired: boolean;
  weight: number;
}

export default function Memberships() {
  const { data: clients, isPending, isError, refetch } = useQuery({
    queryKey: qk.clientSummaries,
    queryFn: listClientSummaries,
  });
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterId>('all');
  const [pauseTarget, setPauseTarget] = useState<ClientSummary | null>(null);
  const navigate = useNavigate();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });

  const all: RowMeta[] = useMemo(() => {
    if (!clients) return [];
    return clients
      .map((c) => {
        // No membership row yet = treated like "paused" for sorting/filtering.
        const status = c.membership?.status ?? 'paused';
        const expiresAt = c.membership?.expires_at ?? null;
        const d = expiresAt ? daysDiff(expiresAt) : 9999;
        const isExpiring = status === 'active' && !!expiresAt && d >= 0 && d <= 7;
        const isExpired = status === 'expired';
        const weight = isExpired ? 0 : isExpiring ? 1 : status === 'paused' ? 2 : status === 'active' ? 3 : 4;
        return { c, d, isExpiring, isExpired, weight };
      })
      .sort((a, b) => a.weight - b.weight || a.d - b.d);
  }, [clients]);

  const matches = (x: RowMeta, id: FilterId) =>
    id === 'all' ? true : id === 'expiring' ? x.isExpiring : (x.c.membership?.status ?? 'paused') === id;

  const rows = all.filter((x) => matches(x, filter));

  const doRenew = async (c: ClientSummary) => {
    try {
      const m = await renewMembership(c.id);
      invalidate();
      toast.success(`Membresía de ${(c.display_name ?? c.email).split(' ')[0]} renovada hasta ${fmtDate(m.expires_at)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo renovar la membresía');
    }
  };

  const doPause = async (c: ClientSummary) => {
    try {
      await updateMembership(c.id, { status: 'paused' as MembershipStatus });
      setPauseTarget(null);
      invalidate();
      toast.success('Membresía pausada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo pausar la membresía');
    }
  };

  const doResume = async (c: ClientSummary) => {
    try {
      await updateMembership(c.id, { status: 'active' as MembershipStatus });
      invalidate();
      toast.success(`Membresía de ${(c.display_name ?? c.email).split(' ')[0]} reactivada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reactivar la membresía');
    }
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
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-border-strong',
              )}
            >
              {f.label} <span className="text-[11px] opacity-70">{all.filter((x) => matches(x, f.id)).length}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="md:overflow-x-auto">
          <div className="md:min-w-[810px]">
            <div
              className={cn(
                GRID,
                'hidden border-b border-border px-5 py-3 text-xs font-medium text-faint md:grid',
              )}
            >
              <span>Cliente</span>
              <span>Plan</span>
              <span>Precio</span>
              <span>Estado</span>
              <span>Vencimiento</span>
              <span className="text-right">Acciones</span>
            </div>

            {isError ? null : isPending ? (
              <TableSkeleton cols={6} rows={5} />
            ) : (
              rows.map(({ c, isExpiring, isExpired }) => {
                const m = c.membership;
                const status = m?.status ?? 'paused';
                const exp = expiryInfo(m);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      GRID,
                      'flex items-center gap-3 border-b border-border px-4 py-3 text-[13px] md:px-5 md:py-[11px]',
                      isExpired && 'bg-destructive/[0.06]',
                      isExpiring && 'bg-warning/[0.07]',
                    )}
                  >
                    <button
                      onClick={() => navigate(`/clients/${c.id}?tab=membership`)}
                      title="Ver membresía del cliente"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar name={c.display_name ?? c.email} color={avatarColor(c.id)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.display_name ?? c.email}</span>
                        <span className="hidden truncate text-xs text-faint md:block">{c.email}</span>
                        <span className={cn('block truncate text-xs md:hidden', TONE_CLASS[exp.tone])}>
                          {m?.plan_name ? `${m.plan_name}, ` : ''}
                          {exp.label === '—' ? 'sin vencimiento' : exp.label.toLowerCase()}
                        </span>
                      </span>
                    </button>
                    <span className="hidden truncate text-[13px] text-muted-foreground md:block">{m?.plan_name ?? 'Sin plan'}</span>
                    <span className="hidden whitespace-nowrap text-[13px] font-semibold md:block">{money(m?.price ?? null)}</span>
                    <span className="hidden flex-none sm:block">
                      <StatusBadge status={status} />
                    </span>
                    <span className={cn('hidden whitespace-nowrap text-[13px] md:block', TONE_CLASS[exp.tone])}>{exp.label}</span>
                    <span className="flex justify-end gap-1.5">
                      <button
                        onClick={() => void doRenew(c)}
                        title="Renovar 30 días"
                        aria-label="Renovar 30 días"
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-success hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <RotateCw className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                      {status === 'active' && (
                        <button
                          onClick={() => setPauseTarget(c)}
                          title="Pausar"
                          aria-label="Pausar membresía"
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-warning hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pause className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                      )}
                      {status === 'paused' && (
                        <button
                          onClick={() => void doResume(c)}
                          title="Reanudar"
                          aria-label="Reanudar membresía"
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-success hover:text-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        {isError && (
          <EmptyState
            icon={AlertCircle}
            title="No se pudieron cargar las membresías"
            description="Revisa tu conexión e inténtalo otra vez."
          >
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        )}

        {!isError && clients && rows.length === 0 && (
          <EmptyState icon={CreditCard} title="Nada por aquí" description="No hay membresías con este estado." />
        )}
      </div>

      {clients && <div className="text-xs text-faint">{rows.length} membresías</div>}

      <AlertDialog open={!!pauseTarget} onOpenChange={(o) => !o && setPauseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Pausar la membresía de {pauseTarget?.display_name?.split(' ')[0]}?</AlertDialogTitle>
            <AlertDialogDescription>Sigue entrando a la app; la membresía queda marcada en pausa.</AlertDialogDescription>
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
