import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_APP_SOUNDS,
  SOUND_MOMENTS,
  SOUND_SETS,
  sameSounds,
  soundUrl,
  type AppSounds,
  type SoundSet,
} from '@/lib/appSounds';
import { errorMessage } from '@/lib/dbError';
import { qk } from '@/lib/queryClient';
import { getAppSounds, saveAppSounds } from '@/services/appSounds';

/**
 * «Sonidos de la app»: one row per moment of a workout, with the sets built
 * into the app as the choice. Picking a set plays it, like a ringtone picker,
 * and ▶ plays the one picked. Saved for every client at once: their app reads
 * it the next time it opens.
 */
export function AppSoundsCard({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: qk.appSounds, queryFn: getAppSounds });
  // The coach's picks not saved yet, over what is saved.
  const [edits, setEdits] = useState<Partial<AppSounds>>({});
  const draft: AppSounds = { ...(saved.data ?? DEFAULT_APP_SOUNDS), ...edits };

  // One sound at a time: a new one cuts the last one short.
  const audio = useRef<HTMLAudioElement | null>(null);
  const play = (set: SoundSet, file: string) => {
    audio.current?.pause();
    const next = new Audio(soundUrl(set, file));
    audio.current = next;
    void next.play().catch(() => {});
  };
  useEffect(() => () => audio.current?.pause(), []);

  const save = useMutation({
    mutationFn: (sounds: AppSounds) => saveAppSounds(sounds),
    onSuccess: (_, sounds) => {
      queryClient.setQueryData(qk.appSounds, sounds);
      setEdits({});
      toast.success('Sonidos guardados. Tus clientes los oirán la próxima vez que abran la app.');
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudieron guardar los sonidos')),
  });

  const dirty = saved.data != null && !sameSounds(draft, saved.data);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sonidos de la app</CardTitle>
        <CardDescription>
          Lo que suena en el teléfono de tus clientes durante el entreno. Elige uno por momento: al elegirlo, suena.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {saved.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {SOUND_MOMENTS.map((m) => (
              <Skeleton key={m.column} className="h-12" />
            ))}
          </div>
        ) : saved.isError ? (
          <div className="flex flex-col items-start gap-3 text-sm">
            <p className="text-muted-foreground">No se pudieron cargar los sonidos.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void saved.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {SOUND_MOMENTS.map((m) => (
                <li
                  key={m.column}
                  className="flex flex-col gap-2 py-3 first:pt-0 md:flex-row md:items-center md:gap-4"
                >
                  <div className="min-w-0 md:w-60 md:flex-none">
                    <div id={`sound-${m.column}`} className="text-sm font-semibold">
                      {m.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.hint}</div>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Segmented<SoundSet>
                      aria-labelledby={`sound-${m.column}`}
                      size="sm"
                      stretch
                      className="flex-1"
                      value={draft[m.column]}
                      onChange={(set) => {
                        setEdits((e) => ({ ...e, [m.column]: set }));
                        play(set, m.file);
                      }}
                      options={SOUND_SETS.map((s) => ({ value: s.value, label: s.label, title: s.title }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Escuchar: ${m.label}`}
                      title="Escuchar"
                      onClick={() => play(draft[m.column], m.file)}
                    >
                      <Play />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Si un cliente eligió «Solo vibración» en su teléfono, no suena ninguno.
              </p>
              <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
                {save.isPending ? 'Guardando…' : 'Guardar sonidos'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
