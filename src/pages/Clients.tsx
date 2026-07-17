import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import type { ClientWithMeta } from '@/types';
import { listClients } from '@/services/clients';
import { avatarColor, cn, expiryInfo, relTime } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { AddClientDialog } from '@/components/shared/AddClientDialog';

const GRID = 'grid gap-3 [grid-template-columns:minmax(220px,2.1fr)_minmax(100px,1fr)_minmax(130px,1.3fr)_minmax(110px,1fr)_minmax(130px,1.2fr)]';

const TONE_CLASS = {
  normal: 'text-muted-foreground',
  warning: 'text-warning',
  danger: 'text-primary',
  muted: 'text-faint',
} as const;

export default function Clients() {
  const [clients, setClients] = useState<ClientWithMeta[] | null>(null);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setClients(null);
    void listClients().then(setClients);
  };
  useEffect(load, []);

  const rows = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) => !q || (c.display_name ?? '').toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-[380px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-faint" />
          <Input
            type="search"
            aria-label="Buscar cliente"
            placeholder="Buscar por nombre o correo…"
            className="bg-card pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1" />
        <Button onClick={() => setAddOpen(true)} className="flex-none">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Añadir cliente
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[780px]">
            <div className={cn(GRID, 'border-b border-border px-5 py-3 text-[11.5px] font-bold uppercase tracking-wider text-faint')}>
              <span>Cliente</span>
              <span>Membresía</span>
              <span>Plan asignado</span>
              <span>Actividad</span>
              <span>Vencimiento</span>
            </div>

            {!clients ? (
              <TableSkeleton cols={5} />
            ) : (
              rows.map((c) => {
                const coachCount = c.routines.filter((r) => r.assigned_by).length;
                const selfCount = c.routines.length - coachCount;
                const last = c.logs.length ? c.logs[c.logs.length - 1] : null;
                const exp = expiryInfo(c.membership);
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/clients/${c.id}`)}
                    className={cn(
                      GRID,
                      'w-full items-center border-b border-border px-5 py-[13px] text-left text-[13px] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={c.display_name ?? c.email} color={avatarColor(c.id)} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold">{c.display_name ?? c.email}</span>
                        <span className="block truncate text-xs text-faint">{c.email}</span>
                      </span>
                    </span>
                    <span>
                      <StatusBadge status={c.membership?.status ?? 'paused'} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {coachCount > 0 && (
                        <span className="flex-none rounded-full bg-primary/10 px-[7px] py-[3px] text-[10.5px] font-bold tracking-wide text-primary dark:bg-primary/15">
                          COACH
                        </span>
                      )}
                      <span className="truncate text-[12.5px] text-muted-foreground">
                        {coachCount > 0
                          ? `${coachCount} ${coachCount === 1 ? 'rutina' : 'rutinas'}`
                          : selfCount > 0
                            ? 'Solo propias'
                            : 'Sin plan'}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
                      {last ? relTime(last.date) : 'Sin actividad'}
                    </span>
                    <span className={cn('whitespace-nowrap text-[12.5px]', TONE_CLASS[exp.tone])}>{exp.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {clients && rows.length === 0 && (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description={`No hay clientes que coincidan con "${search}". Revisa la búsqueda o añade un cliente nuevo.`}
          />
        )}
      </div>

      {clients && <div className="text-xs text-faint">{rows.length} clientes</div>}

      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
    </div>
  );
}
