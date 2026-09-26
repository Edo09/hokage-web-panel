import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ClientWithMeta, Exercise, ProgramStatus, ProgramWithDetail } from '@/types';
import { createProgram, createTemplate, updateProgram, updateTemplate } from '@/services/programs';
import { listExercises } from '@/services/exercises';
import { errorMessage } from '@/lib/dbError';
import { clearDraft, draftKey, loadDraft, saveDraft } from '@/lib/programDraft';
import { draftToPreview } from '@/components/program/previewModel';
import {
  buildPayload,
  clamp,
  daysFrom,
  emptyDay,
  resizeWeeks,
  tomorrowISO,
  validateProgram,
  weeksFrom,
  type DayRow,
  type DraftData,
  type ExRow,
  type ProgramInvalid,
  type WeekRow,
} from '@/components/program/builderModel';

/** The builder's starting point: a clean slate, or the saved program when editing. */
function baselineDraft(initial: ProgramWithDetail | undefined): DraftData {
  return {
    name: initial?.name ?? '',
    focus: initial?.focus ?? '',
    description: initial?.description ?? '',
    durationWeeks: String(initial?.duration_weeks ?? 4),
    startDate: initial?.start_date?.slice(0, 10) ?? tomorrowISO(),
    status: initial?.status ?? 'active',
    progressionRule: initial?.progression_rule ?? '',
    tempoDefault: initial?.tempo_default ?? '',
    notes: initial?.notes ?? '',
    days: initial ? daysFrom(initial) : [emptyDay()],
    weeks: initial ? weeksFrom(initial) : resizeWeeks([], 4),
  };
}

/** Compares drafts by content. Ignores advOpen, which only records whether a
 *  row's "Avanzado" disclosure is expanded. */
const draftSignature = (d: DraftData): string =>
  JSON.stringify(d, (key, value: unknown) => (key === 'advOpen' ? undefined : value));

