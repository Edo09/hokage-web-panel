/**
 * Coach supplement-plan data access (see
 * supabase/migrations/20260807120100_supplement_plans.sql). Same shape as
 * services/nutritionPlans.ts but flatter — a plan is just a tiered list, with
 * no options or foods below it.
 *
 * Assignable INDEPENDENTLY of the nutrition plan: a coach swaps diets far more
 * often than supplement stacks, so binding the two would force a rebuild every
 * phase. A client may have one, both, or neither.
 *
 * The "horario de suplementación" table a coach's PDF ends with is not stored —
 * it is a group-by over timing_slot, derived at render time.
 */
import { supabase } from '@/lib/supabaseClient';
import type {
  DayType,
  PlanAssignment,
  PlanStatus,
  SupplementPlanWithDetail,
  SupplementTier,
  SupplementTiming,
} from '@/types';

const SUPPLEMENT_GRAPH = '*, supplement_plan_items(*)';

function sortGraph(plans: SupplementPlanWithDetail[]): SupplementPlanWithDetail[] {
  for (const p of plans) {
    p.supplement_plan_items.sort((a, b) => a.sort_order - b.sort_order);
  }
  return plans;
}

/* ---------------- reads ---------------- */

export async function listSupplementPlansForClient(
  clientId: string,
): Promise<SupplementPlanWithDetail[]> {
  const { data, error } = await supabase
    .from('supplement_plans')
    .select(SUPPLEMENT_GRAPH)
    .eq('user_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return sortGraph((data ?? []) as unknown as SupplementPlanWithDetail[]);
}

/* ---------------- templates ---------------- */

export async function listSupplementTemplates(): Promise<SupplementPlanWithDetail[]> {
  const { data, error } = await supabase
    .from('supplement_plans')
    .select(SUPPLEMENT_GRAPH)
    .eq('is_template', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return sortGraph((data ?? []) as unknown as SupplementPlanWithDetail[]);
}

export async function listSupplementAssignments(): Promise<Record<string, PlanAssignment[]>> {
  const { data, error } = await supabase
    .from('supplement_plans')
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

export async function saveSupplementPlanAsTemplate(
  planId: string,
  name?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_supplement_plan_as_template', {
    p_plan_id: planId,
    p_name: name ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function assignSupplementTemplate(
  templateId: string,
  clientId: string,
  startDate: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('assign_supplement_plan_template', {
    p_template_id: templateId,
    p_client_id: clientId,
    p_start_date: startDate,
  });
  if (error) throw error;
  return data as string;
}

/* ---------------- writes ---------------- */

export interface SupplementItemInput {
  name: string;
  tier: SupplementTier;
  dose: string | null;
  timing_slot: SupplementTiming;
  timing_note: string | null;
  purpose: string | null;
  notes: string | null;
  applies_to: DayType;
  sort_order: number;
}

export interface SaveSupplementPlanInput {
  name: string;
  description: string | null;
  start_date: string; // ISO date (YYYY-MM-DD)
  status: PlanStatus;
  notes: string | null;
  items: SupplementItemInput[];
}

/** clientId null => save as a library TEMPLATE. */
async function saveSupplementPlan(
  planId: string | null,
  clientId: string | null,
  input: SaveSupplementPlanInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_supplement_plan', {
    p_plan_id: planId,
    p_client_id: clientId,
    p_header: {
      name: input.name,
      description: input.description,
      start_date: input.start_date,
      status: input.status,
      notes: input.notes,
    },
    p_items: input.items,
  });
  if (error) throw error;
  return data as string;
}

export async function createSupplementPlan(
  clientId: string,
  input: SaveSupplementPlanInput,
): Promise<string> {
  return saveSupplementPlan(null, clientId, input);
}

export async function createSupplementTemplate(
  input: SaveSupplementPlanInput,
): Promise<string> {
  return saveSupplementPlan(null, null, input);
}

export async function updateSupplementTemplate(
  templateId: string,
  input: SaveSupplementPlanInput,
): Promise<string> {
  return saveSupplementPlan(templateId, null, input);
}

export async function updateSupplementPlan(
  planId: string,
  clientId: string,
  input: SaveSupplementPlanInput,
): Promise<string> {
  return saveSupplementPlan(planId, clientId, input);
}

export async function deleteSupplementPlan(planId: string): Promise<void> {
  const { error } = await supabase.from('supplement_plans').delete().eq('id', planId);
  if (error) throw error;
}

/** One active supplement plan per client, enforced by
 *  trg_enforce_single_active_supplement_plan — setting one active archives the
 *  previous. */
export async function setSupplementPlanStatus(
  planId: string,
  status: PlanStatus,
): Promise<void> {
  const { error } = await supabase.from('supplement_plans').update({ status }).eq('id', planId);
  if (error) throw error;
}
