import { useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CopyPlus,
  Dumbbell,
  Ellipsis,
  ListPlus,
  Plus,
  Smartphone,
  Sparkles,
  StickyNote,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import type { ClientWithMeta, DayType, NutritionPlanWithDetail, PlanMealType, PlanStatus } from '@/types';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field, SectionHeader } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import { Segmented } from '@/components/ui/segmented';
import { Tip } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FocusEditor } from '@/components/shared/FocusEditor';
import { DiscardChangesDialog } from '@/components/shared/DiscardChangesDialog';
import { MobileNutritionPreview } from '@/components/nutrition/MobileNutritionPreview';
import { draftToPreview } from '@/components/nutrition/previewModel';
import { AiNutritionDialog } from '@/components/nutrition/AiNutritionDialog';
import { AiNutritionResultPanel } from '@/components/nutrition/AiNutritionResultPanel';
import type { AiNutritionResult, NutritionAiHost } from '@/components/nutrition/aiModel';
import { DAY_META, KCAL_PER_G, MEAL_ICON } from '@/components/nutrition/meta';
import {
  APPLIES_TO,
  dayTypesFor,
  draftSignature,
  emptyFood,
  emptyMeal,
  emptyOption,
  emptyTargets,
  FOOD_DAYS,
  foodCount as countFoods,
  MEAL_TYPES,
  mealsFrom,
  mealTypeLabel,
  STATUSES,
  targetHasData,
  targetsFrom,
  todayISO,
  toInt,
  toNum,
  type FoodRow,
  type MealRow,
  type NutritionDraft,
  type OptionRow,
  type TargetRow,
} from '@/components/nutrition/builderModel';

/** The four target pairs, in the order they're shown. */
const PAIRS = [
  ['kcalMin', 'kcalMax'],
  ['proteinMin', 'proteinMax'],
  ['carbsMin', 'carbsMax'],
  ['fatMin', 'fatMax'],
] as const satisfies readonly (readonly [keyof TargetRow, keyof TargetRow])[];

/** Any min/max pair that isn't one number: those need the range inputs. */
const hasRanges = (t: Record<DayType, TargetRow>): boolean =>
  Object.values(t).some((row) =>
    PAIRS.some(([a, b]) => {
      const x = row[a].trim();
      const y = row[b].trim();
      return (x !== '' && y !== '' && x !== y) || (x !== '') !== (y !== '');
    }),
  );

/** Leaving range mode: each pair becomes one number (the lower one). */
const collapseRanges = (t: Record<DayType, TargetRow>): Record<DayType, TargetRow> => {
  const out = { ...t };
  for (const dt of Object.keys(out) as DayType[]) {
    const row = { ...out[dt] };
    for (const [a, b] of PAIRS) {
      const v = row[a].trim() || row[b].trim();
      row[a] = v;
      row[b] = v;
    }
    out[dt] = row;
  }
  return out;
};

/** A meal copied as a NEW meal: no DB ids, so saving inserts it. */
const copyMeal = (m: MealRow): MealRow => ({
  ...m,
  id: undefined,
  options: m.options.map((o) => ({ ...o, id: undefined, foods: o.foods.map((f) => ({ ...f })) })),
});

