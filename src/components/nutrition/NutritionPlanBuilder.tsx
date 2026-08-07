import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Plus, Smartphone, Trash2, X } from 'lucide-react';
import type {
  ClientWithMeta,
  DayType,
  NutritionPlanWithDetail,
  PlanMealType,
  PlanStatus,
} from '@/types';
import {
  createNutritionPlan,
  createNutritionTemplate,
  updateNutritionPlan,
  updateNutritionTemplate,
  type NutritionMealInput,
  type NutritionTargetInput,
  type SaveNutritionPlanInput,
} from '@/services/nutritionPlans';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MobileNutritionPreview } from '@/components/nutrition/MobileNutritionPreview';
import { draftToPreview } from '@/components/nutrition/previewModel';

const MEAL_TYPES: { value: PlanMealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Almuerzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Merienda' },
  { value: 'pre_workout', label: 'Pre-entrenamiento' },
  { value: 'post_workout', label: 'Post-entrenamiento' },
];
const mealTypeLabel = (v: PlanMealType): string =>
  MEAL_TYPES.find((m) => m.value === v)?.label ?? v;

/** Whole-slot gating: "POST-ENTRENAMIENTO (SOLO DÍAS DE ENTRENAMIENTO)". */
const APPLIES_TO: { value: DayType; label: string }[] = [
  { value: 'both', label: 'Ambos días' },
  { value: 'training', label: 'Solo entrenamiento' },
  { value: 'rest', label: 'Solo descanso' },
];

/** Per-food gating — the carb cycling itself. Short labels: this sits inline. */
const FOOD_DAYS: { value: DayType; label: string }[] = [
  { value: 'both', label: 'Ambos' },
  { value: 'training', label: 'Entreno' },
  { value: 'rest', label: 'Descanso' },
];

const STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
];

const WIZARD_STEPS = ['Datos', 'Comidas y opciones', 'Objetivos', 'Revisar'] as const;

const toInt = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : null;
};
const toNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const rangeText = (min: string, max: string): string => {
  const a = min.trim();
  const b = max.trim();
  if (a && b) return a === b ? a : `${a}–${b}`;
  return a || b || '—';
};

