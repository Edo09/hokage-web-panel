import { useState, type CSSProperties, type ReactNode } from 'react';
import { Coffee, Dumbbell, Moon, Pill, Sun, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  foodsFor,
  previewNextIndex,
  previewTodayMeals,
  previewTotalMeals,
  type PreviewNutritionPlan,
  type PreviewSupplementPlan,
  type PreviewTodayMeal,
} from '@/components/nutrition/previewModel';
import type { DayType, PlanMealType, SupplementTier, SupplementTiming } from '@/types';

/**
 * «Así lo ve el cliente»: a replica of the app's Nutrición tab as the client
 * sees it before registering anything today, rendered from either a saved plan
 * or the builder's unsaved draft.
 *
 * FIDELITY RULES (mirror the app's utils/meal-registration.ts and
 * utils/nutrition-plan.ts — keep in sync):
 *   - the day type filters TWICE: applies_to hides whole meals, and each
 *     food's day_type hides single foods; an option with no food that day is
 *     gone;
 *   - a meal hidden by applies_to still shows its `notes` as a «No aplica hoy»
 *     row, because that is where the rest-day substitution instruction lives;
 *   - the next meal is the first required one that applies, and it is the
 *     open card; «0 de M» counts the required meals that apply;
 *   - foods show a name and nothing else. The AI estimates the calories and
 *     macros when the client registers what they ate.
 *
 * Colours are hard-coded to the app's dark palette on purpose: this simulates a
 * device, so it must not follow the panel's light/dark theme.
 */

const APP = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  red: '#ef4444',
  redText: '#f87171',
  redSoft: 'rgba(239,68,68,0.14)',
  gold: '#fbbf24',
  success: '#22c55e',
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fat: '#fb7185',
  text: '#f8fafc',
  secondary: '#cbd5e1',
  tertiary: '#94a3b8',
  muted: '#64748b',
};

/** The app's names: the type name, capitalised, when the coach set no label. */
const MEAL_TYPE_ES: Record<PlanMealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
  pre_workout: 'Pre-entrenamiento',
  post_workout: 'Post-entrenamiento',
};

const MEAL_ICON: Record<PlanMealType, LucideIcon> = {
  breakfast: Sun,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Coffee,
  pre_workout: Zap,
  post_workout: Dumbbell,
};

const TIER_ES: Record<SupplementTier, string> = {
  base: 'Base',
  conditional: 'Condicionales',
  optional: 'Opcionales',
};

const TIER_HINT_ES: Record<SupplementTier, string> = {
  base: 'Obligatorios',
  conditional: 'Según tolerancia',
  optional: 'Menor prioridad',
};

const TIMING_ES: Record<SupplementTiming, string> = {
  wake: 'Al despertar',
  breakfast: 'Desayuno',
  pre_workout: 'Pre-entreno',
  intra_workout: 'Durante el entreno',
  post_workout: 'Post-entreno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  bedtime: 'Antes de dormir',
  any: 'Cualquier momento',
};

/** Day order for the derived schedule table. */
const TIMING_ORDER: SupplementTiming[] = [
  'wake',
  'breakfast',
  'pre_workout',
  'intra_workout',
  'post_workout',
  'lunch',
  'dinner',
  'bedtime',
  'any',
];

const TIERS: SupplementTier[] = ['base', 'conditional', 'optional'];

type Day = Exclude<DayType, 'both'>;

const skew = (deg: number): CSSProperties => ({ transform: `skewX(${deg}deg)` });

/** "1800–1850" → "1,800–1,850", as the app writes the coach's range. */
function groupThousands(range: string): string {
  return range
    .split('–')
    .map((x) => {
      const n = Number(x);
      return x !== '' && Number.isFinite(n) ? n.toLocaleString('en-US') : x;
    })
    .join('–');
}

const mealName = (m: PreviewTodayMeal) => m.meal.label || MEAL_TYPE_ES[m.meal.mealType];
const optionsCount = (n: number) => `${n} ${n === 1 ? 'opción' : 'opciones'}`;

/* ---------------- the phone ---------------- */

