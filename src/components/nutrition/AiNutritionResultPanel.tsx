import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, RefreshCw, Sparkles, Undo2, X } from 'lucide-react';
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
import { mealTypeLabel } from '@/components/nutrition/builderModel';
import { dayTag, diffDrafts, foodText, mealTitle, planFacts, type AiNutritionResult } from '@/components/nutrition/aiModel';

/** Longest change list shown before "y N más". */
const MAX_CHANGES = 12;

/**
 * What the AI just did, laid out for review: its explanation, the plan in
 * numbers, what changed (edits), and every meal's options at a glance — the
 * wizard's Comidas step spreads them over a long form (the Revisar step lists
 * them itself, so the builder hides the grid there). Shown until closed;
 * collapses to one line. It describes the AI's result as applied, not later
 * hand edits.
 */
export function AiNutritionResultPanel({
  result,
  editedSince,
  showMeals = true,
  onUndo,
  onRefine,
  onDismiss,
}: {
  result: AiNutritionResult;
  /** Whether the coach changed the draft after this result was applied. */
  editedSince: () => boolean;
  /** Whether to show every meal at a glance (off where the page already lists them). */
  showMeals?: boolean;
  onUndo: () => void;
  onRefine: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const facts = useMemo(() => planFacts(result.after), [result]);
  const changes = useMemo(() => (result.kind === 'edit' ? diffDrafts(result.before, result.after) : null), [result]);
  const cycling = result.after.dayCycling;
  const meals = result.after.meals.filter((m) => m.options.some((o) => o.foods.some((f) => f.name.trim())));
  const notes = result.after.notes.trim();

  // Mounted fresh for each result (the builder keys it): take focus, so the
  // coach (and a screen reader) lands on what just changed.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    titleRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const undo = () => (editedSince() ? setConfirmUndo(true) : onUndo());

  const changeCount = changes
    ? changes.notes.length +
      changes.mealsAdded.length +
      changes.mealsRemoved.length +
      changes.foodsAdded.length +
      changes.foodsRemoved.length
    : 0;

  return (
    <section
      aria-labelledby="ai-nutrition-result-title"
      className="border border-l-[3px] border-border border-l-primary bg-card motion-safe:animate-fade-up"
    >
      <div className="px-5 py-4">
        {/* Title row: collapse/close stay top-right at every width. Collapsed,
            the facts and actions fold into this same row. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2
            id="ai-nutrition-result-title"
            ref={titleRef}
            tabIndex={-1}
            className="flex items-center gap-2 font-heading text-[20px] focus:outline-none"
          >
            <Sparkles className="h-4 w-4 flex-none text-primary" strokeWidth={2.25} aria-hidden="true" />
            {result.kind === 'new' ? 'Borrador generado' : 'Cambios aplicados'}
          </h2>
          {!open && (
            <p className="text-[13px] text-muted-foreground">
              {facts.meals} {facts.meals === 1 ? 'comida' : 'comidas'}, {facts.options}{' '}
              {facts.options === 1 ? 'opción' : 'opciones'}, {facts.foods} {facts.foods === 1 ? 'alimento' : 'alimentos'}
              {facts.dayCycling && ', con ciclado'}
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
              aria-controls="ai-nutrition-result-body"
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
        <div id="ai-nutrition-result-body" className="flex flex-col gap-6 border-t border-border px-5 pb-5 pt-4">
          {/* The plan in numbers */}
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <Fact value={String(facts.meals)} label={facts.meals === 1 ? 'comida' : 'comidas'} />
              <Fact value={String(facts.options)} label={facts.options === 1 ? 'opción' : 'opciones'} />
              <Fact value={String(facts.foods)} label={facts.foods === 1 ? 'alimento' : 'alimentos'} />
              <Fact value={facts.dayCycling ? 'Sí' : 'No'} label="ciclado por tipo de día" />
              {facts.weeks && <Fact value={facts.weeks} label={facts.weeks === '1' ? 'semana' : 'semanas'} />}
            </dl>
            {(facts.targets.length > 0 || notes) && (
              <div className="max-w-[60ch] text-[13px] text-muted-foreground">
                {facts.targets.map((t) => (
                  <p key={t.dayType} className="font-semibold text-foreground">
                    {t.title}: {t.text}
                  </p>
                ))}
                {notes && <p className="mt-0.5">Notas: {notes}</p>}
              </div>
            )}
          </div>

          {/* What changed (edits only) */}
          {changes && (
            <div>
              <h3 className="mb-2 font-heading text-[15px]">Qué cambió</h3>
              {changeCount === 0 ? (
                <p className="text-[13px] text-muted-foreground">Las comidas y los objetivos quedaron igual.</p>
              ) : (
                <ChangeList changes={changes} />
              )}
            </div>
          )}

          {/* Every meal at a glance */}
          {showMeals && (
            <div>
              <h3 className="mb-2 font-heading text-[15px]">
                {result.kind === 'new' ? 'Las comidas' : 'Así queda cada comida'}
              </h3>
              <ol className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                {meals.map((m, i) => {
                  const options = m.options.filter((o) => o.foods.some((f) => f.name.trim()));
                  const title = mealTitle(m);
                  const typeLabel = mealTypeLabel(m.mealType);
                  // The type only when the title isn't already it (an unlabelled
                  // slot is titled by its type); else the time, else "Comida N".
                  const faint = [
                    title.toLowerCase() !== typeLabel.toLowerCase() ? typeLabel : m.timeHint.trim() || `Comida ${i + 1}`,
                    cycling && m.appliesTo !== 'both' ? `solo ${dayTag(m.appliesTo)}` : '',
                    m.isOptional ? 'opcional' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  const slotNotes = m.notes.trim();
                  return (
                    <li key={i} className="flex flex-col border border-border bg-background p-3.5">
                      <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="font-poster text-[44px] leading-[0.8] text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] text-faint">
                            {!faint.startsWith('Comida ') && <span className="sr-only">Comida {i + 1}. </span>}
                            {faint}
                          </div>
                          <div className="truncate text-[15px] font-bold leading-tight" title={title}>
                            {title}
                          </div>
                        </div>
                        <span className="flex-none pt-0.5 text-[12px] text-faint">
                          {options.length} {options.length === 1 ? 'opción' : 'opciones'}
                        </span>
                      </div>
                      <ul className="mt-3 divide-y divide-border">
                        {options.map((o, oi) => (
                          <li key={oi} className="flex flex-col gap-0.5 py-1.5 text-[13px] leading-snug">
                            <span className="font-bold">{o.label.trim() || `Opción ${oi + 1}`}</span>
                            <span>
                              {o.foods
                                .filter((f) => f.name.trim())
                                .map((f) => foodText(f, cycling))
                                .join(', ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {slotNotes && <p className="mt-2 text-[12px] text-faint">{slotNotes}</p>}
                    </li>
                  );
                })}
              </ol>
            </div>
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
    ...changes.foodsAdded.map((a, i) => ({
      kind: 'added' as const,
      key: `fa-${i}-${a.meal}-${a.name}`,
      body: (
        <span>
          <span className="sr-only">Añadido: </span>
          <span className="font-semibold">{a.name}</span> <span className="text-faint">({a.meal})</span>
        </span>
      ),
    })),
    ...changes.foodsRemoved.map((r, i) => ({
      kind: 'removed' as const,
      key: `fr-${i}-${r.meal}-${r.name}`,
      body: (
        <span>
          <span className="sr-only">Quitado: </span>
          <span className="font-semibold line-through decoration-primary/70">{r.name}</span>{' '}
          <span className="text-faint">({r.meal})</span>
        </span>
      ),
    })),
    ...changes.mealsAdded.map((t, i) => ({
      kind: 'added' as const,
      key: `ma-${i}-${t}`,
      body: (
        <span>
          Comida añadida: <span className="font-semibold">{t}</span>
        </span>
      ),
    })),
    ...changes.mealsRemoved.map((t, i) => ({
      kind: 'removed' as const,
      key: `mr-${i}-${t}`,
      body: (
        <span>
          Comida quitada: <span className="font-semibold line-through decoration-primary/70">{t}</span>
        </span>
      ),
    })),
  ];
  const shown = items.slice(0, MAX_CHANGES);
  const rest = items.length - shown.length;
  const icon = {
    note: <RefreshCw className="h-3.5 w-3.5 text-secondary" strokeWidth={2.25} />,
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
      {rest > 0 && (
        <li className="pl-[22px] text-[12.5px] text-faint">
          y {rest} {rest === 1 ? 'cambio más' : 'cambios más'}
        </li>
      )}
    </ul>
  );
}
