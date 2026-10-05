/**
 * The nutrition builder's row model and its pure helpers — shared by the
 * wizard (NutritionPlanBuilder), the AI adapter (aiModel) and the review
 * panel (AiNutritionResultPanel). Same split as components/program/builderModel.ts.
 *
 * Every field is a string while it's being edited; parsing happens at save.
 * A food row is a NAME and a day type — nothing else (no portion, no macros):
 * the coach prescribes what to eat, the numbers are measured from the
 * client's photo. The only figures here are the plan-level targets.
 */
import type { DayType, NutritionPlanWithDetail, PlanMealType, PlanStatus } from '@/types';

export const MEAL_TYPES: { value: PlanMealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Almuerzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Merienda' },
  { value: 'pre_workout', label: 'Pre-entrenamiento' },
  { value: 'post_workout', label: 'Post-entrenamiento' },
];
export const MEAL_TYPE_VALUES: PlanMealType[] = MEAL_TYPES.map((m) => m.value);
export const mealTypeLabel = (v: PlanMealType): string => MEAL_TYPES.find((m) => m.value === v)?.label ?? v;

/** Whole-slot gating: "POST-ENTRENAMIENTO (SOLO DÍAS DE ENTRENAMIENTO)". */
export const APPLIES_TO: { value: DayType; label: string }[] = [
  { value: 'both', label: 'Ambos días' },
  { value: 'training', label: 'Solo entrenamiento' },
  { value: 'rest', label: 'Solo descanso' },
];

/** Per-food gating — the carb cycling itself. Short labels: this sits inline. */
export const FOOD_DAYS: { value: DayType; label: string }[] = [
  { value: 'both', label: 'Ambos' },
  { value: 'training', label: 'Entreno' },
  { value: 'rest', label: 'Descanso' },
];
export const DAY_TYPES: DayType[] = ['both', 'training', 'rest'];

/** "Días de entrenamiento" / "Días de descanso" / "Todos los días". */
export const dayTypeTitle = (dt: DayType): string =>
  dt === 'training' ? 'Días de entrenamiento' : dt === 'rest' ? 'Días de descanso' : 'Todos los días';

/** The target rows a plan carries: training + rest with cycling, one 'both' row without. */
export const dayTypesFor = (dayCycling: boolean): DayType[] => (dayCycling ? ['training', 'rest'] : ['both']);

export const STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
];

export const toInt = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : null;
};
export const toNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
export const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/** "150" + "155" → "150–155"; equal bounds collapse; one-sided is allowed; blank → "—". */
export const rangeText = (min: string, max: string): string => {
  const a = min.trim();
  const b = max.trim();
  if (a && b) return a === b ? a : `${a}–${b}`;
  return a || b || '—';
};

/* ---- builder row models (all strings; parsed at submit) ---- */
export interface FoodRow {
  name: string;
  dayType: DayType;
}
export interface OptionRow {
  /** DB id of an option loaded from an existing plan — sent back on save so
   *  the RPC updates it in place and diary entries registered from it stay
   *  linked. Absent on options added in the builder. */
  id?: string;
  label: string;
  notes: string;
  foods: FoodRow[];
}
export interface MealRow {
  /** DB id when loaded from an existing plan (see OptionRow.id). */
  id?: string;
  label: string;
  mealType: PlanMealType;
  timeHint: string;
  appliesTo: DayType;
  isOptional: boolean;
  notes: string;
  options: OptionRow[];
  /** UI-only: whether the slot's advanced disclosure is expanded. Not sent. */
  advOpen: boolean;
}
export interface TargetRow {
  kcalMin: string;
  kcalMax: string;
  proteinMin: string;
  proteinMax: string;
  carbsMin: string;
  carbsMax: string;
  fatMin: string;
  fatMax: string;
}

/** The whole form as one value — what the AI assistant reads and replaces,
 *  and what its "Deshacer" puts back. */
export interface NutritionDraft {
  name: string;
  focus: string;
  description: string;
  /** '' = open-ended phase. */
  durationWeeks: string;
  startDate: string;
  status: PlanStatus;
  dayCycling: boolean;
  notes: string;
  meals: MealRow[];
  targets: Record<DayType, TargetRow>;
}

