import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronRight, UtensilsCrossed } from 'lucide-react';
import type { ClientWithMeta, MealWithItems } from '@/types';
import { updateClient } from '@/services/clients';
import { cn, fmtDate, MEAL_TYPE_LABELS, relTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OwnerBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';

const ITEM_GRID = 'grid gap-1.5 [grid-template-columns:2fr_60px_44px_44px_44px]';

export function NutritionTab({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Meals arrive date-DESC; bucket them per day so the tab lists days, not a
  // wall of undated meal cards.
  const mealsByDay = useMemo(() => {
    const map = new Map<string, MealWithItems[]>();
    for (const m of client.meals) {
      const day = m.date.slice(0, 10);
      const bucket = map.get(day);
      if (bucket) bucket.push(m);
      else map.set(day, [m]);
    }
    return [...map.entries()];
  }, [client.meals]);

  // Only the most recent day starts open — everything else is one click away.
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [seededDay, setSeededDay] = useState<string | null>(null);
  const firstDay = mealsByDay[0]?.[0] ?? null;
  if (firstDay != null && firstDay !== seededDay) {
    setSeededDay(firstDay);
    setOpenDays(new Set([firstDay]));
  }
  const toggleDay = (date: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const startEdit = () => {
    setInput(String(client.calorie_goal ?? 2000));
    setEditing(true);
  };

  const save = async () => {
    const v = Math.min(6000, Math.max(800, parseInt(input, 10) || client.calorie_goal || 2000));
    setSaving(true);
    try {
      await updateClient(client.id, { calorie_goal: v });
      setEditing(false);
      onChanged();
      toast.success(`Meta actualizada: ${v.toLocaleString('en-US')} kcal`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Calorie goal */}
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-[220px] flex-1">
          <div className="font-heading text-[14.5px] font-semibold">Meta diaria de calorías</div>
          <p className="mt-0.5 text-[12.5px] text-faint">Se muestra al cliente en su pantalla de inicio.</p>
        </div>
        {!editing ? (
          <div className="flex items-center gap-3.5">
            <span className="font-heading text-[30px] font-bold text-primary">
              {(client.calorie_goal ?? 0).toLocaleString('en-US')}{' '}
              <span className="text-sm font-medium text-faint">kcal</span>
            </span>
            <Button variant="outline" size="sm" onClick={startEdit}>
              Editar
            </Button>
          </div>
        ) : (
          <form
            className="flex items-center gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              type="number"
              aria-label="Meta de calorías"
              className="w-[110px] text-[15px] font-semibold"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <span className="text-[13px] text-faint">kcal</span>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </Card>

      {/* Meals — one collapsible row per day. A client logging 4 meals a day
          would otherwise bury the tab in cards; the row carries the totals a
          coach scans for, and the detail is one click away. */}
      {client.meals.length === 0 ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={UtensilsCrossed}
            title="Sin plan de comidas"
            description={`${(client.display_name ?? client.email).split(' ')[0]} aún no tiene comidas asignadas. El editor de planes de comida llega en la próxima iteración.`}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {mealsByDay.map(([date, meals]) => (
            <DayRow
              key={date}
              date={date}
              meals={meals}
              goal={client.calorie_goal ?? null}
              open={openDays.has(date)}
              onToggle={() => toggleDay(date)}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function DayRow({
  date,
  meals,
  goal,
  open,
  onToggle,
}: {
  date: string;
  meals: MealWithItems[];
  goal: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const tot = meals.reduce(
    (a, m) => {
      for (const i of m.meal_items) {
        a.cal += i.calories;
        a.p += i.protein_g;
        a.c += i.carbs_g;
        a.f += i.fat_g;
      }
      return a;
    },
    { cal: 0, p: 0, c: 0, f: 0 },
  );
  const pct = goal != null && goal > 0 ? Math.min(100, Math.round((tot.cal / goal) * 100)) : null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 flex-none text-faint transition-transform', open && 'rotate-90')}
          strokeWidth={2.25}
        />
        <span className="w-[104px] flex-none text-[13px] font-semibold">{relTime(date)}</span>
        <span className="w-[92px] flex-none text-[12px] text-faint">{fmtDate(date)}</span>

        <span className="flex-none text-[12px] text-faint">
          {meals.length} {meals.length === 1 ? 'comida' : 'comidas'}
        </span>

        {/* kcal vs goal, with a slim bar so a week of days is scannable */}
        <span className="ml-auto flex items-center gap-2.5">
          {pct != null && (
            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
              <span
                className={cn('block h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-secondary')}
                style={{ width: `${pct}%` }}
              />
            </span>
          )}
          <span className="w-[112px] text-right text-[12.5px] tabular-nums">
            <span className="font-semibold text-primary">{tot.cal.toLocaleString('en-US')}</span>
            {goal != null && (
              <span className="text-faint"> / {goal.toLocaleString('en-US')}</span>
            )}
          </span>
          <span className="hidden w-[128px] text-right text-[11.5px] tabular-nums text-faint md:block">
            P {Math.round(tot.p)} · C {Math.round(tot.c)} · G {Math.round(tot.f)}
          </span>
        </span>
      </button>

      {/* One full-width table for the day: meals become section headers, so a
          single meal doesn't leave a row of empty grid tracks beside it. */}
      {open && (
        <div className="bg-muted/30 px-4 pb-3 pt-1">
          <div
            className={`${ITEM_GRID} border-b border-border pb-1 text-[10px] font-bold uppercase tracking-wider text-faint`}
          >
            <span>Alimento</span>
            <span className="text-right">kcal</span>
            <span className="text-right">P</span>
            <span className="text-right">C</span>
            <span className="text-right">G</span>
          </div>

          {meals.map((m) => {
            const mt = m.meal_items.reduce(
              (a, i) => ({
                cal: a.cal + i.calories,
                p: a.p + i.protein_g,
                c: a.c + i.carbs_g,
                f: a.f + i.fat_g,
              }),
              { cal: 0, p: 0, c: 0, f: 0 },
            );
            const typeLabel = MEAL_TYPE_LABELS[m.meal_type] ?? m.meal_type;
            const showName = m.name.toLowerCase() !== typeLabel.toLowerCase();
            return (
              <div key={m.id}>
                {/* Meal section header + its totals on the same line */}
                <div className={`${ITEM_GRID} items-center pt-2.5 text-[12px] font-bold tabular-nums`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex-none rounded-full bg-secondary/10 px-2 py-[2px] text-[10.5px] font-bold text-secondary dark:bg-secondary/15">
                      {typeLabel}
                    </span>
                    {showName && (
                      <span className="min-w-0 truncate text-[12px] font-semibold text-muted-foreground">
                        {m.name}
                      </span>
                    )}
                    {m.assigned_by && <OwnerBadge assignedBy={m.assigned_by} />}
                  </span>
                  <span className="text-right text-primary">{mt.cal}</span>
                  <span className="text-right">{Math.round(mt.p)}</span>
                  <span className="text-right">{Math.round(mt.c)}</span>
                  <span className="text-right">{Math.round(mt.f)}</span>
                </div>

                {m.meal_items.map((it, i) => (
                  <div
                    key={i}
                    className={`${ITEM_GRID} items-center py-[3px] text-[12px] tabular-nums`}
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5 pl-3">
                      <span className="truncate">{it.name}</span>
                      {it.portion && (
                        <span className="flex-none text-[10.5px] text-faint">{it.portion}</span>
                      )}
                    </span>
                    <span className="text-right text-muted-foreground">{it.calories}</span>
                    <span className="text-right text-muted-foreground">{it.protein_g}</span>
                    <span className="text-right text-muted-foreground">{it.carbs_g}</span>
                    <span className="text-right text-muted-foreground">{it.fat_g}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
