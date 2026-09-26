/**
 * AI program drafts, via the generate-program Edge Function (mobile app repo,
 * supabase/functions/generate-program). The function holds the model keys and
 * checks the caller is the coach; it writes nothing — the result is loaded
 * into the builder and saved (or not) by the coach like any hand-made draft.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { AiProgram } from '@/components/program/aiModel';

export interface GenerateProgramInput {
  /** What the coach wants, in their words. */
  prompt: string;
  /** Edit mode: the draft to change. null = a new program from scratch. */
  current: AiProgram | null;
  /** Fit the program to this client's profile. null = generic (templates). */
  clientId: string | null;
  /** Also send the coach's private note on the client (injuries, etc.). */
  includeNotes: boolean;
}

/** A failure the coach should see, with the provider's own error text (if
 *  any) for the "why" — shown under the message. */
export class AiProgramError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

const STATUS_MESSAGES: Record<string, string> = {
  unauthenticated: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  forbidden: 'Solo el coach puede generar programas.',
};

/** Returns the model's program — untrusted: run it through aiToDraft. */
export async function generateProgram(input: GenerateProgramInput): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke<{ program?: unknown; error?: string }>('generate-program', {
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
      if (body?.error) throw new AiProgramError(STATUS_MESSAGES[body.error] ?? body.error, body.detail);
      // No JSON body: the gateway cut the request off (usually a timeout).
      throw new Error('La IA tardó demasiado en responder. Intenta de nuevo, o pide un programa más corto.');
    }
    // No response at all: not deployed, or this origin isn't in ALLOWED_ORIGINS.
    throw new Error('No se pudo conectar con el asistente de IA. Revisa que la función generate-program esté desplegada.');
  }
  if (!data?.program) throw new Error(data?.error ?? 'La IA no devolvió un programa.');
  return data.program;
}
