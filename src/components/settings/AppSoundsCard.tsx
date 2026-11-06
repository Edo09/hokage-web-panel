import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Play, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_APP_SOUNDS,
  SOUND_MOMENTS,
  SOUND_SETS,
  soundUrl,
  UPLOAD_RULES,
  type AppSounds,
  type SoundColumn,
  type SoundPick,
} from '@/lib/appSounds';
import { errorMessage } from '@/lib/dbError';
import { prepareSound, SoundRuleError, type PreparedSound } from '@/lib/prepareSound';
import { qk } from '@/lib/queryClient';
import { customSoundUrl, getAppSounds, saveAppSounds } from '@/services/appSounds';

type Moment = (typeof SOUND_MOMENTS)[number];

const seconds = (s: number) => s.toLocaleString('es', { maximumFractionDigits: 1 });

/**
 * «Sonidos de la app»: one row per moment of a workout, with the sets built
 * into the app and the coach's own upload («Propio») as the choice. Picking
 * plays it, like a ringtone picker; ▶ plays the one picked. An upload is
 * checked and converted in the browser (src/lib/prepareSound.ts) and goes up
 * with «Guardar sonidos». Saved for every client at once: their app reads it
 * the next time it opens.
 */
export function AppSoundsCard({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: qk.appSounds, queryFn: getAppSounds });
  // The coach's picks and uploads not saved yet, over what is saved.
  const [edits, setEdits] = useState<Partial<Record<SoundColumn, SoundPick>>>({});
  const [uploads, setUploads] = useState<Partial<Record<SoundColumn, PreparedSound>>>({});
  const [preparing, setPreparing] = useState<SoundColumn | null>(null);
  const base = saved.data ?? DEFAULT_APP_SOUNDS;
  const picks = { ...base.picks, ...edits };

  // One sound at a time: a new one cuts the last one short.
  const audio = useRef<HTMLAudioElement | null>(null);
  const play = (url: string | null) => {
    if (url == null) return;
    audio.current?.pause();
    const next = new Audio(url);
    audio.current = next;
    void next.play().catch(() => {});
  };
  useEffect(() => () => audio.current?.pause(), []);

  const urlOf = (m: Moment, pick: SoundPick): string | null => {
    if (pick !== 'custom') return soundUrl(pick, m.file);
    const upload = uploads[m.column];
    if (upload) return upload.url;
    const path = base.files[m.column];
    return path != null ? customSoundUrl(path) : null;
  };

  const choose = (m: Moment, pick: SoundPick) => {
    setEdits((e) => ({ ...e, [m.column]: pick }));
    play(urlOf(m, pick));
  };

  const upload = async (m: Moment, file: File) => {
    setPreparing(m.column);
    try {
      const sound = await prepareSound(file, m.maxSeconds);
      setUploads((u) => {
        const old = u[m.column];
        if (old) URL.revokeObjectURL(old.url);
        return { ...u, [m.column]: sound };
      });
      setEdits((e) => ({ ...e, [m.column]: 'custom' }));
      play(sound.url);
    } catch (e) {
      toast.error(e instanceof SoundRuleError ? e.message : 'No se pudo preparar ese sonido.');
    } finally {
      setPreparing(null);
    }
  };

  const save = useMutation({
    mutationFn: (v: { current: AppSounds; wavs: Partial<Record<SoundColumn, Blob>> }) =>
      saveAppSounds(v.current, v.wavs),
    onSuccess: (next) => {
      queryClient.setQueryData(qk.appSounds, next);
      Object.values(uploads).forEach((u) => URL.revokeObjectURL(u.url));
      setUploads({});
      setEdits({});
      toast.success('Sonidos guardados. Tus clientes los oirán la próxima vez que abran la app.');
    },
    onError: (e) => toast.error(errorMessage(e, 'No se pudieron guardar los sonidos')),
  });

  const pending = Object.keys(uploads).length > 0;
  const dirty =
    saved.data != null && (pending || SOUND_MOMENTS.some((m) => picks[m.column] !== base.picks[m.column]));
  const busy = save.isPending || preparing != null;

  const submit = () => {
    const wavs: Partial<Record<SoundColumn, Blob>> = {};
    for (const [column, sound] of Object.entries(uploads) as [SoundColumn, PreparedSound][]) wavs[column] = sound.wav;
    save.mutate({ current: { picks, files: base.files }, wavs });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sonidos de la app</CardTitle>
        <CardDescription>
          Lo que suena en el teléfono de tus clientes durante el entreno. Elige uno por momento (al elegirlo,
          suena) o sube el tuyo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SoundRules />

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
              {SOUND_MOMENTS.map((m) => {
                const newSound = uploads[m.column];
                const hasOwn = newSound != null || base.files[m.column] != null;
                return (
                  <li
                    key={m.column}
                    className="flex flex-col gap-2 py-3 first:pt-0 md:flex-row md:items-center md:gap-4"
                  >
                    <div className="min-w-0 md:w-64 md:flex-none">
                      <div id={`sound-${m.column}`} className="text-sm font-semibold">
                        {m.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{m.hint}</div>
                      <div className="text-xs text-muted-foreground">
                        {newSound
                          ? `Nuevo: ${newSound.name}, ${seconds(newSound.seconds)} s. Se sube al guardar.`
                          : `Propio: hasta ${seconds(m.maxSeconds)} s.`}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Segmented<SoundPick>
                        aria-labelledby={`sound-${m.column}`}
                        size="sm"
                        stretch
                        className="min-w-0 flex-1"
                        value={picks[m.column]}
                        onChange={(pick) => choose(m, pick)}
                        options={[
                          ...SOUND_SETS.map((s) => ({ value: s.value as SoundPick, label: s.label, title: s.title })),
                          {
                            value: 'custom' as SoundPick,
                            label: 'Propio',
                            title: hasOwn ? 'Tu sonido' : 'Sube un sonido para elegirlo',
                            disabled: !hasOwn,
                          },
                        ]}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Escuchar: ${m.label}`}
                        title="Escuchar"
                        onClick={() => play(urlOf(m, picks[m.column]))}
                      >
                        <Play />
                      </Button>
                      <UploadButton
                        label={`Subir un sonido propio para «${m.label}»`}
                        busy={preparing === m.column}
                        disabled={busy}
                        onFile={(file) => void upload(m, file)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Si un cliente eligió «Solo vibración» en su teléfono, no suena ninguno.
              </p>
              <Button type="button" disabled={!dirty || busy} onClick={submit}>
                {save.isPending ? 'Guardando…' : 'Guardar sonidos'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** The rules an upload has to meet, said before the coach picks a file. */
function SoundRules() {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13px]">
      <div className="font-semibold text-foreground">Para subir tus propios sonidos</div>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Formato: {UPLOAD_RULES.formats}, de hasta {UPLOAD_RULES.maxMegabytes} MB.
        </li>
        <li>
          Duración: la que indica cada momento, sin contar el silencio del principio y del final. Un aviso
          corto se oye a tiempo; uno largo se pisa con lo siguiente.
        </li>
        <li>
          Al subirlo lo preparamos para la app: quitamos ese silencio, igualamos su volumen con el de los demás
          sonidos y lo guardamos en WAV.
        </li>
        <li>
          Tu sonido de «Termina el descanso» suena con la app abierta. Con la app en segundo plano o el teléfono
          bloqueado, la notificación usa el sonido Clásico.
        </li>
        <li>Usa sonidos tuyos o con licencia para usarlos en una app (libres de derechos o comprados).</li>
      </ul>
    </div>
  );
}

/** «Subir»: opens the file picker; the chosen file goes to `onFile`. */
function UploadButton({
  label,
  busy,
  disabled,
  onFile,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        Subir
      </Button>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_RULES.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
    </>
  );
}
