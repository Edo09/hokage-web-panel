import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import type { ClientWithMeta, Exercise, LoadQualitative, ProgramStatus, ProgramWithDetail } from '@/types';
import {
  createProgram,
  createTemplate,
  updateProgram,
  updateTemplate,
  type ProgramDayInput,
  type SaveProgramInput,
} from '@/services/programs';
import { listExercises } from '@/services/exercises';
import { ExerciseCombobox } from '@/components/shared/ExerciseCombobox';
import { cn, fmtDate } from '@/lib/utils';
import { errorMessage } from '@/lib/dbError';
import { clearDraft, draftAge, draftKey, loadDraft, saveDraft } from '@/lib/programDraft';
import { STATUS_LABEL } from '@/lib/programStatus';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import { draftToPreview } from '@/components/program/previewModel';

/* Stored lowercase English; UI shows Spanish. '' = "Día N" only (no weekday). */
const WEEKDAYS: { value: string; label: string }[] = [
  { value: '', label: 'Sin día fijo' },
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];
const weekdayLabel = (v: string): string => WEEKDAYS.find((w) => w.value === v)?.label ?? '';

const STATUSES: { value: ProgramStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
];

const LOAD_QUAL: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'light', label: 'Ligero' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'heavy', label: 'Pesado' },
];
const loadQualLabel = (v: string): string => LOAD_QUAL.find((l) => l.value === v)?.label ?? '';

const WIZARD_STEPS = ['Datos', 'Días y ejercicios', 'Periodización', 'Revisar'] as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const toInt = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const v = parseInt(t, 10);
  return Number.isFinite(v) ? v : null;
};
const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
// New client programs default to starting tomorrow: the write-time trigger
// rejects a start_date before the server's current_date, and a same-day
// default can land in the past across the UTC boundary.
const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const rangeText = (min: string, max: string): string => {
  const a = min.trim();
  const b = max.trim();
  if (a && b) return a === b ? a : `${a}–${b}`;
  return a || b || '—';
};

/* ---- builder row models (all strings; parsed at submit) ---- */
interface ExRow {
  name: string;
  sets: string;
  repMin: string;
  repMax: string;
  unilateral: boolean;
  rirMin: string;
  rirMax: string;
  loadPct: string;
  loadQual: string;
  tempo: string;
  rest: string;
  notes: string;
  /** UI-only: whether the row's advanced disclosure is expanded. Not sent. */
  advOpen: boolean;
}
interface DayRow {
  label: string;
  weekday: string;
  exercises: ExRow[];
}
interface WeekRow {
  label: string;
  rirMin: string;
  rirMax: string;
  loadMin: string;
  loadMax: string;
  isDeload: boolean;
  setsOverride: string;
  notes: string;
}

const emptyEx = (): ExRow => ({
  name: '',
  sets: '4',
  repMin: '8',
  repMax: '12',
  unilateral: false,
  rirMin: '',
  rirMax: '',
  loadPct: '',
  loadQual: '',
  tempo: '',
  rest: '90',
  notes: '',
  advOpen: false,
});
const emptyDay = (): DayRow => ({ label: '', weekday: '', exercises: [emptyEx()] });
const emptyWeek = (): WeekRow => ({
  label: '',
  rirMin: '',
  rirMax: '',
  loadMin: '',
  loadMax: '',
  isDeload: false,
  setsOverride: '',
  notes: '',
});

const resizeWeeks = (prev: WeekRow[], n: number): WeekRow[] => {
  if (prev.length === n) return prev;
  if (prev.length < n) return [...prev, ...Array.from({ length: n - prev.length }, emptyWeek)];
  return prev.slice(0, n);
};

/** A short one-liner of a row's extra prescription for the review step. */
const exExtras = (x: ExRow): string => {
  const parts: string[] = [];
  if (x.loadQual) parts.push(loadQualLabel(x.loadQual));
  if (x.loadPct.trim()) parts.push(`${x.loadPct}% 1RM`);
  const rir = rangeText(x.rirMin, x.rirMax);
  if (rir !== '—') parts.push(`RIR ${rir}`);
  if (x.unilateral) parts.push('por lado');
  if (x.rest.trim()) parts.push(`desc. ${x.rest}s`);
  return parts.join(' · ');
};
/** What's set behind a collapsed "Avanzado" — shown next to the toggle so
 *  configured values are never invisible. */
