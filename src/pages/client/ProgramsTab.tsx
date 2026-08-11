import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookmarkPlus,
  CalendarRange,
  CheckCircle2,
  Copy,
  Dumbbell,
  FileDown,
  LibraryBig,
  Pencil,
  Play,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { ClientWithMeta, ProgramStatus, ProgramWithDetail } from '@/types';
import {
  assignTemplate,
  deleteProgram,
  getProgramCompletionCounts,
  listProgramTemplates,
  listProgramsForClient,
  saveProgramAsTemplate,
  setProgramStatus,
} from '@/services/programs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { exportProgramPdf } from '@/lib/programPdf';
import { ProgramBuilder } from '@/components/program/ProgramBuilder';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import { programToPreview } from '@/components/program/previewModel';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { qk } from '@/lib/queryClient';
import { cn, fmtDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import type { ReactNode } from 'react';

const isoDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const todayISO = (): string => isoDate(new Date());
// Assignments default to starting tomorrow: the write-time trigger rejects a
// start_date before the server's current_date, and a same-day default can land
// in the past across the UTC boundary.
const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
};

/* ---------------- tab ---------------- */

export function ProgramsTab({ client }: { client: ClientWithMeta }) {
  const queryClient = useQueryClient();
  const { data: programs, isPending, isError, refetch } = useQuery({
    queryKey: qk.programs(client.id),
    queryFn: () => listProgramsForClient(client.id),
  });
  const { data: completionCounts } = useQuery({
    queryKey: qk.programCompletions(client.id),
    queryFn: () => getProgramCompletionCounts(client.id),
  });

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramWithDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProgramWithDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState<ProgramWithDetail | null>(null);
  const [previewing, setPreviewing] = useState<ProgramWithDetail | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.programs(client.id) });
    void queryClient.invalidateQueries({ queryKey: qk.templateAssignments });
  };
  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  // Change one program's status. Activating another auto-archives the previous
  // active (DB trigger), so the whole list must refetch, not just this card.
  const changeStatus = async (p: ProgramWithDetail, status: ProgramStatus, msg: string) => {
    setStatusBusy(p.id);
    try {
      await setProgramStatus(p.id, status);
      toast.success(msg);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado del programa');
    } finally {
      setStatusBusy(null);
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setTemplatePickerOpen(true)}>
            <LibraryBig className="h-3.5 w-3.5" strokeWidth={2.25} /> Usar plantilla
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Crear programa
          </Button>
        </div>
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
          {[...programs]
            .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'))
            .map((p) => {
            const exCount = p.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
            // "Finished" = every prescribed exercise checked off for every week.
            const target = exCount * p.duration_weeks;
            const done = Math.min(completionCounts?.[p.id] ?? 0, target);
            const pct = target > 0 ? Math.round((done / target) * 100) : 0;
            const finished = target > 0 && done >= target;
            const isActive = p.status === 'active';
            const busy = statusBusy === p.id;
            return (
              <Card key={p.id} className={cn('p-5', isActive && 'border-[1.5px] border-primary/60')}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-[15px] font-semibold">{p.name}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide',
                          STATUS_BADGE[p.status],
                        )}
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    {p.focus && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{p.focus}</div>}
                  </div>
                  <span className="flex flex-none items-center gap-1">
                    <button
                      onClick={() => {
                        void exportProgramPdf(p, client.display_name ?? client.email)
                          .then(() => toast.success('PDF descargado'))
                          .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF'));
                      }}
                      aria-label={`Exportar ${p.name} a PDF`}
                      title="Exportar a PDF"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <FileDown className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => setPreviewing(p)}
                      aria-label={`Vista previa de ${p.name}`}
                      title="Vista previa en la app"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Smartphone className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                    <button
                      onClick={() => setSaveAsTemplate(p)}
                      aria-label={`Guardar ${p.name} como plantilla`}
                      title="Guardar como plantilla"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-secondary hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <BookmarkPlus className="h-3 w-3" strokeWidth={2.25} />
                    </button>
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

                {/* Client progress through the block (checked exercise-weeks). */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11.5px]">
                    <span className={cn('font-semibold', finished ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                      {finished ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Completado por el cliente
                        </span>
                      ) : (
                        'Progreso del cliente'
                      )}
                    </span>
                    <span className="font-semibold tabular-nums text-faint">
                      {done}/{target} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', finished ? 'bg-emerald-500' : 'bg-primary')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Activate / complete — one program is active at a time. */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {isActive ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                        <Play className="h-3.5 w-3.5" strokeWidth={2.5} /> Programa activo en la app
                      </span>
                      {finished && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          disabled={busy}
                          onClick={() => void changeStatus(p, 'completed', `"${p.name}" marcado como completado`)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Marcar completado
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-[12px] text-faint">
                        {p.status === 'completed' ? 'Bloque terminado.' : 'Guardado, no visible en la app.'}
                      </span>
                      <Button
                        size="sm"
                        className="ml-auto"
                        disabled={busy}
                        onClick={() => void changeStatus(p, 'active', `"${p.name}" activado · el cliente ya lo ve en la app`)}
                      >
                        <Play className="h-3.5 w-3.5" strokeWidth={2.5} /> {busy ? 'Activando…' : 'Activar'}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vista previa · app del cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileProgramPreview program={programToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog
        program={saveAsTemplate}
        onClose={() => setSaveAsTemplate(null)}
        onSaved={() => {
          setSaveAsTemplate(null);
          void queryClient.invalidateQueries({ queryKey: qk.programTemplates });
        }}
      />

      <TemplatePicker
        open={templatePickerOpen}
        clientId={client.id}
        onClose={() => setTemplatePickerOpen(false)}
        onAssigned={() => {
          setTemplatePickerOpen(false);
          invalidate();
        }}
      />

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

/** Promote this client's program into the reusable library. */
function SaveAsTemplateDialog({
  program,
  onClose,
  onSaved,
}: {
  program: ProgramWithDetail | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset the field whenever a different program opens the dialog.
  const [seeded, setSeeded] = useState<string | null>(null);
  if (program != null && program.id !== seeded) {
    setSeeded(program.id);
    setName(program.name);
  }

  const submit = async () => {
    if (program == null) return;
    if (!name.trim()) return toast.error('Ponle nombre a la plantilla');
    setSaving(true);
    try {
      await saveProgramAsTemplate(program.id, name.trim());
      toast.success(`"${name.trim()}" guardado en Programas`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={program != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-muted-foreground">
            Copia este bloque a tu biblioteca de Programas para reutilizarlo con otros clientes. El
            programa de este cliente no se modifica.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sat-name">Nombre de la plantilla</Label>
            <Input id="sat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar plantilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pick a saved program from the library and assign a copy to this client. */
function TemplatePicker({
  open,
  clientId,
  onClose,
  onAssigned,
}: {
  open: boolean;
  clientId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { data: allTemplates } = useQuery({
    queryKey: qk.programTemplates,
    queryFn: listProgramTemplates,
    enabled: open,
  });
  // Archived templates are off the shelf — not assignable.
  const templates = allTemplates?.filter((t) => t.status === 'active');
  const [picked, setPicked] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(tomorrowISO());
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (picked == null) return;
    setSaving(true);
    try {
      const tpl = templates?.find((t) => t.id === picked);
      await assignTemplate(picked, clientId, startDate);
      toast.success(`"${tpl?.name ?? 'Programa'}" asignado`);
      setPicked(null);
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar el programa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Asignar desde plantilla</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-muted-foreground">
            Se crea una copia para este cliente y pasa a ser su programa activo. Editar la plantilla
            más tarde no cambiará esta copia.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp-start">Fecha de inicio</Label>
            <Input
              id="tp-start"
              type="date"
              className="max-w-[180px]"
              min={todayISO()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
            {templates == null ? (
              <div className="p-4 text-center text-[12.5px] text-faint">Cargando plantillas…</div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center text-[12.5px] text-faint">
                No hay programas guardados todavía. Créalos en la sección Programas.
              </div>
            ) : (
              templates.map((tpl) => {
                const exCount = tpl.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
                const selected = picked === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setPicked(tpl.id)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 transition-colors',
                      selected ? 'bg-primary/10 dark:bg-primary/15' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('text-[13.5px] font-semibold', selected && 'text-primary')}>
                      {tpl.name}
                    </span>
                    <span className="text-[11.5px] text-faint">
                      {tpl.duration_weeks} semanas · {tpl.program_days.length} días · {exCount}{' '}
                      ejercicios
                      {tpl.focus ? ` · ${tpl.focus}` : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || picked == null}>
            {saving ? 'Asignando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ icon: Icon, children }: { icon?: typeof CalendarRange; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </span>
  );
}
