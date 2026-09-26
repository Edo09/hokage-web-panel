import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { ClientSummary } from '@/types';
import { avatarColor, cn, initials } from '@/lib/utils';
import { lastDays, type AttentionItem, type AttentionTone, type ClientPulse } from '@/lib/insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const TONE: Record<AttentionTone, { tile: string; action: string }> = {
  danger: { tile: 'bg-primary/15 text-primary', action: 'border-primary text-primary hover:bg-primary/10' },
  warning: { tile: 'bg-warning/15 text-warning', action: 'border-warning text-warning hover:bg-warning/10' },
  info: { tile: 'bg-secondary/15 text-secondary', action: 'border-border-strong text-foreground hover:bg-muted' },
  success: { tile: 'bg-success/15 text-success', action: 'border-success text-success hover:bg-success/10' },
};

const nameOf = (c: ClientSummary) => c.display_name ?? c.email;

/** "Hoy necesita tu atención": one row per actionable fact, most urgent first,
 *  each with the one action that resolves it. */
export function AttentionList({ items, loading }: { items: AttentionItem[] | null; loading: boolean }) {
  const shown = items?.slice(0, 8) ?? [];
  const more = (items?.length ?? 0) - shown.length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>Hoy necesita tu atención</CardTitle>
        <span className="text-xs text-faint">{items ? `${items.length} pendientes` : ' '}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading || !items ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={1.8} />
            <p className="text-[13px] font-semibold">Todo al día</p>
            <p className="max-w-[320px] text-[12.5px] text-faint">
              Nadie lleva días sin entrenar, no hay membresías por vencer ni bloques por terminar.
            </p>
          </div>
        ) : (
          <>
            {shown.map((it, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-lg text-[12.5px] font-extrabold', TONE[it.tone].tile)}
                >
                  {initials(nameOf(it.client))}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">
                    <Link to={`/clients/${it.client.id}`} className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {nameOf(it.client)}
                    </Link>{' '}
                    · {it.title}
                  </div>
                  <div className="truncate text-[12px] text-faint">{it.detail}</div>
                </div>
                {it.action.external ? (
                  <a
                    href={it.action.href}
                    target="_blank"
                    rel="noreferrer"
                    className={cn('flex h-9 flex-none items-center rounded-[10px] border px-3 text-[11.5px] font-extrabold uppercase tracking-[0.08em] transition-colors', TONE[it.tone].action)}
                  >
                    {it.action.label}
                  </a>
                ) : (
                  <Link
                    to={it.action.href}
                    className={cn('flex h-9 flex-none items-center rounded-[10px] border px-3 text-[11.5px] font-extrabold uppercase tracking-[0.08em] transition-colors', TONE[it.tone].action)}
                  >
                    {it.action.label}
                  </Link>
                )}
              </div>
            ))}
            {more > 0 && <p className="px-1 text-[12px] text-faint">y {more} más…</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Clients × last 14 days: did they train that day. Most active first. */
export function ConsistencyGrid({
  clients,
  pulse,
  loading,
}: {
  clients: ClientSummary[] | undefined;
  pulse: Map<string, ClientPulse> | null;
  loading: boolean;
}) {
  const days = lastDays(14);
  const today = days[days.length - 1];
  const rows = (clients ?? [])
    .filter((c) => c.membership?.status !== 'cancelled')
    .map((c) => {
      const active = pulse?.get(c.id)?.activeDays ?? new Set<string>();
      return { c, active, count: days.filter((d) => active.has(d)).length };
    })
    .sort((a, b) => b.count - a.count || nameOf(a.c).localeCompare(nameOf(b.c), 'es'))
    .slice(0, 12);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-baseline justify-between space-y-0">
        <CardTitle>Constancia · 14 días</CardTitle>
        <span className="text-xs text-faint">cada cuadro es un día</span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {loading || !pulse ? (
          <Skeleton className="h-[220px] rounded-xl" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-faint">Aún no hay clientes.</p>
        ) : (
          <>
            <div role="table" aria-label="Días entrenados por cliente" className="flex flex-col gap-1">
              {rows.map(({ c, active, count }) => (
                <div role="row" key={c.id} className="grid items-center gap-1 [grid-template-columns:112px_repeat(14,minmax(0,1fr))_28px]">
                  <Link
                    role="rowheader"
                    to={`/clients/${c.id}`}
                    className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ background: avatarColor(c.id) }} />
                    <span className="truncate">{nameOf(c)}</span>
                  </Link>
                  {days.map((d) => (
                    <span
                      role="cell"
                      key={d}
                      title={`${d}${active.has(d) ? ' · entrenó' : ''}`}
                      aria-label={active.has(d) ? `${d}: entrenó` : `${d}: sin sesión`}
                      className={cn('h-5', active.has(d) ? 'bg-primary' : 'bg-muted', d === today && 'outline outline-1 outline-offset-1 outline-border-strong')}
                    />
                  ))}
                  <span role="cell" className="text-right text-[11.5px] font-bold tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-4 pt-2 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-primary" /> Entrenó
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-muted" /> Sin sesión
              </span>
              <Link to="/clients" className="ml-auto font-extrabold uppercase tracking-[0.08em] text-primary hover:underline">
                Todos los clientes →
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
