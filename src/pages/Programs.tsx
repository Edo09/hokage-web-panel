import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  CalendarRange,
  Dumbbell,
  FileDown,
  Lock,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { ProgramWithDetail, TemplateAssignment } from '@/types';
import {
  assignTemplate,
  deleteProgram,
  listProgramTemplates,
  listTemplateAssignments,
  setProgramStatus,
} from '@/services/programs';
import { listClientSummaries } from '@/services/clients';
import { exportProgramPdf } from '@/lib/programPdf';
import { ProgramBuilder } from '@/components/program/ProgramBuilder';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import { LockFutureWeeksSwitch } from '@/components/program/LockFutureWeeksSwitch';
import { programToPreview } from '@/components/program/previewModel';
import { errorMessage } from '@/lib/dbError';
import { draftKey, hasDraft } from '@/lib/programDraft';
import { qk } from '@/lib/queryClient';
import { avatarColor, matchesQuery } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Avatar } from '@/components/shared/Avatar';
import { PlanCard, PlanTag, type PlanAssignee, type PlanMenuItem } from '@/components/shared/PlanCard';
import { AssignDialog } from '@/components/shared/AssignDialog';
import { ArchivedToggle, LibraryGrid, LibrarySearch, LibrarySkeleton } from '@/components/shared/Library';

const toAssignees = (rows: TemplateAssignment[]): PlanAssignee[] =>
  rows.map((a) => ({ key: a.program_id, clientId: a.client_id, name: a.client_name, status: a.status, startDate: a.start_date }));

/**
 * The reusable program library. A template is a program with no client; the
 * coach builds it once here and assigns copies to clients (each copy is a
 * snapshot, so editing a template never disturbs someone's running block).
 */