export function MobileNutritionPreview({
  plan,
  supplements,
  fitToViewport = false,
}: {
  plan: PreviewNutritionPlan;
  /** Independently assignable, so it may legitimately be absent. */
  supplements?: PreviewSupplementPlan | null;
  /** In a dialog: shrink the screen to fit the window, so the dialog itself
   *  never needs a scrollbar. Inline (the builder's side column) it's full height. */
  fitToViewport?: boolean;
}) {
  const [pane, setPane] = useState<'plan' | 'supp'>('plan');
  const [day, setDay] = useState<Day>('training');
  /** A pending card the coach clicked open; null opens the next meal. */
  const [opened, setOpened] = useState<number | null>(null);
  const activeDay: Day = plan.dayCycling ? day : 'training';

  const target =
    plan.targets.find((t) => t.dayType === (plan.dayCycling ? activeDay : 'both')) ?? null;
  const meals = previewTodayMeals(plan, activeDay);
  const next = previewNextIndex(meals);
  const total = previewTotalMeals(meals);
  const open = opened != null && meals[opened] != null && !meals[opened].noteOnly ? opened : next;

  const switchDay = () => {
    setDay(activeDay === 'training' ? 'rest' : 'training');
    setOpened(null);
  };

  return (
    <div className="mx-auto w-full max-w-[336px] flex-none">
      <div
        className="overflow-hidden rounded-[34px] border-[9px] shadow-2xl"
        style={{ borderColor: '#23262C', background: APP.bg }}
      >
        <div className="flex items-center justify-center py-1.5" style={{ background: APP.bg }}>
          <span className="h-1 w-16 rounded-full" style={{ background: '#2E3440' }} />
        </div>

        <div
          className={cn(
            'overflow-y-auto px-3 pb-4',
            fitToViewport ? 'h-[clamp(320px,calc(100dvh-11rem),560px)]' : 'h-[560px]',
          )}
          style={{ background: APP.bg }}
        >
          {/* tab segments — PLAN · SUPLEMENTOS */}
          <div className="mt-1 flex rounded-xl p-1" style={{ border: `1px solid ${APP.border}` }}>
            <Segment active={pane === 'plan'} onClick={() => setPane('plan')}>
              Plan
            </Segment>
            <Segment active={pane === 'supp'} onClick={() => setPane('supp')}>
              Suplementos
            </Segment>
          </div>

          {pane === 'plan' ? (
            <>
              <HoyCard
                kcal={target && !target.empty ? target.kcal : ''}
                protein={target?.protein ?? ''}
                carbs={target?.carbs ?? ''}
                fat={target?.fat ?? ''}
              />

              <div className="mt-3 flex min-h-[20px] items-center justify-between gap-2">
                {plan.dayCycling ? (
                  <button
                    type="button"
                    onClick={switchDay}
                    title="Cambiar el tipo de día"
                    className="flex items-center"
                  >
                    {activeDay === 'training' ? (
                      <Chip tone="red">⚡ Día de entreno</Chip>
                    ) : (
                      <Chip tone="neutral">Día de descanso</Chip>
                    )}
                  </button>
                ) : (
                  <span />
                )}
                {total > 0 && (
                  <Caps className="text-[8.5px]" style={{ color: APP.tertiary }}>
                    0 de {total} {total === 1 ? 'comida' : 'comidas'}
                  </Caps>
                )}
              </div>

              {meals.length === 0 ? (
                <Card className="mt-2.5">
                  <p className="text-[12px]" style={{ color: APP.tertiary }}>
                    Añade comidas para verlas aquí.
                  </p>
                </Card>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2">
                  {meals.map((m, i) =>
                    m.noteOnly ? (
                      <NoteRow key={i} item={m} />
                    ) : i === open ? (
                      <OpenCard key={i} item={m} isNext={i === next} day={activeDay} cycling={plan.dayCycling} />
                    ) : (
                      <PendingCard key={i} item={m} onOpen={() => setOpened(i)} />
                    ),
                  )}
                </div>
              )}

              {plan.notes && (
                <Card className="mt-2.5">
                  <Caps className="text-[8.5px]" style={{ color: APP.tertiary }}>
                    Notas del coach
                  </Caps>
                  <p className="mt-1 whitespace-pre-line text-[11.5px]" style={{ color: APP.secondary }}>
                    {plan.notes}
                  </p>
                </Card>
              )}
            </>
          ) : (
            <SupplementPane plan={supplements ?? null} day={activeDay} cycling={plan.dayCycling} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- plan pane ---------------- */

function HoyCard({ kcal, protein, carbs, fat }: { kcal: string; protein: string; carbs: string; fat: string }) {
  // Nothing registered yet: «N restantes» counts to the bottom of the range.
  const first = Number(kcal.split('–')[0]);
  const remaining = kcal !== '' && Number.isFinite(first) && first > 0 ? first.toLocaleString('en-US') : null;
  return (
    <div
      className="relative mt-2.5 overflow-hidden rounded-[18px] px-3.5 pb-3 pt-3.5"
      style={{ background: APP.surface, border: `1px solid ${APP.border}` }}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: APP.border }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Caps className="text-[8.5px]">
            <span style={{ color: APP.tertiary }}>Hoy · </span>
            <span style={{ color: APP.gold }}>✦ estimado con IA</span>
          </Caps>
          <div className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="font-poster text-[30px] leading-none" style={{ color: APP.text }}>
              0
            </span>
            <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: APP.muted }}>
              {kcal ? `/ ${groupThousands(kcal)} kcal` : 'kcal'}
            </span>
          </div>
        </div>
        {remaining != null && (
          <Caps className="text-[8.5px]" style={{ color: APP.success, letterSpacing: '0.08em' }}>
            {remaining} restantes
          </Caps>
        )}
      </div>
      <div className="mt-3 flex pt-2.5" style={{ borderTop: `1px solid ${APP.border}` }}>
        <MacroColumn label="Proteína" target={protein} color={APP.protein} />
        <span className="w-px" style={{ background: APP.border }} />
        <MacroColumn label="Carbos" target={carbs} color={APP.carbs} />
        <span className="w-px" style={{ background: APP.border }} />
        <MacroColumn label="Grasa" target={fat} color={APP.fat} />
      </div>
    </div>
  );
}

function MacroColumn({ label, target, color }: { label: string; target: string; color: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="font-poster text-[15px] leading-none" style={{ color }}>
          0
        </span>
        <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: APP.muted }}>
          {target ? `/ ${target} g` : 'g'}
        </span>
      </span>
      <Caps className="text-[8px]" style={{ color: APP.tertiary }}>
        {label}
      </Caps>
    </div>
  );
}

