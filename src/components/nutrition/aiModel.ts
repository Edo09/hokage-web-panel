/**
 * Builder draft ⇄ the JSON the generate-nutrition-plan Edge Function reads
 * and writes (hokage-coaching-app: supabase/functions/generate-nutrition-plan/prompt.ts).
 *
 * Model output is untrusted, so aiToDraft clamps every number to the ranges
 * the DB CHECKs enforce, orders every min/max pair, forces the day types a
 * plan without cycling can hold, and maps each kept `ref` back to the builder
 * row it came from. A kept row carries its DB id, so saving updates it in
 * place: an option keeps the diary entries the client registered from it —
 * but only while it still holds at least one of the same foods. An option
 * whose foods were all swapped is a different meal, and becomes a new row.
 *
 * Foods are free text (no catalog), so nothing is dropped for being unknown.
 */
import type { DayType, PlanMealType } from '@/types';
import {
  DAY_TYPES,
  dayTypesFor,
  dayTypeTitle,
  emptyTargets,
  foodCount,
  MEAL_TYPE_VALUES,
  mealHasAdvanced,
  mealTypeLabel,
  rangeText,
  targetHasData,
  toInt,
  toNum,
  type FoodRow,
  type MealRow,
  type NutritionDraft,
  type OptionRow,
  type TargetRow,
} from '@/components/nutrition/builderModel';

/* ---- the JSON shape, as the function sends and receives it ---- */

export interface AiFood {
  name: string;
  day_type: DayType;
}
export interface AiOption {
  ref: string | null;
  label: string | null;
  notes: string | null;
  foods: AiFood[];
}
export interface AiMeal {
  ref: string | null;
  label: string | null;
  meal_type: PlanMealType;
  time_hint: string | null;
  applies_to: DayType;
  is_optional: boolean;
  notes: string | null;
  options: AiOption[];
}
export interface AiTarget {
  day_type: DayType;
  kcal_min: number | null;
  kcal_max: number | null;
  protein_min_g: number | null;
  protein_max_g: number | null;
  carbs_min_g: number | null;
  carbs_max_g: number | null;
  fat_min_g: number | null;
  fat_max_g: number | null;
}
export interface AiNutritionPlan {
  name: string;
  focus: string | null;
  description: string | null;
  /** null = open-ended phase. */
  duration_weeks: number | null;
  day_cycling: boolean;
  notes: string | null;
  targets: AiTarget[];
  meals: AiMeal[];
}

/** What the dialog needs from the builder it sits in. */
export interface NutritionAiHost {
  isTemplate: boolean;
  /** Whether the builder is editing a saved plan (its options may already have diary entries). */
  hasInitial: boolean;
  /** The client the plan is for; null for a library template. */
  clientId: string | null;
  firstName: string;
  /** Whether the draft already has a food — only then is "Modificar el actual" offered. */
  hasContent: boolean;
  /** The whole form as it stands. */
  snapshot: () => NutritionDraft;
  /** Replace the whole form at once (an AI result, or undoing one). */
  replaceDraft: (next: NutritionDraft) => void;
}

// Refs are positions in the draft the request was built from — stable for
// the one request/response round trip, which is all they need to be.
const mealRef = (mi: number) => `m${mi + 1}`;
const optionRef = (mi: number, oi: number) => `m${mi + 1}o${oi + 1}`;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The builder's current draft as the model's `current_plan`. */
export function draftToAi(d: NutritionDraft): AiNutritionPlan {
  const weeks = toInt(d.durationWeeks);
  const cycling = d.dayCycling;
  return {
    name: d.name.trim(),
    focus: d.focus.trim() || null,
    description: d.description.trim() || null,
    duration_weeks: weeks == null ? null : clamp(weeks, 1, 52),
    day_cycling: cycling,
    notes: d.notes.trim() || null,
    targets: dayTypesFor(cycling)
      .filter((dt) => targetHasData(d.targets[dt]))
      .map((dt) => {
        const t = d.targets[dt];
        return {
          day_type: dt,
          kcal_min: toInt(t.kcalMin),
          kcal_max: toInt(t.kcalMax),
          protein_min_g: toNum(t.proteinMin),
          protein_max_g: toNum(t.proteinMax),
          carbs_min_g: toNum(t.carbsMin),
          carbs_max_g: toNum(t.carbsMax),
          fat_min_g: toNum(t.fatMin),
          fat_max_g: toNum(t.fatMax),
        };
      }),
    meals: d.meals
      .map((m, mi) => ({
        ref: mealRef(mi),
        label: m.label.trim() || null,
        meal_type: m.mealType,
        time_hint: m.timeHint.trim() || null,
        applies_to: cycling ? m.appliesTo : ('both' as DayType),
        is_optional: m.isOptional,
        notes: m.notes.trim() || null,
        options: m.options.flatMap((o, oi) => {
          const foods = o.foods
            .filter((f) => f.name.trim())
            .map((f) => ({ name: f.name.trim(), day_type: cycling ? f.dayType : ('both' as DayType) }));
          return foods.length === 0
            ? []
            : [{ ref: optionRef(mi, oi), label: o.label.trim() || null, notes: o.notes.trim() || null, foods }];
        }),
      }))
      .filter((m) => m.options.length > 0),
  };
}

