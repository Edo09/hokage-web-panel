import type { MealItem, MealWithItems } from '@/types';

/* The counting rules for a client's meal rows: the same rules as the app's
   src/utils/meal-counting.ts, ported by hand (the repos share no code).
   A registration is one of today's plan meals registered as a plan option,
   «otra cosa» or «No la comí»; the server estimates the eaten ones. A row
   with no kind was written by the old diary. */

export type EstimateGap = 'pending' | 'failed';

/** Written by the old diary, or read before the migration (no kind key at
 *  all, hence ==). */
export function isOldDiaryRow(i: MealItem): boolean {
  return i.kind == null;
}

/** Food the client ate: a plan or «otra cosa» registration, or an old diary
 *  row. «No la comí» is a registration, not food. */
export function isEaten(i: MealItem): boolean {
  return i.kind == null || i.kind === 'plan' || i.kind === 'other';
}

/** Whether a row's numbers count: an old diary row as written, or a
 *  registration whose estimate is done. Pending and failed add nothing. */
export function countsTowardTotals(i: MealItem): boolean {
  return i.kind == null || i.estimate_status === 'done';
}

/** A registration still waiting for its numbers, or one whose estimate failed. */
export function missingEstimate(i: MealItem): EstimateGap | null {
  if (i.kind !== 'plan' && i.kind !== 'other') return null;
  return i.estimate_status === 'pending' || i.estimate_status === 'failed' ? i.estimate_status : null;
}

/** «del plan»: a plan registration keeps it after the coach removes its
 *  option; an old diary row has it through its option link. */
export function isPlanRegistration(i: MealItem): boolean {
  return i.kind === 'plan' || (i.kind == null && i.plan_option_id != null);
}

/** Undoing a registration leaves its container behind: empty containers
 *  count nowhere. */
export function nonEmptyMeals<T extends { meal_items: unknown[] }>(meals: T[]): T[] {
  return meals.filter((m) => m.meal_items.length > 0);
}

export type Totals = { cal: number; p: number; c: number; f: number };

/** A container's known numbers: missing estimates add nothing. */
export function mealTotals(m: MealWithItems): Totals {
  const t: Totals = { cal: 0, p: 0, c: 0, f: 0 };
  for (const i of m.meal_items) {
    if (!countsTowardTotals(i)) continue;
    t.cal += i.calories;
    t.p += i.protein_g;
    t.c += i.carbs_g;
    t.f += i.fat_g;
  }
  return t;
}

export type DayTotals = Totals & { photos: number; planned: number; eaten: number; missing: number };

/** A day's known numbers and counts. `eaten` is the meals eaten (plan and
 *  «otra cosa» registrations) plus one per container of old diary rows, as
 *  the diary counted them; `missing` is the rows still without numbers. */
export function dayTotals(meals: MealWithItems[]): DayTotals {
  const d: DayTotals = { cal: 0, p: 0, c: 0, f: 0, photos: 0, planned: 0, eaten: 0, missing: 0 };
  for (const m of meals) {
    const t = mealTotals(m);
    d.cal += t.cal;
    d.p += t.p;
    d.c += t.c;
    d.f += t.f;
    let oldRows = false;
    for (const i of m.meal_items) {
      if (i.photo_path) d.photos += 1;
      if (isPlanRegistration(i)) d.planned += 1;
      if (missingEstimate(i) != null) d.missing += 1;
      if (isOldDiaryRow(i)) oldRows = true;
      else if (isEaten(i)) d.eaten += 1;
    }
    if (oldRows) d.eaten += 1;
  }
  return d;
}
