/**
 * AI nutrition-plan drafts, via the generate-nutrition-plan Edge Function
 * (mobile app repo, supabase/functions/generate-nutrition-plan). The function
 * holds the model keys and checks the caller is the coach; it writes nothing —
 * the result is loaded into the builder and saved (or not) by the coach like
 * any hand-made draft.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { AiNutritionPlan } from '@/components/nutrition/aiModel';

export interface GenerateNutritionPlanInput {
  /** What the coach wants, in their words. */
  prompt: string;
  /** Edit mode: the draft to change. null = a new plan from scratch. */
  current: AiNutritionPlan | null;
  /** Fit the plan to this client's profile. null = generic (templates). */
  clientId: string | null;
  /** Also send the coach's private note on the client (allergies, etc.). */
  includeNotes: boolean;
}

/** A failure the coach should see, with the provider's own error text (if
 *  any) for the "why" — shown under the message. */
export class AiNutritionError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

const STATUS_MESSAGES: Record<string, string> = {
  unauthenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  forbidden: 'Solo el coach puede generar planes.',
};

/** Returns the model's plan — untrusted: run it through aiToDraft. */
export async function generateNutritionPlan(input: GenerateNutritionPlanInput): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke<{ plan?: unknown; error?: string }>('generate-nutrition-plan', {
    body: {
      prompt: input.prompt,
      current: input.current,
      client_id: input.clientId,
      include_notes: input.includeNotes,
    },
  });

  if (error) {
    // A non-2xx carries the function's own (Spanish) message in its body.
    if (error instanceof FunctionsHttpError) {
      const body = (await (error.context as Response).json().catch(() => null)) as { error?: string; detail?: string } | null;
      if (body?.error) throw new AiNutritionError(STATUS_MESSAGES[body.error] ?? body.error, body.detail);
      // No JSON body: the gateway cut the request off (usually a timeout).
      throw new Error('La IA tardó demasiado en responder. Intenta de nuevo, o pide un plan más corto.');
    }
    // No response at all: not deployed, or this origin isn't in ALLOWED_ORIGINS.
    throw new Error('No se pudo conectar con el asistente de IA. Revisa que la función generate-nutrition-plan esté desplegada.');
  }
  if (!data?.plan) throw new Error(data?.error ?? 'La IA no devolvió un plan.');
  return data.plan;
}