/* ---- model output → builder rows ---- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

const asNumber = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
/** A whole number clamped into [lo, hi], or null when absent/not a number. */
const int = (v: unknown, lo: number, hi: number): number | null => {
  const n = asNumber(v);
  return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : null;
};
/** A number with at most one decimal, clamped into [lo, hi], or null. */
const num = (v: unknown, lo: number, hi: number): number | null => {
  const n = asNumber(v);
  return Number.isFinite(n) ? clamp(Math.round(n * 10) / 10, lo, hi) : null;
};
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const str = (n: number | null): string => (n == null ? '' : String(n));
/** A min/max pair in order — the DB rejects min > max. */
const ordered = (a: number | null, b: number | null): [string, string] =>
  a != null && b != null && a > b ? [str(b), str(a)] : [str(a), str(b)];
const dayType = (v: unknown): DayType => (typeof v === 'string' && (DAY_TYPES as string[]).includes(v) ? (v as DayType) : 'both');

/** Same food, whatever the model did to case, accents or spacing. */
export const foodKey = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

const namedFoods = (o: OptionRow) => o.foods.filter((f) => f.name.trim());
const sharesFood = (prev: OptionRow, next: FoodRow[]) => {
  const keys = new Set(namedFoods(prev).map((f) => foodKey(f.name)));
  return next.some((f) => keys.has(foodKey(f.name)));
};

export interface AiNutritionDraft {
  header: Pick<NutritionDraft, 'name' | 'focus' | 'description' | 'durationWeeks' | 'dayCycling' | 'notes'>;
  meals: MealRow[];
  targets: Record<DayType, TargetRow>;
  /** What the model says it did, for the coach. */
  summary: string;
}

/**
 * The model's plan → builder rows, or null if nothing usable is left.
 *
 * `before` is the draft the request was built from (edit mode) — its rows are
 * what the refs point at. null for a new plan.
 */
