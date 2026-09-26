/**
 * DEPRECATED — the original 4-step program wizard, kept for the "Clásico
 * (legacy)" panel style (Ajustes → Estilo del panel). The default builder is
 * ProgramWorkspace; both share useProgramBuilder, so they save identically.
 * Don't add features here; this goes away with the legacy style.
 */
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, RotateCcw, Smartphone, Trash2, X } from 'lucide-react';
import type { ProgramStatus } from '@/types';
import { ExerciseCombobox } from '@/components/shared/ExerciseCombobox';
import { cn, fmtDate } from '@/lib/utils';
import { draftAge } from '@/lib/programDraft';
import { STATUS_LABEL } from '@/lib/programStatus';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import {
  advSummary,
  emptyDay,
  emptyEx,
  exExtras,
  LOAD_QUAL,
  rangeText,
  STATUSES,
  todayISO,
  weekdayLabel,
  weekHasData,
  WEEKDAYS,
} from '@/components/program/builderModel';
import { useProgramBuilder, type ProgramBuilderProps } from '@/components/program/useProgramBuilder';

const WIZARD_STEPS = ['Datos', 'Días y ejercicios', 'Periodización', 'Revisar'] as const;

const NUM = 'h-8 w-full rounded-md border border-border bg-card px-1.5 text-center text-[12.5px]';
const NUM_SM = 'h-8 w-10 rounded-md border border-border bg-card px-1 text-center text-[12.5px]';
const WEEK_GRID =
  'grid items-center gap-2 [grid-template-columns:38px_minmax(110px,1.4fr)_104px_104px_50px_48px]';

/* ---- small building blocks ---- */
function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
/** A labelled control. The label rides with its field, so nothing can drift out
 *  of alignment the way a shared header row does. */
function FieldCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      {children}
    </div>
  );
}
function Disclosure({
  open,
  onToggle,
  label,
  className = '',
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 font-semibold text-secondary transition-colors hover:text-secondary/80 focus-visible:outline-none ${className}`}
    >
      {open ? (
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      )}
      {label}
    </button>
  );
}
function RangePair({
  min,
  max,
  onMin,
  onMax,
  labelMin,
  labelMax,
}: {
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  labelMin: string;
  labelMax: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input className={NUM_SM} aria-label={labelMin} type="number" value={min} onChange={(e) => onMin(e.target.value)} />
      <span className="text-faint">–</span>
      <input className={NUM_SM} aria-label={labelMax} type="number" value={max} onChange={(e) => onMax(e.target.value)} />
    </div>
  );
}
function Stepper({
  step,
  maxStep,
  onStep,
}: {
  step: number;
  maxStep: number;
  onStep: (s: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {WIZARD_STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        const reachable = i <= maxStep;
        return (
          <button
            key={label}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onStep(i)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                : reachable
                  ? 'text-muted-foreground hover:bg-muted'
                  : 'cursor-default text-faint',
            )}
          >
            <span
              className={cn(
                'flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold',
                active ? 'bg-primary text-white' : done ? 'bg-secondary text-white' : 'border border-border-strong text-faint',
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function LegacyProgramBuilder(props: ProgramBuilderProps) {
  const { initial, onClose } = props;
  const {
    isTemplate,
    firstName,
    catalog,
    restored,
    draftDismissed,
    discardDraft,
    name,
    setName,
    focus,
    setFocus,
    description,
    setDescription,
    durationWeeks,
    setDuration,
    startDate,
    setStartDate,
    status,
    setStatus,
    progressionRule,
    setProgressionRule,
    tempoDefault,
    setTempoDefault,
    notes,
    setNotes,
    days,
    setDays,
    weeks,
    updDay,
    updEx,
    updWeek,
    saving,
    submit: save,
    weeksN,
    summaryText,
    saveLabel,
    preview,
  } = useProgramBuilder(props);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [headerAdv, setHeaderAdv] = useState(
    !!(initial?.progression_rule || initial?.tempo_default || initial?.description || initial?.notes),
  );
  // Wizard: one focused step at a time. On edit, jump straight to review so a
  // coach tweaking a program isn't walked through every step.
  const [step, setStep] = useState(initial ? WIZARD_STEPS.length - 1 : 0);
  const [maxStep, setMaxStep] = useState(initial ? WIZARD_STEPS.length - 1 : 0);

  const step0Valid = name.trim() !== '';
  const step1Valid = days.some((d) => d.exercises.some((x) => x.name.trim()));

  const goTo = (s: number) => {
    setStep(s);
    setMaxStep((m) => Math.max(m, s));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNext = () => {
    if (step === 0 && !step0Valid) return toast.error('Ponle nombre al programa');
    if (step === 1 && !step1Valid) return toast.error('Añade al menos un día con un ejercicio');
    goTo(Math.min(WIZARD_STEPS.length - 1, step + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const submit = () => save((where) => goTo(where.step));

  const isLast = step === WIZARD_STEPS.length - 1;

  return (
    <Card className="animate-fade-up overflow-hidden border-[1.5px] border-primary p-0">
      {/* Header + stepper */}
      <div className="border-b border-border px-[22px] py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-heading text-[15px] font-semibold">
            {isTemplate
              ? initial
                ? 'Editar plantilla'
                : 'Nueva plantilla'
              : initial
                ? 'Editar programa'
                : 'Nuevo programa'}
            <span className="ml-1.5 text-[13px] font-normal text-faint">
              {isTemplate ? '· reutilizable' : `· para ${firstName}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Smartphone className="h-3.5 w-3.5" strokeWidth={2} /> Vista previa
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
        <Stepper step={step} maxStep={maxStep} onStep={goTo} />
      </div>

      {/* Recovered autosave — the coach should know why fields are pre-filled,
          and be able to throw it away. */}
      {restored != null && !draftDismissed && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-secondary/30 bg-secondary/[0.07] px-[22px] py-2 text-[12.5px]">
          <RotateCcw className="h-3.5 w-3.5 flex-none text-secondary" strokeWidth={2} />
          <span className="text-muted-foreground">
            Recuperamos un borrador sin guardar de{' '}
            <span className="font-semibold text-foreground">{draftAge(restored.savedAt)}</span>.
          </span>
          <button
            type="button"
            onClick={() => {
              discardDraft();
              setStep(0);
            }}
            className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Descartar borrador
          </button>
        </div>
      )}

      <div className="p-[22px]">
        {/* Step 1 · Datos */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <p className="text-[12.5px] text-faint">Lo básico del bloque. Solo el nombre es obligatorio.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" htmlFor="pb-name">
                <Input
                  id="pb-name"
                  placeholder="Ej. Hipertrofia — Glúteos y Piernas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Enfoque" htmlFor="pb-focus">
                <Input id="pb-focus" placeholder="Ej. Glúteos y Piernas" value={focus} onChange={(e) => setFocus(e.target.value)} />
              </Field>
            </div>
            {/* Sized to content — a week count and a date don't need a third of
                the row apiece; only text fields (name/focus) earn full width. */}
            <div className="flex flex-wrap gap-3">
              <Field label="Duración" htmlFor="pb-weeks" className="w-28">
                <div className="relative">
                  <Input
                    id="pb-weeks"
                    type="number"
                    min={1}
                    max={52}
                    className="pr-11"
                    value={durationWeeks}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-faint">
                    sem.
                  </span>
                </div>
              </Field>
              {/* A template has no client, so no start date or status — those
                  are decided when it's assigned. */}
              {!isTemplate && (
                <>
                  <Field label="Inicio" htmlFor="pb-start" className="w-40">
                    <Input
                      id="pb-start"
                      type="date"
                      // Guard past dates only when creating; editing a running
                      // block must keep its original (possibly past) start.
                      min={initial ? undefined : todayISO()}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Estado" htmlFor="pb-status" className="w-40">
                    <Select value={status} onValueChange={(v) => setStatus(v as ProgramStatus)}>
                      <SelectTrigger id="pb-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}
            </div>
            <div>
              <Disclosure
                open={headerAdv}
                onToggle={() => setHeaderAdv((v) => !v)}
                label="Progresión, tempo y notas (opcional)"
                className="text-[12.5px]"
              />
              {headerAdv && (
                <div className="mt-3 grid gap-3">
                  <Field label="Regla de progresión" htmlFor="pb-prog">
                    <Input
                      id="pb-prog"
                      placeholder="Ej. Doble progresión: sube peso al llegar a 8 reps"
                      value={progressionRule}
                      onChange={(e) => setProgressionRule(e.target.value)}
                    />
                  </Field>
                  <Field label="Tempo por defecto" htmlFor="pb-tempo">
                    <Input
                      id="pb-tempo"
                      placeholder="Ej. Excéntrica 2-3s / concéntrica explosiva"
                      value={tempoDefault}
                      onChange={(e) => setTempoDefault(e.target.value)}
                    />
                  </Field>
                  <Field label="Descripción" htmlFor="pb-desc">
                    <Input
                      id="pb-desc"
                      placeholder="Resumen breve del bloque…"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Field>
                  <Field label="Notas del programa" htmlFor="pb-notes">
                    <Textarea
                      id="pb-notes"
                      rows={2}
                      placeholder="Ej. Cardio 20 min postentreno"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2 · Días y ejercicios */}
        {step === 1 && (
          <div className="flex flex-col gap-3.5">
            <p className="text-[12.5px] text-faint">
              Arma el split. Cada ejercicio necesita solo series y repeticiones — abre “Avanzado” si quieres fijar RIR,
              %1RM, tempo o notas.
            </p>
            {days.map((day, di) => (
              <div key={di} className="rounded-xl border border-border bg-muted/40 p-3.5">
                <div className="mb-3 grid gap-2 sm:grid-cols-[auto_1fr_150px_auto]">
                  <span className="flex h-9 items-center rounded-lg bg-primary/10 px-3 text-[12px] font-bold text-primary dark:bg-primary/15">
                    Día {di + 1}
                  </span>
                  <Input
                    aria-label={`Etiqueta del día ${di + 1}`}
                    placeholder="Etiqueta del día — Ej. Pecho + Bíceps"
                    className="h-9 text-[13px]"
                    value={day.label}
                    onChange={(e) => updDay(di, { label: e.target.value })}
                  />
                  <Select value={day.weekday} onValueChange={(v) => updDay(di, { weekday: v })}>
                    <SelectTrigger className="h-9 text-[13px]" aria-label="Día de la semana">
                      <SelectValue placeholder="Sin día fijo" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((w) => (
                        <SelectItem key={w.value || 'none'} value={w.value}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => days.length > 1 && setDays((ds) => ds.filter((_, i) => i !== di))}
                    aria-label={`Quitar día ${di + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>

                {/* One card per exercise. Labels sit ON each field instead of in
                    a shared header row — that row could never line up with the
                    bordered rows beneath it, and it forced a 500px min-width. */}
                <div className="flex flex-col gap-2">
                  {day.exercises.map((ex, xi) => {
                    const adv = advSummary(ex);
                    return (
                      <div key={xi} className="rounded-xl border border-border bg-card p-3">
                        {/* Name — the row's headline, on its own line */}
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
                            {xi + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <ExerciseCombobox
                              aria-label="Ejercicio"
                              catalog={catalog}
                              placeholder={catalog === null ? 'Cargando…' : 'Buscar ejercicio…'}
                              inputClassName="h-9 text-[13.5px] font-medium"
                              value={ex.name}
                              onChange={(v) => updEx(di, xi, { name: v })}
                              disabled={catalog === null}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              day.exercises.length > 1 &&
                              updDay(di, { exercises: day.exercises.filter((_, k) => k !== xi) })
                            }
                            aria-label="Quitar ejercicio"
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </div>

                        {/* Prescription — wraps instead of scrolling sideways */}
                        <div className="mt-2.5 flex flex-wrap items-end gap-2 pl-[34px]">
                          <FieldCell label="Series" className="w-[72px]">
                            <input
                              className={NUM}
                              aria-label="Series"
                              type="number"
                              min={1}
                              value={ex.sets}
                              onChange={(e) => updEx(di, xi, { sets: e.target.value })}
                            />
                          </FieldCell>
                          <FieldCell label="Reps" className="w-[124px]">
                            <RangePair
                              min={ex.repMin}
                              max={ex.repMax}
                              onMin={(v) => updEx(di, xi, { repMin: v })}
                              onMax={(v) => updEx(di, xi, { repMax: v })}
                              labelMin="Rep min"
                              labelMax="Rep max"
                            />
                          </FieldCell>
                          <FieldCell label="Descanso" className="w-[92px]">
                            <div className="relative">
                              <input
                                className={`${NUM} pr-6 text-left`}
                                aria-label="Descanso en segundos"
                                type="number"
                                min={0}
                                value={ex.rest}
                                onChange={(e) => updEx(di, xi, { rest: e.target.value })}
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-faint">
                                s
                              </span>
                            </div>
                          </FieldCell>
                          <FieldCell label="Carga" className="w-[148px]">
                            <Select value={ex.loadQual} onValueChange={(v) => updEx(di, xi, { loadQual: v })}>
                              <SelectTrigger className="h-8 text-[12.5px]" aria-label="Carga">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {LOAD_QUAL.map((l) => (
                                  <SelectItem key={l.value || 'none'} value={l.value}>
                                    {l.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FieldCell>
                        </div>

                        {/* Advanced — one word, plus a summary so values hidden
                            behind the collapse are never invisible. */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[34px]">
                          <Disclosure
                            open={ex.advOpen}
                            onToggle={() => updEx(di, xi, { advOpen: !ex.advOpen })}
                            label="Avanzado"
                            className="text-[11.5px]"
                          />
                          {!ex.advOpen && adv !== '' && (
                            <span className="truncate text-[11.5px] text-faint">{adv}</span>
                          )}
                        </div>

                        {ex.advOpen && (
                          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2.5 pl-3">
                            <FieldCell label="RIR" className="w-[124px]">
                              <RangePair
                                min={ex.rirMin}
                                max={ex.rirMax}
                                onMin={(v) => updEx(di, xi, { rirMin: v })}
                                onMax={(v) => updEx(di, xi, { rirMax: v })}
                                labelMin="RIR min"
                                labelMax="RIR max"
                              />
                            </FieldCell>
                            <FieldCell label="%1RM" className="w-[76px]">
                              <input
                                className={NUM}
                                aria-label="%1RM"
                                type="number"
                                min={1}
                                max={100}
                                value={ex.loadPct}
                                onChange={(e) => updEx(di, xi, { loadPct: e.target.value })}
                              />
                            </FieldCell>
                            <FieldCell label="Tempo" className="w-[96px]">
                              <Input
                                className="h-8 text-[12.5px]"
                                placeholder="3-1-1"
                                value={ex.tempo}
                                onChange={(e) => updEx(di, xi, { tempo: e.target.value })}
                              />
                            </FieldCell>
                            <FieldCell label="Notas" className="min-w-[180px] flex-1">
                              <Input
                                className="h-8 text-[12.5px]"
                                placeholder="Nota del ejercicio…"
                                value={ex.notes}
                                onChange={(e) => updEx(di, xi, { notes: e.target.value })}
                              />
                            </FieldCell>
                            {/* Checkbox reads as a toggle, not a mystery box */}
                            <label className="flex h-8 flex-none cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                                checked={ex.unilateral}
                                onChange={(e) => updEx(di, xi, { unilateral: e.target.checked })}
                              />
                              Por lado
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => updDay(di, { exercises: [...day.exercises, emptyEx()] })}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2 text-[12px] font-semibold text-secondary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3 w-3" strokeWidth={2.5} /> Añadir ejercicio
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDays((ds) => [...ds, emptyDay()])}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong py-3 text-[12.5px] font-semibold text-secondary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Añadir día
            </button>
          </div>
        )}

        {/* Step 3 · Periodización (optional) */}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-secondary/30 bg-secondary/[0.06] p-3.5 text-[12.5px] text-muted-foreground">
              <span className="font-semibold text-secondary">Opcional.</span> Define cómo cambian RIR y % de carga
              cada semana, y marca las semanas de descarga. Si lo dejas en blanco, el cliente verá la misma
              prescripción todas las semanas.
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[540px]">
                <div className={`${WEEK_GRID} px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-faint`}>
                  <span className="text-center">Sem</span>
                  <span>Etiqueta</span>
                  <span className="text-center">RIR</span>
                  <span className="text-center">% Carga</span>
                  <span className="text-center">Series</span>
                  <span className="text-center">Desc.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {weeks.map((w, wi) => (
                    <div key={wi} className={`${WEEK_GRID} rounded-lg py-1 ${w.isDeload ? 'bg-primary/[0.06]' : ''}`}>
                      <span
                        className={`text-center text-[12.5px] font-bold ${w.isDeload ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        {wi + 1}
                      </span>
                      <Input
                        className="h-8 text-[12.5px]"
                        placeholder="Ej. Base / Acumula"
                        value={w.label}
                        onChange={(e) => updWeek(wi, { label: e.target.value })}
                      />
                      <RangePair
                        min={w.rirMin}
                        max={w.rirMax}
                        onMin={(v) => updWeek(wi, { rirMin: v })}
                        onMax={(v) => updWeek(wi, { rirMax: v })}
                        labelMin={`Semana ${wi + 1} RIR min`}
                        labelMax={`Semana ${wi + 1} RIR max`}
                      />
                      <RangePair
                        min={w.loadMin}
                        max={w.loadMax}
                        onMin={(v) => updWeek(wi, { loadMin: v })}
                        onMax={(v) => updWeek(wi, { loadMax: v })}
                        labelMin={`Semana ${wi + 1} carga min`}
                        labelMax={`Semana ${wi + 1} carga max`}
                      />
                      <input
                        className={NUM}
                        aria-label={`Semana ${wi + 1} series`}
                        type="number"
                        placeholder="—"
                        value={w.setsOverride}
                        onChange={(e) => updWeek(wi, { setsOverride: e.target.value })}
                      />
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Semana ${wi + 1} es descarga`}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          checked={w.isDeload}
                          onChange={(e) => updWeek(wi, { isDeload: e.target.checked })}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 · Revisar */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-[12.5px] text-faint">Revisa y asigna. Puedes volver a cualquier paso para ajustar.</p>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[15px] font-semibold">{name.trim() || 'Programa sin nombre'}</span>
                <span className="rounded-full bg-primary/10 px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide text-primary dark:bg-primary/15">
                  {STATUS_LABEL[status]}
                </span>
              </div>
              {focus.trim() && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{focus}</div>}
              <div className="mt-1 text-[12px] text-faint">
                {weeksN} {weeksN === 1 ? 'semana' : 'semanas'} · inicio {fmtDate(startDate)}
              </div>
              {progressionRule.trim() && (
                <p className="mt-2 text-[12px] text-faint">
                  <span className="font-semibold text-muted-foreground">Progresión: </span>
                  {progressionRule}
                </p>
              )}
              {notes.trim() && <p className="mt-1 text-[12px] text-faint">{notes}</p>}
            </div>

            {days.map((d, di) => {
              const filled = d.exercises.filter((x) => x.name.trim());
              if (filled.length === 0) return null;
              return (
                <div key={di} className="rounded-xl border border-border p-4">
                  <div className="text-[13px] font-semibold">
                    Día {di + 1}
                    {d.label.trim() && ` · ${d.label.trim()}`}
                    {d.weekday && <span className="text-faint"> · {weekdayLabel(d.weekday)}</span>}
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {filled.map((x, xi) => {
                      const extras = exExtras(x);
                      return (
                        <div key={xi} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12.5px]">
                          <span className="font-medium">
                            {x.name}
                            {x.unilateral && <span className="text-faint"> (por lado)</span>}
                          </span>
                          <span className="text-muted-foreground">
                            {x.sets}×{rangeText(x.repMin, x.repMax)}
                            {extras && <span className="text-faint"> · {extras}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-border p-4 text-[12.5px]">
              <div className="mb-1 font-semibold text-muted-foreground">Periodización semanal</div>
              {weeks.some(weekHasData) ? (
                <div className="flex flex-col gap-1">
                  {weeks.map((w, wi) => {
                    if (!weekHasData(w)) return null;
                    const bits: string[] = [];
                    const rir = rangeText(w.rirMin, w.rirMax);
                    if (rir !== '—') bits.push(`RIR ${rir}`);
                    const load = rangeText(w.loadMin, w.loadMax);
                    if (load !== '—') bits.push(`${load}%`);
                    if (w.setsOverride.trim()) bits.push(`${w.setsOverride} series`);
                    if (w.isDeload) bits.push('descarga');
                    return (
                      <div key={wi} className="flex justify-between gap-3 text-faint">
                        <span className="font-medium text-muted-foreground">
                          Sem {wi + 1}
                          {w.label.trim() && ` · ${w.label.trim()}`}
                        </span>
                        <span>{bits.join(' · ') || '—'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-faint">Sin periodización — misma prescripción todas las semanas.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-[22px] py-3.5">
        {step > 0 ? (
          <Button variant="outline" size="sm" onClick={goBack}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} /> Atrás
          </Button>
        ) : (
          <span className="text-[12px] text-faint">{summaryText}</span>
        )}
        <div className="flex items-center gap-3">
          {step > 0 && <span className="hidden text-[12px] text-faint sm:inline">{summaryText}</span>}
          {isLast ? (
            <Button size="sm" onClick={() => void submit()} disabled={saving || catalog === null}>
              {saveLabel}
            </Button>
          ) : (
            <Button size="sm" onClick={goNext}>
              Siguiente <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Button>
          )}
        </div>
      </div>

      {/* Live preview of the CURRENT draft — no need to save first. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vista previa · app del cliente</DialogTitle>
          </DialogHeader>
          <p className="-mt-1 text-[12px] text-muted-foreground">
            Así verá {isTemplate ? 'el cliente' : firstName} este bloque. Toca las semanas para
            comprobar la periodización.
          </p>
          <MobileProgramPreview program={preview} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
