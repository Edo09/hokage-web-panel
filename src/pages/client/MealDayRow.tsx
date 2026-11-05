import { Camera, ChevronRight, UtensilsCrossed } from 'lucide-react';
import type { MealItem, MealWithItems } from '@/types';
import { OwnerBadge } from '@/components/shared/StatusBadge';
import { mealPhotoUrl } from '@/lib/mealPhotos';
import { dayTotals, isPlanRegistration, mealTotals, missingEstimate, nonEmptyMeals } from '@/lib/mealRegistrations';
import { cn, fmtDate, MEAL_TYPE_LABELS, plural, relTime } from '@/lib/utils';

/* «Lo que ha comido»: one collapsible row per day of the client's meals —
   registrations of the plan's meals, and the diary rows from before them.
   Totals add only known numbers (lib/mealRegistrations.ts). */

// Photo column sits first so a day of thumbnails scans as a strip.
const ITEM_GRID = 'grid gap-2 [grid-template-columns:36px_minmax(0,1fr)_56px_40px_40px_40px]';

export function MealDayRow({
  date,
  meals: allMeals,
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
  // Undone meals leave empty containers behind; a day of only those is no day.
  const meals = nonEmptyMeals(allMeals);
  if (meals.length === 0) return null;

  const tot = dayTotals(meals);
  const pct = goal != null && goal > 0 ? Math.min(100, Math.round((tot.cal / goal) * 100)) : null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight className={cn('h-4 w-4 flex-none text-faint transition-transform', open && 'rotate-90')} />
        <span className="min-w-[96px] flex-none">
          <span className="block text-sm font-semibold">{relTime(date)}</span>
          <span className="block text-xs text-faint">{fmtDate(date)}</span>
        </span>

        {/* Meals eaten, photos, plan adherence: the signals a coach scans for. */}
        <span className="flex flex-none items-center gap-3 text-[13px] text-muted-foreground">
          <span>{plural(tot.eaten, 'comida', 'comidas')}</span>
          {tot.photos > 0 && (
            <span className="flex items-center gap-1" title={`${tot.photos} con foto`}>
              <Camera className="h-3.5 w-3.5" /> {tot.photos}
            </span>
          )}
          {tot.planned > 0 && (
            <span className="flex items-center gap-1 text-secondary" title={`${tot.planned} del plan`}>
              <UtensilsCrossed className="h-3.5 w-3.5" /> {tot.planned}
            </span>
          )}
        </span>

        <span className="ml-auto flex items-center gap-3">
          {pct != null && (
            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
              <span
                className={cn('block h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-success')}
                style={{ width: `${pct}%` }}
              />
            </span>
          )}
          <span className="text-right text-[13px] tabular-nums">
            <span className="font-semibold text-foreground">{tot.cal.toLocaleString('en-US')}</span>
            {goal != null && <span className="text-faint"> / {goal.toLocaleString('en-US')}</span>}
            <span className="text-faint"> kcal</span>
            {tot.missing > 0 && <span className="text-faint"> · {tot.missing} sin estimar</span>}
          </span>
          <span className="hidden items-center gap-2.5 text-xs tabular-nums text-muted-foreground md:flex">
            <Macro dot="bg-protein" label="P" value={tot.p} />
            <Macro dot="bg-carbs" label="C" value={tot.c} />
            <Macro dot="bg-fat" label="G" value={tot.f} />
          </span>
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto bg-muted/30 px-4 pb-3 pt-1">
          <div className="min-w-[460px]">
            <div className={`${ITEM_GRID} border-b border-border pb-1.5 pt-1 text-xs font-medium text-faint`}>
              <span />
              <span>Alimento</span>
              <span className="text-right">kcal</span>
              <span className="text-right">P</span>
              <span className="text-right">C</span>
              <span className="text-right">G</span>
            </div>

            {meals.map((m) => {
              const mt = mealTotals(m);
              const typeLabel = MEAL_TYPE_LABELS[m.meal_type] ?? m.meal_type;
              const showName = m.name.toLowerCase() !== typeLabel.toLowerCase();
              return (
                <div key={m.id}>
                  <div className={`${ITEM_GRID} items-center pt-3 text-[13px] font-semibold tabular-nums`}>
                    <span />
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex-none">{typeLabel}</span>
                      {showName && <span className="min-w-0 truncate font-normal text-muted-foreground">{m.name}</span>}
                      {m.assigned_by && <OwnerBadge assignedBy={m.assigned_by} />}
                    </span>
                    <span className="text-right">{mt.cal}</span>
                    <span className="text-right">{Math.round(mt.p)}</span>
                    <span className="text-right">{Math.round(mt.c)}</span>
                    <span className="text-right">{Math.round(mt.f)}</span>
                  </div>

                  {m.meal_items.map((it, i) => (
                    <ItemRow key={i} item={it} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** One food or registration: its photo, its name with «del plan» or «No
 *  comió», and its numbers — or why they're missing. */
function ItemRow({ item: it }: { item: MealItem }) {
  const skipped = it.kind === 'skipped';
  const gap = missingEstimate(it);
  return (
    <div className={`${ITEM_GRID} items-center py-1 text-[13px] tabular-nums`}>
      {/* The photo the client took — the coach's clearest window into what was
          actually on the plate. */}
      {it.photo_path ? (
        <a
          href={mealPhotoUrl(it.photo_path)}
          target="_blank"
          rel="noreferrer"
          title={`Ver foto de ${it.name}`}
          className="block h-8 w-8 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img src={mealPhotoUrl(it.photo_path)} alt="" loading="lazy" className="h-full w-full object-cover" />
        </a>
      ) : (
        <span />
      )}
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn('truncate', skipped && 'text-muted-foreground')}>{it.name}</span>
        {it.portion && <span className="flex-none text-xs text-faint">{it.portion}</span>}
        {isPlanRegistration(it) && (
          <span
            title="Registrado desde el plan"
            className="flex-none rounded-full bg-secondary/15 px-1.5 text-[11px] font-semibold text-secondary"
          >
            del plan
          </span>
        )}
        {skipped && (
          <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            No comió
          </span>
        )}
      </span>
      {skipped ? (
        <span className="col-span-4" />
      ) : gap === 'pending' ? (
        <span className="col-span-4 text-right text-[11px] text-faint">Calculando…</span>
      ) : gap === 'failed' ? (
        <span className="col-span-4 text-right text-[11px] text-warning">Sin estimar</span>
      ) : (
        <>
          <span className="text-right text-muted-foreground">{it.calories}</span>
          <span className="text-right text-muted-foreground">{it.protein_g}</span>
          <span className="text-right text-muted-foreground">{it.carbs_g}</span>
          <span className="text-right text-muted-foreground">{it.fat_g}</span>
        </>
      )}
    </div>
  );
}

function Macro({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label} {Math.round(value)}
    </span>
  );
}