export function aiToDraft(raw: unknown, before: MealRow[] | null): AiNutritionDraft | null {
  if (!isObj(raw)) return null;

  // A plan without cycling has one kind of day: every slot and food is 'both'.
  // Should the model leave the switch out, infer it from what it gated.
  const cycling =
    typeof raw.day_cycling === 'boolean'
      ? raw.day_cycling
      : list(raw.targets).some((t) => dayType(t.day_type) !== 'both') ||
        list(raw.meals).some(
          (m) =>
            dayType(m.applies_to) !== 'both' ||
            list(m.options).some((o) => list(o.foods).some((f) => dayType(f.day_type) !== 'both')),
        );
  const gate = (v: unknown): DayType => (cycling ? dayType(v) : 'both');

  // Refs → the rows they came from. Each ref can be claimed once: a model
  // that repeats one gets a new row the second time, not a shared id.
  const mealByRef = new Map<string, MealRow>();
  const optionByRef = new Map<string, OptionRow>();
  before?.forEach((m, mi) => {
    mealByRef.set(mealRef(mi), m);
    m.options.forEach((o, oi) => optionByRef.set(optionRef(mi, oi), o));
  });
  const claimed = new Set<string>();
  const claim = <T,>(map: Map<string, T>, ref: unknown, fits: (hit: T) => boolean = () => true): T | undefined => {
    if (typeof ref !== 'string' || claimed.has(ref)) return undefined;
    const hit = map.get(ref);
    if (!hit || !fits(hit)) return undefined;
    claimed.add(ref);
    return hit;
  };

  const meals: MealRow[] = list(raw.meals).flatMap((m): MealRow[] => {
    const options = list(m.options).flatMap((o): OptionRow[] => {
      const foods: FoodRow[] = list(o.foods).flatMap((f) => {
        const name = text(f.name, 120);
        return name ? [{ name, dayType: gate(f.day_type) }] : [];
      });
      if (foods.length === 0) return [];
      // The row's id only stays with an option that still holds one of the
      // same foods: diary entries registered from it keep describing
      // something that is in it. A full swap is a new option.
      const orig = claim(optionByRef, o.ref, (prev) => sharesFood(prev, foods));
      return [{ ...(orig?.id ? { id: orig.id } : {}), label: text(o.label, 80), notes: text(o.notes, 300), foods }];
    });
    if (options.length === 0) return [];

    const orig = claim(mealByRef, m.ref);
    const row: MealRow = {
      ...(orig?.id ? { id: orig.id } : {}),
      label: text(m.label, 80),
      mealType: typeof m.meal_type === 'string' && (MEAL_TYPE_VALUES as string[]).includes(m.meal_type) ? (m.meal_type as PlanMealType) : 'snack',
      timeHint: text(m.time_hint, 80),
      appliesTo: gate(m.applies_to),
      isOptional: m.is_optional === true,
      notes: text(m.notes, 300),
      options,
      advOpen: false,
    };
    row.advOpen = mealHasAdvanced(row);
    return [row];
  });
  if (meals.length === 0) return null;

  // Targets: one row per day type the plan can hold; the rest are ignored.
  const targets = emptyTargets();
  const allowed = dayTypesFor(cycling);
  const filled = new Set<DayType>();
  for (const t of list(raw.targets)) {
    const dt = dayType(t.day_type);
    if (!allowed.includes(dt) || filled.has(dt)) continue;
    filled.add(dt);
    const [kcalMin, kcalMax] = ordered(int(t.kcal_min, 0, 20000), int(t.kcal_max, 0, 20000));
    const [proteinMin, proteinMax] = ordered(num(t.protein_min_g, 0, 5000), num(t.protein_max_g, 0, 5000));
    const [carbsMin, carbsMax] = ordered(num(t.carbs_min_g, 0, 5000), num(t.carbs_max_g, 0, 5000));
    const [fatMin, fatMax] = ordered(num(t.fat_min_g, 0, 5000), num(t.fat_max_g, 0, 5000));
    targets[dt] = { kcalMin, kcalMax, proteinMin, proteinMax, carbsMin, carbsMax, fatMin, fatMax };
  }

  return {
    header: {
      name: text(raw.name, 120),
      focus: text(raw.focus, 120),
      description: text(raw.description, 500),
      durationWeeks: str(int(raw.duration_weeks, 1, 52)),
      dayCycling: cycling,
      notes: text(raw.notes, 1000),
    },
    meals,
    targets,
    summary: text(raw.summary, 600),
  };
}

/* ---- the result, for the coach's review panel ---- */

/** One applied AI answer: what the builder held before and after it. */
export interface AiNutritionResult {
  kind: 'new' | 'edit';
  summary: string;
  before: NutritionDraft;
  after: NutritionDraft;
}

/** "Desayuno", or the coach's own label for the slot. */
export const mealTitle = (m: MealRow): string => m.label.trim() || mealTypeLabel(m.mealType);

/** "entreno" / "descanso" for a food or slot gated to one kind of day; '' otherwise. */
export const dayTag = (dt: DayType): string => (dt === 'training' ? 'entreno' : dt === 'rest' ? 'descanso' : '');

/** "Arroz 110 g (entreno)". The tag only matters when the plan cycles. */
export const foodText = (f: FoodRow, dayCycling: boolean): string =>
  dayCycling && f.dayType !== 'both' ? `${f.name.trim()} (${dayTag(f.dayType)})` : f.name.trim();

/** "2100–2150 kcal · P 150–155 g · C 220–225 g · G 55 g" — only the parts set. */
export const targetText = (t: TargetRow): string =>
  [
    rangeText(t.kcalMin, t.kcalMax) !== '—' ? `${rangeText(t.kcalMin, t.kcalMax)} kcal` : '',
    rangeText(t.proteinMin, t.proteinMax) !== '—' ? `P ${rangeText(t.proteinMin, t.proteinMax)} g` : '',
    rangeText(t.carbsMin, t.carbsMax) !== '—' ? `C ${rangeText(t.carbsMin, t.carbsMax)} g` : '',
    rangeText(t.fatMin, t.fatMax) !== '—' ? `G ${rangeText(t.fatMin, t.fatMax)} g` : '',
  ]
    .filter(Boolean)
    .join(' · ');

const mealsWithFood = (d: NutritionDraft) => d.meals.filter((m) => m.options.some((o) => namedFoods(o).length > 0));

export interface PlanFacts {
  meals: number;
  options: number;
  foods: number;
  dayCycling: boolean;
  /** Slots that only exist on one kind of day (cycling plans). */
  gatedMeals: number;
  optionalMeals: number;
  /** '' when open-ended. */
  weeks: string;
  /** The targets with any value, as "Días de entrenamiento" + text. */
  targets: { dayType: DayType; title: string; text: string }[];
}

