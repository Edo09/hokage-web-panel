import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Dumbbell, Film, ListChecks, Pencil, Plus, Search } from 'lucide-react';
import type { Exercise } from '@/types';
import {
  createExercise,
  listBodyParts,
  listExercises,
  updateExercise,
} from '@/services/exercises';
import {
  CATEGORIES,
  MUSCLES,
  MUSCLE_LABEL,
  categoryOf,
  findCategory,
  sampleNames,
} from '@/lib/exerciseCategories';
import { MuscleSilhouette } from '@/components/muscles/MuscleSilhouette';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { qk } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const IS_IMG = /\.(gif|apng|webp|png|jpe?g)$/i;
const isImageUrl = (u: string | null): boolean => !!u && IS_IMG.test(u.split('?')[0]);
/** jsonb step array ↔ one-step-per-line textarea text. */
const stepsToText = (steps: string[] | null): string => (steps ?? []).join('\n');
const textToSteps = (text: string): string[] | null => {
  const arr = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : null;
};

/** Exercises whose target_muscle is empty (e.g. added without one). */
const UNSORTED = 'sin-grupo';

export default function Exercises() {
  const queryClient = useQueryClient();
  const { data: exercises, isPending, isError, refetch } = useQuery({
    queryKey: qk.exercises,
    queryFn: listExercises,
  });

  // The open group lives in the URL (?grupo=biceps) so back/forward and
  // reloads keep it; no group = the library of category cards.
  const [params, setParams] = useSearchParams();
  const groupId = params.get('grupo');
  const group = findCategory(groupId);
  const inUnsorted = groupId === UNSORTED;
  const inGroup = !!group || inUnsorted;

  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  // `editing` holds the row being edited; 'new' opens the same dialog blank.
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);

  const byCategory = useMemo(() => {
    const out = new Map<string, Exercise[]>();
    for (const ex of exercises ?? []) {
      const key = categoryOf(ex) ?? UNSORTED;
      out.set(key, [...(out.get(key) ?? []), ex]);
    }
    return out;
  }, [exercises]);

  const open = (id: string | null) => {
    setQuery('');
    setMuscle(null);
    setParams(id ? { grupo: id } : {});
    window.scrollTo({ top: 0 });
  };

  // In a group: that group's exercises (and muscle chip). In the library a
  // search runs over the whole catalog instead of the cards.
  const scope = useMemo(
    () => (inGroup ? (byCategory.get(group?.id ?? UNSORTED) ?? []) : (exercises ?? [])),
    [inGroup, byCategory, group, exercises],
  );
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return scope.filter(
      (e) => (!muscle || e.target_muscle === muscle) && (!q || norm(e.name).includes(q)),
    );
  }, [scope, query, muscle]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: qk.exercises });
  const showList = inGroup || query.trim() !== '';
  const unsorted = byCategory.get(UNSORTED) ?? [];

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {inGroup && (
        <button
          type="button"
          onClick={() => open(null)}
          className="-ml-1 flex w-fit items-center gap-1 rounded-md px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          Todos los grupos
        </button>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[640px]">
          {inGroup ? (
            <h2 className="display text-[28px]">
              {group?.label ?? 'Sin grupo'}
            </h2>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Tu catálogo, por grupo muscular
              <InfoTip label="Qué pasa al editar un ejercicio">
                Editar un ejercicio cambia su nombre, demo e instrucciones en todas las rutinas y programas donde aparece.
              </InfoTip>
            </p>
          )}
        </div>
        <Button className="flex-none" onClick={() => setEditing('new')} aria-label="Nuevo ejercicio">
          <Plus strokeWidth={2.5} />
          <span className="hidden sm:inline">Nuevo ejercicio</span>
        </Button>
      </div>

      {isError ? (
        <Card className="p-6 text-center text-[13px] text-muted-foreground">
          No se pudo cargar el catálogo.{' '}
          <button className="font-semibold text-foreground underline underline-offset-4" onClick={() => void refetch()}>
            Reintentar
          </button>
        </Card>
      ) : isPending ? (
        <Card className="p-6 text-center text-[13px] text-faint">Cargando ejercicios…</Card>
      ) : (
        <>
          {/* Search sits directly above the list. Forced white per request. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12.5px] text-faint">
              {showList
                ? `${filtered.length} de ${scope.length} ejercicios`
                : `${exercises.length} ejercicios en ${CATEGORIES.filter((c) => byCategory.has(c.id)).length} grupos`}
            </div>
            <div className="relative w-full max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="border-slate-200 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                placeholder={group ? `Buscar en ${group.label}…` : 'Buscar ejercicio…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {group && group.muscles.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Músculo">
              {[null, ...group.muscles].map((m) => {
                const count = m ? scope.filter((e) => e.target_muscle === m).length : scope.length;
                if (m && count === 0) return null;
                const active = muscle === m;
                return (
                  <button
                    key={m ?? 'all'}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMuscle(m)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-border-strong',
                    )}
                  >
                    {m ? MUSCLE_LABEL[m] : 'Todos'}{' '}
                    <span className={active ? 'text-background/70' : 'text-faint'}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {showList ? (
            <Card className="divide-y divide-border p-0">
              {filtered.map((ex) => (
                <ExerciseRow key={ex.id} ex={ex} showGroup={!inGroup} onEdit={() => setEditing(ex)} />
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-faint">Sin resultados.</div>
              )}
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const list = byCategory.get(cat.id);
                if (!list) return null;
                return (
                  <CategoryCard
                    key={cat.id}
                    label={cat.label}
                    count={list.length}
                    names={sampleNames(cat, list)}
                    art={<MuscleSilhouette side={cat.side} slugs={cat.slugs} className="h-[132px]" />}
                    onOpen={() => open(cat.id)}
                  />
                );
              })}
              {unsorted.length > 0 && (
                <CategoryCard
                  label="Sin grupo"
                  count={unsorted.length}
                  names={unsorted.slice(0, 3).map((e) => e.name)}
                  art={
                    <span className="flex h-[132px] w-[66px] items-center justify-center text-faint">
                      <Dumbbell className="h-8 w-8" strokeWidth={1.7} />
                    </span>
                  }
                  onOpen={() => open(UNSORTED)}
                />
              )}
            </div>
          )}
        </>
      )}

      <ExerciseEditor
        key={editing === 'new' ? 'new' : (editing?.id ?? 'none')}
        exercise={editing}
        defaultMuscle={muscle ?? group?.muscles[0] ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          invalidate();
        }}
      />
    </div>
  );
}

/** One group in the library: its figure, how many exercises it holds and a
 *  few of them. The whole card opens the group. */
function CategoryCard({
  label,
  count,
  names,
  art,
  onOpen,
}: {
  label: string;
  count: number;
  names: string[];
  art: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left text-card-foreground shadow-card transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex w-[66px] flex-none justify-center">{art}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="display block text-[19px]">
              {label}
            </span>
            <span className="mt-1 block text-[12px] text-faint">
              {count} {count === 1 ? 'ejercicio' : 'ejercicios'}
            </span>
          </span>
          <ChevronRight
            className="mt-0.5 h-4 w-4 flex-none text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            strokeWidth={2}
          />
        </span>
        <span className="mt-3 block border-t border-border pt-2.5">
          {names.map((n) => (
            <span key={n} className="block truncate py-[3px] text-[12.5px] text-muted-foreground">
              {n}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function ExerciseRow({ ex, showGroup, onEdit }: { ex: Exercise; showGroup: boolean; onEdit: () => void }) {
  const hasSteps = (ex.instructions_es?.length ?? ex.instructions_en?.length ?? 0) > 0;
  const muscleLabel = ex.target_muscle ? (MUSCLE_LABEL[ex.target_muscle] ?? ex.target_muscle) : null;
  const groupLabel = findCategory(categoryOf(ex))?.label;
  // Group · muscle when browsing the whole catalog; just the muscle inside a
  // group (and only when it says more than the group's own name).
  const sub = showGroup
    ? [groupLabel, muscleLabel !== groupLabel ? muscleLabel : null].filter(Boolean).join(' · ')
    : muscleLabel !== groupLabel
      ? muscleLabel
      : null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Thumb url={ex.video_url} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{ex.name}</div>
        {sub && <div className="text-[11.5px] text-faint">{sub}</div>}
      </div>
      <div className="flex flex-none items-center gap-1.5">
        <Flag on={!!ex.video_url} icon={Film} label="Demo" />
        <Flag on={hasSteps} icon={ListChecks} label="Pasos" />
      </div>
      <Button variant="outline" size="sm" className="flex-none" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} /> Editar
      </Button>
    </div>
  );
}

/** The exercise's demo in the list: animated GIF/image, an inline looping
 *  video, or the barbell placeholder. Lazy so a long catalog doesn't load
 *  every clip at once. */
function Thumb({ url }: { url: string | null }) {
  const base = 'h-24 w-24 flex-none rounded-xl border border-border bg-muted object-cover';
  if (url && IS_IMG.test(url.split('?')[0])) {
    return <img src={url} alt="" loading="lazy" className={base} />;
  }
  if (url) {
    return <video src={url} className={base} muted loop autoPlay playsInline preload="metadata" />;
  }
  return (
    <span className="flex h-24 w-24 flex-none items-center justify-center rounded-xl bg-muted text-faint">
      <Dumbbell className="h-8 w-8" strokeWidth={1.7} />
    </span>
  );
}

function Flag({ on, icon: Icon, label }: { on: boolean; icon: typeof Film; label: string }) {
  return (
    <span
      title={on ? label : `Sin ${label.toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
        on ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-faint',
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
  );
}

/** The body part a main muscle belongs to (bodyparts.name), so picking the
 *  muscle can fill an empty "Grupo muscular" — the app still reads that one. */
const MUSCLE_BODY_PART: Record<string, string> = {
  pectorals: 'chest',
  'serratus anterior': 'chest',
  lats: 'back',
  'upper back': 'back',
  traps: 'back',
  spine: 'back',
  delts: 'shoulders',
  quads: 'upper legs',
  hamstrings: 'upper legs',
  adductors: 'upper legs',
  glutes: 'upper legs',
  abductors: 'upper legs',
  calves: 'lower legs',
  biceps: 'upper arms',
  triceps: 'upper arms',
  forearms: 'lower arms',
  abs: 'waist',
  'cardiovascular system': 'cardio',
  'levator scapulae': 'neck',
};

function ExerciseEditor({
  exercise,
  defaultMuscle,
  onClose,
  onSaved,
}: {
  /** An existing row to edit, or 'new' to create one. */
  exercise: Exercise | 'new' | null;
  /** Main muscle a new exercise starts with (the group being browsed). */
  defaultMuscle: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = exercise === 'new';
  const row = isNew ? null : exercise;

  const [name, setName] = useState(row?.name ?? '');
  const [videoUrl, setVideoUrl] = useState(row?.video_url ?? '');
  const [targetMuscle, setTargetMuscle] = useState(row ? (row.target_muscle ?? '') : (defaultMuscle ?? ''));
  const [bodyPartId, setBodyPartId] = useState(row?.body_part_id ?? '');
  const [es, setEs] = useState(stepsToText(row?.instructions_es ?? null));
  const [en, setEn] = useState(stepsToText(row?.instructions_en ?? null));
  const [saving, setSaving] = useState(false);

  const { data: bodyParts } = useQuery({
    queryKey: qk.bodyParts,
    queryFn: listBodyParts,
    enabled: exercise != null,
  });

  // An empty "Grupo muscular" follows the main muscle; a chosen one stays.
  const inferredBodyPart = targetMuscle
    ? bodyParts?.find((bp) => bp.name === MUSCLE_BODY_PART[targetMuscle])?.id
    : undefined;

  const save = async () => {
    if (exercise == null) return;
    if (!name.trim()) return toast.error('El nombre no puede estar vacío');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        video_url: videoUrl.trim() || null,
        target_muscle: targetMuscle || null,
        body_part_id: bodyPartId || inferredBodyPart || null,
        instructions_es: textToSteps(es),
        instructions_en: textToSteps(en),
      };
      if (isNew) {
        await createExercise(payload);
        toast.success(`"${payload.name}" añadido al catálogo`);
      } else {
        await updateExercise(row!.id, payload);
        toast.success('Ejercicio actualizado');
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el ejercicio');
    } finally {
      setSaving(false);
    }
  };

  const url = videoUrl.trim();

  return (
    <Dialog open={exercise != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nuevo ejercicio' : 'Editar ejercicio'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ex-name">Nombre</Label>
              <Input
                id="ex-name"
                placeholder="Ej. Sentadilla Búlgara con Mancuernas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={isNew}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="ex-muscle">Músculo principal</Label>
              <Select value={targetMuscle} onValueChange={setTargetMuscle}>
                <SelectTrigger id="ex-muscle">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLES.map((m) => {
                    const cat = findCategory(categoryOf({ target_muscle: m }));
                    const label = MUSCLE_LABEL[m];
                    return (
                      <SelectItem key={m} value={m}>
                        {cat && cat.label !== label ? `${cat.label} · ${label}` : label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[200px] flex-col gap-1.5">
              <Label htmlFor="ex-bp">Grupo muscular</Label>
              <Select value={bodyPartId || inferredBodyPart || ''} onValueChange={setBodyPartId}>
                <SelectTrigger id="ex-bp">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {(bodyParts ?? []).map((bp) => (
                    <SelectItem key={bp.id} value={bp.id}>
                      {bp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-url">URL del GIF / video (bucket exercise-media)</Label>
            <Input
              id="ex-url"
              placeholder="https://…/exercise-media/nombre.gif"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            {isImageUrl(url) && (
              <img
                src={url}
                alt="Vista previa del demo"
                className="mt-1 h-40 w-40 rounded-xl border border-border object-cover"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ex-es">Instrucciones (Español)</Label>
              <Textarea
                id="ex-es"
                rows={8}
                placeholder={'Un paso por línea…'}
                value={es}
                onChange={(e) => setEs(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ex-en">Instructions (English)</Label>
              <Textarea
                id="ex-en"
                rows={8}
                placeholder={'One step per line…'}
                value={en}
                onChange={(e) => setEn(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11.5px] text-faint">
            Cada línea es un paso numerado en la app. Deja el campo vacío para quitar las instrucciones.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