const advSummary = (x: ExRow): string => {
  const parts: string[] = [];
  const rir = rangeText(x.rirMin, x.rirMax);
  if (rir !== '—') parts.push(`RIR ${rir}`);
  if (x.loadPct.trim()) parts.push(`${x.loadPct}% 1RM`);
  if (x.tempo.trim()) parts.push(`tempo ${x.tempo.trim()}`);
  if (x.unilateral) parts.push('por lado');
  if (x.notes.trim()) parts.push('con nota');
  return parts.join(' · ');
};

/** Everything the builder needs to restore itself from localStorage. */
interface DraftData {
  name: string;
  focus: string;
  description: string;
  durationWeeks: string;
  startDate: string;
  status: ProgramStatus;
  progressionRule: string;
  tempoDefault: string;
  notes: string;
  days: DayRow[];
  weeks: WeekRow[];
}

/**
 * Mirrors every CHECK constraint in 20260717120000_coach_programs.sql. Without
 * this the DB rejects the whole save and the coach only learns something was
 * wrong — not which field. Returns the step to jump to plus the message.
 *
 * Keep in sync with the migration: sets 1–20, reps 1–100, RIR 0–10,
 * %1RM 1–100, rest 0–900, and min ≤ max on reps and RIR.
 */
const checkRange = (
  raw: string,
  lo: number,
  hi: number,
  label: string,
): string | null => {
  const v = toInt(raw);
  if (v == null) return null; // empty is allowed — it's stored as null
  return v < lo || v > hi ? `${label} debe estar entre ${lo} y ${hi}.` : null;
};

function validateProgram(days: DayRow[], weeks: WeekRow[]): { step: number; message: string } | null {
  for (const [di, d] of days.entries()) {
    for (const [xi, x] of d.exercises.entries()) {
      if (!x.name.trim()) continue; // blank rows are dropped before saving
      const where = `Día ${di + 1}, ejercicio ${xi + 1}`;

      const sets = toInt(x.sets);
      if (sets != null && (sets < 1 || sets > 20)) {
        return { step: 1, message: `${where}: las series deben estar entre 1 y 20.` };
      }
      for (const [raw, label] of [
        [x.repMin, 'las repeticiones mínimas'],
        [x.repMax, 'las repeticiones máximas'],
      ] as const) {
        const err = checkRange(raw, 1, 100, label);
        if (err) return { step: 1, message: `${where}: ${err}` };
      }
      const repMin = toInt(x.repMin);
      const repMax = toInt(x.repMax);
      if (repMin != null && repMax != null && repMin > repMax) {
        return { step: 1, message: `${where}: las repeticiones van de menor a mayor (${repMin}–${repMax}).` };
      }

      for (const [raw, label] of [
        [x.rirMin, 'el RIR mínimo'],
        [x.rirMax, 'el RIR máximo'],
      ] as const) {
        const err = checkRange(raw, 0, 10, label);
        if (err) return { step: 1, message: `${where}: ${err}` };
      }
      const rirMin = toInt(x.rirMin);
      const rirMax = toInt(x.rirMax);
      if (rirMin != null && rirMax != null && rirMin > rirMax) {
        return { step: 1, message: `${where}: el RIR va de menor a mayor (${rirMin}–${rirMax}).` };
      }

      const pct = checkRange(x.loadPct, 1, 100, 'el %1RM');
      if (pct) return { step: 1, message: `${where}: ${pct}` };
      const rest = checkRange(x.rest, 0, 900, 'el descanso (en segundos)');
      if (rest) return { step: 1, message: `${where}: ${rest}` };
    }
  }

  for (const [wi, w] of weeks.entries()) {
    const where = `Semana ${wi + 1}`;
    for (const [raw, label, lo, hi] of [
      [w.rirMin, 'el RIR mínimo', 0, 10],
      [w.rirMax, 'el RIR máximo', 0, 10],
      [w.loadMin, 'el % de carga mínimo', 1, 100],
      [w.loadMax, 'el % de carga máximo', 1, 100],
      [w.setsOverride, 'las series', 1, 20],
    ] as const) {
      const err = checkRange(raw, lo, hi, label);
      if (err) return { step: 2, message: `${where}: ${err}` };
    }
  }
  return null;
}