export const emptyFood = (): FoodRow => ({ name: '', dayType: 'both' });
export const emptyOption = (n: number): OptionRow => ({
  label: `Opción ${n}`,
  notes: '',
  foods: [emptyFood()],
});
export const emptyMeal = (): MealRow => ({
  label: '',
  mealType: 'breakfast',
  timeHint: '',
  appliesTo: 'both',
  isOptional: false,
  notes: '',
  options: [emptyOption(1)],
  advOpen: false,
});
export const emptyTarget = (): TargetRow => ({
  kcalMin: '',
  kcalMax: '',
  proteinMin: '',
  proteinMax: '',
  carbsMin: '',
  carbsMax: '',
  fatMin: '',
  fatMax: '',
});
export const emptyTargets = (): Record<DayType, TargetRow> => ({
  both: emptyTarget(),
  training: emptyTarget(),
  rest: emptyTarget(),
});

export const targetHasData = (t: TargetRow): boolean => Object.values(t).some((v) => v.trim() !== '');

/** Whether a slot's advanced fields have anything set (what opens the disclosure). */
export const mealHasAdvanced = (m: MealRow): boolean =>
  m.appliesTo !== 'both' || m.isOptional || !!m.timeHint.trim() || !!m.notes.trim();

/** What's set behind a collapsed "Avanzado" — shown next to the toggle so
 *  configured values are never invisible. */
export const advSummary = (m: MealRow): string => {
  const parts: string[] = [];
  if (m.appliesTo !== 'both') {
    parts.push(APPLIES_TO.find((a) => a.value === m.appliesTo)?.label.toLowerCase() ?? '');
  }
  if (m.isOptional) parts.push('opcional');
  if (m.timeHint.trim()) parts.push(m.timeHint.trim());
  if (m.notes.trim()) parts.push('con nota');
  return parts.filter(Boolean).join(' · ');
};

/** Foods with a name, across the whole plan. */
export const foodCount = (meals: MealRow[]): number =>
  meals.reduce((a, m) => a + m.options.reduce((b, o) => b + o.foods.filter((f) => f.name.trim()).length, 0), 0);

/** Compares drafts by content. Ignores advOpen, which only records whether a
 *  slot's "Avanzado" disclosure is expanded. */
export const draftSignature = (d: NutritionDraft): string =>
  JSON.stringify(d, (key, value: unknown) => (key === 'advOpen' ? undefined : value));

/* ---- edit prefill ---- */
export const mealsFrom = (p: NutritionPlanWithDetail): MealRow[] =>
  p.nutrition_plan_meals.length === 0
    ? [emptyMeal()]
    : [...p.nutrition_plan_meals]
        .sort((a, b) => a.sort_order - b.sort_order || a.slot_index - b.slot_index)
        .map((m) => ({
          id: m.id,
          label: m.label ?? '',
          mealType: m.meal_type,
          timeHint: m.time_hint ?? '',
          appliesTo: m.applies_to,
          isOptional: m.is_optional,
          notes: m.notes ?? '',
          advOpen: m.applies_to !== 'both' || m.is_optional || !!m.time_hint || !!m.notes,
          options:
            m.nutrition_plan_options.length === 0
              ? [emptyOption(1)]
              : [...m.nutrition_plan_options]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((o) => ({
                    id: o.id,
                    label: o.label ?? '',
                    notes: o.notes ?? '',
                    foods:
                      o.nutrition_plan_option_items.length === 0
                        ? [emptyFood()]
                        : [...o.nutrition_plan_option_items]
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((i) => ({ name: i.name, dayType: i.day_type })),
                  })),
        }));

export const targetsFrom = (p: NutritionPlanWithDetail): Record<DayType, TargetRow> => {
  const out = emptyTargets();
  for (const t of p.nutrition_plan_targets) {
    out[t.day_type] = {
      kcalMin: t.kcal_min != null ? String(t.kcal_min) : '',
      kcalMax: t.kcal_max != null ? String(t.kcal_max) : '',
      proteinMin: t.protein_min_g != null ? String(t.protein_min_g) : '',
      proteinMax: t.protein_max_g != null ? String(t.protein_max_g) : '',
      carbsMin: t.carbs_min_g != null ? String(t.carbs_min_g) : '',
      carbsMax: t.carbs_max_g != null ? String(t.carbs_max_g) : '',
      fatMin: t.fat_min_g != null ? String(t.fat_min_g) : '',
      fatMax: t.fat_max_g != null ? String(t.fat_max_g) : '',
    };
  }
  return out;
};
