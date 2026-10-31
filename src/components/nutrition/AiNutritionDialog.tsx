import { useState } from 'react';
import { toast } from 'sonner';
import { AiNutritionError, generateNutritionPlan } from '@/services/aiNutrition';
import { aiToDraft, draftToAi, type AiNutritionResult, type NutritionAiHost } from '@/components/nutrition/aiModel';
import type { NutritionDraft } from '@/components/nutrition/builderModel';
import { AiPromptDialog, type AiExample, type AiMode } from '@/components/shared/AiPromptDialog';

const EXAMPLES: { new: AiExample[]; edit: AiExample[] } = {
  new: [
    {
      label: 'Definición con ciclado',
      prompt:
        'Ciclado de carbohidratos para definición, 5 comidas, 3 opciones por comida, post-entreno solo en días de entrenamiento',
    },
    { label: 'Volumen limpio', prompt: 'Plan de volumen limpio, 2800 kcal, 4 comidas sencillas sin ciclado' },
    {
      label: 'Comida dominicana',
      prompt: 'Dieta para perder grasa con comida dominicana, 3 comidas y una merienda opcional',
    },
  ],
  edit: [
    { label: 'Una opción más', prompt: 'Añade una tercera opción a cada comida' },
    { label: 'Sin lácteos', prompt: 'Quita los lácteos y sustitúyelos' },
    { label: 'Más carbos al entrenar', prompt: 'Sube los carbohidratos de los días de entrenamiento a 250–260 g' },
  ],
};

/**
 * The nutrition builder's AI assistant. The coach describes a plan (or a
 * change to the current draft); the generate-nutrition-plan function returns
 * it; the result replaces the draft in the builder, where it's reviewed and
 * saved like a hand-made one. Nothing here touches the database; the
 * builder's review panel (AiNutritionResultPanel) shows what changed and
 * offers "Deshacer" back to the exact draft from before.
 */
export function AiNutritionDialog({
  host,
  open,
  onOpenChange,
  onApplied,
}: {
  host: NutritionAiHost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the draft was replaced, with what the AI did. */
  onApplied: (result: AiNutritionResult) => void;
}) {
  const hasContent = host.hasContent;
  const [prompt, setPrompt] = useState('');
  // Only offered once the draft has foods; until then it's always "new".
  const [mode, setMode] = useState<AiMode>('edit');
  const [useProfile, setUseProfile] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSummary, setLastSummary] = useState('');

  const editing = hasContent && mode === 'edit';
  const forClient = !host.isTemplate && useProfile;

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    const before = host.snapshot();

    setBusy(true);
    try {
      const raw = await generateNutritionPlan({
        prompt: text,
        current: editing ? draftToAi(before) : null,
        clientId: forClient ? host.clientId : null,
        includeNotes: forClient && includeNotes,
      });
      const next = aiToDraft(raw, editing ? before.meals : null);
      if (!next) throw new Error('La IA no devolvió comidas. Prueba a describirlo de otra forma.');

      const after: NutritionDraft = {
        ...before, // start date and status stay the coach's
        ...next.header,
        name: next.header.name || before.name,
        meals: next.meals,
        targets: next.targets,
      };
      host.replaceDraft(after);
      setLastSummary(next.summary);
      setPrompt('');
      setMode('edit');
      onOpenChange(false);
      // The builder shows it in the review panel (with "Deshacer").
      onApplied({ kind: editing ? 'edit' : 'new', summary: next.summary, before, after });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el plan', {
        description: e instanceof AiNutritionError && e.detail ? `Detalle: ${e.detail.slice(0, 300)}` : undefined,
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
        host.hasInitial && !host.isTemplate
          ? 'Al guardar, las comidas que el cliente ya registró desde este plan se conservan en su diario, pero sin vínculo al nuevo plan.'
          : undefined
      }
      prompt={prompt}
      onPromptChange={setPrompt}
      examples={EXAMPLES}
      lastSummary={lastSummary}
      subject="el plan"
      client={
        host.isTemplate
          ? undefined
          : {
              firstName: host.firstName,
              useProfile,
              onUseProfile: setUseProfile,
              includeNotes,
              onIncludeNotes: setIncludeNotes,
              profileTip:
                'Objetivo, edad, sexo, peso, altura, actividad, tipo de trabajo, días de entreno y meta calórica. Nunca su nombre ni su correo.',
              notesTip: `Alergias, intolerancias, gustos o límites que anotaste sobre ${host.firstName}.`,
            }
      }
      onGenerate={() => void generate()}
    />
  );
}