/* ---- builder row models (all strings; parsed at submit) ---- */
interface FoodRow {
  name: string;
  dayType: DayType;
}
interface OptionRow {
  label: string;
  notes: string;
  foods: FoodRow[];
}
interface MealRow {
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
interface TargetRow {
  kcalMin: string;
  kcalMax: string;
  proteinMin: string;
  proteinMax: string;
  carbsMin: string;
  carbsMax: string;
  fatMin: string;
  fatMax: string;
}

const emptyFood = (): FoodRow => ({ name: '', dayType: 'both' });
const emptyOption = (n: number): OptionRow => ({
  label: `Opción ${n}`,
  notes: '',
  foods: [emptyFood()],
});
const emptyMeal = (): MealRow => ({
  label: '',
  mealType: 'breakfast',
  timeHint: '',
  appliesTo: 'both',
  isOptional: false,
  notes: '',
  options: [emptyOption(1)],
  advOpen: false,
});
const emptyTarget = (): TargetRow => ({
  kcalMin: '',
  kcalMax: '',
  proteinMin: '',
  proteinMax: '',
  carbsMin: '',
  carbsMax: '',
  fatMin: '',
  fatMax: '',
});
const emptyTargets = (): Record<DayType, TargetRow> => ({
  both: emptyTarget(),
  training: emptyTarget(),
  rest: emptyTarget(),
});

const targetHasData = (t: TargetRow): boolean =>
  Object.values(t).some((v) => v.trim() !== '');

/** What's set behind a collapsed "Avanzado" — shown next to the toggle so
 *  configured values are never invisible. */
const advSummary = (m: MealRow): string => {
  const parts: string[] = [];
  if (m.appliesTo !== 'both') {
    parts.push(APPLIES_TO.find((a) => a.value === m.appliesTo)?.label.toLowerCase() ?? '');
  }
  if (m.isOptional) parts.push('opcional');
  if (m.timeHint.trim()) parts.push(m.timeHint.trim());
  if (m.notes.trim()) parts.push('con nota');
  return parts.filter(Boolean).join(' · ');
};

/* ---- edit prefill ---- */
const mealsFrom = (p: NutritionPlanWithDetail): MealRow[] =>
  p.nutrition_plan_meals.length === 0
    ? [emptyMeal()]
    : [...p.nutrition_plan_meals]
        .sort((a, b) => a.sort_order - b.sort_order || a.slot_index - b.slot_index)
        .map((m) => ({
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

const targetsFrom = (p: NutritionPlanWithDetail): Record<DayType, TargetRow> => {
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

const NUM_SM = 'h-8 w-[62px] rounded-md border border-border bg-card px-1 text-center text-[12.5px]';

/* ---- small building blocks ---- */
function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
function FieldCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      {children}
    </div>
  );
}
function Disclosure({
  open,
  onToggle,
  label,
  className = '',
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 font-semibold text-secondary transition-colors hover:text-secondary/80 focus-visible:outline-none ${className}`}
    >
      {open ? (
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      )}
      {label}
    </button>
  );
}
function MacroRow({
  label,
  unit,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  unit: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[92px] flex-none text-[12.5px] text-muted-foreground">{label}</span>
      <input
        className={NUM_SM}
        aria-label={`${label} mínimo`}
        type="number"
        min={0}
        value={min}
        onChange={(e) => onMin(e.target.value)}
      />
      <span className="text-faint">–</span>
      <input
        className={NUM_SM}
        aria-label={`${label} máximo`}
        type="number"
        min={0}
        value={max}
        onChange={(e) => onMax(e.target.value)}
      />
      <span className="text-[11.5px] text-faint">{unit}</span>
    </div>
  );
}
function Stepper({
  step,
  maxStep,
  onStep,
}: {
  step: number;
  maxStep: number;
  onStep: (s: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {WIZARD_STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        const reachable = i <= maxStep;
        return (
          <button
            key={label}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onStep(i)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                : reachable
                  ? 'text-muted-foreground hover:bg-muted'
                  : 'cursor-default text-faint',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold',
                active ? 'bg-primary text-white' : done ? 'bg-secondary text-white' : 'border border-border-strong text-faint',
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The 4-step nutrition wizard, shared by two callers:
 *   - a client's Nutrición tab → `client` set, saves an assigned plan;
 *   - the Nutrición library page → `client` omitted, saves a reusable TEMPLATE.
 *
 * A food row is a NAME and a day type — nothing else. No portion, no macros:
 * the coach prescribes what to eat, and every number is measured later from the
 * client's photo. The only figures collected here are the plan-level targets in
 * step 3.
 */
export function NutritionPlanBuilder({
  client,
  initial,
  onClose,
  onSaved,
}: {
  /** Omit to author a library template instead of a client's plan. */
  client?: ClientWithMeta;
  initial?: NutritionPlanWithDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isTemplate = client == null;
  const [name, setName] = useState(initial?.name ?? '');
  const [focus, setFocus] = useState(initial?.focus ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [durationWeeks, setDurationWeeks] = useState(
    initial?.duration_weeks != null ? String(initial.duration_weeks) : '',
  );
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 10) ?? todayISO());
  const [status, setStatus] = useState<PlanStatus>(initial?.status ?? 'active');
  const [dayCycling, setDayCycling] = useState(initial?.day_cycling ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [meals, setMeals] = useState<MealRow[]>(initial ? mealsFrom(initial) : [emptyMeal()]);
  const [targets, setTargets] = useState<Record<DayType, TargetRow>>(
    initial ? targetsFrom(initial) : emptyTargets(),
  );
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [headerAdv, setHeaderAdv] = useState(
    !!(initial?.description || initial?.notes || initial?.duration_weeks),
  );
  const [step, setStep] = useState(initial ? WIZARD_STEPS.length - 1 : 0);
  const [maxStep, setMaxStep] = useState(initial ? WIZARD_STEPS.length - 1 : 0);

  const firstName = client?.display_name?.split(' ')[0] ?? 'el cliente';

  /* ---- immutable patch helpers, one per nesting level ---- */
  const updMeal = (mi: number, patch: Partial<MealRow>) =>
    setMeals((ms) => ms.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  const updOption = (mi: number, oi: number, patch: Partial<OptionRow>) =>
    setMeals((ms) =>
      ms.map((m, i) =>
        i === mi ? { ...m, options: m.options.map((o, k) => (k === oi ? { ...o, ...patch } : o)) } : m,
      ),
    );
  const updFood = (mi: number, oi: number, fi: number, patch: Partial<FoodRow>) =>
    setMeals((ms) =>
      ms.map((m, i) =>
        i === mi
          ? {
              ...m,
              options: m.options.map((o, k) =>
                k === oi
                  ? { ...o, foods: o.foods.map((f, j) => (j === fi ? { ...f, ...patch } : f)) }
                  : o,
              ),
            }
          : m,
      ),
    );
  const updTarget = (dt: DayType, patch: Partial<TargetRow>) =>
    setTargets((t) => ({ ...t, [dt]: { ...t[dt], ...patch } }));

  const step0Valid = name.trim() !== '';
  const step1Valid = meals.some((m) => m.options.some((o) => o.foods.some((f) => f.name.trim())));

  const goTo = (s: number) => {
    setStep(s);
    setMaxStep((m) => Math.max(m, s));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNext = () => {
    if (step === 0 && !step0Valid) return toast.error('Ponle nombre al plan');
    if (step === 1 && !step1Valid) return toast.error('Añade al menos una comida con un alimento');
    goTo(Math.min(WIZARD_STEPS.length - 1, step + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      setStep(0);
      return toast.error('Ponle nombre al plan');
    }

    const outMeals: NutritionMealInput[] = meals
      .map((m, mi) => ({
        slot_index: mi + 1,
        label: m.label.trim() || null,
        meal_type: m.mealType,
        time_hint: m.timeHint.trim() || null,
        applies_to: m.appliesTo,
        is_optional: m.isOptional,
        notes: m.notes.trim() || null,
        sort_order: mi,
        options: m.options
          .filter((o) => o.foods.some((f) => f.name.trim()))
          .map((o, oi) => ({
            label: o.label.trim() || null,
            notes: o.notes.trim() || null,
            sort_order: oi,
            items: o.foods
              .filter((f) => f.name.trim())
              .map((f, fi) => ({
                name: f.name.trim(),
                // With cycling off there is only one kind of day, so every food
                // is 'both' regardless of what the (hidden) selector holds.
                day_type: dayCycling ? f.dayType : ('both' as DayType),
                sort_order: fi,
              })),
          })),
      }))
      .filter((m) => m.options.length > 0);

    if (outMeals.length === 0) {
      setStep(1);
      return toast.error('Añade al menos una comida con un alimento');
    }

    // Cycling on → a training row and a rest row; off → a single 'both' row.
    // Blank rows are dropped so an untouched plan carries no empty targets.
    const dayTypes: DayType[] = dayCycling ? ['training', 'rest'] : ['both'];
    const outTargets: NutritionTargetInput[] = dayTypes
      .filter((dt) => targetHasData(targets[dt]))
      .map((dt) => {
        const t = targets[dt];
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
          notes: null,
        };
      });

    const payload: SaveNutritionPlanInput = {
      name: nm,
      description: description.trim() || null,
      focus: focus.trim() || null,
      duration_weeks: toInt(durationWeeks),
      start_date: startDate,
      status,
      day_cycling: dayCycling,
      notes: notes.trim() || null,
      targets: outTargets,
      meals: outMeals,
    };

    setSaving(true);
    try {
      if (initial) {
        if (isTemplate) {
          await updateNutritionTemplate(initial.id, payload);
          toast.success('Plantilla actualizada');
        } else {
          await updateNutritionPlan(initial.id, client!.id, payload);
          toast.success('Plan actualizado');
        }
      } else if (isTemplate) {
        await createNutritionTemplate(payload);
        toast.success('Plantilla guardada');
      } else {
        await createNutritionPlan(client!.id, payload);
        toast.success(`Plan asignado a ${firstName}`);
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const foodCount = meals.reduce(
    (a, m) => a + m.options.reduce((b, o) => b + o.foods.filter((f) => f.name.trim()).length, 0),
    0,
  );
  const summaryText = `${meals.length} ${meals.length === 1 ? 'comida' : 'comidas'} · ${foodCount} ${
    foodCount === 1 ? 'alimento' : 'alimentos'
  }${dayCycling ? ' · con ciclado' : ''}`;
  const saveLabel = saving
    ? 'Guardando…'
    : initial
      ? 'Guardar cambios'
      : isTemplate
        ? 'Guardar plantilla'
        : `Asignar a ${firstName}`;
  const isLast = step === WIZARD_STEPS.length - 1;

  return (
    <Card className="animate-fade-up overflow-hidden border-[1.5px] border-primary p-0">
      {/* Header + stepper */}
      <div className="border-b border-border px-[22px] py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-heading text-[15px] font-semibold">
            {isTemplate
              ? initial
                ? 'Editar plantilla'
                : 'Nueva plantilla nutricional'
              : initial
                ? 'Editar plan'
                : 'Nuevo plan nutricional'}
            <span className="ml-1.5 text-[13px] font-normal text-faint">
              {isTemplate ? '· reutilizable' : `· para ${firstName}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Smartphone className="h-3.5 w-3.5" strokeWidth={2} /> Vista previa
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
        <Stepper step={step} maxStep={maxStep} onStep={goTo} />
      </div>

      <div className="p-[22px]">
        {/* Step 1 · Datos */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <p className="text-[12.5px] text-faint">Lo básico del plan. Solo el nombre es obligatorio.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" htmlFor="nb-name">
                <Input
                  id="nb-name"
                  placeholder="Ej. Protocolo Nutricional Fase 2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Enfoque" htmlFor="nb-focus">
                <Input
                  id="nb-focus"
                  placeholder="Ej. Ciclado de carbohidratos"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
              </Field>
            </div>

            {/* The switch that decides whether the whole plan has two faces. */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
              <Switch
                id="nb-cycling"
                checked={dayCycling}
                onCheckedChange={setDayCycling}
                aria-label="Ciclado de carbohidratos"
              />
              <div className="min-w-0">
                <Label htmlFor="nb-cycling" className="text-[13px]">
                  Ciclado por tipo de día
                </Label>
                <p className="mt-0.5 text-[12px] text-faint">
                  El plan cambia entre días de entrenamiento y de descanso. Podrás marcar qué
                  alimentos aparecen en cada uno y fijar objetivos distintos.
                </p>
              </div>
            </div>

            {!isTemplate && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fecha de inicio" htmlFor="nb-start">
                  <Input
                    id="nb-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="Estado">
                  <Select value={status} onValueChange={(v) => setStatus(v as PlanStatus)}>
                    <SelectTrigger aria-label="Estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            <div>
              <Disclosure
                open={headerAdv}
                onToggle={() => setHeaderAdv((v) => !v)}
                label="Más detalles"
                className="text-[12.5px]"
              />
              {headerAdv && (
                <div className="mt-3 flex flex-col gap-3">
                  <Field label="Duración (semanas)" htmlFor="nb-weeks" className="max-w-[220px]">
                    <Input
                      id="nb-weeks"
                      type="number"
                      min={1}
                      max={52}
                      placeholder="Sin límite"
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(e.target.value)}
                    />
                    <span className="text-[11.5px] text-faint">
                      Déjalo vacío si la fase no tiene fin definido.
                    </span>
                  </Field>
                  <Field label="Descripción" htmlFor="nb-desc">
                    <Textarea
                      id="nb-desc"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Field>
                  <Field label="Notas para el cliente" htmlFor="nb-notes">
                    <Textarea
                      id="nb-notes"
                      rows={2}
                      placeholder="Ej. En días de descanso elimina la comida post-entrenamiento."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2 · Comidas y opciones */}
        {step === 1 && (
          <div className="flex flex-col gap-3.5">
            <p className="text-[12.5px] text-faint">
              Una tarjeta por comida. Dentro, cada opción es una rotación que el cliente puede
              elegir. Solo escribes el alimento — las calorías y macros las calcula la app cuando el
              cliente sube la foto de su plato.
            </p>

            {meals.map((meal, mi) => {
              const adv = advSummary(meal);
              return (
                <div key={mi} className="rounded-xl border border-border bg-muted/40 p-3.5">
                  <div className="mb-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                    <Select
                      value={meal.mealType}
                      onValueChange={(v) => updMeal(mi, { mealType: v as PlanMealType })}
                    >
                      <SelectTrigger className="h-9 text-[13px]" aria-label={`Tipo de comida ${mi + 1}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label={`Etiqueta de la comida ${mi + 1}`}
                      placeholder={`Etiqueta — por defecto "${mealTypeLabel(meal.mealType)}"`}
                      className="h-9 text-[13px]"
                      value={meal.label}
                      onChange={(e) => updMeal(mi, { label: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => meals.length > 1 && setMeals((ms) => ms.filter((_, i) => i !== mi))}
                      aria-label={`Quitar comida ${mi + 1}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>

                  {/* Options — the rotation tier */}
                  <div className="flex flex-col gap-2">
                    {meal.options.map((opt, oi) => (
                      <div key={oi} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
                            {oi + 1}
                          </span>
                          <Input
                            aria-label="Etiqueta de la opción"
                            placeholder="Ej. Opción 1 · Día 1-2"
                            className="h-9 min-w-0 flex-1 text-[13.5px] font-medium"
                            value={opt.label}
                            onChange={(e) => updOption(mi, oi, { label: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              meal.options.length > 1 &&
                              updMeal(mi, { options: meal.options.filter((_, k) => k !== oi) })
                            }
                            aria-label="Quitar opción"
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </div>

                        {/* Foods — name, plus a day selector only when cycling */}
                        <div className="mt-2.5 flex flex-col gap-1.5 pl-[34px]">
                          {opt.foods.map((food, fi) => (
                            <div key={fi} className="flex items-center gap-2">
                              <Input
                                aria-label="Alimento"
                                placeholder="Ej. Pechuga de pollo"
                                className="h-8 min-w-0 flex-1 text-[13px]"
                                value={food.name}
                                onChange={(e) => updFood(mi, oi, fi, { name: e.target.value })}
                              />
                              {dayCycling && (
                                <Select
                                  value={food.dayType}
                                  onValueChange={(v) => updFood(mi, oi, fi, { dayType: v as DayType })}
                                >
                                  <SelectTrigger
                                    className="h-8 w-[118px] flex-none text-[12px]"
                                    aria-label="Días en que aplica"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FOOD_DAYS.map((d) => (
                                      <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  opt.foods.length > 1 &&
                                  updOption(mi, oi, { foods: opt.foods.filter((_, j) => j !== fi) })
                                }
                                aria-label="Quitar alimento"
                                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-faint transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <X className="h-3 w-3" strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => updOption(mi, oi, { foods: [...opt.foods, emptyFood()] })}
                            className="mt-0.5 flex w-fit items-center gap-1 text-[12px] font-semibold text-secondary transition-colors hover:text-secondary/80 focus-visible:outline-none"
                          >
                            <Plus className="h-3 w-3" strokeWidth={2.5} /> Alimento
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        updMeal(mi, { options: [...meal.options, emptyOption(meal.options.length + 1)] })
                      }
                      className="flex w-fit items-center gap-1 text-[12.5px] font-semibold text-secondary transition-colors hover:text-secondary/80 focus-visible:outline-none"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Opción de rotación
                    </button>
                  </div>

                  {/* Slot-level advanced */}
                  <div className="mt-3 border-t border-border pt-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Disclosure
                        open={meal.advOpen}
                        onToggle={() => updMeal(mi, { advOpen: !meal.advOpen })}
                        label="Avanzado"
                        className="text-[12px]"
                      />
                      {!meal.advOpen && adv && <span className="text-[11.5px] text-faint">{adv}</span>}
                    </div>
                    {meal.advOpen && (
                      <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
                        {dayCycling && (
                          <FieldCell label="Aparece en" className="w-[176px]">
                            <Select
                              value={meal.appliesTo}
                              onValueChange={(v) => updMeal(mi, { appliesTo: v as DayType })}
                            >
                              <SelectTrigger className="h-8 text-[12.5px]" aria-label="Aparece en">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {APPLIES_TO.map((a) => (
                                  <SelectItem key={a.value} value={a.value}>
                                    {a.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldCell>
                        )}
                        <FieldCell label="Horario" className="w-[190px]">
                          <Input
                            className="h-8 text-[12.5px]"
                            aria-label="Horario"
                            placeholder="Ej. 30-45 min antes"
                            value={meal.timeHint}
                            onChange={(e) => updMeal(mi, { timeHint: e.target.value })}
                          />
                        </FieldCell>
                        <label className="flex h-8 items-center gap-2 text-[12.5px] text-muted-foreground">
                          <Switch
                            checked={meal.isOptional}
                            onCheckedChange={(v) => updMeal(mi, { isOptional: v })}
                            aria-label="Comida opcional"
                          />
                          Opcional
                        </label>
                        <FieldCell label="Nota" className="w-full">
                          <Input
                            className="h-8 text-[12.5px]"
                            aria-label="Nota de la comida"
                            placeholder="Ej. En días de descanso sustituir por 1 scoop de proteína."
                            value={meal.notes}
                            onChange={(e) => updMeal(mi, { notes: e.target.value })}
                          />
                        </FieldCell>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setMeals((ms) => [...ms, emptyMeal()])}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Añadir comida
            </button>
          </div>
        )}

        {/* Step 3 · Objetivos */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-[12.5px] text-faint">
              Los únicos números que escribes. Son el objetivo diario contra el que se compara lo
              que el cliente registra con fotos. Puedes dejarlos vacíos.
            </p>
            <div className={cn('grid gap-3.5', dayCycling && 'sm:grid-cols-2')}>
              {(dayCycling ? (['training', 'rest'] as DayType[]) : (['both'] as DayType[])).map((dt) => (
                <div key={dt} className="rounded-xl border border-border bg-muted/40 p-3.5">
                  <div className="mb-3 font-heading text-[13.5px] font-semibold">
                    {dt === 'training'
                      ? 'Días de entrenamiento'
                      : dt === 'rest'
                        ? 'Días de descanso'
                        : 'Todos los días'}
                  </div>
                  <div className="flex flex-col gap-2">
                    <MacroRow
                      label="Calorías"
                      unit="kcal"
                      min={targets[dt].kcalMin}
                      max={targets[dt].kcalMax}
                      onMin={(v) => updTarget(dt, { kcalMin: v })}
                      onMax={(v) => updTarget(dt, { kcalMax: v })}
                    />
                    <MacroRow
                      label="Proteína"
                      unit="g"
                      min={targets[dt].proteinMin}
                      max={targets[dt].proteinMax}
                      onMin={(v) => updTarget(dt, { proteinMin: v })}
                      onMax={(v) => updTarget(dt, { proteinMax: v })}
                    />
                    <MacroRow
                      label="Carbohidratos"
                      unit="g"
                      min={targets[dt].carbsMin}
                      max={targets[dt].carbsMax}
                      onMin={(v) => updTarget(dt, { carbsMin: v })}
                      onMax={(v) => updTarget(dt, { carbsMax: v })}
                    />
                    <MacroRow
                      label="Grasas"
                      unit="g"
                      min={targets[dt].fatMin}
                      max={targets[dt].fatMax}
                      onMin={(v) => updTarget(dt, { fatMin: v })}
                      onMax={(v) => updTarget(dt, { fatMax: v })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 · Revisar */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="font-heading text-[15px] font-semibold">{name.trim() || 'Sin nombre'}</div>
              <div className="mt-0.5 text-[12.5px] text-faint">
                {focus.trim() ? `${focus.trim()} · ` : ''}
                {summaryText}
              </div>
            </div>

            {meals.map((meal, mi) => {
              const title = meal.label.trim() || mealTypeLabel(meal.mealType);
              const shown = meal.options.filter((o) => o.foods.some((f) => f.name.trim()));
              if (shown.length === 0) return null;
              return (
                <div key={mi} className="rounded-xl border border-border p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold">{title}</span>
                    {meal.appliesTo !== 'both' && dayCycling && (
                      <span className="rounded-full bg-warning/10 px-2 py-[1px] text-[10.5px] font-bold text-warning">
                        {meal.appliesTo === 'training' ? 'solo entreno' : 'solo descanso'}
                      </span>
                    )}
                    {meal.isOptional && (
                      <span className="rounded-full bg-secondary/10 px-2 py-[1px] text-[10.5px] font-bold text-secondary">
                        opcional
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {shown.map((opt, oi) => (
                      <div key={oi} className="text-[12.5px]">
                        <span className="font-semibold text-muted-foreground">
                          {opt.label.trim() || `Opción ${oi + 1}`}
                        </span>
                        <span className="text-faint"> — </span>
                        {opt.foods
                          .filter((f) => f.name.trim())
                          .map((f, fi, arr) => (
                            <span key={fi}>
                              {f.name.trim()}
                              {dayCycling && f.dayType !== 'both' && (
                                <span className="text-faint">
                                  {' '}
                                  ({f.dayType === 'training' ? 'entreno' : 'descanso'})
                                </span>
                              )}
                              {fi < arr.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                      </div>
                    ))}
                  </div>
                  {meal.notes.trim() && (
                    <p className="mt-2 text-[11.5px] text-faint">{meal.notes.trim()}</p>
                  )}
                </div>
              );
            })}

            {(dayCycling ? (['training', 'rest'] as DayType[]) : (['both'] as DayType[]))
              .filter((dt) => targetHasData(targets[dt]))
              .map((dt) => {
                const t = targets[dt];
                return (
                  <div key={dt} className="rounded-xl border border-border p-3.5">
                    <div className="text-[13px] font-semibold">
                      Objetivo ·{' '}
                      {dt === 'training' ? 'entrenamiento' : dt === 'rest' ? 'descanso' : 'todos los días'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] tabular-nums text-muted-foreground">
                      <span>{rangeText(t.kcalMin, t.kcalMax)} kcal</span>
                      <span>P {rangeText(t.proteinMin, t.proteinMax)} g</span>
                      <span>C {rangeText(t.carbsMin, t.carbsMax)} g</span>
                      <span>G {rangeText(t.fatMin, t.fatMax)} g</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-[22px] py-3.5">
        <span className="text-[12px] text-faint">{summaryText}</span>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={goBack}>
              Atrás
            </Button>
          )}
          {!isLast ? (
            <Button size="sm" onClick={goNext}>
              Siguiente
            </Button>
          ) : (
            <Button size="sm" disabled={saving} onClick={() => void submit()}>
              {saveLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Live preview of the unsaved draft */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <MobileNutritionPreview
            plan={draftToPreview({ name, focus, notes, dayCycling }, meals, targets)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
