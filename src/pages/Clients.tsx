import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { listClientSummaries } from '@/services/clients';
import { qk } from '@/lib/queryClient';
import { avatarColor, cn, expiryInfo, matchesQuery, relTime } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { AddClientDialog } from '@/components/shared/AddClientDialog';

// A table from md up; on phones each row folds to name, status and expiry.
const GRID =
  'md:grid md:gap-3 md:[grid-template-columns:minmax(220px,2.1fr)_minmax(100px,1fr)_minmax(130px,1.3fr)_minmax(110px,1fr)_minmax(130px,1.2fr)]';

const TONE_CLASS = {
  normal: 'text-muted-foreground',
  warning: 'text-warning',
  danger: 'text-destructive',
  muted: 'text-faint',
} as const;

export default function Clients() {
  const { data: clients, isPending, isError, refetch } = useQuery({
    queryKey: qk.clientSummaries,
    queryFn: listClientSummaries,
  });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  const rows = useMemo(
    () => (clients ?? []).filter((c) => matchesQuery(search, c.display_name, c.email)),
    [clients, search],
  );

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 max-w-[380px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            type="search"
            aria-label="Buscar cliente"
            placeholder="Buscar por nombre o correo"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddOpen(true)} className="ml-auto flex-none" aria-label="Añadir cliente">
          <Plus strokeWidth={2.5} />
          <span className="hidden sm:inline">Añadir cliente</span>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className={cn(GRID, 'hidden border-b border-border px-5 py-3 text-xs font-medium text-faint md:grid')}>
          <span>Cliente</span>
          <span>Membresía</span>
          <span>Plan</span>
          <span>Última actividad</span>
          <span>Vence</span>
        </div>

        {isError ? null : isPending ? (
          <TableSkeleton cols={5} />
        ) : (
          rows.map((c) => {
            const coachCount = c.coachRoutineCount;
            const selfCount = c.selfRoutineCount;
            // logs arrive date-DESC — newest is [0]
            const last = c.logs[0] ?? null;
            const exp = expiryInfo(c.membership);
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className={cn(
                  GRID,
                  'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5',
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={c.display_name ?? c.email} color={avatarColor(c.id)} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.display_name ?? c.email}</span>
                    <span className="block truncate text-xs text-faint md:hidden">
                      <span className={TONE_CLASS[exp.tone]}>{exp.label === '—' ? 'Sin membresía' : exp.label}</span>
                    </span>
                    <span className="hidden truncate text-xs text-faint md:block">{c.email}</span>
                  </span>
                </span>
                <span className="flex-none">
                  <StatusBadge status={c.membership?.status ?? 'paused'} />
                </span>
                <span className="hidden min-w-0 items-center gap-1.5 md:flex">
                  {coachCount > 0 && (
                    <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">Coach</span>
                  )}
                  <span className="truncate text-[13px] text-muted-foreground">
                    {coachCount > 0
                      ? `${coachCount} ${coachCount === 1 ? 'rutina' : 'rutinas'}`
                      : selfCount > 0
                        ? 'Solo propias'
                        : 'Sin plan'}
                  </span>
                </span>
                <span className="hidden whitespace-nowrap text-[13px] text-muted-foreground md:block">
                  {last ? relTime(last.date) : 'Sin actividad'}
                </span>
                <span className={cn('hidden whitespace-nowrap text-[13px] md:block', TONE_CLASS[exp.tone])}>{exp.label}</span>
                <ChevronRight className="h-4 w-4 flex-none text-faint md:hidden" />
              </button>
            );
          })
        )}

        {isError && (
          <EmptyState icon={AlertCircle} title="No se pudieron cargar tus clientes" description="Revisa tu conexión e inténtalo otra vez.">
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        )}

        {!isError && clients && clients.length === 0 && (
          <EmptyState icon={Users} title="Aún no tienes clientes" description="Crea su cuenta y compártele la contraseña por WhatsApp.">
            <Button onClick={() => setAddOpen(true)}>
              <Plus strokeWidth={2.5} /> Añadir el primero
            </Button>
          </EmptyState>
        )}

        {!isError && clients && clients.length > 0 && rows.length === 0 && (
          <EmptyState icon={Search} title="Sin resultados" description={`Nadie coincide con «${search}».`} />
        )}
      </div>

      {clients && clients.length > 0 && (
        <div className="text-xs text-faint">
          {rows.length} {rows.length === 1 ? 'cliente' : 'clientes'}
        </div>
      )}

      <AddClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: qk.clientSummaries })}
      />
    </div>
  );
}