function MealIcon({ type, red = false }: { type: PlanMealType; red?: boolean }) {
  const Icon = MEAL_ICON[type];
  return (
    <span
      className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px]"
      style={{
        background: red ? APP.redSoft : APP.bg,
        border: `1px solid ${red ? APP.red : APP.border}`,
      }}
    >
      <Icon className="h-4 w-4" style={{ color: red ? APP.red : APP.muted }} />
    </span>
  );
}

function PendingCard({ item, onOpen }: { item: PreviewTodayMeal; onOpen: () => void }) {
  const { meal, options } = item;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('flex w-full items-center gap-2.5 rounded-[14px] p-2.5 text-left', meal.isOptional && 'opacity-70')}
      style={{ background: APP.surface, border: `1px solid ${APP.border}` }}
    >
      <MealIcon type={meal.mealType} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-poster text-[14px] uppercase leading-none" style={{ color: APP.text }}>
          {mealName(item)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {meal.isOptional && <Chip tone="neutral">Opcional</Chip>}
          <span className="truncate text-[10.5px]" style={{ color: APP.tertiary }}>
            {[meal.timeHint, optionsCount(options.length)].filter(Boolean).join(' · ')}
          </span>
        </span>
      </span>
      <StatusBox next={false} />
    </button>
  );
}