const weekHasData = (w: WeekRow): boolean =>
  !!(w.label.trim() || w.rirMin || w.rirMax || w.loadMin || w.loadMax || w.isDeload || w.setsOverride || w.notes.trim());

/* ---- edit prefill ---- */
const daysFrom = (p: ProgramWithDetail): DayRow[] =>
  p.program_days.length === 0
    ? [emptyDay()]
    : [...p.program_days]
        .sort((a, b) => a.day_index - b.day_index)
        .map((d) => ({
          label: d.label ?? '',
          weekday: d.weekday ?? '',
          exercises:
            d.program_exercises.length === 0
              ? [emptyEx()]
              : d.program_exercises.map((e) => ({
                  name: e.exercise?.name ?? e.custom_name ?? '',
                  sets: String(e.sets),
                  repMin: e.rep_min != null ? String(e.rep_min) : '',
                  repMax: e.rep_max != null ? String(e.rep_max) : '',
                  unilateral: e.is_unilateral,
                  rirMin: e.rir_min != null ? String(e.rir_min) : '',
                  rirMax: e.rir_max != null ? String(e.rir_max) : '',
                  loadPct: e.load_pct_1rm != null ? String(e.load_pct_1rm) : '',
                  loadQual: e.load_qualitative ?? '',
                  tempo: e.tempo ?? '',
                  rest: e.rest_seconds != null ? String(e.rest_seconds) : '',
                  notes: e.notes ?? '',
                  advOpen:
                    e.rir_min != null ||
                    e.rir_max != null ||
                    e.load_pct_1rm != null ||
                    e.is_unilateral ||
                    !!e.tempo ||
                    !!e.notes,
                })),
        }));
const weeksFrom = (p: ProgramWithDetail): WeekRow[] => {
  const rows = [...p.program_weeks]
    .sort((a, b) => a.week_number - b.week_number)
    .map((w) => ({
      label: w.label ?? '',
      rirMin: w.rir_min != null ? String(w.rir_min) : '',
      rirMax: w.rir_max != null ? String(w.rir_max) : '',
      loadMin: w.load_pct_min != null ? String(w.load_pct_min) : '',
      loadMax: w.load_pct_max != null ? String(w.load_pct_max) : '',
      isDeload: w.is_deload,
      setsOverride: w.sets_override != null ? String(w.sets_override) : '',
      notes: w.notes ?? '',
    }));
  return resizeWeeks(rows, clamp(p.duration_weeks, 1, 52));
};

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

/**
 * The 4-step program wizard, shared by two callers:
 *   - a client's Programas tab → `client` set, saves an assigned program;
 *   - the Programs library page → `client` omitted, saves a reusable TEMPLATE
 *     (no owner, no start date/status semantics).
 */
