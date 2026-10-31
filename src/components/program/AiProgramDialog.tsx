import { useState } from 'react';
import { toast } from 'sonner';
import { AiProgramError, generateProgram } from '@/services/aiProgram';
import { aiToDraft, draftToAi, type AiResult } from '@/components/program/aiModel';
import type { DraftData } from '@/components/program/builderModel';
import type { ProgramBuilderState } from '@/components/program/useProgramBuilder';
import { AiPromptDialog, type AiExample, type AiMode } from '@/components/shared/AiPromptDialog';

const EXAMPLES: { new: AiExample[]; edit: AiExample[] } = {
  new: [
    {
      label: 'Glúteos y piernas',
      prompt: 'Hipertrofia de glúteos y piernas, 4 días, 5 semanas con descarga en la última',
    },
    {
      label: 'Fuerza full body',
      prompt: 'Fuerza full body 3 días, 6 semanas, press banca, sentadilla y peso muerto al 75–90%',
    },
    { label: 'Torso / pierna', prompt: 'Torso/pierna 4 días para perder grasa, superseries en los accesorios' },
  ],
  edit: [
    { label: 'A 3 días', prompt: 'Pásalo a 3 días por semana' },
    { label: 'Superseries de brazo', prompt: 'Añade superseries en los ejercicios de brazo' },
    {
      label: 'Semana 4 más dura',
      prompt: 'Haz la semana 4 más intensa y baja las series de la descarga a 2',
    },
  ],
};

/**
 * The builder's AI assistant. The coach describes a program (or a change to
 * the current draft); the generate-program function returns it; the result
 * replaces the draft in the builder, where it's reviewed and saved like a
 * hand-made one. Nothing here touches the database; the workspace's review
 * panel (AiResultPanel) shows what changed and offers "Deshacer" back to the
 * exact draft from before.
 */
export function AiProgramDialog({
  b,
  open,
  onOpenChange,
  onApplied,
}: {
  b: ProgramBuilderState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the draft was replaced, with what the AI did. */
  onApplied: (result: AiResult) => void;
}) {
  const hasContent = b.exCount > 0;
  const [prompt, setPrompt] = useState('');
  // Only offered once the draft has exercises; until then it's always "new".
  const [mode, setMode] = useState<AiMode>('edit');
  const [useProfile, setUseProfile] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSummary, setLastSummary] = useState('');

  const editing = hasContent && mode === 'edit';
  const forClient = !b.isTemplate && useProfile;
  const catalogReady = (b.catalog?.length ?? 0) > 0;

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    const before = b.snapshot();
    // Names the model may use: the catalog, plus custom movements the coach
    // already has in the draft being edited.
    const kept = new Set(
      editing ? before.days.flatMap((d) => d.exercises.map((x) => x.name.trim().toLowerCase())).filter(Boolean) : [],
    );
    const isKnown = (name: string) => b.byName.has(name.trim().toLowerCase()) || kept.has(name.trim().toLowerCase());

    setBusy(true);
    try {
      const raw = await generateProgram({
        prompt: text,
        current: editing ? draftToAi(before) : null,
        clientId: forClient ? b.clientId : null,
        includeNotes: forClient && includeNotes,
      });
      const next = aiToDraft(raw, editing ? before.days : null, isKnown);
      if (!next) throw new Error('La IA no devolvió ejercicios del catálogo. Prueba a describirlo de otra forma.');

      const after: DraftData = {
        ...before, // start date and status stay the coach's
        ...next.header,
        name: next.header.name || before.name,
        days: next.days,
        weeks: next.weeks,
      };
      b.replaceDraft(after);
      setLastSummary(next.summary);
      setPrompt('');
      setMode('edit');
      onOpenChange(false);
      // The workspace shows it in the review panel (with "Deshacer").
      onApplied({ kind: editing ? 'edit' : 'new', summary: next.summary, dropped: next.dropped, before, after });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el programa', {
        description: e instanceof AiProgramError && e.detail ? `Detalle: ${e.detail.slice(0, 300)}` : undefined,
        duration: 15_000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AiPromptDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      hasContent={hasContent}
      mode={mode}
      onModeChange={setMode}
      replaceNote={
        b.initial && !b.isTemplate
          ? 'Al guardar, las series que ya registró el cliente se conservan en su historial, pero sin vínculo al nuevo programa.'
          : undefined
      }
      prompt={prompt}
      onPromptChange={setPrompt}
      examples={EXAMPLES}
      lastSummary={lastSummary}
      subject="el programa"
      client={
        b.isTemplate
          ? undefined
          : {
              firstName: b.firstName,
              useProfile,
              onUseProfile: setUseProfile,
              includeNotes,
              onIncludeNotes: setIncludeNotes,
              profileTip: 'Objetivo, edad, peso, días disponibles y duración de sesión. Nunca su nombre ni su correo.',
              notesTip: `Lesiones, limitaciones o preferencias que anotaste sobre ${b.firstName}.`,
            }
      }
      onGenerate={() => void generate()}
      canGenerate={catalogReady}
    />
  );
}
