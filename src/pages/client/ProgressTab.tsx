import { useMemo } from 'react';
import { Dumbbell } from 'lucide-react';
import type { ClientWithMeta } from '@/types';
import { daysDiff, fmtShort } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { WeeklyBarChart, type WeekBar } from '@/components/shared/charts';

export function ProgressTab({ client }: { client: ClientWithMeta }) {
  const { bars, total, avg, recent } = useMemo(() => {
    const bars: WeekBar[] = Array.from({ length: 6 }, (_, i) => {
      const value = client.logs.filter((l) => {
        const d = -daysDiff(l.date);
        return d >= (5 - i) * 7 - 6 && d <= (5 - i) * 7;
      }).length;
      return { label: i === 5 ? 'Esta' : `-${5 - i}`, value, current: i === 5 };
    });
    const total = client.logs.length;
    const avg = total ? Math.round(client.logs.reduce((a, l) => a + l.duration_minutes, 0) / total) : 0;
    const recent = [...client.logs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    return { bars, total, avg, recent };
  }, [client]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,1.1fr)_minmax(320px,1.6fr)]">
      <Card>
        <CardHeader className="flex-row items-baseline justify-between space-y-0">
          <CardTitle>Frecuencia semanal</CardTitle>
          <span className="text-xs text-faint">6 semanas</span>
        </CardHeader>
        <CardContent>
          <WeeklyBarChart data={bars} height={130} />
          <div className="mt-4 flex gap-4 border-t border-border pt-3.5">
            <div>
              <div className="text-[11.5px] font-semibold text-faint">Total registrado</div>
              <div className="font-heading text-lg font-bold">{total} entrenos</div>
            </div>
            <div>
              <div className="text-[11.5px] font-semibold text-faint">Duración media</div>
              <div className="font-heading text-lg font-bold">{avg} min</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de entrenos</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="Aún sin entrenos"
              description={`Cuando ${client.display_name.split(' ')[0]} registre entrenos en la app, aparecerán aquí.`}
              className="py-9"
            />
          ) : (
            <div className="flex flex-col">
              {recent.map((lg) => (
                <div key={lg.id} className="flex gap-3.5 border-b border-border py-[11px]">
                  <div className="w-16 flex-none pt-0.5 text-[11.5px] font-semibold text-faint">
                    {fmtShort(lg.date)}
                  </div>
                  <div className="flex w-2 flex-none flex-col items-center pt-[5px]">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{lg.routine_name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {lg.duration_minutes} min
                      </span>
                    </div>
                    {lg.notes && <p className="mt-0.5 text-xs text-faint">{lg.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
