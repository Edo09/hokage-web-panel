/**
 * Coach nutrition-plan data access (see
 * supabase/migrations/20260807120000_nutrition_plans.sql). The exact shape of
 * services/programs.ts: writes go through the transactional save_nutrition_plan
 * RPC so a plan's whole graph — header + macro targets + slots + options +
 * foods — is created or rewritten atomically, and reads pull the nested graph
 * in one query.
 *
 * The template switch is the same trick programs uses: p_client_id null means
 * "save a library template" (no owner, invisible to every client).
 *
 * Foods carry a name and a day type — no quantity, no macros. Numbers are
 * measured from the client's photo, never prescribed.
 *
 * Requires 20260807120000 and 20260807120200 applied.
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  DayType,
  NutritionPlanWithDetail,
  PlanAssignment,
  PlanMealType,
  PlanStatus,
} from '@/types';

const NUTRITION_GRAPH =
  '*, nutrition_plan_targets(*), nutrition_plan_meals(*, nutrition_plan_options(*, nutrition_plan_option_items(*)))';

/** PostgREST can't order three levels deep — sort options and their foods here.
 *  Slots are ordered by the query; everything below it is ordered in JS. */
function sortGraph(plans: NutritionPlanWithDetail[]): NutritionPlanWithDetail[] {
  for (const p of plans) {
    p.nutrition_plan_meals.sort((a, b) => a.sort_order - b.sort_order || a.slot_index - b.slot_index);
    for (const m of p.nutrition_plan_meals) {
      m.nutrition_plan_options.sort((a, b) => a.sort_order - b.sort_order);
      for (const o of m.nutrition_plan_options) {
        o.nutrition_plan_option_items.sort((a, b) => a.sort_order - b.sort_order);
      }
    }
  }
  return plans;
}

/* ---------------- reads ---------------- */

