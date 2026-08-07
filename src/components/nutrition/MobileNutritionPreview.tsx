import { useState, type ReactNode } from 'react';
import { foodsFor, mealAppliesOn } from '@/components/nutrition/previewModel';
import type {
  PreviewNutritionPlan,
  PreviewSupplementPlan,
} from '@/components/nutrition/previewModel';
import type { DayType, PlanMealType, SupplementTier, SupplementTiming } from '@/types';

/**
 * "How will this look in the client's app?" — a replica of the mobile Nutrición
 * tab, rendered from either a saved plan or the builder's unsaved draft.
 *
 * FIDELITY RULES (mirror the app's utils/nutrition-plan.ts — keep in sync):
 *   - day type filters TWICE: it hides whole slots via applies_to, and hides
 *     individual foods via each food's day_type;
 *   - a slot hidden by applies_to still surfaces its `notes`, because that is
 *     where the rest-day substitution instruction lives;
 *   - foods show a name and nothing else. No portions, no macros — those are
 *     measured from the client's photo, never prescribed.
 *
 * Colours are hard-coded to the app's dark palette on purpose: this simulates a
 * device, so it must not follow the panel's light/dark theme.
 */

const APP = {
  bg: '#0E1116',
  surface: '#171B22',
  elevated: '#1E242D',
  border: '#2A313B',
  primary: '#E5484D',
  primarySoft: 'rgba(229,72,77,0.14)',
  text: '#ECEEF1',
  secondary: '#C2C8D2',
  tertiary: '#9AA4B2',
  muted: '#6B727E',
  info: '#5B9DF9',
  infoSoft: 'rgba(91,157,249,0.14)',
  accent: '#F0B23A',
  accentSoft: 'rgba(240,178,58,0.14)',
};

const MEAL_TYPE_ES: Record<PlanMealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
  pre_workout: 'Pre-entreno',
  post_workout: 'Post-entreno',
};

