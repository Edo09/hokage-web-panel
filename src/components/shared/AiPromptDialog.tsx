import type { ReactNode } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InfoTip } from '@/components/ui/info-tip';
import { Segmented } from '@/components/ui/segmented';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const AI_MAX_PROMPT = 2000;

export interface AiExample {
  /** What the chip says. */
  label: string;
  /** What it writes in the box. */
  prompt: string;
}

export type AiMode = 'edit' | 'new';

/**
 * The AI assistant's dialog, shared by the program and nutrition builders
 * (each keeps its own request and result handling). One box to write in,
 * a few ideas to start from, and — for a client — what of their profile the
 * AI may read. The details live behind ⓘ.
 */
export function AiPromptDialog({
  open,
  onOpenChange,
  busy,
  hasContent,
  mode,
  onModeChange,
  replaceNote,
  prompt,
  onPromptChange,
  examples,
  lastSummary,
  client,
  onGenerate,
  canGenerate = true,
  subject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  /** The draft already has content: offer "modify" vs "start over". */
  hasContent: boolean;
  mode: AiMode;
  onModeChange: (m: AiMode) => void;
  /** Extra detail on what "start over" replaces, behind an ⓘ. */
  replaceNote?: ReactNode;
  prompt: string;
  onPromptChange: (v: string) => void;
  examples: { new: AiExample[]; edit: AiExample[] };
  lastSummary?: string;
  /** Set for a client's plan: which of their data the AI may read. */
  client?: {
    firstName: string;
    useProfile: boolean;
    onUseProfile: (v: boolean) => void;
    includeNotes: boolean;
    onIncludeNotes: (v: boolean) => void;
    profileTip: ReactNode;
    notesTip: ReactNode;
  };
  onGenerate: () => void;
  /** Extra gate (e.g. the exercise catalog still loading). */
  canGenerate?: boolean;
  /** "el plan" / "el programa". */
  subject: string;
}) {
  const editing = hasContent && mode === 'edit';
  const ideas = editing ? examples.edit : examples.new;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-[18px] w-[18px] text-primary" strokeWidth={2.25} />
            {editing ? 'Editar con IA' : 'Crear con IA'}
          </DialogTitle>
          <DialogDescription>Revisas el resultado antes de guardar; nada se guarda solo.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {hasContent && (
            <div className="flex flex-col gap-1.5">
              <Segmented<AiMode>
                aria-label="Qué hacer con el borrador"
                stretch
                value={mode}
                onChange={onModeChange}
                options={[
                  { value: 'edit', label: `Cambiar ${subject}` },
                  { value: 'new', label: 'Empezar de cero' },
                ]}
              />
              {mode === 'new' && (
                <p className="flex items-center gap-1.5 text-[13px] text-warning">
                  Reemplaza todo el borrador actual.
                  {replaceNote && <InfoTip label="Qué pasa con lo registrado">{replaceNote}</InfoTip>}
                </p>
              )}
            </div>
          )}

          {editing && lastSummary && (
            <p className="line-clamp-3 border-l-2 border-border-strong pl-3 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">Último cambio: </span>
              {lastSummary}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-prompt">{editing ? '¿Qué quieres cambiar?' : `¿Cómo quieres ${subject}?`}</Label>
            <Textarea
              id="ai-prompt"
              rows={4}
              maxLength={AI_MAX_PROMPT}
              value={prompt}
              disabled={busy}
              autoFocus
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim() && canGenerate) onGenerate();
              }}
              placeholder={`Ej. ${ideas[0]?.prompt ?? ''}`}
              className="text-[15px]"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-xs text-faint">Ideas:</span>
              {ideas.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  disabled={busy}
                  title={ex.prompt}
                  onClick={() => onPromptChange(ex.prompt)}
                  className="h-7 rounded-full border border-border px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
              {prompt.length > AI_MAX_PROMPT * 0.8 && (
                <span className="ml-auto text-xs tabular-nums text-faint">
                  {prompt.length}/{AI_MAX_PROMPT}
                </span>
              )}
            </div>
          </div>

          {client && (
            <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3">
              <div className="flex items-center gap-2.5">
                <Switch
                  id="ai-profile"
                  checked={client.useProfile}
                  onCheckedChange={client.onUseProfile}
                  disabled={busy}
                />
                <Label htmlFor="ai-profile" className="cursor-pointer text-sm text-foreground">
                  Usar el perfil de {client.firstName}
                </Label>
                <InfoTip label="Qué datos del perfil se usan">{client.profileTip}</InfoTip>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch
                  id="ai-notes"
                  checked={client.useProfile && client.includeNotes}
                  onCheckedChange={client.onIncludeNotes}
                  disabled={busy || !client.useProfile}
                />
                <Label
                  htmlFor="ai-notes"
                  className={client.useProfile ? 'cursor-pointer text-sm text-foreground' : 'text-sm opacity-50'}
                >
                  Incluir mis notas privadas
                </Label>
                <InfoTip label="Qué notas se incluyen">{client.notesTip}</InfoTip>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {busy && (
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground sm:mr-auto">
              <Loader2 className="h-4 w-4 animate-spin" /> Generando… puede tardar un minuto
            </span>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onGenerate} disabled={busy || !prompt.trim() || !canGenerate}>
            <Sparkles strokeWidth={2.25} />
            {busy ? 'Generando…' : editing ? 'Aplicar cambios' : 'Generar borrador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
