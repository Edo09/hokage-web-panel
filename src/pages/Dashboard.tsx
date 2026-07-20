import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CreditCard, Dumbbell, Plus, Users } from 'lucide-react';
import { getClientTrend, listClientSummaries } from '@/services/clients';
import { getRecentActivity } from '@/services/tracking';
import { qk } from '@/lib/queryClient';
import { avatarColor, daysDiff, monthAbbr, relTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/shared/StatTile';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrendAreaChart, WeeklyBarChart, type WeekBar } from '@/components/shared/charts';
import { AddClientDialog } from '@/components/shared/AddClientDialog';

interface FeedItem {
  clientId: string;
  clientName: string;
  text: string;
  time: string;
  date: number;
}

export default function Dashboard() {
  const clientsQuery = useQuery({ queryKey: qk.clientSummaries, queryFn: listClientSummaries });
  const trendQuery = useQuery({ queryKey: qk.clientTrend, queryFn: getClientTrend });
  const activityQuery = useQuery({ queryKey: qk.recentActivity, queryFn: () => getRecentActivity() });
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  const clients = clientsQuery.data;
  const trend = trendQuery.data ?? [];
  const isError = clientsQuery.isError || trendQuery.isError || activityQuery.isError;

  const onCreated = () => {
    void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });
    void queryClient.invalidateQueries({ queryKey: qk.clientTrend });
  };

  // Month ticks under the 12-week trend chart. Mirrors getClientTrend's
  // Monday-based window; renders each distinct month once (was hardcoded).
  const monthTicks = useMemo(() => {
    const WEEK = 7 * 86_400_000;
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const labels: string[] = [];
    for (let i = 0; i < 12; i++) {
      const mo = monthAbbr(new Date(monday.getTime() - (11 - i) * WEEK));
      if (labels[labels.length - 1] !== mo) labels.push(mo);
    }
    return labels;
  }, []);

  const stats = useMemo(() => {
    if (!clients) return null;
    const active = clients.filter((c) => c.membership?.status === 'active');
    const paused = clients.filter((c) => c.membership?.status === 'paused');
    const expiring = active.filter((c) => {
      if (!c.membership?.expires_at) return false;
      const d = daysDiff(c.membership.expires_at);
      return d >= 0 && d <= 7;
    });
    const allLogs = clients.flatMap((c) =>
      c.logs.map((l) => ({
        clientId: c.id,
        clientName: c.display_name ?? c.email,
        routine: l.routine_name,
        date: new Date(l.date).getTime(),
        dateIso: l.date,
      })),
    );
    const weekLogs = allLogs.filter((l) => daysDiff(l.dateIso) > -7).length;

    const weekBars: WeekBar[] = Array.from({ length: 8 }, (_, i) => {
      const value = allLogs.filter((l) => {
        const d = -daysDiff(l.dateIso);
        return d >= (7 - i) * 7 - 6 && d <= (7 - i) * 7;
      }).length;
      return { label: i === 7 ? 'Esta' : `-${7 - i} sem`, value, current: i === 7 };
    });

    const feed: FeedItem[] = allLogs
      .sort((a, b) => b.date - a.date)
      .slice(0, 7)
      .map((l) => ({
        clientId: l.clientId,
        clientName: l.clientName,
        text: `${l.clientName} completó "${l.routine}"`,
        time: relTime(l.dateIso),
        date: l.date,
      }));

    return { active, paused, expiring, weekLogs, weekBars, feed };
  }, [clients]);

  if (isError) {
    return (
      <Card className="animate-fade-up">
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar el panel"
          description="Hubo un problema al cargar los datos. Revisa tu conexión e inténtalo de nuevo."
        >
          <Button
            variant="outline"
            onClick={() => {
              void clientsQuery.refetch();
              void trendQuery.refetch();
            }}
            className="mt-1"
          >
            Reintentar
          </Button>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      {/* KPI tiles */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))' }}>
        {!stats || !clients ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
        ) : (
          <>
            <StatTile
              label="Clientes"
              value={clients.length}
              sub={`${stats.active.length} con membresía activa`}
              subTone="success"
              icon={Users}
              tone="primary"
            />
            <StatTile
              label="Membresías activas"
              value={stats.active.length}
              sub={`${stats.paused.length} en pausa`}
              icon={CreditCard}
              tone="secondary"
            />
            <StatTile
              label="Vencen en 7 días"
              value={stats.expiring.length}
              sub={stats.expiring.length ? 'Requieren renovación' : 'Todo al día'}
              subTone={stats.expiring.length ? 'warning' : 'muted'}
              icon={AlertCircle}
              tone="warning"
            />
            <StatTile
              label="Entrenos esta semana"
              value={stats.weekLogs}
              sub="entre todos los clientes"
              icon={Dumbbell}
              tone="success"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Card>
          <CardHeader className="flex-row items-baseline justify-between space-y-0">
            <CardTitle>Clientes activos</CardTitle>
            <span className="text-xs text-faint">últimas 12 semanas</span>
          </CardHeader>
          <CardContent>
            {trend.length ? <TrendAreaChart data={trend} /> : <Skeleton className="h-[150px] rounded-xl" />}
            <div className="mt-2 flex justify-between text-[11.5px] text-faint">
              {monthTicks.map((mo, i) => (
                <span key={i}>{mo}</span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-baseline justify-between space-y-0">
            <CardTitle>Entrenos por semana</CardTitle>
            <span className="text-xs text-faint">todos los clientes</span>
          </CardHeader>
          <CardContent>
            {stats ? <WeeklyBarChart data={stats.weekBars} /> : <Skeleton className="h-[150px] rounded-xl" />}
          </CardContent>
        </Card>
      </div>

      {/* Feed + quick actions */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-[34px] w-[34px] rounded-full" />
                    <Skeleton className="h-3 flex-1 rounded-md" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {stats.feed.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border px-0.5 py-[11px]">
                    <Avatar name={a.clientName} color={avatarColor(a.clientId)} size={34} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{a.text}</span>
                    <span className="flex-none text-xs text-faint">{a.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              <Button onClick={() => setAddOpen(true)} className="justify-start">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Añadir cliente
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link to="/clients">
                  <Dumbbell className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Asignar rutina
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Por vencer</CardTitle>
            </CardHeader>
            <CardContent>
              {!stats ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : stats.expiring.length === 0 ? (
                <p className="text-[12.5px] text-faint">Nada por vencer esta semana.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {stats.expiring.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/clients/${c.id}?tab=membership`)}
                      className="flex w-full items-center gap-[11px] rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar name={c.display_name ?? c.email} color={avatarColor(c.id)} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{c.display_name ?? c.email}</span>
                        <span className="block text-[11.5px] text-faint">{c.membership!.plan_name}</span>
                      </span>
                      <span className="flex-none rounded-full bg-warning/15 px-2 py-1 text-[11px] font-bold text-warning">
                        {daysDiff(c.membership!.expires_at!)} d
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} onCreated={onCreated} />
    </div>
  );
}
