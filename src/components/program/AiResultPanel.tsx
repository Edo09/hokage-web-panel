import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Minus, Plus, RefreshCw, Sparkles, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { weekdayLabel } from '@/components/program/builderModel';
import { blockFacts, diffDrafts, rxIntensity, rxText, type AiResult } from '@/components/program/aiModel';

/** Longest change list shown before "y N más". */
const MAX_CHANGES = 12;

/**
 * What the AI just did, laid out for review: its explanation, the block in
 * numbers, what changed (edits), and every day's exercises at a glance — the
 * builder below only shows one day at a time. Shown until closed; collapses
 * to one line. It describes the AI's result as applied, not later hand edits.
 */
export function AiResultPanel({
  result,
  editedSince,
  onUndo,
  onRefine,
  onDismiss,
}: {
  result: AiResult;
  /** Whether the coach changed the draft after this result was applied. */
  editedSince: () => boolean;
  onUndo: () => void;
  onRefine: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const facts = useMemo(() => blockFacts(result.after), [result]);
  const changes = useMemo(() => (result.kind === 'edit' ? diffDrafts(result.before, result.after) : null), [result]);
  const days = result.after.days.filter((d) => d.exercises.some((x) => x.name.trim()));
  const rule = result.after.progressionRule.trim();
  const notes = result.after.notes.trim();

  // Mounted fresh for each result (the workspace keys it): take focus, so the
  // coach (and a screen reader) lands on what just changed.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    titleRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const undo = () => (editedSince() ? setConfirmUndo(true) : onUndo());

  const changeCount = changes
    ? changes.notes.length + changes.added.length + changes.removed.length + changes.changed.length
    : 0;

  return (
    <section
      aria-labelledby="ai-result-title"
      className="border border-l-[3px] border-border border-l-primary bg-card motion-safe:animate-fade-up"
    >
      <div className="px-5 py-4">
        {/* Title row: collapse/close stay top-right at every width. Collapsed,
            the facts and actions fold into this same row. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2
            id="ai-result-title"
            ref={titleRef}
            tabIndex={-1}
            className="flex items-center gap-2 font-heading text-[20px] focus:outline-none"
          >
            <Sparkles className="h-4 w-4 flex-none text-primary" strokeWidth={2.25} aria-hidden="true" />
            {result.kind === 'new' ? 'Borrador generado' : 'Cambios aplicados'}
          </h2>
          {!open && (
            <p className="text-[13px] text-muted-foreground">
              {facts.weeks} {facts.weeks === 1 ? 'semana' : 'semanas'}, {facts.days} {facts.days === 1 ? 'día' : 'días'},{' '}
              {facts.exercises} ejercicios
              {changes && `, ${changeCount} ${changeCount === 1 ? 'cambio' : 'cambios'}`}
            </p>
          )}
          <div className="-mr-2 ml-auto flex items-center gap-1">
            {!open && <Actions onUndo={undo} onRefine={onRefine} />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="ai-result-body"
              aria-label={open ? 'Ocultar el resumen' : 'Ver el resumen'}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Cerrar el resumen">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {open && (
          <>
            {result.summary && (
              <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-foreground">{result.summary}</p>
            )}
            <div className="mt-3">
              <Actions onUndo={undo} onRefine={onRefine} />
            </div>
          </>
        )}
      </div>

      {open && (
        <div id="ai-result-body" className="flex flex-col gap-6 border-t border-border px-5 pb-5 pt-4">
          {/* The block in numbers */}
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <Fact value={String(facts.weeks)} label={facts.weeks === 1 ? 'semana' : 'semanas'} />
              <Fact value={String(facts.days)} label={facts.days === 1 ? 'día por semana' : 'días por semana'} />
              <Fact value={String(facts.exercises)} label="ejercicios" />
              {facts.deloadWeeks.length > 0 && (
                <Fact value={`Sem ${facts.deloadWeeks.join(', ')}`} label="descarga" />
              )}
            </dl>
            {(facts.ramp.length > 0 || rule || notes) && (
              <div className="max-w-[60ch] text-[13px] text-muted-foreground">
                {facts.ramp.length > 0 && (
                  <p className="font-semibold text-foreground">
                    {facts.ramp.join(' y ')}
                    {facts.rampWeeks && `, de la semana ${facts.rampWeeks[0]} a la ${facts.rampWeeks[1]}`}
                  </p>
                )}
                {rule && <p className="mt-0.5">Progresión: {rule}</p>}
                {notes && <p className="mt-0.5">Notas: {notes}</p>}
              </div>
            )}
          </div>

          {/* What changed (edits only) */}
          {changes && (
            <div>
              <h3 className="mb-2 font-heading text-[15px]">Qué cambió</h3>
              {changeCount === 0 ? (
                <p className="text-[13px] text-muted-foreground">Los ejercicios y la periodización quedaron igual.</p>
              ) : (
                <ChangeList changes={changes} />
              )}
            </div>
          )}

          {/* Every day at a glance */}
          <div>
            <h3 className="mb-2 font-heading text-[15px]">{result.kind === 'new' ? 'Los días' : 'Así queda cada día'}</h3>
            <ol className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
              {days.map((d, i) => {
                const rows = d.exercises.filter((x) => x.name.trim());
                const weekday = weekdayLabel(d.weekday);
                return (
                  <li key={i} className="flex flex-col border border-border bg-background p-3.5">
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" className="font-poster text-[44px] leading-[0.8] text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-faint">
                          <span className="sr-only">Día {i + 1}. </span>
                          {weekday || `Día ${i + 1}`}
                        </div>
                        <div className="truncate text-[15px] font-bold leading-tight" title={d.label}>
                          {d.label.trim() || 'Sin nombre'}
                        </div>
                      </div>
                      <span className="flex-none pt-0.5 text-[12px] text-faint">
                        {rows.length} {rows.length === 1 ? 'ejercicio' : 'ejercicios'}
                      </span>
                    </div>
                    <ul className="mt-3 divide-y divide-border">
                      {rows.map((x, xi) => {
                        const intensity = rxIntensity(x);
                        return (
                          <li key={xi} className="flex items-start gap-2 py-1.5">
                            {x.superset ? (
                              <span
                                title={`Superserie ${x.superset}: se hace seguida de los otros ejercicios ${x.superset}`}
                                className="mt-px grid h-5 w-5 flex-none place-items-center bg-secondary/15 text-[10.5px] font-extrabold text-secondary"
                              >
                                <span className="sr-only">Superserie </span>
                                {x.superset}
                              </span>
                            ) : (
                              <span className="w-5 flex-none" aria-hidden="true" />
                            )}
                            <span className="min-w-0 flex-1 text-[13px] leading-snug">{x.name.trim()}</span>
                            <span className="flex-none text-right">
                              <span className="block text-[13px] font-bold tabular-nums">{rxText(x)}</span>
                              {intensity && <span className="block text-[11.5px] text-faint">{intensity}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </div>

          {result.dropped.length > 0 && (
            <p className="flex items-start gap-2 border border-warning/40 bg-warning/[0.07] px-3 py-2 text-[13px]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" strokeWidth={2} aria-hidden="true" />
              <span>
                <span className="font-semibold">Se quitaron porque no están en el catálogo:</span> {result.dropped.join(', ')}.
                Añádelos en Ejercicios si los quieres usar.
              </span>
            </p>
          )}
        </div>
      )}

      <AlertDialog open={confirmUndo} onOpenChange={setConfirmUndo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer el cambio de la IA?</AlertDialogTitle>
            <AlertDialogDescription>
              El borrador vuelve a como estaba antes de pedirlo. También se pierden los cambios que hiciste después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={onUndo}>Deshacer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Actions({ onUndo, onRefine }: { onUndo: () => void; onRefine: () => void }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onUndo}>
        <Undo2 className="h-3.5 w-3.5" strokeWidth={2} /> Deshacer
      </Button>
      <Button variant="outline" size="sm" onClick={onRefine}>
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} /> Pedir otro cambio
      </Button>
    </span>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="font-poster text-[34px] leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function ChangeList({ changes }: { changes: NonNullable<ReturnType<typeof diffDrafts>> }) {
  const items = [
    ...changes.notes.map((n) => ({ kind: 'note' as const, key: `n-${n}`, body: <span>{n}</span> })),
    ...changes.changed.map((c) => ({
      kind: 'changed' as const,
      key: `c-${c.name}-${c.day}`,
      body: (
        <span>
          <span className="font-semibold">{c.name}</span> <span className="text-faint">(día {c.day})</span>{' '}
          <span className="tabular-nums text-muted-foreground">
            {c.from} <span aria-label="pasa a">→</span> <span className="font-semibold text-foreground">{c.to}</span>
          </span>
        </span>
      ),
    })),
    ...changes.added.map((a) => ({
      kind: 'added' as const,
      key: `a-${a.name}-${a.day}`,
      body: (
        <span>
          <span className="sr-only">Añadido: </span>
          <span className="font-semibold">{a.name}</span> <span className="text-faint">(día {a.day})</span>
        </span>
      ),
    })),
    ...changes.removed.map((r) => ({
      kind: 'removed' as const,
      key: `r-${r.name}-${r.day}`,
      body: (
        <span>
          <span className="sr-only">Quitado: </span>
          <span className="font-semibold line-through decoration-primary/70">{r.name}</span>{' '}
          <span className="text-faint">(día {r.day})</span>
        </span>
      ),
    })),
  ];
  const shown = items.slice(0, MAX_CHANGES);
  const icon = {
    note: <RefreshCw className="h-3.5 w-3.5 text-secondary" strokeWidth={2.25} />,
    changed: <RefreshCw className="h-3.5 w-3.5 text-secondary" strokeWidth={2.25} />,
    added: <Plus className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />,
    removed: <Minus className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />,
  };
  return (
    <ul className="grid gap-1.5 text-[13.5px]">
      {shown.map((it) => (
        <li key={it.key} className="flex items-start gap-2">
          <span className="mt-[3px] flex-none" aria-hidden="true">
            {icon[it.kind]}
          </span>
          {it.body}
        </li>
      ))}
      {items.length > shown.length && (
        <li className="pl-[22px] text-[12.5px] text-faint">y {items.length - shown.length} cambios más</li>
      )}
    </ul>
  );
}
