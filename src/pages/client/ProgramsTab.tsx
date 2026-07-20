import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarRange, Copy, Dumbbell, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ClientWithMeta, Exercise, LoadQualitative, ProgramStatus, ProgramWithDetail } from '@/types';
import {
  createProgram,
  deleteProgram,
  listProgramsForClient,
  updateProgram,
  type ProgramDayInput,
  type SaveProgramInput,
} from '@/services/programs';
import { listExercises } from '@/services/exercises';
import { qk } from '@/lib/queryClient';
import { fmtDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { EmptyState } from '@/components/shared/EmptyState';

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
const STATUS_LABEL: Record<ProgramStatus, string> = {
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};

const DATALIST_ID = 'program-exercise-catalog';

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

function ProgramBuilder({
  client,
  initial,
  onClose,
  onSaved,
}: {
  client: ClientWithMeta;
  initial?: ProgramWithDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [focus, setFocus] = useState(initial?.focus ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [durationWeeks, setDurationWeeks] = useState(String(initial?.duration_weeks ?? 4));
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 10) ?? todayISO());
  const [status, setStatus] = useState<ProgramStatus>(initial?.status ?? 'active');
  const [progressionRule, setProgressionRule] = useState(initial?.progression_rule ?? '');
  const [tempoDefault, setTempoDefault] = useState(initial?.tempo_default ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [days, setDays] = useState<DayRow[]>(initial ? daysFrom(initial) : [emptyDay()]);
  const [weeks, setWeeks] = useState<WeekRow[]>(initial ? weeksFrom(initial) : resizeWeeks([], 4));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listExercises()
      .then(setCatalog)
      .catch(() => {
        toast.error('No se pudo cargar el catálogo de ejercicios');
        setCatalog([]);
      });
  }, []);

  const byName = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const ex of catalog ?? []) m.set(ex.name.trim().toLowerCase(), ex);
    return m;
  }, [catalog]);

  // Duration drives the periodization table length (handled here, not in an
  // effect, to avoid a synchronous setState-in-effect).
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

  const submit = async () => {
    const nm = name.trim();
    if (!nm) return toast.error('Ponle nombre al programa');

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

    if (outDays.length === 0) return toast.error('Añade al menos un día con un ejercicio');

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
        await updateProgram(initial.id, client.id, payload);
        toast.success('Programa actualizado');
      } else {
        await createProgram(client.id, payload);
        toast.success(`Programa asignado a ${client.display_name?.split(' ')[0] ?? 'el cliente'}`);
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el programa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="animate-fade-up border-[1.5px] border-primary p-[22px]">
      <div className="mb-4 font-heading text-[15px] font-semibold">
        {initial ? `Editar programa — ${initial.name}` : 'Nuevo programa'}
      </div>

      <datalist id={DATALIST_ID}>
        {(catalog ?? []).map((ex) => (
          <option key={ex.id} value={ex.name} />
        ))}
      </datalist>

      {/* Header */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pb-name">Nombre</Label>
          <Input id="pb-name" placeholder="Ej. Hipertrofia — Glúteos y Piernas" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pb-focus">Enfoque</Label>
          <Input id="pb-focus" placeholder="Ej. Glúteos y Piernas" value={focus} onChange={(e) => setFocus(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pb-weeks">Duración (semanas)</Label>
          <Input id="pb-weeks" type="number" min={1} max={52} value={durationWeeks} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-start">Inicio</Label>
            <Input id="pb-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pb-status">Estado</Label>
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
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pb-prog">Regla de progresión</Label>
          <Input id="pb-prog" placeholder="Ej. Doble progresión: sube peso al llegar a 8 reps" value={progressionRule} onChange={(e) => setProgressionRule(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pb-tempo">Tempo por defecto</Label>
          <Input id="pb-tempo" placeholder="Ej. Excéntrica 2-3s / concéntrica explosiva" value={tempoDefault} onChange={(e) => setTempoDefault(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="pb-desc">Descripción</Label>
          <Input id="pb-desc" placeholder="Resumen breve del bloque…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="pb-notes">Notas del programa</Label>
          <Textarea id="pb-notes" rows={2} placeholder="Ej. Cardio 20 min postentreno" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Days */}
      <div className="mt-6 mb-2 flex items-center justify-between">
        <span className="font-heading text-[13.5px] font-semibold">Días de entrenamiento</span>
        <span className="text-[11.5px] text-faint">{days.length} días</span>
      </div>
      <div className="flex flex-col gap-4">
        {days.map((day, di) => (
          <div key={di} className="rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="mb-2.5 grid gap-2 sm:grid-cols-[auto_2fr_1.2fr_auto]">
              <span className="flex h-8 items-center rounded-md bg-primary/10 px-2.5 text-[12px] font-bold text-primary dark:bg-primary/15">
                Día {di + 1}
              </span>
              <Input
                aria-label={`Etiqueta del día ${di + 1}`}
                placeholder="Ej. Pecho + Bíceps"
                className="h-8 text-[13px]"
                value={day.label}
                onChange={(e) => updDay(di, { label: e.target.value })}
              />
              <Select value={day.weekday} onValueChange={(v) => updDay(di, { weekday: v })}>
                <SelectTrigger className="h-8 text-[13px]" aria-label="Día de la semana">
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
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>

            {/* Exercise rows */}
            <div className="flex flex-col gap-2.5">
              {day.exercises.map((ex, xi) => (
                <div key={xi} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Input
                      aria-label="Ejercicio"
                      list={DATALIST_ID}
                      placeholder={catalog === null ? 'Cargando catálogo…' : 'Ejercicio (catálogo o libre)…'}
                      className="h-8 flex-1 text-[13px]"
                      value={ex.name}
                      onChange={(e) => updEx(di, xi, { name: e.target.value })}
                      disabled={catalog === null}
                    />
                    <label className="flex flex-none items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                        checked={ex.unilateral}
                        onChange={(e) => updEx(di, xi, { unilateral: e.target.checked })}
                      />
                      Por lado
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        day.exercises.length > 1 &&
                        updDay(di, { exercises: day.exercises.filter((_, k) => k !== xi) })
                      }
                      aria-label="Quitar ejercicio"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[repeat(7,minmax(0,1fr))]">
                    <NumField label="Series" value={ex.sets} onChange={(v) => updEx(di, xi, { sets: v })} />
                    <NumField label="Rep min" value={ex.repMin} onChange={(v) => updEx(di, xi, { repMin: v })} />
                    <NumField label="Rep max" value={ex.repMax} onChange={(v) => updEx(di, xi, { repMax: v })} />
                    <NumField label="RIR min" value={ex.rirMin} onChange={(v) => updEx(di, xi, { rirMin: v })} />
                    <NumField label="RIR max" value={ex.rirMax} onChange={(v) => updEx(di, xi, { rirMax: v })} />
                    <NumField label="%1RM" value={ex.loadPct} onChange={(v) => updEx(di, xi, { loadPct: v })} />
                    <NumField label="Desc. s" value={ex.rest} onChange={(v) => updEx(di, xi, { rest: v })} />
                  </div>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-[1fr_1.4fr_2fr]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">Carga</span>
                      <Select value={ex.loadQual} onValueChange={(v) => updEx(di, xi, { loadQual: v })}>
                        <SelectTrigger className="h-8 text-[12.5px]" aria-label="Carga cualitativa">
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
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">Tempo</span>
                      <Input className="h-8 text-[12.5px]" placeholder="3-1-1" value={ex.tempo} onChange={(e) => updEx(di, xi, { tempo: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">Notas</span>
                      <Input className="h-8 text-[12.5px]" placeholder="Nota del ejercicio…" value={ex.notes} onChange={(e) => updEx(di, xi, { notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updDay(di, { exercises: [...day.exercises, emptyEx()] })}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2 text-[12px] font-semibold text-secondary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} /> Añadir ejercicio
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDays((ds) => [...ds, emptyDay()])}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-strong py-2.5 text-[12.5px] font-semibold text-secondary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} /> Añadir día
      </button>

      {/* Weekly periodization */}
      <div className="mt-6 mb-2 font-heading text-[13.5px] font-semibold">
        Periodización semanal
        <span className="ml-2 text-[11.5px] font-normal text-faint">RIR y % de carga por semana</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[46px_1.6fr_repeat(4,minmax(0,0.8fr))_64px_auto] gap-1.5 px-0.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-faint">
            <span>Sem</span>
            <span>Etiqueta</span>
            <span className="text-center">RIR min</span>
            <span className="text-center">RIR max</span>
            <span className="text-center">%min</span>
            <span className="text-center">%max</span>
            <span className="text-center">Series</span>
            <span className="text-center">Descarga</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {weeks.map((w, wi) => (
              <div key={wi} className="grid grid-cols-[46px_1.6fr_repeat(4,minmax(0,0.8fr))_64px_auto] items-center gap-1.5">
                <span className="text-center text-[12.5px] font-bold text-muted-foreground">{wi + 1}</span>
                <Input className="h-8 text-[12.5px]" placeholder="Ej. Base / Descarga" value={w.label} onChange={(e) => updWeek(wi, { label: e.target.value })} />
                <input className={NUM} aria-label={`Semana ${wi + 1} RIR min`} type="number" value={w.rirMin} onChange={(e) => updWeek(wi, { rirMin: e.target.value })} />
                <input className={NUM} aria-label={`Semana ${wi + 1} RIR max`} type="number" value={w.rirMax} onChange={(e) => updWeek(wi, { rirMax: e.target.value })} />
                <input className={NUM} aria-label={`Semana ${wi + 1} carga min`} type="number" value={w.loadMin} onChange={(e) => updWeek(wi, { loadMin: e.target.value })} />
                <input className={NUM} aria-label={`Semana ${wi + 1} carga max`} type="number" value={w.loadMax} onChange={(e) => updWeek(wi, { loadMax: e.target.value })} />
                <input className={NUM} aria-label={`Semana ${wi + 1} series (descarga)`} type="number" placeholder="—" value={w.setsOverride} onChange={(e) => updWeek(wi, { setsOverride: e.target.value })} />
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

      <div className="mt-[22px] flex justify-end gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void submit()} disabled={saving || catalog === null}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : `Asignar a ${client.display_name?.split(' ')[0] ?? 'el cliente'}`}
        </Button>
      </div>
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      <input className={NUM} aria-label={label} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------------- tab ---------------- */

export function ProgramsTab({ client }: { client: ClientWithMeta }) {
  const queryClient = useQueryClient();
  const { data: programs, isPending, isError, refetch } = useQuery({
    queryKey: qk.programs(client.id),
    queryFn: () => listProgramsForClient(client.id),
  });

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramWithDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProgramWithDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: qk.programs(client.id) });
  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProgram(pendingDelete.id);
      toast.success(`"${pendingDelete.name}" eliminado`);
      setPendingDelete(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el programa');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] text-muted-foreground">
          {programs?.length ?? 0} programas · bloques periodizados de varias semanas
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setBuilderOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Crear programa
        </Button>
      </div>

      {(builderOpen || editing) && (
        <ProgramBuilder
          key={editing?.id ?? 'new'}
          client={client}
          initial={editing ?? undefined}
          onClose={closeBuilder}
          onSaved={() => {
            closeBuilder();
            invalidate();
          }}
        />
      )}

      {isError ? (
        <Card className="shadow-none">
          <EmptyState icon={CalendarRange} title="No se pudo cargar" description="Hubo un problema al cargar los programas.">
            <Button variant="outline" onClick={() => void refetch()} className="mt-1">
              Reintentar
            </Button>
          </EmptyState>
        </Card>
      ) : isPending ? (
        <Card className="shadow-none">
          <div className="p-6 text-center text-[13px] text-faint">Cargando programas…</div>
        </Card>
      ) : programs.length === 0 && !builderOpen ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={Dumbbell}
            title="Sin programas"
            description={`${(client.display_name ?? client.email).split(' ')[0]} aún no tiene un programa. Crea un bloque periodizado para que lo siga en la app.`}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {programs.map((p) => {
            const exCount = p.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
            return (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-[15px] font-semibold">{p.name}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide text-primary dark:bg-primary/15">
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    {p.focus && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{p.focus}</div>}
                  </div>
                  <span className="flex flex-none items-center gap-1">
                    <button
                      onClick={() => {
                        setBuilderOpen(false);
                        setEditing(p);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      aria-label={`Editar ${p.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(p)}
                      aria-label={`Eliminar ${p.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
                  <Chip icon={CalendarRange}>{p.duration_weeks} semanas</Chip>
                  <Chip icon={Dumbbell}>{p.program_days.length} días</Chip>
                  <Chip icon={Copy}>{exCount} ejercicios</Chip>
                  <Chip>Inicio {fmtDate(p.start_date)}</Chip>
                </div>

                {p.progression_rule && (
                  <p className="mt-3 text-[12px] text-faint">
                    <span className="font-semibold text-muted-foreground">Progresión: </span>
                    {p.progression_rule}
                  </p>
                )}
                {p.notes && <p className="mt-1 text-[12px] text-faint">{p.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de la app del cliente con todos sus días, ejercicios y semanas. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon?: typeof CalendarRange; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </span>
  );
}