const TIER_ES: Record<SupplementTier, string> = {
  base: 'Base',
  conditional: 'Condicionales',
  optional: 'Opcionales',
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

/* ---------------- the phone ---------------- */

export function MobileNutritionPreview({
  plan,
  supplements,
}: {
  plan: PreviewNutritionPlan;
  /** Independently assignable, so it may legitimately be absent. */
  supplements?: PreviewSupplementPlan | null;
}) {
  const [pane, setPane] = useState<'plan' | 'supp'>('plan');
  const [day, setDay] = useState<Day>('training');
  const activeDay: Day = plan.dayCycling ? day : 'training';

  const target =
    plan.targets.find((t) => t.dayType === (plan.dayCycling ? activeDay : 'both')) ?? null;

  return (
    <div className="mx-auto w-[336px] flex-none">
      <div
        className="overflow-hidden rounded-[34px] border-[9px] shadow-2xl"
        style={{ borderColor: '#23262C', background: APP.bg }}
      >
        <div className="flex items-center justify-center py-1.5" style={{ background: APP.bg }}>
          <span className="h-1 w-16 rounded-full" style={{ background: '#2E3440' }} />
        </div>

        <div className="h-[560px] overflow-y-auto px-3 pb-4" style={{ background: APP.bg }}>
          {/* tab segments — Plan · Suplementos · Diario */}
          <div className="mt-1 flex gap-1 rounded-xl p-1" style={{ background: APP.surface }}>
            <Segment active={pane === 'plan'} onClick={() => setPane('plan')}>
              Plan
            </Segment>
            <Segment active={pane === 'supp'} onClick={() => setPane('supp')}>
              Suplementos
            </Segment>
            <Segment active={false} disabled>
              Diario
            </Segment>
          </div>

          {pane === 'plan' ? (
            <>
              <Panel accent className="mt-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-[11px]"
                    style={{ background: APP.primarySoft, color: APP.primary }}
                  >
                    ◍
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: APP.text }}>
                    {plan.name}
                  </span>
                  <span className="flex-none text-[9px] font-bold tracking-widest" style={{ color: APP.primary }}>
                    COACH
                  </span>
                </div>
                {plan.focus && (
                  <p className="mt-1.5 text-[12px]" style={{ color: APP.secondary }}>
                    {plan.focus}
                  </p>
                )}
              </Panel>

              {/* day-type toggle — only when the plan actually cycles */}
              {plan.dayCycling && (
                <div className="mt-2.5 flex gap-1.5">
                  <DayPill active={activeDay === 'training'} onClick={() => setDay('training')}>
                    Entrenamiento
                  </DayPill>
                  <DayPill active={activeDay === 'rest'} onClick={() => setDay('rest')}>
                    Descanso
                  </DayPill>
                </div>
              )}

              {/* macro target for the active day */}
              {target && !target.empty && (
                <Panel className="mt-2.5">
                  <div className="text-[9px] font-bold tracking-widest" style={{ color: APP.tertiary }}>
                    OBJETIVO DE HOY
                  </div>
                  {target.kcal && (
                    <div className="mt-1 text-[19px] font-bold tabular-nums" style={{ color: APP.text }}>
                      {target.kcal}{' '}
                      <span className="text-[12px] font-medium" style={{ color: APP.tertiary }}>
                        kcal
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums" style={{ color: APP.secondary }}>
                    {target.protein && <span>P {target.protein} g</span>}
                    {target.carbs && <span>C {target.carbs} g</span>}
                    {target.fat && <span>G {target.fat} g</span>}
                  </div>
                </Panel>
              )}

              {plan.meals.length === 0 ? (
                <Panel className="mt-2.5">
                  <p className="text-[12px]" style={{ color: APP.tertiary }}>
                    Añade comidas para verlas aquí.
                  </p>
                </Panel>
              ) : (
                plan.meals.map((meal, mi) => {
                  const applies = !plan.dayCycling || mealAppliesOn(meal, activeDay);
                  // A slot gated off today still shows its note — that's where
                  // "sustituir por 1 scoop de proteína" lives.
                  if (!applies && !meal.notes) return null;
                  const title = meal.label || MEAL_TYPE_ES[meal.mealType];

                  return (
                    <Panel key={mi} className="mt-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13px] font-bold" style={{ color: APP.text }}>
                          {title}
                        </span>
                        {meal.isOptional && <Tag color={APP.info} soft={APP.infoSoft}>opcional</Tag>}
                        {meal.timeHint && (
                          <span className="text-[10.5px]" style={{ color: APP.tertiary }}>
                            {meal.timeHint}
                          </span>
                        )}
                      </div>

                      {!applies ? (
                        <p className="mt-1.5 text-[11.5px]" style={{ color: APP.accent }}>
                          {meal.notes}
                        </p>
                      ) : (
                        <>
                          {meal.options.map((opt, oi) => {
                            const foods = plan.dayCycling ? foodsFor(opt, activeDay) : opt.foods;
                            if (foods.length === 0) return null;
                            return (
                              <div
                                key={oi}
                                className="mt-2 rounded-lg p-2"
                                style={{ background: APP.elevated }}
                              >
                                {opt.label && (
                                  <div className="text-[10.5px] font-bold" style={{ color: APP.tertiary }}>
                                    {opt.label}
                                  </div>
                                )}
                                <ul className="mt-1 flex flex-col gap-0.5">
                                  {foods.map((f, fi) => (
                                    <li key={fi} className="text-[12px]" style={{ color: APP.secondary }}>
                                      · {f.name}
                                    </li>
                                  ))}
                                </ul>
                                <div
                                  className="mt-1.5 rounded-md px-2 py-1 text-center text-[10.5px] font-bold"
                                  style={{ background: APP.primarySoft, color: APP.primary }}
                                >
                                  Registrar en mi diario
                                </div>
                              </div>
                            );
                          })}
                          {meal.notes && (
                            <p className="mt-1.5 text-[11px]" style={{ color: APP.muted }}>
                              {meal.notes}
                            </p>
                          )}
                        </>
                      )}
                    </Panel>
                  );
                })
              )}

              {plan.notes && (
                <Panel className="mt-2.5">
                  <div className="text-[9px] font-bold tracking-widest" style={{ color: APP.tertiary }}>
                    NOTAS DEL COACH
                  </div>
                  <p className="mt-1 text-[11.5px]" style={{ color: APP.secondary }}>
                    {plan.notes}
                  </p>
                </Panel>
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
      <Panel className="mt-2.5">
        <p className="text-[12px]" style={{ color: APP.tertiary }}>
          Sin plan de suplementación asignado.
        </p>
        <p className="mt-1 text-[11px]" style={{ color: APP.muted }}>
          Se asigna por separado del plan nutricional.
        </p>
      </Panel>
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
      <Panel accent className="mt-2.5">
        <span className="text-[14px] font-bold" style={{ color: APP.text }}>
          {plan.name}
        </span>
      </Panel>

      {TIERS.map((tier) => {
        const items = visible.filter((i) => i.tier === tier);
        if (items.length === 0) return null;
        return (
          <Panel key={tier} className="mt-2.5">
            <div className="text-[9px] font-bold tracking-widest" style={{ color: APP.tertiary }}>
              {TIER_ES[tier].toUpperCase()}
            </div>
            {items.map((i, idx) => (
              <div
                key={idx}
                className="mt-2 rounded-lg p-2"
                style={{ background: APP.elevated }}
              >
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
                  <div className="mt-0.5 text-[11px]" style={{ color: APP.muted }}>
                    {i.purpose}
                  </div>
                )}
              </div>
            ))}
          </Panel>
        );
      })}

      {bySlot.length > 0 && (
        <Panel className="mt-2.5">
          <div className="text-[9px] font-bold tracking-widest" style={{ color: APP.tertiary }}>
            HORARIO
          </div>
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
        </Panel>
      )}
    </>
  );
}

/* ---------------- bits ---------------- */

function Panel({
  children,
  accent = false,
  className = '',
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${className}`}
      style={{
        background: APP.surface,
        border: `1px solid ${accent ? APP.primary : APP.border}`,
      }}
    >
      {children}
    </div>
  );
}

function Segment({
  children,
  active,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors"
      style={{
        background: active ? APP.primary : 'transparent',
        color: active ? '#fff' : disabled ? APP.muted : APP.tertiary,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function DayPill({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition-colors"
      style={{
        background: active ? APP.primarySoft : APP.surface,
        color: active ? APP.primary : APP.tertiary,
        border: `1px solid ${active ? APP.primary : APP.border}`,
      }}
    >
      {children}
    </button>
  );
}

function Tag({
  children,
  color,
  soft,
}: {
  children: ReactNode;
  color: string;
  soft: string;
}) {
  return (
    <span
      className="rounded-full px-1.5 py-[1px] text-[9.5px] font-bold"
      style={{ background: soft, color }}
    >
      {children}
    </span>
  );
}
