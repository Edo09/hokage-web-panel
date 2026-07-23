import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dumbbell, Film, ListChecks, Pencil, Search } from 'lucide-react';
import type { Exercise } from '@/types';
import { listExercises, updateExercise } from '@/services/exercises';
import { qk } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

export default function Exercises() {
  const queryClient = useQueryClient();
  const { data: exercises, isPending, isError, refetch } = useQuery({
    queryKey: qk.exercises,
    queryFn: listExercises,
  });

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    const list = exercises ?? [];
    const q = norm(query.trim());
    if (!q) return list;
    return list.filter((e) => norm(e.name).includes(q));
  }, [exercises, query]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: qk.exercises });

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold">Ejercicios</h1>
        <p className="text-[13px] text-muted-foreground">
          Catálogo compartido — editar un ejercicio actualiza su nombre, demo e instrucciones en cada
          rutina y programa asignado.
        </p>
      </div>

      {isError ? (
        <Card className="p-6 text-center text-[13px] text-muted-foreground">
          No se pudo cargar el catálogo.{' '}
          <button className="font-semibold text-primary" onClick={() => void refetch()}>
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
              {filtered.length} de {exercises.length} ejercicios
            </div>
            <div className="relative w-full max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="border-slate-200 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                placeholder="Buscar ejercicio…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <Card className="divide-y divide-border p-0">
            {filtered.map((ex) => {
              const hasSteps = (ex.instructions_es?.length ?? ex.instructions_en?.length ?? 0) > 0;
              return (
                <div key={ex.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Thumb url={ex.video_url} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{ex.name}</div>
                    {ex.body_part?.name && (
                      <div className="text-[11.5px] text-faint">{ex.body_part.name}</div>
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <Flag on={!!ex.video_url} icon={Film} label="Demo" />
                    <Flag on={hasSteps} icon={ListChecks} label="Pasos" />
                  </div>
                  <Button variant="outline" size="sm" className="flex-none" onClick={() => setEditing(ex)}>
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} /> Editar
                  </Button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-faint">Sin resultados.</div>
            )}
          </Card>
        </>
      )}

      <ExerciseEditor
        key={editing?.id ?? 'none'}
        exercise={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          invalidate();
        }}
      />
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

function ExerciseEditor({
  exercise,
  onClose,
  onSaved,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [videoUrl, setVideoUrl] = useState(exercise?.video_url ?? '');
  const [es, setEs] = useState(stepsToText(exercise?.instructions_es ?? null));
  const [en, setEn] = useState(stepsToText(exercise?.instructions_en ?? null));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (exercise == null) return;
    if (!name.trim()) return toast.error('El nombre no puede estar vacío');
    setSaving(true);
    try {
      await updateExercise(exercise.id, {
        name: name.trim(),
        video_url: videoUrl.trim() || null,
        instructions_es: textToSteps(es),
        instructions_en: textToSteps(en),
      });
      toast.success('Ejercicio actualizado');
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
          <DialogTitle>Editar ejercicio</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-name">Nombre</Label>
            <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} />
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