export function ProgramBuilder({
  client,
  initial,
  onClose,
  onSaved,
}: {
  /** Omit to author a library template instead of a client's program. */
  client?: ClientWithMeta;
  initial?: ProgramWithDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isTemplate = client == null;

  // Autosave slot for THIS builder context (a client's program, or a template;
  // new vs editing an existing one).
  const storageKey = draftKey(isTemplate ? 'template' : client!.id, initial?.id ?? 'new');
  // Read once, at mount, so restored values seed useState directly — no flash
  // of empty fields and no effect-driven overwrite.
  const [restored] = useState(() => loadDraft<DraftData>(storageKey));
  const d = restored?.data;
  const [draftDismissed, setDraftDismissed] = useState(false);

  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [name, setName] = useState(d?.name ?? initial?.name ?? '');
  const [focus, setFocus] = useState(d?.focus ?? initial?.focus ?? '');
  const [description, setDescription] = useState(d?.description ?? initial?.description ?? '');
  const [durationWeeks, setDurationWeeks] = useState(
    d?.durationWeeks ?? String(initial?.duration_weeks ?? 4),
  );
  const [startDate, setStartDate] = useState(
    d?.startDate ?? initial?.start_date?.slice(0, 10) ?? tomorrowISO(),
  );
  const [status, setStatus] = useState<ProgramStatus>(d?.status ?? initial?.status ?? 'active');
  const [progressionRule, setProgressionRule] = useState(
    d?.progressionRule ?? initial?.progression_rule ?? '',
  );
  const [tempoDefault, setTempoDefault] = useState(d?.tempoDefault ?? initial?.tempo_default ?? '');
  const [notes, setNotes] = useState(d?.notes ?? initial?.notes ?? '');
  const [days, setDays] = useState<DayRow[]>(
    d?.days ?? (initial ? daysFrom(initial) : [emptyDay()]),
  );
  const [weeks, setWeeks] = useState<WeekRow[]>(
    d?.weeks ?? (initial ? weeksFrom(initial) : resizeWeeks([], 4)),
  );
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [headerAdv, setHeaderAdv] = useState(
    !!(initial?.progression_rule || initial?.tempo_default || initial?.description || initial?.notes),
  );
  // Wizard: one focused step at a time. On edit, jump straight to review so a
  // coach tweaking a program isn't walked through every step.
  const [step, setStep] = useState(initial ? WIZARD_STEPS.length - 1 : 0);
  const [maxStep, setMaxStep] = useState(initial ? WIZARD_STEPS.length - 1 : 0);

  const firstName = client?.display_name?.split(' ')[0] ?? 'el cliente';

  useEffect(() => {
    void listExercises()
      .then(setCatalog)
      .catch(() => {
        toast.error('No se pudo cargar el catálogo de ejercicios');
        setCatalog([]);
      });
  }, []);

  // Autosave. Debounced so typing doesn't hit localStorage on every keystroke;
  // cleared only on a successful save (see submit) or an explicit discard.
  useEffect(() => {
    const t = setTimeout(() => {
      saveDraft<DraftData>(storageKey, {
        name,
        focus,
        description,
        durationWeeks,
        startDate,
        status,
        progressionRule,
        tempoDefault,
        notes,
        days,
        weeks,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [
    storageKey,
    name,
    focus,
    description,
    durationWeeks,
    startDate,
    status,
    progressionRule,
    tempoDefault,
    notes,
    days,
    weeks,
  ]);

  const byName = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const ex of catalog ?? []) m.set(ex.name.trim().toLowerCase(), ex);
    return m;
  }, [catalog]);

  const setDuration = (val: string) => {
    setDurationWeeks(val);
    const t = val.trim();
    if (t) setWeeks((prev) => resizeWeeks(prev, clamp(parseInt(t, 10) || 1, 1, 52)));
  };

  const updDay = (di: number, patch: Partial<DayRow>) =>
    setDays((ds) => ds.map((d, i) => (i === di ? { ...d, ...patch } : d)));
  const updEx = (di: number, xi: number, patch: Partial<ExRow>) =>
    setDays((ds) =>
      ds.map((d, i) =>
        i === di ? { ...d, exercises: d.exercises.map((x, k) => (k === xi ? { ...x, ...patch } : x)) } : d,
      ),
    );
  const updWeek = (wi: number, patch: Partial<WeekRow>) =>
    setWeeks((ws) => ws.map((w, i) => (i === wi ? { ...w, ...patch } : w)));

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

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      setStep(0);
      return toast.error('Ponle nombre al programa');
    }

    const outDays: ProgramDayInput[] = days
      .map((d, di) => ({
        day_index: di + 1,
        label: d.label.trim() || null,
        weekday: d.weekday || null,
        sort_order: di,
        exercises: d.exercises
          .filter((x) => x.name.trim())
          .map((x, xi) => {
            const match = byName.get(x.name.trim().toLowerCase());
            return {
              exercise_id: match?.id ?? null,
              custom_name: match ? null : x.name.trim(),
              sets: toInt(x.sets) ?? 3,
              rep_min: toInt(x.repMin),
              rep_max: toInt(x.repMax),
              is_unilateral: x.unilateral,
              rir_min: toInt(x.rirMin),
              rir_max: toInt(x.rirMax),
              load_pct_1rm: toInt(x.loadPct),
              load_qualitative: (x.loadQual || null) as LoadQualitative | null,
              tempo: x.tempo.trim() || null,
              rest_seconds: toInt(x.rest),
              notes: x.notes.trim() || null,
              sort_order: xi,
            };
          }),
      }))
      .filter((d) => d.exercises.length > 0);

    if (outDays.length === 0) {
      setStep(1);
      return toast.error('Añade al menos un día con un ejercicio');
    }

    // Catch out-of-range numbers here so the coach gets a field-level message
    // instead of the database rejecting the whole save.
    const invalid = validateProgram(days, weeks);
    if (invalid) {
      goTo(invalid.step);
      return toast.error(invalid.message);
    }

    const payload: SaveProgramInput = {
      name: nm,
      description: description.trim() || null,
      focus: focus.trim() || null,
      duration_weeks: clamp(parseInt(durationWeeks, 10) || 1, 1, 52),
      start_date: startDate,
      status,
      progression_rule: progressionRule.trim() || null,
      tempo_default: tempoDefault.trim() || null,
      notes: notes.trim() || null,
      days: outDays,
      weeks: weeks.map((w, wi) => ({
        week_number: wi + 1,
        label: w.label.trim() || null,
        rir_min: toInt(w.rirMin),
        rir_max: toInt(w.rirMax),
        load_pct_min: toInt(w.loadMin),
        load_pct_max: toInt(w.loadMax),
        is_deload: w.isDeload,
        sets_override: toInt(w.setsOverride),
        notes: w.notes.trim() || null,
      })),
    };

    setSaving(true);
    try {
      if (initial) {
        if (isTemplate) {
          await updateTemplate(initial.id, payload);
          toast.success('Plantilla actualizada');
        } else {
          await updateProgram(initial.id, client!.id, payload);
          toast.success('Programa actualizado');
        }
      } else if (isTemplate) {
        await createTemplate(payload);
        toast.success('Plantilla guardada');
      } else {
        await createProgram(client!.id, payload);
        toast.success(`Programa asignado a ${firstName}`);
      }
      clearDraft(storageKey); // saved for real — the autosave copy is obsolete
      onSaved();
    } catch (e) {
      // PostgrestError is a plain object, so `instanceof Error` would hide it.
      toast.error(errorMessage(e, 'No se pudo guardar el programa'));
    } finally {
      setSaving(false);
    }
  };

  const weeksN = clamp(parseInt(durationWeeks, 10) || 1, 1, 52);
  const exCount = days.reduce((a, d) => a + d.exercises.filter((x) => x.name.trim()).length, 0);
  const summaryText = `${weeksN} ${weeksN === 1 ? 'semana' : 'semanas'} · ${days.length} ${
    days.length === 1 ? 'día' : 'días'
  } · ${exCount} ${exCount === 1 ? 'ejercicio' : 'ejercicios'}`;
  const saveLabel = saving
    ? 'Guardando…'
    : initial
      ? 'Guardar cambios'
      : isTemplate
        ? 'Guardar plantilla'
        : `Asignar a ${firstName}`;
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
              clearDraft(storageKey);
              setDraftDismissed(true);
              // Back to a clean slate (or the saved program, when editing).
              setName(initial?.name ?? '');
              setFocus(initial?.focus ?? '');
              setDescription(initial?.description ?? '');
              setDurationWeeks(String(initial?.duration_weeks ?? 4));
              setStartDate(initial?.start_date?.slice(0, 10) ?? tomorrowISO());
              setStatus(initial?.status ?? 'active');
              setProgressionRule(initial?.progression_rule ?? '');
              setTempoDefault(initial?.tempo_default ?? '');
              setNotes(initial?.notes ?? '');
              setDays(initial ? daysFrom(initial) : [emptyDay()]);
              setWeeks(initial ? weeksFrom(initial) : resizeWeeks([], 4));
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
          <MobileProgramPreview
            program={draftToPreview(
              {
                name,
                focus,
                durationWeeks: clamp(parseInt(durationWeeks, 10) || 1, 1, 52),
                startDate,
                progressionRule,
                tempoDefault,
                notes,
              },
              days,
              weeks,
              catalog,
            )}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
