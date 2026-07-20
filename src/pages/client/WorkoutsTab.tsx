import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ClientWithMeta, Exercise, RoutineWithExercises } from '@/types';
import { assignRoutine, deleteRoutine, updateRoutine } from '@/services/clients';
import { listExercises } from '@/services/exercises';
import { useWeightUnit } from '@/hooks/useWeightUnit';
import { displayToKg, formatWeight, kgToDisplay, type WeightUnit } from '@/lib/weightUnit';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { OwnerBadge } from '@/components/shared/StatusBadge';

/** Stored value is lowercase English ('monday'..'sunday') — matches the
 *  mobile app's convention (day-scheduling/muscle-group logic indexes by
 *  it); the coach only ever sees the Spanish label. */
const WEEKDAYS: { value: string; label: string }[] = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

const dayLabel = (value: string | null): string =>
  (value && WEEKDAYS.find((w) => w.value === value)?.label) || value || '—';

const DATALIST_ID = 'exercise-catalog-options';

interface BuilderRow {
  exerciseName: string; // resolved to exercise_id at submit against the catalog
  sets: string;
  reps: string;
  weight: string;
  rest: string;
}

const emptyRow = (): BuilderRow => ({ exerciseName: '', sets: '4', reps: '10', weight: '', rest: '90' });

/** Prefills the builder in the coach's chosen display unit — stored weight is
 *  always kg (submit() converts back). */
const rowsFrom = (routine: RoutineWithExercises, unit: WeightUnit): BuilderRow[] =>
  routine.routine_exercises.length === 0
    ? [emptyRow()]
    : routine.routine_exercises.map((ex) => ({
        exerciseName: ex.exercise?.name ?? '',
        sets: String(ex.sets),
        reps: String(ex.reps),
        weight: ex.weight_kg != null ? String(Math.round(kgToDisplay(ex.weight_kg, unit) * 100) / 100) : '',
        rest: String(ex.rest_seconds),
      }));

const ROW_GRID = 'grid gap-2 [grid-template-columns:2fr_64px_64px_84px_84px_36px]';

/** RoutineBuilder — repeatable exercise rows. Creates a COACH routine, or
 *  rewrites an existing one when `initial` is set. Every exercise must
 *  resolve to a catalog entry (routine_exercises.exercise_id is a required
 *  FK — no free-text names). */
