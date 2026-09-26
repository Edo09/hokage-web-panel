import { Fragment, useMemo, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  GripVertical,
  Link2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Exercise, ProgramStatus } from '@/types';
import { ExerciseCombobox } from '@/components/shared/ExerciseCombobox';
import { cn } from '@/lib/utils';
import { draftAge } from '@/lib/programDraft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DiscardChangesDialog } from '@/components/program/DiscardChangesDialog';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import { AiProgramDialog } from '@/components/program/AiProgramDialog';
import { AiResultPanel } from '@/components/program/AiResultPanel';
import type { AiResult } from '@/components/program/aiModel';
import {
  bodyPartLabel,
  emptyDay,
  emptyEx,
  emptyOverride,
  overriddenWeeks,
  overrideHasData,
  SUPERSET_LETTERS,
  type OverrideRow,
  LOAD_QUAL,
  rangeText,
  STATUSES,
  todayISO,
  toInt,
  WEEKDAYS,
  type DayRow,
  type ExRow,
  type WeekRow,
} from '@/components/program/builderModel';
import {
  draftSignature,
  useProgramBuilder,
  type ProgramBuilderProps,
  type ProgramBuilderState,
} from '@/components/program/useProgramBuilder';

/*
 * The program builder as one workspace (the "Dojo Poster" redesign):
 *
 *   header        name, details, save
 *   periodization one card per week — load bar, RIR, deload — + its editor
 *   library       catalog search + body-part filter; click or drag into a day
 *   day editor    day tabs, one spreadsheet-like row per exercise
 *   preview       the client's phone view of the draft, live
 *
 * State, autosave and save live in useProgramBuilder (shared with the legacy
 * wizard), so this file is layout and interaction only.
 */

const WEEKDAY_SHORT: Record<string, string> = {
  monday: 'LUN',
  tuesday: 'MAR',
  wednesday: 'MIÉ',
  thursday: 'JUE',
  friday: 'VIE',
  saturday: 'SÁB',
  sunday: 'DOM',
};

// Drag payloads: a catalog exercise from the library, or a row being moved.
const DT_EXERCISE = 'application/x-hokage-exercise';
const DT_ROW = 'application/x-hokage-row';

const CELL =
  'h-8 w-full min-w-0 rounded-[4px] border border-border bg-field px-1 text-center text-[13px] font-bold tabular-nums text-foreground placeholder:font-normal placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  // No spinner arrows: Chrome reserves their width even when hidden, which
  // clipped two-digit values in the narrow cells.
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const ROW_GRID = 'grid items-center gap-2 [grid-template-columns:16px_24px_minmax(180px,1fr)_52px_96px_90px_60px_60px_56px]';
const CAPS = 'text-[10px] font-extrabold uppercase tracking-[0.12em] text-faint';
const NATIVE_SELECT =
  'h-8 rounded-[4px] border border-border bg-field px-2 text-[12.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A copy of a row as a NEW row: without its DB id, so saving inserts it
 *  instead of stealing the original's identity (and its logged history). */
function withoutId<T extends { id?: string }>(row: T): T {
  const copy = { ...row };
  delete copy.id;
  return copy;
}

const isImage = (url: string | null | undefined) => !!url && /\.(gif|webp|png|jpe?g)(\?|$)/i.test(url);