export default function Programs() {
  const queryClient = useQueryClient();

  const { data: templates, isPending, isError, refetch } = useQuery({
    queryKey: qk.programTemplates,
    queryFn: listProgramTemplates,
  });
  const { data: assignments } = useQuery({
    queryKey: qk.templateAssignments,
    queryFn: listTemplateAssignments,
  });

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramWithDetail | null>(null);
  const [assignTarget, setAssignTarget] = useState<ProgramWithDetail | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ProgramWithDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<ProgramWithDetail | null>(null);
  // Archived templates are retired clutter — kept, but out of the way.
  const [showArchived, setShowArchived] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProgramWithDetail | null>(null);
  const [query, setQuery] = useState('');
  // Surface a draft that survived a refresh — otherwise the coach assumes the
  // work is gone and starts over.
  const draftWaiting = useMemo(
    () => !builderOpen && !editing && hasDraft(draftKey('template', 'new')),
    [builderOpen, editing],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.programTemplates });
    void queryClient.invalidateQueries({ queryKey: qk.templateAssignments });
  };
  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  // Templates are never deleted — retiring one just takes it off the shelf, so
  // the history of who ran it stays intact and it can come back later.
  const setShelfState = async (tpl: ProgramWithDetail, archived: boolean) => {
    setBusyId(tpl.id);
    try {
      await setProgramStatus(tpl.id, archived ? 'archived' : 'active');
      toast.success(archived ? `"${tpl.name}" archivado` : `"${tpl.name}" restaurado`);
      setPendingArchive(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado de la plantilla');
    } finally {
      setBusyId(null);
    }
  };

  // Permanent removal, offered only once a template is archived. Assigned
  // copies survive: programs.template_id is ON DELETE SET NULL, so no client
  // loses the block they are running.
  const destroyTemplate = async (tpl: ProgramWithDetail) => {
    setBusyId(tpl.id);
    try {
      await deleteProgram(tpl.id);
      toast.success(`"${tpl.name}" eliminado`);
      setPendingDelete(null);
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar la plantilla'));
    } finally {
      setBusyId(null);
    }
  };

  const all = (templates ?? []).filter((t) => matchesQuery(query, t.name, t.focus));
  const activeTemplates = all.filter((t) => t.status === 'active');
  const archivedTemplates = all.filter((t) => t.status !== 'active');

  const card = (tpl: ProgramWithDetail) => {
    const archived = tpl.status !== 'active';
    const exCount = tpl.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
    const busy = busyId === tpl.id;
    const menu: PlanMenuItem[] = [
      { label: 'Vista previa', icon: Smartphone, onSelect: () => setPreviewing(tpl) },
      {
        label: 'Exportar PDF',
        icon: FileDown,
        onSelect: () =>
          void exportProgramPdf(tpl, 'Plantilla')
            .then(() => toast.success('PDF descargado'))
            .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF')),
      },
      ...(archived
        ? [
            { label: 'Restaurar', icon: ArchiveRestore, onSelect: () => void setShelfState(tpl, false), disabled: busy, divide: true },
            // Permanent removal is only reachable once retired — archive first.
            { label: 'Eliminar para siempre', icon: Trash2, onSelect: () => setPendingDelete(tpl), disabled: busy, destructive: true },
          ]
        : [{ label: 'Archivar', icon: Archive, onSelect: () => setPendingArchive(tpl), disabled: busy, divide: true }]),
    ];
    return (
      <PlanCard
        key={tpl.id}
        title={tpl.name}
        subtitle={tpl.focus}
        archived={archived}
        facts={[
          { value: tpl.duration_weeks, label: tpl.duration_weeks === 1 ? 'semana' : 'semanas' },
          { value: tpl.program_days.length, label: tpl.program_days.length === 1 ? 'día' : 'días' },
          { value: exCount, label: exCount === 1 ? 'ejercicio' : 'ejercicios' },
        ]}
        tags={tpl.lock_future_weeks ? <PlanTag icon={Lock}>Solo semana actual</PlanTag> : undefined}
        assigned={toAssignees(assignments?.[tpl.id] ?? [])}
        onOpen={() => setEditing(tpl)}
        openLabel={`Editar ${tpl.name}`}
        menu={menu}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(tpl)}>
              <Pencil /> Editar
            </Button>
            {!archived && (
              <Button variant="outline" size="sm" onClick={() => setAssignTarget(tpl)}>
                <UserPlus /> Asignar
              </Button>
            )}
          </>
        }
      />
    );
  };

  const newLabel = draftWaiting ? 'Continuar borrador' : 'Nuevo programa';

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {(templates?.length ?? 0) > 4 ? (
          <LibrarySearch query={query} onQuery={setQuery} placeholder="Buscar programa" />
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Tus bloques, listos para asignar
            <InfoTip label="Cómo funcionan las plantillas">
              Créalos una vez y asígnalos a quien quieras. Cada cliente recibe una copia: editar aquí no cambia el bloque
              que alguien ya sigue.
            </InfoTip>
          </p>
        )}
        <Button className="ml-auto" onClick={() => setBuilderOpen(true)} aria-label={newLabel}>
          <Plus strokeWidth={2.5} />
          <span className="hidden sm:inline">{newLabel}</span>
        </Button>
      </div>

      {(builderOpen || editing) && (
        <ProgramBuilder
          key={editing?.id ?? 'new-template'}
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
          <EmptyState icon={CalendarRange} title="No se pudo cargar la biblioteca" description="Revisa tu conexión e inténtalo otra vez.">
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        </Card>
      ) : isPending ? (
        <LibrarySkeleton />
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState icon={Dumbbell} title="Aún no tienes programas" description="Arma un bloque una vez y asígnalo a varios clientes.">
            <Button onClick={() => setBuilderOpen(true)}>
              <Plus strokeWidth={2.5} /> Crear el primero
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <>
          {activeTemplates.length > 0 ? (
            <LibraryGrid>{activeTemplates.map(card)}</LibraryGrid>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              {query ? 'Ningún programa coincide con la búsqueda.' : 'Todos tus programas están archivados.'}
            </p>
          )}
          <ArchivedToggle count={archivedTemplates.length} open={showArchived} onToggle={() => setShowArchived((v) => !v)} />
          {showArchived && <LibraryGrid>{archivedTemplates.map(card)}</LibraryGrid>}
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

      <AssignToClient
        template={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          invalidate();
          void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });
        }}
      />

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{pendingDelete?.name}» para siempre?</AlertDialogTitle>
            <AlertDialogDescription>
              No se puede deshacer. Los programas que ya asignaste no se tocan: siguen en la app de tus clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busyId != null} onClick={() => pendingDelete && void destroyTemplate(pendingDelete)}>
              {busyId != null ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingArchive != null} onOpenChange={(o) => !o && setPendingArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar «{pendingArchive?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en tu biblioteca, pero no se borra. Los clientes que ya lo tienen no notan nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busyId != null} onClick={() => pendingArchive && void setShelfState(pendingArchive, true)}>
              {busyId != null ? 'Archivando…' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssignToClient({
  template,
  onClose,
  onAssigned,
}: {
  template: ProgramWithDetail | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { data: clients } = useQuery({
    queryKey: qk.clientSummaries,
    queryFn: listClientSummaries,
    enabled: template != null,
  });
  // «Solo semana actual» for this copy: pre-set from the template each time
  // the dialog opens for one.
  const [lockFutureWeeks, setLockFutureWeeks] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if ((template?.id ?? null) !== seededFor) {
    setSeededFor(template?.id ?? null);
    setLockFutureWeeks(template?.lock_future_weeks ?? false);
  }

  return (
    <AssignDialog
      open={template != null}
      onOpenChange={(o) => !o && onClose()}
      title={`Asignar «${template?.name ?? ''}»`}
      description="Pasa a ser su programa activo."
      tip="El cliente recibe una copia; su programa activo anterior se archiva. Editar la plantilla después no cambia su copia."
      pickLabel="Cliente"
      searchPlaceholder="Buscar cliente"
      emptyText="Aún no tienes clientes."
      defaultStart="tomorrow"
      options={clients?.map((c) => ({
        id: c.id,
        title: c.display_name ?? c.email,
        subtitle: c.display_name ? c.email : undefined,
        leading: <Avatar name={c.display_name ?? c.email} color={avatarColor(c.id)} size={32} />,
      }))}
      extra={() => <LockFutureWeeksSwitch id="as-lock" checked={lockFutureWeeks} onCheckedChange={setLockFutureWeeks} />}
      submitLabel={(c) => (c ? `Asignar a ${c.title.split(' ')[0]}` : 'Asignar')}
      onSubmit={async (clientId, startDate) => {
        if (!template) return;
        await assignTemplate(template.id, clientId, startDate, lockFutureWeeks);
        const c = clients?.find((x) => x.id === clientId);
        toast.success(`"${template.name}" asignado a ${c?.display_name ?? c?.email ?? 'el cliente'}`);
        onAssigned();
      }}
    />
  );
}
