import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Ellipsis, KeyRound, MessageCircle, UserX } from 'lucide-react';
import { getClient } from '@/services/clients';
import { qk } from '@/lib/queryClient';
import { activityLabel, avatarColor, fmtShort } from '@/lib/utils';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { formatWeight } from '@/lib/weightUnit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResetPasswordDialog } from '@/components/shared/ResetPasswordDialog';
import { OverviewTab } from './OverviewTab';
import { ProgramsTab } from './ProgramsTab';
import { SeguimientoTab } from './SeguimientoTab';
import { NutritionTab } from './NutritionTab';
import { ProgressTab } from './ProgressTab';
import { MembershipTab } from './MembershipTab';

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'programs', label: 'Programas' },
  { id: 'tracking', label: 'Seguimiento' },
  { id: 'nutrition', label: 'Nutrición' },
  { id: 'progress', label: 'Progreso' },
  { id: 'membership', label: 'Membresía' },
];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { unit } = useWeightUnit();
  const [resetOpen, setResetOpen] = useState(false);

  // Keyed by id, so switching clients swaps queries (and shows the skeleton)
  // automatically — no manual reset needed. `null` from getClient = missing.
  const { data: client } = useQuery({
    queryKey: qk.client(id ?? ''),
    queryFn: () => getClient(id!),
    enabled: !!id,
  });
  const whatsapp = (client?.whatsapp ?? '').replace(/\D/g, '');

  const requestedTab = searchParams.get('tab') ?? 'overview';
  // Fall back to overview for a removed/unknown tab (e.g. an old ?tab=workouts link).
  const tab = TABS.some((t) => t.id === requestedTab) ? requestedTab : 'overview';
  const setTab = (t: string) => setSearchParams(t === 'overview' ? {} : { tab: t }, { replace: true });

  // Refetch this client after a tab writes, and refresh the lists so the
  // change (calorie goal, membership, routine counts) shows there too.
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: qk.client(id ?? '') });
    void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });
  };

  if (client === null) {
    return (
      <Card>
        <EmptyState icon={UserX} title="Cliente no encontrado" description="Puede que haya sido eliminado.">
          <Button variant="outline" asChild className="mt-1">
            <Link to="/clients">Volver a Clientes</Link>
          </Button>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <Link
        to="/clients"
        className="-ml-1 flex w-fit items-center gap-1 rounded-md px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Clientes
      </Link>

      {!client ? (
        <>
          <Skeleton className="h-[96px] rounded-xl" />
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-[300px] rounded-xl" />
        </>
      ) : (
        <>
          {/* Header: who, their status, and the two ways to reach them. */}
          <div className="flex flex-wrap items-start gap-4">
            <Avatar
              name={client.display_name ?? client.email}
              color={avatarColor(client.id)}
              size={60}
              radiusClass="rounded-2xl"
              className="font-display text-[24px] font-normal"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h2 className="display min-w-0 break-words text-[30px] sm:text-[36px]">{client.display_name ?? client.email}</h2>
                {client.membership && <StatusBadge status={client.membership.status} />}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                <span className="truncate">{client.email}</span>
                {client.created_at && <span>Cliente desde {fmtShort(client.created_at)}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  `${client.age ?? '—'} años`,
                  `${client.height_cm ?? '—'} cm`,
                  formatWeight(client.weight_kg, unit),
                  `Actividad: ${activityLabel(client.activity_level).toLowerCase()}`,
                ].map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex w-full items-center gap-1.5 sm:w-auto sm:flex-none">
              {whatsapp && (
                <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none">
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="!text-success" />
                    WhatsApp
                  </a>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Más acciones del cliente">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                    <KeyRound />
                    Restablecer contraseña
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <ResetPasswordDialog
            open={resetOpen}
            onOpenChange={setResetOpen}
            clientName={client.display_name ?? client.email}
            clientId={client.id}
          />

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Secciones del cliente">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview">
              <OverviewTab client={client} onGoTab={setTab} onChanged={reload} />
            </TabsContent>
            <TabsContent value="programs">
              <ProgramsTab client={client} />
            </TabsContent>
            <TabsContent value="tracking">
              <SeguimientoTab client={client} />
            </TabsContent>
            <TabsContent value="nutrition">
              <NutritionTab client={client} onChanged={reload} />
            </TabsContent>
            <TabsContent value="progress">
              <ProgressTab client={client} />
            </TabsContent>
            <TabsContent value="membership">
              <MembershipTab client={client} onChanged={reload} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
