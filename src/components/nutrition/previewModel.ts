/**
 * Adapters between the two shapes a nutrition plan can be in — a saved row from
 * the DB, or the builder's in-progress draft of strings — and the single
 * camelCase shape MobileNutritionPreview renders.
 *
 * Kept in its own module (not inside the component file) so the component file
 * exports only components, satisfying react-refresh/only-export-components.
 * Same split as components/program/previewModel.ts.
 */
import type {
  DayType,
  NutritionPlanWithDetail,
  PlanMealType,
  SupplementPlanWithDetail,
  SupplementTier,
  SupplementTiming,
} from '@/types';

export interface PreviewFood {
  name: string;
  dayType: DayType;
}

export interface PreviewOption {
  label: string;
  notes: string | null;
  foods: PreviewFood[];
}

export interface PreviewMeal {
  label: string;
  mealType: PlanMealType;
  timeHint: string | null;
  appliesTo: DayType;
  isOptional: boolean;
  notes: string | null;
  options: PreviewOption[];
}

export interface PreviewTarget {
  dayType: DayType;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  /** True when every field was blank — the card is hidden rather than shown empty. */
  empty: boolean;
}

export interface PreviewNutritionPlan {
  name: string;
  focus: string | null;
  notes: string | null;
  dayCycling: boolean;
  meals: PreviewMeal[];
  targets: PreviewTarget[];
}

export interface PreviewSupplement {
  name: string;
  tier: SupplementTier;
  dose: string | null;
  timingSlot: SupplementTiming;
  timingNote: string | null;
  purpose: string | null;
  notes: string | null;
  appliesTo: DayType;
}

export interface PreviewSupplementPlan {
  name: string;
  notes: string | null;
  items: PreviewSupplement[];
}

/** "150" + "155" → "150–155"; equal bounds collapse; one-sided is allowed. */
export function range(a: string | number | null, b: string | number | null): string {
  const x = a == null ? '' : String(a).trim();
  const y = b == null ? '' : String(b).trim();
  if (x && y) return x === y ? x : `${x}–${y}`;
  return x || y || '';
}

/** Foods visible on a given day. 'both' rows always survive. */
export function foodsFor(option: PreviewOption, day: Exclude<DayType, 'both'>): PreviewFood[] {
  return option.foods.filter((f) => f.dayType === 'both' || f.dayType === day);
}

/** Whether a slot exists at all on a given day. A slot gated to training
 *  disappears on rest — but its note is surfaced separately, because that is
 *  where the substitution instruction lives. */
export function mealAppliesOn(meal: PreviewMeal, day: Exclude<DayType, 'both'>): boolean {
  return meal.appliesTo === 'both' || meal.appliesTo === day;
}

function buildTarget(
  dayType: DayType,
  kcalMin: string | number | null,
  kcalMax: string | number | null,
  pMin: string | number | null,
  pMax: string | number | null,
  cMin: string | number | null,
  cMax: string | number | null,
  fMin: string | number | null,
  fMax: string | number | null,
): PreviewTarget {
  const kcal = range(kcalMin, kcalMax);
  const protein = range(pMin, pMax);
  const carbs = range(cMin, cMax);
  const fat = range(fMin, fMax);
  return { dayType, kcal, protein, carbs, fat, empty: !kcal && !protein && !carbs && !fat };
}

/* ---------------- saved row → preview ---------------- */

export function planToPreview(p: NutritionPlanWithDetail): PreviewNutritionPlan {
  return {
    name: p.name,
    focus: p.focus,
    notes: p.notes,
    dayCycling: p.day_cycling,
    meals: [...p.nutrition_plan_meals]
      .sort((a, b) => a.sort_order - b.sort_order || a.slot_index - b.slot_index)
      .map((m) => ({
        label: m.label ?? '',
        mealType: m.meal_type,
        timeHint: m.time_hint,
        appliesTo: m.applies_to,
        isOptional: m.is_optional,
        notes: m.notes,
        options: [...m.nutrition_plan_options]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => ({
            label: o.label ?? '',
            notes: o.notes,
            foods: [...o.nutrition_plan_option_items]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((i) => ({ name: i.name, dayType: i.day_type })),
          })),
      })),
    targets: p.nutrition_plan_targets.map((t) =>
      buildTarget(
        t.day_type,
        t.kcal_min,
        t.kcal_max,
        t.protein_min_g,
        t.protein_max_g,
        t.carbs_min_g,
        t.carbs_max_g,
        t.fat_min_g,
        t.fat_max_g,
      ),
    ),
  };
}

