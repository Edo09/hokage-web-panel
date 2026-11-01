import type { NutritionPlanWithDetail } from '@/types';

/** A plan's calorie target as the cards show it: "2,200" or "2,000–2,400"
 *  (training day, else every day); null when it sets no calories. */
export const kcalText = (p: NutritionPlanWithDetail): string | null => {
  const t =
    p.nutrition_plan_targets.find((x) => x.day_type === 'training') ??
    p.nutrition_plan_targets.find((x) => x.day_type === 'both');
  if (!t || (t.kcal_min == null && t.kcal_max == null)) return null;
  const a = t.kcal_min ?? t.kcal_max!;
  const b = t.kcal_max ?? t.kcal_min!;
  return a === b ? a.toLocaleString('en-US') : `${a.toLocaleString('en-US')}–${b.toLocaleString('en-US')}`;
};