function OpenCard({
  item,
  isNext,
  day,
  cycling,
}: {
  item: PreviewTodayMeal;
  isNext: boolean;
  day: Day;
  cycling: boolean;
}) {
  const { meal, options } = item;
  const [tab, setTab] = useState(0);
  const selected = options[Math.min(tab, options.length - 1)] ?? null;
  const foods = selected == null ? [] : cycling ? foodsFor(selected, day) : selected.foods;
  const label = (i: number) => options[i].label || `Opción ${meal.options.indexOf(options[i]) + 1}`;

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] p-3" style={{ background: APP.surface, border: `1px solid ${APP.red}` }}>
      <div className="flex items-center gap-2.5">
        <MealIcon type={meal.mealType} red />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-poster text-[17px] uppercase leading-none" style={{ color: APP.text }}>
              {mealName(item)}
            </span>
            {isNext && <Chip tone="solid">Siguiente</Chip>}
          </span>
          <span className="truncate text-[10.5px]" style={{ color: APP.tertiary }}>
            {[meal.timeHint, optionsCount(options.length)].filter(Boolean).join(' · ')}
          </span>
        </span>
        <StatusBox next={isNext} />
      </div>

      {options.length > 1 && (
        <div className="flex gap-3.5" style={{ borderBottom: `1px solid ${APP.border}` }}>
          {options.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTab(i)}
              className="pb-1.5"
              style={i === Math.min(tab, options.length - 1) ? { boxShadow: `inset 0 -2px 0 ${APP.red}` } : undefined}
            >
              <Caps
                className="text-[8.5px]"
                style={{ color: i === Math.min(tab, options.length - 1) ? APP.text : APP.muted, letterSpacing: '0.1em' }}
              >
                {label(i)}
              </Caps>
            </button>
          ))}
        </div>
      )}

      {foods.length > 0 && (
        <ul className="flex flex-col gap-1">
          {foods.map((f, fi) => (
            <li key={fi} className="flex items-center gap-2 text-[12px]" style={{ color: APP.text }}>
              <span aria-hidden="true" className="h-[5px] w-[5px] flex-none" style={{ background: APP.red, ...skew(-10) }} />
              {f.name}
            </li>
          ))}
        </ul>
      )}
      {selected?.notes && (
        <p className="text-[11px]" style={{ color: APP.tertiary }}>
          {selected.notes}
        </p>
      )}

      {/* What the client taps to register: shown, not working, in the preview. */}
      <div className="py-2 text-center" style={{ background: APP.red, ...skew(-10) }}>
        <span className="inline-block" style={skew(10)}>
          <Caps className="text-[10px]" style={{ color: '#fff', letterSpacing: '0.1em' }}>
            Registrar {mealName(item).toLocaleLowerCase('es')}
          </Caps>
        </span>
      </div>
    </div>
  );
}

/** A meal the day type leaves out, kept for its note (the substitution). */
function NoteRow({ item }: { item: PreviewTodayMeal }) {
  return (
    <div className="rounded-[14px] px-3 py-2.5 opacity-80" style={{ background: APP.surface, border: `1px solid ${APP.border}` }}>
      <div className="flex items-center gap-2">
        <span className="truncate font-poster text-[12.5px] uppercase leading-none" style={{ color: APP.tertiary }}>
          {mealName(item)}
        </span>
        <Chip tone="neutral">No aplica hoy</Chip>
      </div>
      <p className="mt-1 text-[11px]" style={{ color: APP.secondary }}>
        {item.meal.notes}
      </p>
    </div>
  );
}

/** The slanted box on the right: red outline for «Siguiente», dashed while pending. */
function StatusBox({ next }: { next: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="h-[22px] w-[22px] flex-none"
      style={{
        border: next ? `2px solid ${APP.red}` : `1.5px dashed ${APP.muted}`,
        ...skew(-8),
      }}
    />
  );
}

/* ---------------- supplements pane ---------------- */