export function supplementPlanToPreview(p: SupplementPlanWithDetail): PreviewSupplementPlan {
  return {
    name: p.name,
    notes: p.notes,
    items: [...p.supplement_plan_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        name: i.name,
        tier: i.tier,
        dose: i.dose,
        timingSlot: i.timing_slot,
        timingNote: i.timing_note,
        purpose: i.purpose,
        notes: i.notes,
        appliesTo: i.applies_to,
      })),
  };
}

/* ---------------- unsaved builder draft → preview ---------------- */

export interface DraftFood {
  name: string;
  dayType: DayType;
}
export interface DraftOption {
  label: string;
  notes: string;
  foods: DraftFood[];
}
export interface DraftMeal {
  label: string;
  mealType: PlanMealType;
  timeHint: string;
  appliesTo: DayType;
  isOptional: boolean;
  notes: string;
  options: DraftOption[];
}
export interface DraftTarget {
  kcalMin: string;
  kcalMax: string;
  proteinMin: string;
  proteinMax: string;
  carbsMin: string;
  carbsMax: string;
  fatMin: string;
  fatMax: string;
}
export interface DraftHeader {
  name: string;
  focus: string;
  notes: string;
  dayCycling: boolean;
}

/** An empty nutrition plan, for previewing a supplement stack on its own — the
 *  two plans are independently assignable, so the phone has to render one
 *  without the other. */
export function emptyPlanPreview(): PreviewNutritionPlan {
  return {
    name: '',
    focus: null,
    notes: null,
    dayCycling: false,
    meals: [],
    targets: [],
  };
}

export function draftToPreview(
  header: DraftHeader,
  meals: DraftMeal[],
  targets: Record<DayType, DraftTarget>,
): PreviewNutritionPlan {
  const dayTypes: DayType[] = header.dayCycling ? ['training', 'rest'] : ['both'];
  return {
    name: header.name.trim() || 'Plan sin nombre',
    focus: header.focus.trim() || null,
    notes: header.notes.trim() || null,
    dayCycling: header.dayCycling,
    meals: meals
      .filter((m) => m.options.some((o) => o.foods.some((f) => f.name.trim())))
      .map((m) => ({
        label: m.label.trim(),
        mealType: m.mealType,
        timeHint: m.timeHint.trim() || null,
        appliesTo: m.appliesTo,
        isOptional: m.isOptional,
        notes: m.notes.trim() || null,
        options: m.options
          .filter((o) => o.foods.some((f) => f.name.trim()))
          .map((o) => ({
            label: o.label.trim(),
            notes: o.notes.trim() || null,
            foods: o.foods
              .filter((f) => f.name.trim())
              .map((f) => ({ name: f.name.trim(), dayType: f.dayType })),
          })),
      })),
    targets: dayTypes.map((dt) => {
      const t = targets[dt];
      return buildTarget(
        dt,
        t.kcalMin,
        t.kcalMax,
        t.proteinMin,
        t.proteinMax,
        t.carbsMin,
        t.carbsMax,
        t.fatMin,
        t.fatMax,
      );
    }),
  };
}

export interface DraftSupplement {
  name: string;
  tier: SupplementTier;
  dose: string;
  timingSlot: SupplementTiming;
  timingNote: string;
  purpose: string;
  notes: string;
  appliesTo: DayType;
}

export function draftToSupplementPreview(
  name: string,
  notes: string,
  items: DraftSupplement[],
): PreviewSupplementPlan {
  return {
    name: name.trim() || 'Suplementación sin nombre',
    notes: notes.trim() || null,
    items: items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        tier: i.tier,
        dose: i.dose.trim() || null,
        timingSlot: i.timingSlot,
        timingNote: i.timingNote.trim() || null,
        purpose: i.purpose.trim() || null,
        notes: i.notes.trim() || null,
        appliesTo: i.appliesTo,
      })),
  };
}