export async function listNutritionPlansForClient(
  clientId: string,
): Promise<NutritionPlanWithDetail[]> {
  const { data, error } = await supabase
    .from('nutrition_plans')
    .select(NUTRITION_GRAPH)
    .eq('user_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return sortGraph((data ?? []) as unknown as NutritionPlanWithDetail[]);
}

/* ---------------- templates ---------------- */

/** The reusable library: plans with no client (is_template). */
export async function listNutritionTemplates(): Promise<NutritionPlanWithDetail[]> {
  const { data, error } = await supabase
    .from('nutrition_plans')
    .select(NUTRITION_GRAPH)
    .eq('is_template', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return sortGraph((data ?? []) as unknown as NutritionPlanWithDetail[]);
}

/** Every client carrying a copy of any nutrition template, keyed by
 *  template_id. Answers "who is on this plan?" for the library page. */
export async function listNutritionAssignments(): Promise<Record<string, PlanAssignment[]>> {
  const { data, error } = await supabase
    .from('nutrition_plans')
    .select('id, template_id, user_id, status, start_date, client:profiles!user_id(display_name, email)')
    .not('template_id', 'is', null)
    .order('start_date', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    template_id: string;
    user_id: string;
    status: PlanStatus;
    start_date: string;
    client: { display_name: string | null; email: string } | null;
  }[];

  const byTemplate: Record<string, PlanAssignment[]> = {};
  for (const r of rows) {
    (byTemplate[r.template_id] ??= []).push({
      plan_id: r.id,
      template_id: r.template_id,
      client_id: r.user_id,
      client_name: r.client?.display_name ?? r.client?.email ?? 'Cliente',
      status: r.status,
      start_date: r.start_date,
    });
  }
  return byTemplate;
}

/** Promote a client's one-off plan into a reusable library template. The source
 *  plan is untouched apart from claiming its provenance. */
export async function saveNutritionPlanAsTemplate(
  planId: string,
  name?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_nutrition_plan_as_template', {
    p_plan_id: planId,
    p_name: name ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Deep-copies a template into a new ACTIVE plan for the client (the
 *  single-active trigger archives whatever they were on). The copy is a
 *  snapshot — later template edits don't touch it. */
export async function assignNutritionTemplate(
  templateId: string,
  clientId: string,
  startDate: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('assign_nutrition_plan_template', {
    p_template_id: templateId,
    p_client_id: clientId,
    p_start_date: startDate,
  });
  if (error) throw error;
  return data as string;
}

/* ---------------- writes ---------------- */

export interface NutritionItemInput {
  name: string;
  day_type: DayType;
  sort_order: number;
}

export interface NutritionOptionInput {
  label: string | null;
  notes: string | null;
  sort_order: number;
  items: NutritionItemInput[];
}

export interface NutritionMealInput {
  slot_index: number;
  label: string | null;
  meal_type: PlanMealType;
  time_hint: string | null;
  applies_to: DayType;
  is_optional: boolean;
  notes: string | null;
  sort_order: number;
  options: NutritionOptionInput[];
}

export interface NutritionTargetInput {
  day_type: DayType;
  kcal_min: number | null;
  kcal_max: number | null;
  protein_min_g: number | null;
  protein_max_g: number | null;
  carbs_min_g: number | null;
  carbs_max_g: number | null;
  fat_min_g: number | null;
  fat_max_g: number | null;
  notes: string | null;
}

export interface SaveNutritionPlanInput {
  name: string;
  description: string | null;
  focus: string | null;
  /** null = open-ended phase. */
  duration_weeks: number | null;
  start_date: string; // ISO date (YYYY-MM-DD)
  status: PlanStatus;
  day_cycling: boolean;
  notes: string | null;
  targets: NutritionTargetInput[];
  meals: NutritionMealInput[];
}

/** Create (planId null) or rewrite (id set) a nutrition plan atomically. */
/** clientId null => save as a library TEMPLATE (no owner, invisible to clients). */
async function saveNutritionPlan(
  planId: string | null,
  clientId: string | null,
  input: SaveNutritionPlanInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_nutrition_plan', {
    p_plan_id: planId,
    p_client_id: clientId,
    p_header: {
      name: input.name,
      description: input.description,
      focus: input.focus,
      duration_weeks: input.duration_weeks,
      start_date: input.start_date,
      status: input.status,
      day_cycling: input.day_cycling,
      notes: input.notes,
    },
    p_targets: input.targets,
    p_meals: input.meals,
  });
  if (error) throw error;
  return data as string;
}

export async function createNutritionPlan(
  clientId: string,
  input: SaveNutritionPlanInput,
): Promise<string> {
  return saveNutritionPlan(null, clientId, input);
}

/** Save a library template — same RPC, null client means "no owner". */
export async function createNutritionTemplate(input: SaveNutritionPlanInput): Promise<string> {
  return saveNutritionPlan(null, null, input);
}

export async function updateNutritionTemplate(
  templateId: string,
  input: SaveNutritionPlanInput,
): Promise<string> {
  return saveNutritionPlan(templateId, null, input);
}

export async function updateNutritionPlan(
  planId: string,
  clientId: string,
  input: SaveNutritionPlanInput,
): Promise<string> {
  return saveNutritionPlan(planId, clientId, input);
}

/** Removes a plan; targets/slots/options/foods cascade (FK on delete cascade). */
export async function deleteNutritionPlan(planId: string): Promise<void> {
  const { error } = await supabase.from('nutrition_plans').delete().eq('id', planId);
  if (error) throw error;
}

/**
 * Set a plan's status. Only one nutrition plan per client may be 'active' —
 * setting one active auto-archives the previous one (trigger
 * trg_enforce_single_active_nutrition_plan), so the coach switches phases in
 * one call. The status-only UPDATE never touches start_date, so the past-start
 * guard doesn't fire on a running plan.
 */
export async function setNutritionPlanStatus(
  planId: string,
  status: PlanStatus,
): Promise<void> {
  const { error } = await supabase.from('nutrition_plans').update({ status }).eq('id', planId);
  if (error) throw error;
}
