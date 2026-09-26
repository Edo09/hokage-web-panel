import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateProgram } from '@/services/aiProgram';
import { aiToDraft, draftToAi } from '@/components/program/aiModel';
import type { ProgramBuilderState } from '@/components/program/useProgramBuilder';

const MAX_PROMPT = 2000;
const CAPS = 'text-[10px] font-extrabold uppercase tracking-[0.12em] text-faint';

const NEW_EXAMPLES = [
  'Hipertrofia de glúteos y piernas, 4 días, 5 semanas con descarga en la última',
  'Fuerza full body 3 días, 6 semanas, press banca, sentadilla y peso muerto al 75–90%',
  'Torso/pierna 4 días para perder grasa, superseries en los accesorios',
];
const EDIT_EXAMPLES = [
  'Pásalo a 3 días por semana',
  'Añade superseries en los ejercicios de brazo',
  'Haz la semana 4 más intensa y baja las series de la descarga a 2',
];

type Mode = 'edit' | 'new';

/**
 * The builder's AI assistant. The coach describes a program (or a change to
 * the current draft); the generate-program function returns it; the result
 * replaces the draft in the builder, where it's reviewed and saved like a
 * hand-made one. Nothing here touches the database, and the toast offers
 * "Deshacer" back to the exact draft from before.
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
  /** Called after the draft was replaced (the workspace resets its tabs). */
  onApplied: () => void;
}) {
  const hasContent = b.exCount > 0;
  const [prompt, setPrompt] = useState('');
  // Only offered once the draft has exercises; until then it's always "new".
  const [mode, setMode] = useState<Mode>('edit');
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

      b.replaceDraft({
        ...before, // start date and status stay the coach's
        ...next.header,
        name: next.header.name || before.name,
        days: next.days,
        weeks: next.weeks,
      });
      onApplied();
      setLastSummary(next.summary);
      setPrompt('');
      setMode('edit');
      onOpenChange(false);

      toast.success(editing ? 'Cambios aplicados al borrador' : 'Borrador generado', {
        description: next.summary || 'Revísalo antes de guardar.',
        duration: 15_000,
        action: { label: 'Deshacer', onClick: () => b.replaceDraft(before) },
      });
      if (next.dropped.length > 0) {
        toast.warning('Algunos ejercicios no están en el catálogo y se quitaron', {
          description: next.dropped.join(', '),
          duration: 15_000,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el programa');
    } finally {
      setBusy(false);
    }
  };

  const examples = editing ? EDIT_EXAMPLES : NEW_EXAMPLES;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={2.25} />
            {editing ? 'Editar con IA' : 'Generar con IA'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Di qué quieres cambiar y la IA lo aplica al borrador. Revísalo antes de guardar: nada se guarda ni se asigna hasta que tú lo guardes.'
              : 'Describe el programa y la IA arma un borrador con los ejercicios del catálogo. Revísalo antes de guardar: nada se guarda ni se asigna hasta que tú lo guardes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {hasContent && (
            <div role="radiogroup" aria-label="Qué hacer con el borrador actual" className="grid grid-cols-2 border border-border">
              {(
                [
                  ['edit', 'Modificar el actual'],
                  ['new', 'Crear uno nuevo'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'h-9 text-[12.5px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {hasContent && mode === 'new' && (
            <p className="-mt-2 text-[12px] text-warning">
              Reemplaza todo lo que hay en el constructor.
              {b.initial && !b.isTemplate && ' Al guardar, las series que ya registró el cliente se conservan en su historial, pero sin vínculo al nuevo programa.'}
            </p>
          )}

          {editing && lastSummary && (
            <div className="border-l-2 border-primary bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
              <span className={cn(CAPS, 'mb-0.5 block')}>Último cambio de la IA</span>
              {lastSummary}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-prompt" className={CAPS}>
              {editing ? '¿Qué cambio quieres?' : '¿Cómo quieres el programa?'}
            </Label>
            <Textarea
              id="ai-prompt"
              rows={5}
              maxLength={MAX_PROMPT}
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void generate();
              }}
              placeholder={editing ? `Ej. ${EDIT_EXAMPLES[0]}` : `Ej. ${NEW_EXAMPLES[0]}`}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={busy}
                  onClick={() => setPrompt(ex)}
                  className="border border-border px-2 py-1 text-left text-[11.5px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
              <span className="ml-auto text-[11px] tabular-nums text-faint">
                {prompt.length}/{MAX_PROMPT}
              </span>
            </div>
          </div>

          {!b.isTemplate && (
            <div className="flex flex-col gap-2.5 border-t border-border pt-3">
              <label htmlFor="ai-profile" className="flex cursor-pointer items-start gap-2.5 text-[12.5px]">
                <Switch id="ai-profile" checked={useProfile} onCheckedChange={setUseProfile} disabled={busy} className="mt-0.5" />
                <span>
                  <span className="font-semibold text-foreground">Usar el perfil de {b.firstName}</span>
                  <span className="block text-faint">Objetivo, edad, peso, días disponibles y duración de sesión. Nunca su nombre ni su correo.</span>
                </span>
              </label>
              <label
                htmlFor="ai-notes"
                className={cn('flex items-start gap-2.5 text-[12.5px]', useProfile ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}
              >
                <Switch
                  id="ai-notes"
                  checked={useProfile && includeNotes}
                  onCheckedChange={setIncludeNotes}
                  disabled={busy || !useProfile}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold text-foreground">Incluir mis notas privadas</span>
                  <span className="block text-faint">Lesiones, limitaciones o preferencias que anotaste sobre {b.firstName}.</span>
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2">
          {busy && <span className="mr-auto text-[12px] text-faint">Puede tardar hasta un minuto…</span>}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void generate()} disabled={busy || !prompt.trim() || !catalogReady}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
            {busy ? 'Generando…' : editing ? 'Aplicar cambios' : 'Generar borrador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