export interface ProgramBuilderProps {
  /** Omit to author a library template instead of a client's program. */
  client?: ClientWithMeta;
  initial?: ProgramWithDetail;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * State, autosave and save for the program builder. Shared by the workspace
 * (ProgramWorkspace) and the deprecated wizard (LegacyProgramBuilder), so
 * both write exactly the same program.
 *
 * Two callers:
 *   - a client's Programas tab → `client` set, saves an assigned program;
 *   - the Programs library page → `client` omitted, saves a reusable TEMPLATE
 *     (no owner, no start date/status semantics).
 */
export function useProgramBuilder({ client, initial, onSaved }: ProgramBuilderProps) {
  const isTemplate = client == null;

  // Autosave slot for THIS builder context (a client's program, or a template;
  // new vs editing an existing one).
  const storageKey = draftKey(isTemplate ? 'template' : client!.id, initial?.id ?? 'new');
  // The form as it opens, before the coach touches it. A draft identical to it
  // is not work worth keeping: opening the builder and cancelling, or
  // discarding a recovered draft, must not leave a "Continuar borrador" behind.
  const [pristine] = useState(() => draftSignature(baselineDraft(initial)));
  // Read once, at mount, so restored values seed useState directly — no flash
  // of empty fields and no effect-driven overwrite.
  const [restored] = useState(() => {
    const r = loadDraft<DraftData>(storageKey);
    if (r && draftSignature(r.data) === pristine) {
      clearDraft(storageKey); // an untouched form saved by an older version
      return null;
    }
    return r;
  });
  const d = restored?.data;
  const [draftDismissed, setDraftDismissed] = useState(false);

  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [name, setName] = useState(d?.name ?? initial?.name ?? '');
  const [focus, setFocus] = useState(d?.focus ?? initial?.focus ?? '');
  const [description, setDescription] = useState(d?.description ?? initial?.description ?? '');
  const [durationWeeks, setDurationWeeks] = useState(d?.durationWeeks ?? String(initial?.duration_weeks ?? 4));
  const [startDate, setStartDate] = useState(d?.startDate ?? initial?.start_date?.slice(0, 10) ?? tomorrowISO());
  const [status, setStatus] = useState<ProgramStatus>(d?.status ?? initial?.status ?? 'active');
  const [progressionRule, setProgressionRule] = useState(d?.progressionRule ?? initial?.progression_rule ?? '');
  const [tempoDefault, setTempoDefault] = useState(d?.tempoDefault ?? initial?.tempo_default ?? '');
  const [notes, setNotes] = useState(d?.notes ?? initial?.notes ?? '');
  const [days, setDays] = useState<DayRow[]>(d?.days ?? (initial ? daysFrom(initial) : [emptyDay()]));
  const [weeks, setWeeks] = useState<WeekRow[]>(d?.weeks ?? (initial ? weeksFrom(initial) : resizeWeeks([], 4)));
  const [saving, setSaving] = useState(false);
  /** When the autosave last wrote (for the "guardado" indicator). */
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(restored?.savedAt ?? null);

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
  // cleared on a successful save (see submit), an explicit discard, or when
  // the form is back to exactly how it opened.
  useEffect(() => {
    const t = setTimeout(() => {
      const data: DraftData = {
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
      };
      if (draftSignature(data) === pristine) {
        clearDraft(storageKey);
        setDraftSavedAt(null);
      } else {
        saveDraft<DraftData>(storageKey, data);
        setDraftSavedAt(Date.now());
      }
    }, 600);
    return () => clearTimeout(t);
  }, [storageKey, pristine, name, focus, description, durationWeeks, startDate, status, progressionRule, tempoDefault, notes, days, weeks]);

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
    setDays((ds) => ds.map((day, i) => (i === di ? { ...day, ...patch } : day)));
  const updEx = (di: number, xi: number, patch: Partial<ExRow>) =>
    setDays((ds) =>
      ds.map((day, i) =>
        i === di ? { ...day, exercises: day.exercises.map((x, k) => (k === xi ? { ...x, ...patch } : x)) } : day,
      ),
    );
  const updWeek = (wi: number, patch: Partial<WeekRow>) =>
    setWeeks((ws) => ws.map((w, i) => (i === wi ? { ...w, ...patch } : w)));

  const header = {
    name,
    focus,
    description,
    durationWeeks,
    startDate,
    status,
    progressionRule,
    tempoDefault,
    notes,
  };

  /** The whole draft as it stands — what the AI assistant edits, and what
   *  its "Deshacer" puts back. */
  const snapshot = (): DraftData => ({ ...header, days, weeks });

  /** Replace the whole draft at once (an AI result, or undoing one). */
  const replaceDraft = (next: DraftData) => {
    setName(next.name);
    setFocus(next.focus);
    setDescription(next.description);
    setDurationWeeks(next.durationWeeks);
    setStartDate(next.startDate);
    setStatus(next.status);
    setProgressionRule(next.progressionRule);
    setTempoDefault(next.tempoDefault);
    setNotes(next.notes);
    setDays(next.days);
    setWeeks(resizeWeeks(next.weeks, clamp(parseInt(next.durationWeeks, 10) || 1, 1, 52)));
  };

  /** Throw the recovered autosave away: back to a clean slate (or the saved
   *  program, when editing). The autosave then sees an untouched form and
   *  keeps no draft. */
  const discardDraft = () => {
    clearDraft(storageKey);
    setDraftDismissed(true);
    replaceDraft(baselineDraft(initial));
  };

  /** Whether the form differs from how it opened (a recovered draft counts) —
   *  i.e. whether leaving now would throw work away. */
  const hasChanges = () => draftSignature(snapshot()) !== pristine;

  /** Forget the autosave for good (the coach chose to discard). The caller
   *  closes the builder; unmounting cancels any pending autosave. */
  const dropDraft = () => clearDraft(storageKey);

  /** Validates and saves. `onInvalid` lets the caller bring the failing field
   *  into view (a wizard step, a day tab, a week). */
  const submit = async (onInvalid: (where: ProgramInvalid | { step: 0; message: string }) => void) => {
    if (!name.trim()) {
      onInvalid({ step: 0, message: 'Ponle nombre al programa' });
      return toast.error('Ponle nombre al programa');
    }
    const payload = buildPayload(header, days, weeks, (n) => byName.get(n.toLowerCase())?.id ?? null);
    if (payload.days.length === 0) {
      onInvalid({ step: 1, message: 'Añade al menos un día con un ejercicio' });
      return toast.error('Añade al menos un día con un ejercicio');
    }
    // Catch out-of-range numbers here so the coach gets a field-level message
    // instead of the database rejecting the whole save.
    const invalid = validateProgram(days, weeks);
    if (invalid) {
      onInvalid(invalid);
      return toast.error(invalid.message);
    }

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
  const exCount = days.reduce((a, day) => a + day.exercises.filter((x) => x.name.trim()).length, 0);
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

  const preview = useMemo(
    () =>
      draftToPreview(
        { name, focus, durationWeeks: weeksN, startDate, progressionRule, tempoDefault, notes },
        days,
        weeks,
        catalog,
      ),
    [name, focus, weeksN, startDate, progressionRule, tempoDefault, notes, days, weeks, catalog],
  );

  return {
    isTemplate,
    clientId: client?.id ?? null,
    initial,
    firstName,
    catalog,
    byName,
    restored,
    draftDismissed,
    discardDraft,
    hasChanges,
    dropDraft,
    draftSavedAt,
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
    setWeeks,
    updDay,
    updEx,
    updWeek,
    snapshot,
    replaceDraft,
    saving,
    submit,
    weeksN,
    exCount,
    summaryText,
    saveLabel,
    preview,
  };
}

export type ProgramBuilderState = ReturnType<typeof useProgramBuilder>;