export function planFacts(d: NutritionDraft): PlanFacts {
  const meals = mealsWithFood(d);
  return {
    meals: meals.length,
    options: meals.reduce((a, m) => a + m.options.filter((o) => namedFoods(o).length > 0).length, 0),
    foods: foodCount(d.meals),
    dayCycling: d.dayCycling,
    gatedMeals: d.dayCycling ? meals.filter((m) => m.appliesTo !== 'both').length : 0,
    optionalMeals: meals.filter((m) => m.isOptional).length,
    weeks: d.durationWeeks.trim(),
    targets: dayTypesFor(d.dayCycling)
      .filter((dt) => targetHasData(d.targets[dt]))
      .map((dt) => ({ dayType: dt, title: dayTypeTitle(dt), text: targetText(d.targets[dt]) })),
  };
}

export interface DraftChanges {
  /** Plan-level changes, already phrased ("Ciclado por tipo de día activado"). */
  notes: string[];
  mealsAdded: string[];
  mealsRemoved: string[];
  foodsAdded: { meal: string; name: string }[];
  foodsRemoved: { meal: string; name: string }[];
}

/**
 * What an edit changed, for the coach to check. Meals are matched by DB id
 * when both sides have one, else by title (a draft that was never saved has
 * no ids); inside a matched meal, foods are compared by name and day type
 * across all of its options.
 */
export function diffDrafts(before: NutritionDraft, after: NutritionDraft): DraftChanges {
  const notes: string[] = [];
  if (before.name.trim() !== after.name.trim() && after.name.trim()) notes.push(`Nombre: ${after.name.trim()}`);
  if (before.dayCycling !== after.dayCycling) {
    notes.push(after.dayCycling ? 'Ciclado por tipo de día activado' : 'Ciclado por tipo de día desactivado');
  }
  if (before.durationWeeks.trim() !== after.durationWeeks.trim()) {
    const w = after.durationWeeks.trim();
    notes.push(w ? `Duración: ${w} ${w === '1' ? 'semana' : 'semanas'}` : 'Duración: sin límite');
  }
  for (const dt of dayTypesFor(after.dayCycling)) {
    const b = targetText(before.targets[dt]);
    const a = targetText(after.targets[dt]);
    if (b !== a) notes.push(`Objetivo · ${dayTypeTitle(dt).toLowerCase()}: ${a || 'sin objetivo'}`);
  }
  if (before.notes.trim() !== after.notes.trim()) notes.push('Notas para el cliente actualizadas');

  const key = (m: MealRow) => mealTitle(m).toLowerCase();
  const foodKeys = (m: MealRow, cycling: boolean) => {
    const out = new Map<string, string>(); // key → display text
    for (const o of m.options) for (const f of namedFoods(o)) {
      const k = `${foodKey(f.name)}|${cycling && f.dayType !== 'both' ? f.dayType : 'both'}`;
      if (!out.has(k)) out.set(k, foodText(f, cycling));
    }
    return out;
  };

  const bm = mealsWithFood(before);
  const am = mealsWithFood(after);
  const matched = new Map<MealRow, MealRow>(); // after → before
  const usedBefore = new Set<MealRow>();
  // Pass 1: by id. Pass 2: by title, in order.
  for (const a of am) {
    if (!a.id) continue;
    const b = bm.find((x) => x.id === a.id && !usedBefore.has(x));
    if (b) {
      matched.set(a, b);
      usedBefore.add(b);
    }
  }
  for (const a of am) {
    if (matched.has(a)) continue;
    const b = bm.find((x) => !usedBefore.has(x) && key(x) === key(a));
    if (b) {
      matched.set(a, b);
      usedBefore.add(b);
    }
  }

  const mealsAdded = am.filter((a) => !matched.has(a)).map(mealTitle);
  const mealsRemoved = bm.filter((b) => !usedBefore.has(b)).map(mealTitle);
  const foodsAdded: DraftChanges['foodsAdded'] = [];
  const foodsRemoved: DraftChanges['foodsRemoved'] = [];
  for (const [a, b] of matched) {
    const fb = foodKeys(b, before.dayCycling);
    const fa = foodKeys(a, after.dayCycling);
    for (const [k, name] of fa) if (!fb.has(k)) foodsAdded.push({ meal: mealTitle(a), name });
    for (const [k, name] of fb) if (!fa.has(k)) foodsRemoved.push({ meal: mealTitle(a), name });
  }
  return { notes, mealsAdded, mealsRemoved, foodsAdded, foodsRemoved };
}