function RoutineBuilder({
  client,
  initial,
  onClose,
  onSaved,
}: {
  client: ClientWithMeta;
  /** When set, the builder edits this routine instead of creating one. */
  initial?: RoutineWithExercises;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { unit } = useWeightUnit();
  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [day, setDay] = useState(initial?.day_of_week ?? 'monday');
  const [rows, setRows] = useState<BuilderRow[]>(initial ? rowsFrom(initial, unit) : [emptyRow()]);
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

  const upd = (i: number, field: keyof BuilderRow, value: string) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [field]: value } : r)));

  const submit = async () => {
    const n = name.trim();
    const filled = rows.filter((r) => r.exerciseName.trim());
    if (!n || !filled.length) {
      toast.error('Ponle nombre y al menos un ejercicio');
      return;
    }

    const resolved: { row: BuilderRow; exercise: Exercise }[] = [];
    for (const row of filled) {
      const match = byName.get(row.exerciseName.trim().toLowerCase());
      if (!match) {
        toast.error(`"${row.exerciseName}" no está en el catálogo — elige una opción de la lista.`);
        return;
      }
      resolved.push({ row, exercise: match });
    }

    const payload = {
      name: n,
      description: desc.trim() || 'Rutina asignada por el coach.',
      day_of_week: day,
      exercises: resolved.map(({ row, exercise }, j) => ({
        exercise_id: exercise.id,
        sets: +row.sets || 3,
        reps: +row.reps || 10,
        weight_kg: +row.weight > 0 ? Math.round(displayToKg(+row.weight, unit) * 100) / 100 : null,
        rest_seconds: +row.rest || 60,
        sort_order: j,
      })),
    };

    setSaving(true);
    try {
      if (initial) {
        await updateRoutine(initial.id, client.id, payload);
        toast.success('Rutina actualizada');
      } else {
        await assignRoutine(client.id, payload);
        toast.success(`Rutina asignada a ${client.display_name?.split(' ')[0] ?? 'el cliente'}`);
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la rutina');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="animate-fade-up border-[1.5px] border-primary p-[22px]">
      <div className="mb-4 font-heading text-[15px] font-semibold">
        {initial ? `Editar rutina — ${initial.name}` : 'Nueva rutina asignada'}
      </div>

      {/* Shared datalist so every row's exercise input autocompletes against
          the real catalog — resolved back to exercise_id at submit. */}
      <datalist id={DATALIST_ID}>
        {(catalog ?? []).map((ex) => (
          <option key={ex.id} value={ex.name} />
        ))}
      </datalist>

      <div className="mb-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-name">Nombre</Label>
          <Input
            id="rb-name"
            placeholder="Ej. Empuje — Pecho y Hombro"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rb-day">Día</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger id="rb-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-1.5">
        <Label htmlFor="rb-desc">Descripción</Label>
        <Input
          id="rb-desc"
          placeholder="Objetivo de la sesión…"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className={`${ROW_GRID} mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wider text-faint`}>
            <span>Ejercicio</span>
            <span>Series</span>
            <span>Reps</span>
            <span>Peso {unit}</span>
            <span>Desc. s</span>
            <span></span>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className={`${ROW_GRID} items-center`}>
                <Input
                  aria-label="Ejercicio (del catálogo)"
                  placeholder={catalog === null ? 'Cargando catálogo…' : 'Buscar ejercicio…'}
                  list={DATALIST_ID}
                  className="h-9 rounded-[9px] text-[13px]"
                  value={row.exerciseName}
                  onChange={(e) => upd(i, 'exerciseName', e.target.value)}
                  disabled={catalog === null}
                />
                <Input
                  type="number"
                  aria-label="Series"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.sets}
                  onChange={(e) => upd(i, 'sets', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Repeticiones"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.reps}
                  onChange={(e) => upd(i, 'reps', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label={`Peso en ${unit === 'kg' ? 'kilogramos' : 'libras'}`}
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.weight}
                  onChange={(e) => upd(i, 'weight', e.target.value)}
                />
                <Input
                  type="number"
                  aria-label="Descanso en segundos"
                  className="h-9 rounded-[9px] px-2 text-[13px]"
                  value={row.rest}
                  onChange={(e) => upd(i, 'rest', e.target.value)}
                />
                <button
                  onClick={() => rows.length > 1 && setRows((rs) => rs.filter((_, k) => k !== i))}
                  aria-label="Quitar ejercicio"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setRows((rs) => [...rs, { ...emptyRow(), sets: '3', reps: '12', rest: '60' }])}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border-strong py-2.5 text-[12.5px] font-semibold text-secondary transition-colors hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Añadir ejercicio
      </button>

      <div className="mt-[18px] flex justify-end gap-2.5">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => void submit()} disabled={saving || catalog === null}>
          {saving
            ? 'Guardando…'
            : initial
              ? 'Guardar cambios'
              : `Asignar a ${client.display_name?.split(' ')[0] ?? 'el cliente'}`}
        </Button>
      </div>
    </Card>
  );
}

const EX_GRID = 'grid gap-1.5 [grid-template-columns:2fr_52px_52px_62px_62px]';

export function WorkoutsTab({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const { unit } = useWeightUnit();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineWithExercises | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoutineWithExercises | null>(null);
  const [deleting, setDeleting] = useState(false);

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteRoutine(pendingDelete.id);
      toast.success(`"${pendingDelete.name}" eliminada`);
      setPendingDelete(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la rutina');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {client.routines.length} rutinas · las marcadas <OwnerBadge assignedBy="coach" /> son tuyas
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setBuilderOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Asignar rutina
        </Button>
      </div>

      {(builderOpen || editing) && (
        <RoutineBuilder
          key={editing?.id ?? 'new'}
          client={client}
          initial={editing ?? undefined}
          onClose={closeBuilder}
          onSaved={() => {
            closeBuilder();
            onChanged();
          }}
        />
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
        {client.routines.map((rt) => (
          <Card key={rt.id} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-heading text-sm font-semibold">{rt.name}</span>
              <OwnerBadge assignedBy={rt.assigned_by} />
              <span className="flex-none rounded-full bg-muted px-2.5 py-[3px] text-[11px] font-semibold text-muted-foreground">
                {dayLabel(rt.day_of_week)}
              </span>
              {/* Only coach-assigned routines are editable here — the client's
                  own routines belong to them. */}
              {rt.assigned_by != null && (
                <span className="flex flex-none items-center gap-1">
                  <button
                    onClick={() => {
                      setBuilderOpen(false);
                      setEditing(rt);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    aria-label={`Editar ${rt.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2.25} />
                  </button>
                  <button
                    onClick={() => setPendingDelete(rt)}
                    aria-label={`Eliminar ${rt.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                  </button>
                </span>
              )}
            </div>
            <p className="mb-3 mt-1.5 text-[12.5px] text-faint">{rt.description}</p>
            <div className={`${EX_GRID} border-b border-border pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-faint`}>
              <span>Ejercicio</span>
              <span className="text-center">Ser.</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Peso</span>
              <span className="text-center">Desc.</span>
            </div>
            {rt.routine_exercises.map((ex) => (
              <div key={ex.id} className={`${EX_GRID} items-center border-b border-border py-[7px] text-[12.5px]`}>
                <span className="truncate font-medium">{ex.exercise?.name ?? '—'}</span>
                <span className="text-center text-muted-foreground">{ex.sets}</span>
                <span className="text-center text-muted-foreground">{ex.reps}</span>
                <span className="text-center text-muted-foreground">{formatWeight(ex.weight_kg, unit)}</span>
                <span className="text-center text-muted-foreground">{ex.rest_seconds}s</span>
              </div>
            ))}
          </Card>
        ))}
      </div>

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de la app del cliente junto con todos sus ejercicios. Esta acción no se
              puede deshacer.
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