/**
 * The nutrition plan builder, shared by two callers:
 *   - a client's Nutrición tab → `client` set, saves an assigned plan;
 *   - the Nutrición library page → `client` omitted, saves a reusable TEMPLATE.
 *
 * One canvas instead of steps: the plan's name, whether days differ (training
 * vs rest), the daily targets, then the meals — each a card whose options sit
 * side by side. A food row is a NAME and a day type — nothing else. No portion,
 * no macros: the coach prescribes what to eat, and every number is measured
 * later from the client's photo. The only figures are the daily targets.
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
  // Starts closed: what's set inside shows as chips beside the toggle.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rangeMode, setRangeMode] = useState(() => (initial ? hasRanges(targetsFrom(initial)) : false));
  /** Dims what a given day type doesn't show — a check, not a filter. */
  const [lens, setLens] = useState<DayType>('both');
  const [confirmClose, setConfirmClose] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  /** The last AI answer applied, shown in the review panel until closed. */
  const [aiResult, setAiResult] = useState<AiNutritionResult | null>(null);
  /** Remounts the panel per result, so each one opens expanded and focused. */
  const [aiResultSeq, setAiResultSeq] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const mealsRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 'este cliente' reads right everywhere it's interpolated ("de este cliente").
  const firstName = client?.display_name?.split(' ')[0] ?? 'este cliente';

  /** The whole form as it stands — what the AI assistant edits, and what
   *  its "Deshacer" puts back. */
  const snapshot = (): NutritionDraft => ({
    name,
    focus,
    description,
    durationWeeks,
    startDate,
    status,
    dayCycling,
    notes,
    meals,
    targets,
  });

  // What "unsaved changes" is measured against.
  const savedSig = useRef<string | null>(null);
  if (savedSig.current === null) savedSig.current = draftSignature(snapshot());

  const requestClose = () =>
    draftSignature(snapshot()) !== savedSig.current ? setConfirmClose(true) : onClose();

  /** Replace the whole form at once (an AI result, or undoing one). */
  const replaceDraft = (next: NutritionDraft) => {
    setName(next.name);
    setFocus(next.focus);
    setDescription(next.description);
    setDurationWeeks(next.durationWeeks);
    setStartDate(next.startDate);
    setStatus(next.status);
    setDayCycling(next.dayCycling);
    setNotes(next.notes);
    setMeals(next.meals);
    setTargets(next.targets);
    // Ranges must show as ranges (the details stay closed: their chips say
    // what the AI filled in).
    if (hasRanges(next.targets)) setRangeMode(true);
  };

  /* ---- immutable patch helpers, one per nesting level ---- */
  const updMeal = (mi: number, patch: Partial<MealRow>) =>
    setMeals((ms) => ms.map((m, i) => (i === mi ? { ...m, ...patch } : m)));
  const updOption = (mi: number, oi: number, patch: Partial<OptionRow>) =>
    setMeals((ms) =>
      ms.map((m, i) =>
        i === mi ? { ...m, options: m.options.map((o, k) => (k === oi ? { ...o, ...patch } : o)) } : m,
      ),
    );
  const updFoods = (mi: number, oi: number, fn: (foods: FoodRow[]) => FoodRow[]) =>
    setMeals((ms) =>
      ms.map((m, i) =>
        i === mi
          ? { ...m, options: m.options.map((o, k) => (k === oi ? { ...o, foods: fn(o.foods) } : o)) }
          : m,
      ),
    );
  const updTarget = (dt: DayType, patch: Partial<TargetRow>) =>
    setTargets((t) => ({ ...t, [dt]: { ...t[dt], ...patch } }));

  /** Focus a food input (rows are addressed by position). Call after the row
   *  is committed — `change` runs inside flushSync so it is, and keys typed
   *  right after Enter land in the new row, not the old one. */
  const focusFood = (mi: number, oi: number, fi: number, atEnd = false, change?: () => void) => {
    if (change) flushSync(change);
    const el = canvasRef.current?.querySelector<HTMLInputElement>(`[data-food="${mi}-${oi}-${fi}"]`);
    el?.focus();
    if (el && atEnd) el.setSelectionRange(el.value.length, el.value.length);
  };

  const addFood = (mi: number, oi: number, at: number) =>
    focusFood(mi, oi, at, false, () => updFoods(mi, oi, (fs) => [...fs.slice(0, at), emptyFood(), ...fs.slice(at)]));
  const removeFood = (mi: number, oi: number, fi: number) =>
    updFoods(mi, oi, (fs) => (fs.length > 1 ? fs.filter((_, j) => j !== fi) : [emptyFood()]));

  const addMeal = (type: PlanMealType) =>
    focusFood(meals.length, 0, 0, false, () => setMeals((ms) => [...ms, { ...emptyMeal(), mealType: type }]));
  const moveMeal = (mi: number, dir: -1 | 1) =>
    setMeals((ms) => {
      const j = mi + dir;
      if (j < 0 || j >= ms.length) return ms;
      const out = [...ms];
      [out[mi], out[j]] = [out[j], out[mi]];
      return out;
    });

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      nameRef.current?.focus();
      return toast.error('Ponle nombre al plan');
    }

    const outMeals: NutritionMealInput[] = meals
      .map((m, mi) => ({
        id: m.id,
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
            id: o.id,
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
      mealsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      focusFood(0, 0, 0);
      return toast.error('Añade al menos un alimento');
    }

    // Cycling on → a training row and a rest row; off → a single 'both' row.
    // Blank rows are dropped so an untouched plan carries no empty targets.
    const outTargets: NutritionTargetInput[] = dayTypesFor(dayCycling)
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
          toast.success('Plantilla guardada');
        } else {
          await updateNutritionPlan(initial.id, client!.id, payload);
          toast.success('Plan guardado');
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

  const foodCount = countFoods(meals);
  const aiHost: NutritionAiHost = {
    isTemplate,
    hasInitial: !!initial,
    clientId: client?.id ?? null,
    firstName,
    hasContent: foodCount > 0,
    snapshot,
    replaceDraft,
  };
  const saveLabel = saving
    ? 'Guardando…'
    : initial
      ? 'Guardar cambios'
      : isTemplate
        ? 'Guardar plantilla'
        : `Asignar a ${firstName}`;
  const preview = draftToPreview({ name, focus, notes, dayCycling }, meals, targets);
  const detailChips = [
    durationWeeks.trim() && `${durationWeeks.trim()} ${durationWeeks.trim() === '1' ? 'semana' : 'semanas'}`,
    description.trim() && 'Descripción',
    notes.trim() && 'Notas',
  ].filter(Boolean) as string[];

  return (
    <FocusEditor
      kicker={isTemplate ? 'Nutrición · plantilla' : `Nutrición de ${firstName}`}
      title={isTemplate ? (initial ? 'Editar plantilla' : 'Nueva plantilla') : initial ? 'Editar plan' : 'Nuevo plan'}
      onClose={requestClose}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => setAiOpen(true)} aria-label={foodCount > 0 ? 'Editar con IA' : 'Crear con IA'} className="text-foreground">
            <Sparkles className="!text-primary" strokeWidth={2.25} />
            <span className="hidden sm:inline">{foodCount > 0 ? 'Editar con IA' : 'Crear con IA'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)} aria-label="Vista previa" className="text-foreground xl:hidden">
            <Smartphone />
            <span className="hidden sm:inline">Vista previa</span>
          </Button>
        </>
      }
      footer={
        <>
          <div className="hidden min-w-0 flex-1 items-center gap-5 text-[13px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <UtensilsCrossed className="h-4 w-4" />
              <strong className="font-semibold tabular-nums text-foreground">{meals.length}</strong>
              {meals.length === 1 ? 'comida' : 'comidas'}
            </span>
            <span className="flex items-center gap-1.5">
              <ListPlus className="h-4 w-4" />
              <strong className="font-semibold tabular-nums text-foreground">{foodCount}</strong>
              {foodCount === 1 ? 'alimento' : 'alimentos'}
            </span>
          </div>
          <Button variant="ghost" onClick={requestClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving} className="flex-1 sm:flex-none">
            {saveLabel}
          </Button>
        </>
      }
    >
      <div ref={canvasRef} className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto flex w-full min-w-0 max-w-[920px] flex-col gap-8">
          {aiResult && (
            <AiNutritionResultPanel
              key={aiResultSeq}
              result={aiResult}
              editedSince={() => draftSignature(snapshot()) !== draftSignature(aiResult.after)}
              showMeals={false}
              onUndo={() => {
                replaceDraft(aiResult.before);
                setAiResult(null);
              }}
              onRefine={() => setAiOpen(true)}
              onDismiss={() => setAiResult(null)}
            />
          )}

          {/* ---- the plan ---- */}
          <section aria-label="Datos del plan" className="flex flex-col gap-4">
            <div>
              <label htmlFor="nb-name" className="sr-only">
                Nombre del plan
              </label>
              <input
                id="nb-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del plan"
                autoFocus={!initial}
                className="display w-full border-b-2 border-transparent bg-transparent pb-1 text-[34px] text-foreground transition-colors placeholder:text-faint/50 hover:border-border focus:border-foreground/50 focus:outline-none sm:text-[44px]"
              />
              <input
                aria-label="Enfoque"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Añade un enfoque, ej. Definición"
                className="inline-input -mx-2 mt-1 h-9 max-w-xl text-[15px] text-muted-foreground"
              />
            </div>

            {!isTemplate && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Empieza" htmlFor="nb-start" className="w-[170px]">
                  <Input id="nb-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Estado" className="w-[170px]">
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  aria-expanded={detailsOpen}
                  aria-controls="nb-details"
                  className="-ml-1 inline-flex h-8 items-center gap-1 rounded-md px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !detailsOpen && '-rotate-90')} />
                  Duración, descripción y notas
                </button>
                {!detailsOpen &&
                  detailChips.map((c) => (
                    <span key={c} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {c}
                    </span>
                  ))}
              </div>
              {detailsOpen && (
                <div id="nb-details" className="mt-3 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Field label="Duración" htmlFor="nb-weeks" tip="Déjalo vacío si la fase no tiene fecha de fin." optional>
                    <div className="relative">
                      <Input
                        id="nb-weeks"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={52}
                        placeholder="Sin fin"
                        value={durationWeeks}
                        onChange={(e) => setDurationWeeks(e.target.value)}
                        className="pr-20"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">
                        semanas
                      </span>
                    </div>
                  </Field>
                  <Field label="Descripción" htmlFor="nb-desc" optional>
                    <Textarea id="nb-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </Field>
                  <Field label="Notas para el cliente" htmlFor="nb-notes" tip="Las ve en su plan, dentro de la app." optional className="sm:col-span-2">
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
          </section>

          {/* ---- one kind of day, or training vs rest ---- */}
          <section aria-labelledby="nb-daymode" className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <h2 id="nb-daymode" className="text-base font-semibold">
                Días
              </h2>
              <InfoTip label="Qué cambia con «Entreno y descanso»">
                Con <b className="text-foreground">Entreno y descanso</b> puedes marcar alimentos y comidas solo para un tipo de
                día, y fijar objetivos distintos para cada uno (ciclado de carbohidratos).
              </InfoTip>
            </div>
            <Segmented
              aria-labelledby="nb-daymode"
              className="sm:w-auto sm:self-start"
              stretch
              value={dayCycling ? 'cycling' : 'same'}
              onChange={(v) => {
                setDayCycling(v === 'cycling');
                setLens('both');
              }}
              options={[
                { value: 'same', label: 'Todos iguales', icon: CalendarDays },
                { value: 'cycling', label: 'Entreno y descanso', icon: Dumbbell },
              ]}
            />
          </section>

          {/* ---- daily targets ---- */}
          <section aria-labelledby="nb-targets" className="flex flex-col gap-3">
            <SectionHeader
              id="nb-targets"
              title="Objetivo diario"
              tip="Los únicos números del plan. Lo que el cliente registra con fotos se compara con esto. Puedes dejarlo vacío."
              actions={
                <div className="flex items-center gap-2">
                  <Switch
                    id="nb-range"
                    checked={rangeMode}
                    onCheckedChange={(v) => {
                      if (!v) setTargets(collapseRanges);
                      setRangeMode(v);
                    }}
                  />
                  <Label htmlFor="nb-range" className="cursor-pointer">
                    Rangos
                  </Label>
                  <InfoTip label="Qué son los rangos">
                    Escribe un mínimo y un máximo (ej. 150–170 g) en lugar de un número exacto.
                  </InfoTip>
                </div>
              }
            />
            <div className={cn('grid gap-3', dayCycling && 'lg:grid-cols-2')}>
              {dayTypesFor(dayCycling).map((dt) => (
                <TargetCard key={dt} dayType={dt} t={targets[dt]} range={rangeMode} onChange={(p) => updTarget(dt, p)} />
              ))}
            </div>
          </section>

          {/* ---- meals ---- */}
          <section ref={mealsRef} aria-labelledby="nb-meals" className="flex scroll-mt-24 flex-col gap-3">
            <SectionHeader
              id="nb-meals"
              title="Comidas"
              count={meals.length}
              tip="Cada comida tiene una o más opciones y el cliente elige una. Solo escribes los alimentos: la app calcula calorías y macros con la foto del plato."
              actions={
                dayCycling && (
                  <div className="flex items-center gap-2">
                    <span className="hidden text-[13px] text-muted-foreground sm:inline">Ver día de</span>
                    <Segmented<DayType>
                      aria-label="Ver cómo queda cada tipo de día"
                      size="sm"
                      value={lens}
                      onChange={setLens}
                      options={[
                        { value: 'both', label: 'Todo' },
                        { value: 'training', label: 'Entreno', icon: Dumbbell },
                        { value: 'rest', label: 'Descanso', icon: BedDouble },
                      ]}
                    />
                  </div>
                )
              }
            />

            {meals.map((meal, mi) => (
              <MealCard
                key={mi}
                meal={meal}
                mi={mi}
                count={meals.length}
                dayCycling={dayCycling}
                lens={lens}
                onPatch={(p) => updMeal(mi, p)}
                onPatchOption={(oi, p) => updOption(mi, oi, p)}
                onFoodName={(oi, fi, v) => updFoods(mi, oi, (fs) => fs.map((f, j) => (j === fi ? { ...f, name: v } : f)))}
                onFoodDay={(oi, fi, v) => updFoods(mi, oi, (fs) => fs.map((f, j) => (j === fi ? { ...f, dayType: v } : f)))}
                onAddFood={(oi, at) => addFood(mi, oi, at)}
                onRemoveFood={(oi, fi) => removeFood(mi, oi, fi)}
                onFocusFood={(oi, fi) => focusFood(mi, oi, fi, true)}
                onAddOption={() =>
                  focusFood(mi, meal.options.length, 0, false, () =>
                    updMeal(mi, { options: [...meal.options, emptyOption(meal.options.length + 1)] }),
                  )
                }
                onRemoveOption={(oi) => updMeal(mi, { options: meal.options.filter((_, k) => k !== oi) })}
                onDuplicate={() => setMeals((ms) => [...ms.slice(0, mi + 1), copyMeal(ms[mi]), ...ms.slice(mi + 1)])}
                onMove={(d) => moveMeal(mi, d)}
                onRemove={() => setMeals((ms) => (ms.length > 1 ? ms.filter((_, i) => i !== mi) : ms))}
              />
            ))}

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-strong p-3">
              <span className="mr-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                <Plus className="h-4 w-4" /> Añadir
              </span>
              {MEAL_TYPES.map((t) => {
                const Icon = MEAL_ICON[t.value];
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => addMeal(t.value)}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium transition-colors hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Live preview of the unsaved draft, beside it on wide screens. */}
        <aside aria-label="Vista previa en la app" className="hidden xl:block">
          <div className="sticky top-[88px] flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Así lo ve el cliente</span>
              <span className="flex items-center gap-1.5 text-xs text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> en vivo
              </span>
            </div>
            <MobileNutritionPreview plan={preview} />
          </div>
        </aside>
      </div>

      <AiNutritionDialog
        host={aiHost}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onApplied={(r) => {
          setAiResult(r);
          setAiResultSeq((n) => n + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <DiscardChangesDialog open={confirmClose} onOpenChange={setConfirmClose} editing={!!initial} onDiscard={onClose} />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          <MobileNutritionPreview plan={preview} />
        </DialogContent>
      </Dialog>
    </FocusEditor>
  );
}

/* ------------------------------------------------------------------ targets */

const mid = (a: string, b: string): number | null => {
  const x = toNum(a);
  const y = toNum(b);
  if (x != null && y != null) return (x + y) / 2;
  return x ?? y;
};

function TargetCard({
  dayType,
  t,
  range,
  onChange,
}: {
  dayType: DayType;
  t: TargetRow;
  range: boolean;
  onChange: (patch: Partial<TargetRow>) => void;
}) {
  const meta = DAY_META[dayType];
  const Icon = meta.icon;
  const id = `nb-t-${dayType}`;
  const macro = (minKey: keyof TargetRow, maxKey: keyof TargetRow, label: string, dot: string) => (
    <MacroField
      id={`${id}-${minKey}`}
      label={label}
      unit="g"
      dot={dot}
      range={range}
      min={t[minKey]}
      max={t[maxKey]}
      onMin={(v) => onChange({ [minKey]: v })}
      onMax={(v) => onChange({ [maxKey]: v })}
    />
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className={cn('flex items-center gap-2 text-sm font-semibold', meta.tone)}>
        <Icon className="h-4 w-4" />
        <span className={dayType === 'both' ? 'text-foreground' : undefined}>{meta.title}</span>
      </div>
      <MacroField
        id={`${id}-kcal`}
        label="Calorías"
        unit="kcal"
        big
        range={range}
        min={t.kcalMin}
        max={t.kcalMax}
        onMin={(v) => onChange({ kcalMin: v })}
        onMax={(v) => onChange({ kcalMax: v })}
      />
      <div className={cn('grid gap-3', range ? 'grid-cols-1' : 'grid-cols-3')}>
        {macro('proteinMin', 'proteinMax', 'Proteína', 'bg-protein')}
        {macro('carbsMin', 'carbsMax', 'Carbos', 'bg-carbs')}
        {macro('fatMin', 'fatMax', 'Grasa', 'bg-fat')}
      </div>
      <MacroSplit t={t} onUseKcal={(k) => onChange({ kcalMin: k, kcalMax: k })} range={range} />
    </div>
  );
}

const NUM =
  'no-spin h-10 w-full min-w-0 rounded-lg border border-border bg-field px-3 text-[15px] font-semibold tabular-nums text-foreground transition-colors placeholder:font-normal placeholder:text-faint hover:border-border-strong focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const NUM_BIG = 'h-14 font-display text-[30px] font-normal tracking-wide placeholder:font-sans placeholder:text-base';

/** One target figure: a single number by default, min–max in range mode
 *  (a single number is stored as min = max). */
function MacroField({
  id,
  label,
  unit,
  dot,
  big,
  range,
  min,
  max,
  onMin,
  onMax,
}: {
  id: string;
  label: string;
  unit: string;
  dot?: string;
  big?: boolean;
  range: boolean;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  const labelEl = (
    <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
      {dot && <span aria-hidden="true" className={cn('h-2 w-2 flex-none rounded-full', dot)} />}
      {label}
    </label>
  );

  if (range) {
    return (
      <div className={cn('flex gap-1.5', big ? 'flex-col' : 'items-center justify-between gap-3')}>
        {labelEl}
        <div className="flex items-center gap-1.5">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            aria-label={`${label} mínimo`}
            placeholder="mín"
            value={min}
            onChange={(e) => onMin(e.target.value)}
            className={cn(NUM, big ? cn(NUM_BIG, 'w-32') : 'w-20')}
          />
          <span className="text-faint">–</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            aria-label={`${label} máximo`}
            placeholder="máx"
            value={max}
            onChange={(e) => onMax(e.target.value)}
            className={cn(NUM, big ? cn(NUM_BIG, 'w-32') : 'w-20')}
          />
          <span className="w-8 text-[13px] text-faint">{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {labelEl}
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          placeholder={big ? 'Ej. 2200' : '—'}
          value={min.trim() || max.trim()}
          onChange={(e) => {
            onMin(e.target.value);
            onMax(e.target.value);
          }}
          className={cn(NUM, big && NUM_BIG, big ? 'pr-16' : 'pr-7')}
        />
        <span className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-faint', big ? 'right-4 text-sm' : 'right-2.5 text-xs')}>
          {unit}
        </span>
      </div>
    </div>
  );
}

/** How the macros split the day's energy, and whether they add up to the
 *  calories — the maths a coach would otherwise do on the side. */
function MacroSplit({ t, range, onUseKcal }: { t: TargetRow; range: boolean; onUseKcal: (kcal: string) => void }) {
  const p = (mid(t.proteinMin, t.proteinMax) ?? 0) * KCAL_PER_G.protein;
  const c = (mid(t.carbsMin, t.carbsMax) ?? 0) * KCAL_PER_G.carbs;
  const f = (mid(t.fatMin, t.fatMax) ?? 0) * KCAL_PER_G.fat;
  const total = p + c + f;
  if (total <= 0) return null;

  const kcal = mid(t.kcalMin, t.kcalMax);
  const fromMacros = Math.round(total / 10) * 10;
  const pct = (v: number) => Math.round((v / total) * 100);
  const fits = kcal != null && kcal > 0 && Math.abs(kcal - total) / kcal <= 0.08;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div
        role="img"
        aria-label={`Reparto de calorías: ${pct(p)} % proteína, ${pct(c)} % carbohidratos, ${pct(f)} % grasa`}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
      >
        <span className="bg-protein" style={{ width: `${(p / total) * 100}%` }} />
        <span className="bg-carbs" style={{ width: `${(c / total) * 100}%` }} />
        <span className="bg-fat" style={{ width: `${(f / total) * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          <b className="font-semibold text-foreground">{pct(p)}%</b> prot.
        </span>
        <span className="tabular-nums">
          <b className="font-semibold text-foreground">{pct(c)}%</b> carbos
        </span>
        <span className="tabular-nums">
          <b className="font-semibold text-foreground">{pct(f)}%</b> grasa
        </span>
        <span className="ml-auto flex items-center gap-2">
          {fits ? (
            <span className="flex items-center gap-1 text-success">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Cuadra con las calorías
            </span>
          ) : (
            <>
              <span className={cn('tabular-nums', kcal != null && kcal > 0 && 'text-warning')}>
                Los macros suman ≈ {fromMacros.toLocaleString('en-US')} kcal
              </span>
              {!range && (
                <button
                  type="button"
                  onClick={() => onUseKcal(String(fromMacros))}
                  className="h-6 rounded-md bg-muted px-2 text-xs font-semibold text-foreground transition-colors hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Usar
                </button>
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- meals */

function MealCard({
  meal,
  mi,
  count,
  dayCycling,
  lens,
  onPatch,
  onPatchOption,
  onFoodName,
  onFoodDay,
  onAddFood,
  onRemoveFood,
  onFocusFood,
  onAddOption,
  onRemoveOption,
  onDuplicate,
  onMove,
  onRemove,
}: {
  meal: MealRow;
  mi: number;
  count: number;
  dayCycling: boolean;
  lens: DayType;
  onPatch: (p: Partial<MealRow>) => void;
  onPatchOption: (oi: number, p: Partial<OptionRow>) => void;
  onFoodName: (oi: number, fi: number, v: string) => void;
  onFoodDay: (oi: number, fi: number, v: DayType) => void;
  onAddFood: (oi: number, at: number) => void;
  onRemoveFood: (oi: number, fi: number) => void;
  onFocusFood: (oi: number, fi: number) => void;
  onAddOption: () => void;
  onRemoveOption: (oi: number) => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const typeLabel = mealTypeLabel(meal.mealType);
  const title = meal.label.trim() || typeLabel;
  const Icon = MEAL_ICON[meal.mealType];
  const noteRef = useRef<HTMLInputElement>(null);
  const focusNoteNext = useRef(false);
  const showNote = meal.advOpen || meal.notes.trim() !== '';
  /** The lens is on a day this meal doesn't appear on. */
  const off = dayCycling && lens !== 'both' && meal.appliesTo !== 'both' && meal.appliesTo !== lens;
  const applies = DAY_META[meal.appliesTo];
  const AppliesIcon = applies.icon;

  return (
    <article
      aria-label={`Comida ${mi + 1}: ${title}`}
      className={cn('rounded-xl border border-border bg-card p-3 transition-opacity sm:p-4', off && 'opacity-40')}
    >
      <div className="flex items-center gap-2">
        <Select value={meal.mealType} onValueChange={(v) => onPatch({ mealType: v as PlanMealType })}>
          <Tip label={`Tipo: ${typeLabel}`}>
            <SelectTrigger
              hideChevron
              aria-label={`Tipo de comida: ${typeLabel}`}
              className="h-10 w-10 flex-none justify-center rounded-lg border-transparent bg-muted p-0 hover:border-border-strong"
            >
              <Icon className="h-[18px] w-[18px]" />
            </SelectTrigger>
          </Tip>
          <SelectContent>
            {MEAL_TYPES.map((m) => {
              const MIcon = MEAL_ICON[m.value];
              return (
                <SelectItem key={m.value} value={m.value}>
                  <MIcon className="text-muted-foreground" />
                  {m.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <input
          aria-label={`Nombre de la comida ${mi + 1}`}
          value={meal.label}
          placeholder={typeLabel}
          onChange={(e) => onPatch({ label: e.target.value })}
          className="inline-input h-10 flex-1 text-base font-semibold placeholder:text-foreground/80"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones de ${title}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            onCloseAutoFocus={(e) => {
              if (!focusNoteNext.current) return;
              focusNoteNext.current = false;
              e.preventDefault();
              noteRef.current?.focus();
            }}
          >
            <DropdownMenuCheckboxItem checked={meal.isOptional} onCheckedChange={(v) => onPatch({ isOptional: !!v })}>
              Opcional (puede saltarla)
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
              onSelect={() => {
                focusNoteNext.current = true;
                onPatch({ advOpen: true });
              }}
            >
              <StickyNote />
              {showNote ? 'Editar nota' : 'Añadir nota'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDuplicate}>
              <CopyPlus />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem disabled={mi === 0} onSelect={() => onMove(-1)}>
              <ArrowUp />
              Subir
            </DropdownMenuItem>
            <DropdownMenuItem disabled={mi === count - 1} onSelect={() => onMove(1)}>
              <ArrowDown />
              Bajar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={count <= 1} onSelect={onRemove}>
              <Trash2 />
              Eliminar comida
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* What's set on the meal, as chips you can change in place. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-12">
        <label
          className={cn(
            'inline-flex h-8 cursor-text items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors focus-within:border-border-strong focus-within:ring-2 focus-within:ring-ring',
            meal.timeHint.trim() ? 'border-border bg-field text-foreground' : 'border-dashed border-border-strong text-faint hover:text-foreground',
          )}
        >
          <Clock3 className="h-3.5 w-3.5 flex-none" />
          <span className="sr-only">Horario</span>
          <input
            value={meal.timeHint}
            onChange={(e) => onPatch({ timeHint: e.target.value })}
            placeholder="Añadir hora"
            size={Math.max(10, meal.timeHint.length + 1)}
            className="min-w-0 bg-transparent outline-none placeholder:text-faint"
          />
        </label>
        {dayCycling && (
          <Select value={meal.appliesTo} onValueChange={(v) => onPatch({ appliesTo: v as DayType })}>
            <SelectTrigger
              aria-label={`Días en que aparece: ${applies.label}`}
              className={cn('h-8 w-auto gap-1.5 rounded-full px-3 text-[13px] font-medium', applies.chip)}
            >
              <AppliesIcon className="h-3.5 w-3.5" />
              <span>{applies.label}</span>
            </SelectTrigger>
            <SelectContent>
              {APPLIES_TO.map((a) => {
                const AIcon = DAY_META[a.value].icon;
                return (
                  <SelectItem key={a.value} value={a.value}>
                    <AIcon className={DAY_META[a.value].tone} />
                    {a.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        {meal.isOptional && (
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-[13px] font-medium text-muted-foreground">
            Opcional
            <button
              type="button"
              onClick={() => onPatch({ isOptional: false })}
              aria-label="Quitar «opcional»"
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      {showNote && (
        <div className="mt-2 flex items-center gap-1.5 sm:pl-12">
          <StickyNote className="h-4 w-4 flex-none text-faint" />
          <input
            ref={noteRef}
            aria-label="Nota de la comida"
            value={meal.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Nota para el cliente, ej. en descanso cámbiala por un batido"
            className="inline-input h-8 flex-1 text-[13px]"
          />
          <button
            type="button"
            onClick={() => onPatch({ notes: '', advOpen: false })}
            aria-label="Quitar nota"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-faint hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Options — the rotation — side by side. */}
      <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
        {meal.options.map((opt, oi) => (
          <div key={oi} className="flex min-w-0 flex-col rounded-lg border border-border bg-background/60 p-1.5">
            <div className="flex items-center gap-1">
              <input
                aria-label={`Nombre de la opción ${oi + 1}`}
                value={opt.label}
                placeholder={`Opción ${oi + 1}`}
                onChange={(e) => onPatchOption(oi, { label: e.target.value })}
                className="inline-input h-8 flex-1 text-[13px] font-semibold text-muted-foreground focus-visible:text-foreground"
              />
              {meal.options.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveOption(oi)}
                  aria-label={`Quitar ${opt.label.trim() || `opción ${oi + 1}`}`}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-faint hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <ul className="flex flex-col">
              {opt.foods.map((food, fi) => (
                <FoodLine
                  key={fi}
                  id={`${mi}-${oi}-${fi}`}
                  food={food}
                  dayCycling={dayCycling}
                  dim={dayCycling && lens !== 'both' && food.dayType !== 'both' && food.dayType !== lens}
                  canRemove={opt.foods.length > 1 || food.name.trim() !== ''}
                  onName={(v) => onFoodName(oi, fi, v)}
                  onDay={(v) => onFoodDay(oi, fi, v)}
                  onEnter={() => onAddFood(oi, fi + 1)}
                  onRemove={() => onRemoveFood(oi, fi)}
                  onBackspaceEmpty={() => {
                    if (opt.foods.length <= 1) return;
                    onRemoveFood(oi, fi);
                    onFocusFood(oi, Math.max(0, fi - 1));
                  }}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onAddFood(oi, opt.foods.length)}
              className="mt-0.5 flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" /> Alimento
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddOption}
          className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong sm:min-h-[96px] text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" /> Otra opción
        </button>
      </div>
    </article>
  );
}

/** One food: its name, and — when days differ — which days it's on.
 *  Enter adds the next food; Backspace on an empty one removes it. */
function FoodLine({
  id,
  food,
  dayCycling,
  dim,
  canRemove,
  onName,
  onDay,
  onEnter,
  onRemove,
  onBackspaceEmpty,
}: {
  id: string;
  food: FoodRow;
  dayCycling: boolean;
  dim: boolean;
  canRemove: boolean;
  onName: (v: string) => void;
  onDay: (v: DayType) => void;
  onEnter: () => void;
  onRemove: () => void;
  onBackspaceEmpty: () => void;
}) {
  const meta = DAY_META[food.dayType];
  const DayIcon = meta.icon;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (food.name.trim()) onEnter();
    } else if (e.key === 'Backspace' && food.name === '') {
      e.preventDefault();
      onBackspaceEmpty();
    }
  };

  return (
    <li className={cn('group flex items-center gap-1 rounded-md transition-opacity', dim && 'opacity-35')}>
      <span aria-hidden="true" className="ml-2 h-1.5 w-1.5 flex-none rounded-full bg-border-strong" />
      <input
        data-food={id}
        aria-label="Alimento"
        value={food.name}
        placeholder="Escribe un alimento"
        onChange={(e) => onName(e.target.value)}
        onKeyDown={onKeyDown}
        enterKeyHint="next"
        className="inline-input h-8 flex-1 text-sm"
      />
      {dayCycling && (
        <Select value={food.dayType} onValueChange={(v) => onDay(v as DayType)}>
          <Tip label={food.dayType === 'both' ? 'Ambos días · cambiar' : meta.label}>
            <SelectTrigger
              hideChevron
              aria-label={`Días de ${food.name.trim() || 'este alimento'}: ${meta.label}`}
              className={cn(
                'h-7 w-7 flex-none justify-center rounded-md border-transparent bg-transparent p-0',
                food.dayType === 'both' ? 'text-faint hover:text-foreground' : cn(meta.tone, 'bg-muted'),
              )}
            >
              <DayIcon className="h-4 w-4" />
            </SelectTrigger>
          </Tip>
          <SelectContent align="end">
            {FOOD_DAYS.map((d) => {
              const DIcon = DAY_META[d.value].icon;
              return (
                <SelectItem key={d.value} value={d.value}>
                  <DIcon className={DAY_META[d.value].tone} />
                  {DAY_META[d.value].label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${food.name.trim() || 'alimento'}`}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-faint transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
