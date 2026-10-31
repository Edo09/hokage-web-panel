import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookmarkPlus,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  FileDown,
  LibraryBig,
  Lock,
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
import { Field } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { exportProgramPdf } from '@/lib/programPdf';
import { ProgramBuilder } from '@/components/program/ProgramBuilder';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import { LockFutureWeeksSwitch } from '@/components/program/LockFutureWeeksSwitch';
import { programToPreview } from '@/components/program/previewModel';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { draftKey, hasDraft } from '@/lib/programDraft';
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
import { PlanCard, PlanTag, type PlanMenuItem } from '@/components/shared/PlanCard';
import { AssignDialog } from '@/components/shared/AssignDialog';

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
  const [showHistory, setShowHistory] = useState(false);
  // An unsaved draft survives a refresh, but the coach can't see that until the
  // builder is reopened — so advertise it on the button. Re-checked whenever the
  // builder closes (it clears the draft on a successful save).
  const draftWaiting = useMemo(
    () => !builderOpen && !editing && hasDraft(draftKey(client.id, 'new')),
    [builderOpen, editing, client.id],
  );
  const firstName = (client.display_name ?? client.email).split(' ')[0];

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

  const sorted = [...(programs ?? [])].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const current = sorted.filter((p) => p.status === 'active');
  const older = sorted.filter((p) => p.status !== 'active');

  const card = (p: ProgramWithDetail) => {
    const exCount = p.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
    // "Finished" = every prescribed exercise checked off for every week.
    const target = exCount * p.duration_weeks;
    const done = Math.min(completionCounts?.[p.id] ?? 0, target);
    const pct = target > 0 ? Math.round((done / target) * 100) : 0;
    const finished = target > 0 && done >= target;
    const isActive = p.status === 'active';
    const busy = statusBusy === p.id;
    const menu: PlanMenuItem[] = [
      { label: 'Vista previa', icon: Smartphone, onSelect: () => setPreviewing(p) },
      {
        label: 'Exportar PDF',
        icon: FileDown,
        onSelect: () =>
          void exportProgramPdf(p, client.display_name ?? client.email)
            .then(() => toast.success('PDF descargado'))
            .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF')),
      },
      { label: 'Guardar como plantilla', icon: BookmarkPlus, onSelect: () => setSaveAsTemplate(p) },
      ...(isActive
        ? [
            {
              label: 'Marcar completado',
              icon: CheckCircle2,
              onSelect: () => void changeStatus(p, 'completed', `"${p.name}" completado`),
              disabled: busy,
              divide: true,
            },
          ]
        : []),
      { label: 'Eliminar', icon: Trash2, onSelect: () => setPendingDelete(p), destructive: true, divide: !isActive },
    ];

    return (
      <PlanCard
        key={p.id}
        title={p.name}
        subtitle={p.focus}
        archived={!isActive}
        facts={[
          { value: p.duration_weeks, label: p.duration_weeks === 1 ? 'semana' : 'semanas' },
          { value: p.program_days.length, label: p.program_days.length === 1 ? 'día' : 'días' },
          { value: exCount, label: exCount === 1 ? 'ejercicio' : 'ejercicios' },
        ]}
        tags={
          <>
            <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold', STATUS_BADGE[p.status])}>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              {isActive ? 'Activo en la app' : STATUS_LABEL[p.status]}
            </span>
            {p.lock_future_weeks && <PlanTag icon={Lock}>Solo semana actual</PlanTag>}
          </>
        }
        footnote={`Desde ${fmtDate(p.start_date)}`}
        onOpen={() => setEditing(p)}
        openLabel={`Editar ${p.name}`}
        menu={menu}
        actions={
          <>
            <Button variant={isActive ? 'outline' : 'ghost'} size="sm" onClick={() => setEditing(p)}>
              <Pencil /> Editar
            </Button>
            {!isActive && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void changeStatus(p, 'active', `"${p.name}" activado: ${firstName} ya lo ve en la app`)}
              >
                <Play /> {busy ? 'Activando…' : 'Activar'}
              </Button>
            )}
          </>
        }
      >
        {/* The client's progress through the block (checked exercise-weeks). */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className={cn('flex items-center gap-1.5 font-medium', finished ? 'text-success' : 'text-muted-foreground')}>
              {finished && <CheckCircle2 className="h-4 w-4" />}
              {finished ? 'Lo terminó' : 'Avance'}
            </span>
            <span className="tabular-nums text-muted-foreground">
              <b className="font-semibold text-foreground">{pct}%</b> · {done}/{target}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', finished ? 'bg-success' : 'bg-foreground')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </PlanCard>
    );
  };

  const newLabel = draftWaiting ? 'Continuar borrador' : 'Nuevo programa';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setTemplatePickerOpen(true)}>
          <LibraryBig /> Usar plantilla
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setBuilderOpen(true);
          }}
        >
          <Plus strokeWidth={2.5} />
          {newLabel}
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
        <Card>
          <EmptyState icon={CalendarRange} title="No se pudieron cargar los programas" description="Revisa tu conexión e inténtalo otra vez.">
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        </Card>
      ) : isPending ? (
        <Card className="h-[220px] animate-pulse bg-muted/40" />
      ) : programs.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={CalendarRange}
            title={`${firstName} aún no tiene programa`}
            description="Asígnale una plantilla o arma un bloque a su medida."
          />
        </Card>
      ) : (
        <>
          {current.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">{current.map(card)}</div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Ningún programa está activo en la app.</p>
          )}
          {older.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                aria-expanded={showHistory}
                className="flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', !showHistory && '-rotate-90')} />
                Anteriores ({older.length})
              </button>
              {showHistory && <div className="grid gap-3 lg:grid-cols-2">{older.map(card)}</div>}
            </>
          )}
        </>
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileProgramPreview program={programToPreview(previewing)} fitToViewport />}
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog
        program={saveAsTemplate}
        clientName={firstName}
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
            <AlertDialogTitle>¿Eliminar «{pendingDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece de la app de {firstName} con todos sus días, ejercicios y semanas. No se puede deshacer.
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
  clientName,
  onClose,
  onSaved,
}: {
  program: ProgramWithDetail | null;
  clientName: string;
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
          <DialogDescription>Se copia a tu biblioteca; el programa de {clientName} no cambia.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Nombre de la plantilla" htmlFor="sat-name">
            <Input id="sat-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar plantilla'}
            </Button>
          </DialogFooter>
        </form>
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
  // «Solo semana actual» for this copy: pre-set from the picked template, and
  // reset whenever the coach picks a different one.
  const [lockFutureWeeks, setLockFutureWeeks] = useState(false);
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setLockFutureWeeks(false);
  }

  return (
    <AssignDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Asignar desde plantilla"
      description="Pasa a ser su programa activo."
      tip="Recibe una copia: editar la plantilla después no cambia la suya. Su programa activo anterior se archiva."
      pickLabel="Plantilla"
      searchPlaceholder="Buscar programa"
      emptyText="Aún no tienes programas guardados. Créalos en Programas."
      defaultStart="tomorrow"
      options={templates?.map((tpl) => {
        const exCount = tpl.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
        return {
          id: tpl.id,
          title: tpl.name,
          subtitle: `${tpl.duration_weeks} sem, ${tpl.program_days.length} días, ${exCount} ejercicios`,
        };
      })}
      onSelectedChange={(id) => setLockFutureWeeks(templates?.find((t) => t.id === id)?.lock_future_weeks ?? false)}
      extra={(picked) => (
        <LockFutureWeeksSwitch id="tp-lock" checked={lockFutureWeeks} onCheckedChange={setLockFutureWeeks} disabled={picked == null} />
      )}
      submitLabel={() => 'Asignar'}
      onSubmit={async (picked, startDate) => {
        const tpl = templates?.find((t) => t.id === picked);
        await assignTemplate(picked, clientId, startDate, lockFutureWeeks);
        toast.success(`"${tpl?.name ?? 'Programa'}" asignado`);
        onAssigned();
      }}
    />
  );
}