export function ProgramWorkspace(props: ProgramBuilderProps) {
  const b = useProgramBuilder(props);
  const [activeDay, setActiveDay] = useState(0);
  const [selWeek, setSelWeek] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(
    !!(props.initial?.progression_rule || props.initial?.tempo_default || props.initial?.description || props.initial?.notes),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  /** The last AI answer applied, shown in the review panel until closed. */
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  /** Remounts the panel per result, so each one opens expanded and focused. */
  const [aiResultSeq, setAiResultSeq] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  /** Cancelar throws the draft away — so ask first when there's work to lose. */
  const cancel = () => (b.hasChanges() ? setConfirmCancel(true) : props.onClose());

  const day = b.days[Math.min(activeDay, b.days.length - 1)];
  const dayIdx = Math.min(activeDay, b.days.length - 1);
  const week = b.weeks[Math.min(selWeek, b.weeks.length - 1)] as WeekRow | undefined;

  const submit = () =>
    b.submit((where) => {
      if ('dayIndex' in where && where.dayIndex != null) setActiveDay(where.dayIndex);
      if ('weekIndex' in where && where.weekIndex != null) setSelWeek(where.weekIndex);
      if (where.step === 0) nameRef.current?.focus();
    });

  /** Add a catalog exercise to the active day — fills a trailing blank row
   *  instead of leaving it dangling. `at` inserts before that row. */
  const addExercise = (name: string, at?: number) => {
    b.setDays((ds) =>
      ds.map((d, i) => {
        if (i !== dayIdx) return d;
        const rows = [...d.exercises];
        const last = rows[rows.length - 1];
        if (at == null && last && !last.name.trim()) {
          rows[rows.length - 1] = { ...last, name };
        } else {
          rows.splice(at ?? rows.length, 0, { ...emptyEx(), name });
        }
        return { ...d, exercises: rows };
      }),
    );
  };

  const moveRow = (from: number, to: number) => {
    if (from === to) return;
    b.setDays((ds) =>
      ds.map((d, i) => {
        if (i !== dayIdx) return d;
        const rows = [...d.exercises];
        const [row] = rows.splice(from, 1);
        rows.splice(to > from ? to - 1 : to, 0, row);
        return { ...d, exercises: rows };
      }),
    );
  };

  const onDropAt = (e: DragEvent, at?: number) => {
    e.preventDefault();
    const ex = e.dataTransfer.getData(DT_EXERCISE);
    if (ex) return addExercise(ex, at);
    const row = e.dataTransfer.getData(DT_ROW);
    if (row !== '') moveRow(Number(row), at ?? day.exercises.length);
  };

  const duplicateDay = () => {
    b.setDays((ds) => {
      const copy: DayRow = {
        // A copy is a NEW day: no ids, so the save inserts it instead of
        // stealing the original's rows (and their logged history).
        label: day.label,
        weekday: '',
        exercises: day.exercises.map(withoutId),
      };
      return [...ds.slice(0, dayIdx + 1), copy, ...ds.slice(dayIdx + 1)];
    });
    setActiveDay(dayIdx + 1);
  };

  const removeDay = () => {
    if (b.days.length <= 1) return;
    b.setDays((ds) => ds.filter((_, i) => i !== dayIdx));
    setActiveDay(Math.max(0, dayIdx - 1));
  };

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <WorkspaceHeader
        b={b}
        nameRef={nameRef}
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((v) => !v)}
        onPreview={() => setPreviewOpen(true)}
        onAi={() => setAiOpen(true)}
        onCancel={cancel}
        onSave={() => void submit()}
      />

      <DiscardChangesDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        isTemplate={b.isTemplate}
        editing={!!b.initial}
        onDiscard={() => {
          b.dropDraft();
          props.onClose();
        }}
      />

      <AiProgramDialog
        b={b}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onApplied={(r) => {
          setActiveDay(0);
          setSelWeek(0);
          setAiResult(r);
          setAiResultSeq((n) => n + 1);
        }}
      />

      {aiResult && (
        <AiResultPanel
          key={aiResultSeq}
          result={aiResult}
          editedSince={() => draftSignature(b.snapshot()) !== draftSignature(aiResult.after)}
          onUndo={() => {
            b.replaceDraft(aiResult.before);
            setAiResult(null);
          }}
          onRefine={() => setAiOpen(true)}
          onDismiss={() => setAiResult(null)}
        />
      )}

      <PeriodizationStrip b={b} selWeek={selWeek} onSelect={setSelWeek} />

      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <ExerciseLibrary catalog={b.catalog} onAdd={(n) => addExercise(n)} />

        <section aria-label="Días y ejercicios" className="flex min-w-0 flex-col gap-3">
          <DayTabs days={b.days} active={dayIdx} onSelect={setActiveDay} onAdd={() => {
            b.setDays((ds) => [...ds, emptyDay()]);
            setActiveDay(b.days.length);
          }} />

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <Label htmlFor="pw-day-label" className={CAPS}>
                Nombre del día {dayIdx + 1}
              </Label>
              <Input
                id="pw-day-label"
                placeholder="Ej. Glúteos + femorales"
                value={day.label}
                onChange={(e) => b.updDay(dayIdx, { label: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pw-day-weekday" className={CAPS}>
                Día de la semana
              </Label>
              <select
                id="pw-day-weekday"
                className={cn(NATIVE_SELECT, 'h-9 min-w-[150px]')}
                value={day.weekday}
                onChange={(e) => b.updDay(dayIdx, { weekday: e.target.value })}
              >
                {WEEKDAYS.map((w) => (
                  <option key={w.value || 'none'} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={duplicateDay}>
              <Copy className="h-3.5 w-3.5" strokeWidth={2} /> Duplicar día
            </Button>
            <Button variant="outline" onClick={removeDay} disabled={b.days.length <= 1} aria-label={`Eliminar día ${dayIdx + 1}`}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </Button>
          </div>

          <ExerciseTable
            b={b}
            day={day}
            dayIdx={dayIdx}
            week={week}
            weekNumber={Math.min(selWeek, b.weeks.length - 1) + 1}
            onDropAt={onDropAt}
            onMove={moveRow}
          />

          <VolumeCard b={b} dayIdx={dayIdx} week={week} weekNumber={Math.min(selWeek, b.weeks.length - 1) + 1} />
        </section>

        <aside aria-label="Vista previa en la app" className="hidden flex-col gap-2 2xl:flex">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-[18px]">Así lo ve el cliente</h2>
            <span className="text-[11.5px] text-faint">en vivo</span>
          </div>
          <MobileProgramPreview program={b.preview} />
        </aside>
      </div>

      {/* The header's actions again, so a long program can be saved without
          scrolling back up. */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card px-5 py-3">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{b.summaryText}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
          <Button size="lg" onClick={() => void submit()} disabled={b.saving || b.catalog === null}>
            {b.saveLabel}
          </Button>
        </div>
      </footer>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vista previa · app del cliente</DialogTitle>
          </DialogHeader>
          <MobileProgramPreview program={b.preview} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function WorkspaceHeader({
  b,
  nameRef,
  detailsOpen,
  onToggleDetails,
  onPreview,
  onAi,
  onCancel,
  onSave,
}: {
  b: ProgramBuilderState;
  nameRef: RefObject<HTMLInputElement>;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onPreview: () => void;
  onAi: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const kind = b.isTemplate
    ? b.initial
      ? 'Editar plantilla'
      : 'Nueva plantilla'
    : b.initial
      ? `Editar programa · ${b.firstName}`
      : `Nuevo programa · ${b.firstName}`;

  return (
    <header className="relative overflow-hidden border border-border bg-gradient-to-b from-card to-background px-5 py-4">
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 right-44 h-[240px] w-[220px] -skew-x-[18deg] bg-primary/[0.07]" />
      <div className="relative flex flex-wrap items-end gap-4">
        <div className="min-w-[260px] flex-1">
          <div className={CAPS}>{kind}</div>
          <label htmlFor="pw-name" className="sr-only">
            Nombre del programa
          </label>
          <input
            id="pw-name"
            ref={nameRef}
            value={b.name}
            onChange={(e) => b.setName(e.target.value)}
            placeholder="NOMBRE DEL PROGRAMA"
            autoFocus={!b.initial}
            className="mt-1 w-full border-b-2 border-transparent bg-transparent font-poster text-[32px] uppercase leading-tight tracking-[0.01em] text-foreground placeholder:text-faint/60 focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span aria-hidden="true" className="h-[3px] w-[22px] bg-primary" />
            <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{b.summaryText}</span>
            {b.draftSavedAt != null && (
              <span className="flex items-center gap-1.5 text-[11.5px] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Borrador guardado en este navegador
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onAi} disabled={!b.catalog?.length} className="border-primary/60 text-primary hover:bg-primary/10">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} /> {b.exCount > 0 ? 'Editar con IA' : 'Generar con IA'}
          </Button>
          <Button variant="outline" onClick={onToggleDetails} aria-expanded={detailsOpen}>
            Detalles {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" onClick={onPreview} className="2xl:hidden">
            <Smartphone className="h-3.5 w-3.5" strokeWidth={2} /> Vista previa
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="lg" onClick={onSave} disabled={b.saving || b.catalog === null}>
            {b.saveLabel}
          </Button>
        </div>
      </div>

      {b.restored != null && !b.draftDismissed && (
        <div className="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border border-secondary/30 bg-secondary/[0.07] px-3 py-2 text-[12.5px]">
          <RotateCcw className="h-3.5 w-3.5 flex-none text-secondary" strokeWidth={2} />
          <span className="text-muted-foreground">
            Recuperamos un borrador sin guardar de{' '}
            <span className="font-semibold text-foreground">{draftAge(b.restored.savedAt)}</span>.
          </span>
          <button
            type="button"
            onClick={b.discardDraft}
            className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Descartar borrador
          </button>
        </div>
      )}

      {detailsOpen && (
        <div className="relative mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-3">
          <Field id="pw-focus" label="Enfoque">
            <Input id="pw-focus" placeholder="Ej. Glúteos y piernas" value={b.focus} onChange={(e) => b.setFocus(e.target.value)} />
          </Field>
          <Field id="pw-prog" label="Regla de progresión">
            <Input
              id="pw-prog"
              placeholder="Ej. Doble progresión: sube peso al llegar a 8 reps"
              value={b.progressionRule}
              onChange={(e) => b.setProgressionRule(e.target.value)}
            />
          </Field>
          <Field id="pw-tempo" label="Tempo por defecto">
            <Input
              id="pw-tempo"
              placeholder="Ej. Excéntrica 2-3 s / concéntrica explosiva"
              value={b.tempoDefault}
              onChange={(e) => b.setTempoDefault(e.target.value)}
            />
          </Field>
          {!b.isTemplate && (
            <>
              <Field id="pw-start" label="Inicio">
                <Input
                  id="pw-start"
                  type="date"
                  // Guard past dates only when creating; editing a running
                  // block must keep its original (possibly past) start.
                  min={b.initial ? undefined : todayISO()}
                  value={b.startDate}
                  onChange={(e) => b.setStartDate(e.target.value)}
                />
              </Field>
              <Field id="pw-status" label="Estado">
                <select
                  id="pw-status"
                  className={cn(NATIVE_SELECT, 'h-9 w-full')}
                  value={b.status}
                  onChange={(e) => b.setStatus(e.target.value as ProgramStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field id="pw-desc" label="Descripción">
            <Input id="pw-desc" placeholder="Resumen breve del bloque…" value={b.description} onChange={(e) => b.setDescription(e.target.value)} />
          </Field>
          <Field id="pw-notes" label="Notas del programa" className="md:col-span-2 xl:col-span-3">
            <Textarea id="pw-notes" rows={2} placeholder="Ej. Cardio 20 min post-entreno" value={b.notes} onChange={(e) => b.setNotes(e.target.value)} />
          </Field>
        </div>
      )}
    </header>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={id} className={CAPS}>
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- periodization */

function PeriodizationStrip({
  b,
  selWeek,
  onSelect,
}: {
  b: ProgramBuilderState;
  selWeek: number;
  onSelect: (i: number) => void;
}) {
  const sel = Math.min(selWeek, b.weeks.length - 1);
  const w = b.weeks[sel];
  const num = (field: keyof WeekRow, label: string, min: number, max: number) => (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={`Semana ${sel + 1}: ${label}`}
      placeholder="—"
      className={cn(CELL, 'w-12')}
      value={w[field] as string}
      onChange={(e) => b.updWeek(sel, { [field]: e.target.value } as Partial<WeekRow>)}
    />
  );

  return (
    <section aria-label="Periodización" className="border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-heading text-[20px]">Periodización</h2>
          <p className="text-[12px] text-faint">
            Carga y RIR de cada semana. El RIR de la semana se aplica a los ejercicios que no fijan el suyo.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            aria-label="Quitar una semana"
            disabled={b.weeksN <= 1}
            onClick={() => {
              b.setDuration(String(b.weeksN - 1));
              if (sel >= b.weeksN - 1) onSelect(b.weeksN - 2);
            }}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[88px] text-center text-[12px] font-extrabold uppercase tracking-[0.1em]">
            {b.weeksN} {b.weeksN === 1 ? 'semana' : 'semanas'}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Añadir una semana"
            disabled={b.weeksN >= 52}
            onClick={() => b.setDuration(String(b.weeksN + 1))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Semanas">
        {b.weeks.map((wk, i) => {
          const load = toInt(wk.loadMax) ?? toInt(wk.loadMin);
          const active = i === sel;
          return (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={cn(
                'flex w-[132px] flex-none flex-col gap-1.5 border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-2 border-primary bg-card' : 'border-border bg-background hover:border-border-strong',
                wk.isDeload && 'bg-[repeating-linear-gradient(135deg,transparent_0_8px,hsl(var(--muted)/0.45)_8px_16px)]',
              )}
            >
              <span className="font-poster text-[17px] leading-none">SEM {i + 1}</span>
              <span className="flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
                {wk.isDeload && (
                  <span className="flex-none bg-muted px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.1em] text-foreground">DESCARGA</span>
                )}
                <span className="truncate">{wk.label.trim() || '—'}</span>
              </span>
              <span className="flex h-12 items-end bg-field p-1" aria-hidden="true">
                <span
                  className={cn('block w-full', wk.isDeload ? 'bg-faint/60' : active ? 'bg-primary' : 'bg-primary/55')}
                  style={{ height: `${load != null ? Math.max(6, Math.min(100, load)) : 6}%` }}
                />
              </span>
              <span className="flex justify-between text-[11px]">
                <span className="font-extrabold tabular-nums">{rangeText(wk.loadMin, wk.loadMax) === '—' ? '— %' : `${rangeText(wk.loadMin, wk.loadMax)} %`}</span>
                <span className="text-faint">RIR {rangeText(wk.rirMin, wk.rirMax)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {w && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <span className="self-center font-poster text-[17px]">SEM {sel + 1}</span>
          <Field id="pw-week-label" label="Etiqueta">
            <Input
              id="pw-week-label"
              className="h-8 w-44"
              placeholder="Ej. Técnica y base"
              value={w.label}
              onChange={(e) => b.updWeek(sel, { label: e.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>% carga</span>
            <div className="flex items-center gap-1">
              {num('loadMin', 'carga mínima', 1, 100)}
              <span className="text-faint">–</span>
              {num('loadMax', 'carga máxima', 1, 100)}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>RIR</span>
            <div className="flex items-center gap-1">
              {num('rirMin', 'RIR mínimo', 0, 10)}
              <span className="text-faint">–</span>
              {num('rirMax', 'RIR máximo', 0, 10)}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>Series (todas)</span>
            {num('setsOverride', 'series para toda la semana', 1, 20)}
          </div>
          <label className="flex h-8 cursor-pointer items-center gap-2 border border-border bg-field px-2.5 text-[12px] font-bold uppercase tracking-[0.08em]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
              checked={w.isDeload}
              onChange={(e) => b.updWeek(sel, { isDeload: e.target.checked })}
            />
            Descarga
          </label>
          <Field id="pw-week-notes" label="Nota de la semana" className="min-w-[200px] flex-1">
            <Input id="pw-week-notes" className="h-8" placeholder="Opcional" value={w.notes} onChange={(e) => b.updWeek(sel, { notes: e.target.value })} />
          </Field>
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- library */

function ExerciseLibrary({ catalog, onAdd }: { catalog: Exercise[] | null; onAdd: (name: string) => void }) {
  const [q, setQ] = useState('');
  const [part, setPart] = useState<string | null>(null);

  const parts = useMemo(() => {
    const s = new Set<string>();
    for (const ex of catalog ?? []) s.add(bodyPartLabel(ex.body_part?.name));
    return [...s].sort((a, c) => a.localeCompare(c, 'es'));
  }, [catalog]);

  const list = useMemo(() => {
    const needle = q
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    return (catalog ?? []).filter((ex) => {
      if (part && bodyPartLabel(ex.body_part?.name) !== part) return false;
      if (!needle) return true;
      return ex.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(needle);
    });
  }, [catalog, q, part]);

  return (
    <aside aria-label="Biblioteca de ejercicios" className="flex flex-col gap-2.5 border border-border bg-card p-3.5 lg:sticky lg:top-[112px] lg:max-h-[calc(100vh-128px)]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-[18px]">Ejercicios</h2>
        <span className="text-[11.5px] text-faint">{catalog ? list.length : '…'}</span>
      </div>
      <label className="flex h-9 items-center gap-2 border border-border bg-field px-2.5">
        <Search className="h-3.5 w-3.5 text-faint" />
        <span className="sr-only">Buscar ejercicio</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-faint focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por grupo muscular">
        {parts.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={part === p}
            onClick={() => setPart(part === p ? null : p)}
            className={cn(
              'px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              part === p ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:border-border-strong',
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] text-faint">Arrastra al día o pulsa +.</p>
      <ul className="-mr-1.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1.5">
        {catalog === null && <li className="py-6 text-center text-[12.5px] text-faint">Cargando catálogo…</li>}
        {catalog !== null && list.length === 0 && <li className="py-6 text-center text-[12.5px] text-faint">Sin resultados.</li>}
        {list.map((ex) => (
          <li
            key={ex.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DT_EXERCISE, ex.name);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="flex cursor-grab items-center gap-2.5 border border-border bg-background p-1.5 active:cursor-grabbing"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden border border-border bg-field">
              {isImage(ex.video_url) ? (
                <img src={ex.video_url!} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Dumbbell className="h-4 w-4 text-faint" strokeWidth={1.8} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-[12.5px] font-bold leading-tight">{ex.name}</span>
              <span className="block text-[11px] text-faint">{bodyPartLabel(ex.body_part?.name)}</span>
            </span>
            <button
              type="button"
              onClick={() => onAdd(ex.name)}
              aria-label={`Añadir ${ex.name} al día`}
              className="flex h-8 w-8 flex-none items-center justify-center border border-border-strong text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* -------------------------------------------------------------------- days */

function DayTabs({
  days,
  active,
  onSelect,
  onAdd,
}: {
  days: DayRow[];
  active: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1 pl-1" role="tablist" aria-label="Días del programa">
      {days.map((d, i) => {
        const isActive = i === active;
        const count = d.exercises.filter((x) => x.name.trim()).length;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(i)}
            className={cn(
              'flex-none text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? '-skew-x-[10deg] bg-primary text-primary-foreground' : 'border border-border bg-card hover:border-border-strong',
            )}
          >
            <span className={cn('flex flex-col px-3.5 py-2', isActive && 'skew-x-[10deg]')}>
              <span className={cn('text-[10px] font-extrabold uppercase tracking-[0.14em]', !isActive && 'text-faint')}>
                Día {i + 1}
                {d.weekday && ` · ${WEEKDAY_SHORT[d.weekday] ?? ''}`} · {count}
              </span>
              <span className="max-w-[180px] truncate text-[13px] font-bold">{d.label.trim() || 'Sin nombre'}</span>
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Añadir día"
        className="flex w-11 flex-none items-center justify-center border border-dashed border-border-strong text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- table */

function ExerciseTable({
  b,
  day,
  dayIdx,
  week,
  weekNumber,
  onDropAt,
  onMove,
}: {
  b: ProgramBuilderState;
  day: DayRow;
  dayIdx: number;
  week: WeekRow | undefined;
  weekNumber: number;
  onDropAt: (e: DragEvent, at?: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [over, setOver] = useState<number | 'end' | null>(null);
  const weekRir = week ? rangeText(week.rirMin, week.rirMax) : '—';
  const weekSets = week?.setsOverride.trim();

  const allowDrop = (e: DragEvent, target: number | 'end') => {
    if (![DT_EXERCISE, DT_ROW].some((t) => e.dataTransfer.types.includes(t))) return;
    e.preventDefault();
    setOver(target);
  };

  return (
    <div className="overflow-x-auto border border-border bg-card">
      <div className="min-w-[700px]">
        {(weekRir !== '—' || weekSets) && (
          <div className="border-b border-border bg-primary/[0.06] px-3.5 py-2 text-[12px] text-muted-foreground">
            Semana {weekNumber}:{weekRir !== '—' && <> RIR <strong className="text-foreground">{weekRir}</strong></>}
            {weekSets && <> · <strong className="text-foreground">{weekSets} series</strong> por ejercicio</>}
            <span className="text-faint"> — los campos punteados heredan de la semana.</span>
          </div>
        )}
        <div className={cn(ROW_GRID, 'border-b border-border px-3.5 py-2', CAPS)} aria-hidden="true">
          <span />
          <span>#</span>
          <span>Ejercicio</span>
          <span className="text-center">Series</span>
          <span className="text-center">Reps</span>
          <span className="text-center">RIR</span>
          <span className="text-center">%1RM</span>
          <span className="text-center">Desc. (s)</span>
          <span />
        </div>

        {day.exercises.map((x, xi) => {
          // Consecutive rows sharing a letter form a superset (as in the app).
          const g = x.superset?.trim() || null;
          const prev = day.exercises[xi - 1]?.superset?.trim() || null;
          const next = day.exercises[xi + 1]?.superset?.trim() || null;
          const inGroup = g != null && (g === prev || g === next);
          return (
          <Fragment key={xi}>
          {inGroup && g !== prev && (
            <div className="border-l-[3px] border-primary bg-primary/[0.05] px-3.5 pt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
              Superserie {g} · sin descanso entre ejercicios
            </div>
          )}
          <ExerciseRow
            b={b}
            x={x}
            xi={xi}
            dayIdx={dayIdx}
            count={day.exercises.length}
            inGroup={inGroup}
            weekRir={weekRir}
            dropHere={over === xi}
            onDragOver={(e) => allowDrop(e, xi)}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              onDropAt(e, xi);
            }}
            onMove={onMove}
          />
          </Fragment>
          );
        })}

        <button
          type="button"
          onClick={() => b.updDay(dayIdx, { exercises: [...day.exercises, emptyEx()] })}
          onDragOver={(e) => allowDrop(e, 'end')}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            setOver(null);
            onDropAt(e);
          }}
          className={cn(
            'm-3 flex h-12 w-[calc(100%-1.5rem)] items-center justify-center gap-2 border-2 border-dashed text-[12px] font-extrabold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            over === 'end' ? 'border-primary bg-primary/10 text-foreground' : 'border-border-strong text-muted-foreground hover:border-primary',
          )}
        >
          <Plus className="h-4 w-4 text-primary" strokeWidth={2.5} /> Suelta aquí o añade una fila
        </button>
      </div>
    </div>
  );
}

function ExerciseRow({
  b,
  x,
  xi,
  dayIdx,
  count,
  inGroup,
  weekRir,
  dropHere,
  onDragOver,
  onDragLeave,
  onDrop,
  onMove,
}: {
  b: ProgramBuilderState;
  x: ExRow;
  xi: number;
  dayIdx: number;
  count: number;
  inGroup: boolean;
  weekRir: string;
  dropHere: boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onMove: (from: number, to: number) => void;
}) {
  const upd = (patch: Partial<ExRow>) => b.updEx(dayIdx, xi, patch);
  const catalogHit = b.byName.get(x.name.trim().toLowerCase());
  const rirInherited = !x.rirMin.trim() && !x.rirMax.trim() && weekRir !== '—';
  const [rirLo, rirHi] = weekRir.includes('–') ? weekRir.split('–') : [weekRir, weekRir];
  const qual = LOAD_QUAL.find((l) => l.value === x.loadQual && l.value)?.label;
  const adjusted = overriddenWeeks(x, b.weeksN);
  const [editWeek, setEditWeek] = useState<number | null>(null);

  /** Put this row and the next one in the same superset (reusing a letter
   *  either already has, else the first one free in the day). */
  const linkWithNext = () => {
    const rows = [...b.days[dayIdx].exercises];
    const next = rows[xi + 1];
    if (!next) return;
    const used = new Set(rows.map((r) => r.superset?.trim()).filter(Boolean));
    const letter = x.superset?.trim() || next.superset?.trim() || SUPERSET_LETTERS.find((l) => !used.has(l)) || 'A';
    rows[xi] = { ...rows[xi], superset: letter };
    rows[xi + 1] = { ...next, superset: letter };
    b.updDay(dayIdx, { exercises: rows });
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'border-b border-border',
        inGroup && 'border-l-[3px] border-l-primary bg-primary/[0.05]',
        dropHere && 'shadow-[inset_0_3px_0_hsl(var(--primary))]',
        x.advOpen && 'bg-muted/30',
      )}
    >
      <div className={cn(ROW_GRID, 'px-3.5 py-2')}>
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DT_ROW, String(xi));
            e.dataTransfer.effectAllowed = 'move';
          }}
          title="Arrastra para reordenar"
          className="flex cursor-grab items-center text-faint active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="font-poster text-[17px] leading-none text-muted-foreground">{xi + 1}</span>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <ExerciseCombobox
              aria-label={`Ejercicio ${xi + 1}`}
              catalog={b.catalog}
              placeholder={b.catalog === null ? 'Cargando…' : 'Buscar ejercicio…'}
              inputClassName="h-8 text-[13px] font-semibold"
              value={x.name}
              onChange={(v) => upd({ name: v })}
              disabled={b.catalog === null}
            />
            <div className="mt-0.5 flex gap-1.5 text-[10.5px] text-faint">
              <span>{x.name.trim() ? (catalogHit ? bodyPartLabel(catalogHit.body_part?.name) : 'Personalizado') : ''}</span>
              {x.unilateral && <span className="bg-muted px-1 font-extrabold uppercase tracking-[0.06em] text-muted-foreground">Por lado</span>}
              {qual && <span>· {qual}</span>}
              {x.tempo.trim() && <span>· tempo {x.tempo.trim()}</span>}
              {x.notes.trim() && <span>· nota</span>}
              {adjusted.length > 0 && (
                <span className="font-bold text-warning">· ajustes {adjusted.map((w) => `S${w}`).join(', ')}</span>
              )}
            </div>
          </div>
        </div>
        <input className={CELL} type="number" min={1} max={20} aria-label="Series" value={x.sets} onChange={(e) => upd({ sets: e.target.value })} />
        <div className="flex items-center gap-1">
          <input className={CELL} type="number" min={1} max={100} aria-label="Repeticiones mínimas" value={x.repMin} onChange={(e) => upd({ repMin: e.target.value })} />
          <span className="text-faint">–</span>
          <input className={CELL} type="number" min={1} max={100} aria-label="Repeticiones máximas" value={x.repMax} onChange={(e) => upd({ repMax: e.target.value })} />
        </div>
        <div className="flex items-center gap-1">
          <input
            className={cn(CELL, rirInherited && 'border-dashed')}
            type="number"
            min={0}
            max={10}
            aria-label="RIR mínimo"
            placeholder={rirInherited ? rirLo : '—'}
            value={x.rirMin}
            onChange={(e) => upd({ rirMin: e.target.value })}
          />
          <span className="text-faint">–</span>
          <input
            className={cn(CELL, rirInherited && 'border-dashed')}
            type="number"
            min={0}
            max={10}
            aria-label="RIR máximo"
            placeholder={rirInherited ? rirHi : '—'}
            value={x.rirMax}
            onChange={(e) => upd({ rirMax: e.target.value })}
          />
        </div>
        <input className={CELL} type="number" min={1} max={100} aria-label="% de 1RM" placeholder="—" value={x.loadPct} onChange={(e) => upd({ loadPct: e.target.value })} />
        <input className={CELL} type="number" min={0} max={900} aria-label="Descanso en segundos" placeholder="—" value={x.rest} onChange={(e) => upd({ rest: e.target.value })} />
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={() => upd({ advOpen: !x.advOpen })}
            aria-expanded={x.advOpen}
            aria-label={x.advOpen ? 'Ocultar opciones' : 'Más opciones'}
            className="flex h-8 w-7 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {x.advOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() =>
              b.updDay(dayIdx, {
                exercises: count > 1 ? b.days[dayIdx].exercises.filter((_, k) => k !== xi) : [emptyEx()],
              })
            }
            aria-label={`Quitar ejercicio ${xi + 1}`}
            className="flex h-8 w-7 items-center justify-center text-faint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {x.advOpen && (
        <div className="flex flex-wrap items-end gap-3 px-3.5 pb-3 pl-[64px]">
          <div className="flex flex-col gap-1">
            <span className={CAPS}>Carga</span>
            <select className={NATIVE_SELECT} aria-label="Carga cualitativa" value={x.loadQual} onChange={(e) => upd({ loadQual: e.target.value })}>
              {LOAD_QUAL.map((l) => (
                <option key={l.value || 'none'} value={l.value}>
                  {l.value ? l.label : 'Sin indicar'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>Tempo</span>
            <Input className="h-8 w-24" aria-label="Tempo" placeholder="3-1-1" value={x.tempo} onChange={(e) => upd({ tempo: e.target.value })} />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className={CAPS}>Nota para el cliente</span>
            <Input className="h-8" aria-label="Nota para el cliente" placeholder="Ej. Paso largo, torso algo inclinado" value={x.notes} onChange={(e) => upd({ notes: e.target.value })} />
          </div>
          <label className="flex h-8 cursor-pointer items-center gap-2 border border-border bg-field px-2.5 text-[12px] font-bold uppercase tracking-[0.08em]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
              checked={x.unilateral}
              onChange={(e) => upd({ unilateral: e.target.checked })}
            />
            Por lado
          </label>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>Superserie</span>
            <div className="flex gap-1">
              <select
                className={NATIVE_SELECT}
                aria-label="Superserie"
                value={x.superset ?? ''}
                onChange={(e) => upd({ superset: e.target.value })}
              >
                <option value="">Ninguna</option>
                {SUPERSET_LETTERS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" disabled={xi === count - 1} onClick={linkWithNext} title="Hacer superserie con el siguiente ejercicio">
                <Link2 className="h-3.5 w-3.5" /> Unir con el siguiente
              </Button>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label="Subir" disabled={xi === 0} onClick={() => onMove(xi, xi - 1)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Bajar" disabled={xi === count - 1} onClick={() => onMove(xi, xi + 2)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Duplicar ejercicio"
              onClick={() => {
                const rows = [...b.days[dayIdx].exercises];
                rows.splice(xi + 1, 0, { ...withoutId(x), advOpen: false });
                b.updDay(dayIdx, { exercises: rows });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <WeekOverrides
            x={x}
            weeks={b.weeksN}
            editWeek={editWeek}
            onEditWeek={setEditWeek}
            onChange={(w, o) => upd({ overrides: { ...(x.overrides ?? {}), [String(w)]: o } })}
          />
        </div>
      )}
    </div>
  );
}

/** "Ajuste por semana": this exercise's own values for chosen weeks (e.g. 4
 *  sets in week 3). Empty fields fall back to the base row / week. */
function WeekOverrides({
  x,
  weeks,
  editWeek,
  onEditWeek,
  onChange,
}: {
  x: ExRow;
  weeks: number;
  editWeek: number | null;
  onEditWeek: (w: number | null) => void;
  onChange: (week: number, o: OverrideRow) => void;
}) {
  const o = editWeek != null ? (x.overrides?.[String(editWeek)] ?? emptyOverride()) : null;
  const field = (k: keyof OverrideRow, label: string, placeholder: string) => (
    <input
      className={cn(CELL, 'w-12')}
      type="number"
      aria-label={`Semana ${editWeek}: ${label}`}
      placeholder={placeholder}
      value={o![k]}
      onChange={(e) => onChange(editWeek!, { ...o!, [k]: e.target.value })}
    />
  );

  return (
    <div className="flex w-full flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn(CAPS, 'mr-1')}>Ajuste por semana</span>
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
          const has = overrideHasData(x.overrides?.[String(w)]);
          return (
            <button
              key={w}
              type="button"
              aria-pressed={editWeek === w}
              onClick={() => onEditWeek(editWeek === w ? null : w)}
              className={cn(
                'h-8 min-w-10 border px-2 text-[12px] font-extrabold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                editWeek === w
                  ? 'border-primary bg-primary text-primary-foreground'
                  : has
                    ? 'border-warning bg-warning/15 text-warning'
                    : 'border-border bg-field text-muted-foreground hover:border-border-strong',
              )}
            >
              S{w}
            </button>
          );
        })}
      </div>
      {o && editWeek != null && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className={CAPS}>Series</span>
            {field('sets', 'series', x.sets || '—')}
          </div>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>Reps</span>
            <div className="flex items-center gap-1">
              {field('repMin', 'repeticiones mínimas', x.repMin || '—')}
              <span className="text-faint">–</span>
              {field('repMax', 'repeticiones máximas', x.repMax || '—')}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>RIR</span>
            <div className="flex items-center gap-1">
              {field('rirMin', 'RIR mínimo', x.rirMin || '—')}
              <span className="text-faint">–</span>
              {field('rirMax', 'RIR máximo', x.rirMax || '—')}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={CAPS}>%1RM</span>
            {field('loadPct', '% de 1RM', x.loadPct || '—')}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(editWeek, emptyOverride())} disabled={!overrideHasData(o)}>
            Quitar ajuste S{editWeek}
          </Button>
          <span className="text-[11.5px] text-faint">Lo que dejes vacío usa los valores de la fila.</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ volume */

function VolumeCard({ b, dayIdx, week, weekNumber }: { b: ProgramBuilderState; dayIdx: number; week: WeekRow | undefined; weekNumber: number }) {
  const override = week ? toInt(week.setsOverride) : null;

  const tally = (days: DayRow[]) => {
    const m = new Map<string, number>();
    for (const d of days) {
      for (const x of d.exercises) {
        if (!x.name.trim()) continue;
        const part = bodyPartLabel(b.byName.get(x.name.trim().toLowerCase())?.body_part?.name);
        const sets = toInt(x.overrides?.[String(weekNumber)]?.sets ?? '') ?? override ?? toInt(x.sets) ?? 0;
        m.set(part, (m.get(part) ?? 0) + sets);
      }
    }
    return [...m.entries()].sort((a, c) => c[1] - a[1]);
  };

  const dayRows = tally([b.days[dayIdx]]);
  const weekRows = tally(b.days);
  if (weekRows.length === 0) return null;
  const max = Math.max(...weekRows.map(([, n]) => n));

  return (
    <section aria-label="Series por grupo muscular" className="flex flex-wrap gap-6 border border-border bg-card p-4">
      <VolumeBars rows={dayRows} max={max} title={`Día ${dayIdx + 1}`} />
      <VolumeBars rows={weekRows} max={max} title="Semana completa" />
    </section>
  );
}

function VolumeBars({ rows, max, title }: { rows: [string, number][]; max: number; title: string }) {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
      <div className="flex justify-between">
        <span className={CAPS}>{title}</span>
        <span className="text-[11.5px] font-extrabold tabular-nums">{rows.reduce((a, [, n]) => a + n, 0)} series</span>
      </div>
      {rows.map(([part, n]) => (
        <div key={part} className="flex items-center gap-2 text-[12px]">
          <span className="w-24 truncate text-muted-foreground">{part}</span>
          <span className="h-2 flex-1 bg-field">
            <span className="block h-2 bg-secondary" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="w-6 text-right font-bold tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}