function SupplementPane({
  plan,
  day,
  cycling,
}: {
  plan: PreviewSupplementPlan | null;
  day: Day;
  cycling: boolean;
}) {
  if (plan == null || plan.items.length === 0) {
    return (
      <Card className="mt-2.5">
        <p className="text-[12px]" style={{ color: APP.tertiary }}>
          Sin plan de suplementación asignado.
        </p>
        <p className="mt-1 text-[11px]" style={{ color: APP.muted }}>
          Se asigna por separado del plan nutricional.
        </p>
      </Card>
    );
  }

  const visible = plan.items.filter(
    (i) => !cycling || i.appliesTo === 'both' || i.appliesTo === day,
  );

  // The schedule table the coach's PDF ends with is DERIVED, not stored.
  const bySlot = TIMING_ORDER.map((slot) => ({
    slot,
    items: visible.filter((i) => i.timingSlot === slot),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div
        className="relative mt-2.5 overflow-hidden rounded-[18px] p-3.5"
        style={{ background: APP.surface, border: `1px solid ${APP.border}` }}
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: APP.border }} />
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px]"
            style={{ background: APP.redSoft, border: `1px solid ${APP.red}` }}
          >
            <Pill className="h-4 w-4" style={{ color: APP.red }} />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <Caps className="text-[8px]" style={{ color: APP.red }}>
              Coach
            </Caps>
            <span className="font-poster text-[17px] uppercase leading-none" style={{ color: APP.text }}>
              {plan.name}
            </span>
          </span>
        </div>
        <p className="mt-2 text-[11px] tabular-nums" style={{ color: APP.tertiary }}>
          Hoy: 0 de {visible.length} tomados
        </p>
      </div>

      {TIERS.map((tier) => {
        const items = visible.filter((i) => i.tier === tier);
        if (items.length === 0) return null;
        return (
          <Card key={tier} className="mt-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Caps className="text-[8.5px]" style={{ color: APP.tertiary }}>
                {TIER_ES[tier]}
              </Caps>
              <span className="text-[10.5px]" style={{ color: APP.muted }}>
                {TIER_HINT_ES[tier]}
              </span>
            </div>
            {items.map((i, idx) => (
              <div
                key={idx}
                className="mt-2 flex gap-2.5 rounded-[12px] p-2.5"
                style={{ background: APP.bg, border: `1px solid ${APP.border}` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold" style={{ color: APP.text }}>
                    {i.name}
                  </div>
                  {i.dose && (
                    <div className="mt-0.5 text-[11.5px]" style={{ color: APP.secondary }}>
                      {i.dose}
                    </div>
                  )}
                  {(i.timingNote || i.timingSlot !== 'any') && (
                    <div className="mt-0.5 text-[11px]" style={{ color: APP.tertiary }}>
                      {i.timingNote || TIMING_ES[i.timingSlot]}
                    </div>
                  )}
                  {i.purpose && (
                    <div className="mt-0.5 text-[11px]" style={{ color: APP.tertiary }}>
                      {i.purpose}
                    </div>
                  )}
                  {i.notes && (
                    <div className="mt-0.5 text-[11px] italic" style={{ color: APP.tertiary }}>
                      {i.notes}
                    </div>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 flex-none rounded-full"
                  style={{ border: `2px solid ${APP.border}` }}
                />
              </div>
            ))}
          </Card>
        );
      })}

      {bySlot.length > 0 && (
        <Card className="mt-2.5">
          <Caps className="text-[8.5px]" style={{ color: APP.tertiary }}>
            Horario
          </Caps>
          <div className="mt-1.5 flex flex-col gap-1">
            {bySlot.map((g) => (
              <div key={g.slot} className="flex gap-2 text-[11.5px]">
                <span className="w-[104px] flex-none font-semibold" style={{ color: APP.secondary }}>
                  {TIMING_ES[g.slot]}
                </span>
                <span className="min-w-0 flex-1" style={{ color: APP.tertiary }}>
                  {g.items.map((i) => i.name).join(' + ')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {plan.notes && (
        <Card className="mt-2.5">
          <p className="whitespace-pre-line text-[11.5px]" style={{ color: APP.secondary }}>
            {plan.notes}
          </p>
        </Card>
      )}
    </>
  );
}

/* ---------------- bits ---------------- */

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-[14px] p-3', className)}
      style={{ background: APP.surface, border: `1px solid ${APP.border}` }}
    >
      {children}
    </div>
  );
}

/** The app's CapsLabel: small, extra-bold, spaced capitals. */
function Caps({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn('font-extrabold uppercase tracking-[0.16em]', className)} style={style}>
      {children}
    </span>
  );
}

/** Square-cornered chips: red, neutral, or solid red and slanted («Siguiente»). */
function Chip({ tone, children }: { tone: 'red' | 'neutral' | 'solid'; children: ReactNode }) {
  if (tone === 'solid') {
    return (
      <span className="inline-block flex-none px-1.5 py-[3px]" style={{ background: APP.red, ...skew(-10) }}>
        <span className="inline-block" style={skew(10)}>
          <Caps className="text-[8px]" style={{ color: '#fff', letterSpacing: '0.08em' }}>
            {children}
          </Caps>
        </span>
      </span>
    );
  }
  return (
    <span
      className="inline-block flex-none px-1.5 py-[3px]"
      style={
        tone === 'red'
          ? { background: APP.redSoft }
          : { background: APP.bg, border: `1px solid ${APP.border}` }
      }
    >
      <Caps
        className="text-[8px]"
        style={{ color: tone === 'red' ? APP.redText : APP.tertiary, letterSpacing: '0.08em' }}
      >
        {children}
      </Caps>
    </span>
  );
}

function Segment({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="relative flex-1 py-1.5">
      {active && (
        <span aria-hidden="true" className="absolute inset-0" style={{ background: APP.red, ...skew(-10) }} />
      )}
      <Caps className="relative text-[9.5px]" style={{ color: active ? '#fff' : APP.tertiary, letterSpacing: '0.1em' }}>
        {children}
      </Caps>
    </button>
  );
}
