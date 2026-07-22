import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, UserX } from 'lucide-react';
import { getClient } from '@/services/clients';
import { qk } from '@/lib/queryClient';
import { activityLabel, avatarColor } from '@/lib/utils';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { formatWeight } from '@/lib/weightUnit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/shared/Avatar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { OverviewTab } from './OverviewTab';
import { WorkoutsTab } from './WorkoutsTab';
import { ProgramsTab } from './ProgramsTab';
import { SeguimientoTab } from './SeguimientoTab';
import { NutritionTab } from './NutritionTab';
import { ProgressTab } from './ProgressTab';
import { MembershipTab } from './MembershipTab';

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'programs', label: 'Programas' },
  { id: 'tracking', label: 'Seguimiento' },
  { id: 'workouts', label: 'Rutinas' },
  { id: 'nutrition', label: 'Nutrición' },
  { id: 'progress', label: 'Progreso' },
  { id: 'membership', label: 'Membresía' },
];

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { unit } = useWeightUnit();

  // Keyed by id, so switching clients swaps queries (and shows the skeleton)
  // automatically — no manual reset needed. `null` from getClient = missing.
  const { data: client } = useQuery({
    queryKey: qk.client(id ?? ''),
    queryFn: () => getClient(id!),
    enabled: !!id,
  });

  const tab = searchParams.get('tab') ?? 'overview';
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
    <div className="flex animate-fade-up flex-col gap-[18px]">
      <Link
        to="/clients"
        className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Clientes
      </Link>

      {!client ? (
        <>
          <Skeleton className="h-[124px] rounded-2xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </>
      ) : (
        <>
          {/* Header card */}
          <Card className="flex flex-wrap items-center gap-[18px] p-[22px]">
            <Avatar
              name={client.display_name}
              color={avatarColor(client.id)}
              size={64}
              radiusClass="rounded-[20px] font-heading"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-heading text-[19px] font-semibold">{client.display_name ?? client.email}</span>
                {client.membership && <StatusBadge status={client.membership.status} />}
              </div>
              <div className="mt-0.5 text-[12.5px] text-faint">{client.email}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="rounded-full bg-muted px-[11px] py-[5px] text-xs font-semibold text-muted-foreground">
                  {client.age ?? '—'} años
                </span>
                <span className="rounded-full bg-muted px-[11px] py-[5px] text-xs font-semibold text-muted-foreground">
                  {client.height_cm ?? '—'} cm
                </span>
                <span className="rounded-full bg-muted px-[11px] py-[5px] text-xs font-semibold text-muted-foreground">
                  {formatWeight(client.weight_kg, unit)}
                </span>
                <span className="rounded-full bg-muted px-[11px] py-[5px] text-xs font-semibold text-muted-foreground">
                  Actividad: {activityLabel(client.activity_level)}
                </span>
              </div>
            </div>
          </Card>

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
            <TabsContent value="workouts">
              <WorkoutsTab client={client} onChanged={reload} />
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
