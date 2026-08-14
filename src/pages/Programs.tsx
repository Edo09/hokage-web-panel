import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  CalendarRange,
  ChevronDown,
  Copy,
  Dumbbell,
  FileDown,
  Pencil,
  Plus,
  Smartphone,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ProgramWithDetail, TemplateAssignment } from '@/types';
import {
  assignTemplate,
  listProgramTemplates,
  listTemplateAssignments,
  setProgramStatus,
} from '@/services/programs';
import { listClientSummaries } from '@/services/clients';
import { exportProgramPdf } from '@/lib/programPdf';
import { ProgramBuilder } from '@/components/program/ProgramBuilder';
import { MobileProgramPreview } from '@/components/program/MobileProgramPreview';
import { programToPreview } from '@/components/program/previewModel';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { draftKey, hasDraft } from '@/lib/programDraft';
import { qk } from '@/lib/queryClient';
import { cn, fmtDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const isoDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const todayISO = (): string => isoDate(new Date());

// Default program start is tomorrow: the write-time trigger rejects a
// start_date before the server's current_date, and a same-day default can
// land in the past across the UTC boundary. Starting next day is always valid.
const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoDate(d);
};

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

  const activeTemplates = (templates ?? []).filter((t) => t.status === 'active');
  const archivedTemplates = (templates ?? []).filter((t) => t.status !== 'active');

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-[22px] font-bold">Programas</h1>
          <p className="text-[13px] text-muted-foreground">
            Tu biblioteca de bloques reutilizables. Créalos una vez y asígnalos a cuantos clientes
            quieras — cada asignación es una copia, así que editar aquí no altera el bloque que
            alguien ya está siguiendo.
          </p>
        </div>
        {!builderOpen && !editing && (
          <Button
            onClick={() => {
              setEditing(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {draftWaiting ? 'Continuar borrador' : 'Crear programa'}
          </Button>
        )}
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
        <Card className="shadow-none">
          <EmptyState
            icon={CalendarRange}
            title="No se pudo cargar"
            description="Hubo un problema al cargar la biblioteca."
          >
            <Button variant="outline" onClick={() => void refetch()} className="mt-1">
              Reintentar
            </Button>
          </EmptyState>
        </Card>
      ) : isPending ? (
        <Card className="shadow-none">
          <div className="p-6 text-center text-[13px] text-faint">Cargando programas…</div>
        </Card>
      ) : templates.length === 0 && !builderOpen ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={Dumbbell}
            title="Sin programas guardados"
            description="Crea tu primer bloque reutilizable para asignarlo a varios clientes sin volver a armarlo."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {activeTemplates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              assigned={assignments?.[tpl.id] ?? []}
              busy={busyId === tpl.id}
              onPreview={() => setPreviewing(tpl)}
              onEdit={() => {
                setBuilderOpen(false);
                setEditing(tpl);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onAssign={() => setAssignTarget(tpl)}
              onArchive={() => setPendingArchive(tpl)}
            />
          ))}

          {archivedTemplates.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                className="mt-1 flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-faint transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={2} />
                {showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedTemplates.length})`}
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', showArchived && 'rotate-180')}
                  strokeWidth={2}
                />
              </button>

              {showArchived &&
                archivedTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    assigned={assignments?.[tpl.id] ?? []}
                    busy={busyId === tpl.id}
                    archived
                    onPreview={() => setPreviewing(tpl)}
                    onEdit={() => {
                      setBuilderOpen(false);
                      setEditing(tpl);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onRestore={() => void setShelfState(tpl, false)}
                  />
                ))}
            </>
          )}
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

      <AssignDialog
        template={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          invalidate();
          void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });
        }}
      />

      <AlertDialog open={pendingArchive != null} onOpenChange={(o) => !o && setPendingArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar &quot;{pendingArchive?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Sale de la lista de plantillas disponibles, pero no se borra: puedes restaurarlo cuando
              quieras. Los programas ya asignados a tus clientes siguen intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busyId != null}
              onClick={() => pendingArchive && void setShelfState(pendingArchive, true)}
            >
              {busyId != null ? 'Archivando…' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateCard({
  template,
  assigned,
  busy,
  archived,
  onPreview,
  onEdit,
  onAssign,
  onArchive,
  onRestore,
}: {
  template: ProgramWithDetail;
  assigned: TemplateAssignment[];
  busy?: boolean;
  archived?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onAssign?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const exCount = template.program_days.reduce((a, d) => a + d.program_exercises.length, 0);
  const active = assigned.filter((a) => a.status === 'active').length;

  return (
    <Card className={cn('p-5', archived && 'border-dashed opacity-75')}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-[15px] font-semibold">{template.name}</span>
            {archived && (
              <span className="rounded-full bg-muted px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                Archivado
              </span>
            )}
          </div>
          {template.focus && (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">{template.focus}</div>
          )}
        </div>
        <span className="flex flex-none items-center gap-1">
          <IconBtn
            label={`Exportar ${template.name} a PDF`}
            title="Exportar a PDF"
            onClick={() => {
              void exportProgramPdf(template, 'Plantilla')
                .then(() => toast.success('PDF descargado'))
                .catch((e) =>
                  toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF'),
                );
            }}
          >
            <FileDown className="h-3 w-3" strokeWidth={2.25} />
          </IconBtn>
          <IconBtn
            label={`Vista previa de ${template.name}`}
            title="Vista previa en la app"
            onClick={onPreview}
          >
            <Smartphone className="h-3 w-3" strokeWidth={2.25} />
          </IconBtn>
          <IconBtn label={`Editar ${template.name}`} title="Editar" onClick={onEdit}>
            <Pencil className="h-3 w-3" strokeWidth={2.25} />
          </IconBtn>
          {archived ? (
            <IconBtn
              label={`Restaurar ${template.name}`}
              title="Restaurar"
              onClick={() => onRestore?.()}
              disabled={busy}
            >
              <ArchiveRestore className="h-3 w-3" strokeWidth={2.25} />
            </IconBtn>
          ) : (
            <IconBtn
              label={`Archivar ${template.name}`}
              title="Archivar"
              onClick={() => onArchive?.()}
              disabled={busy}
              danger
            >
              <Archive className="h-3 w-3" strokeWidth={2.25} />
            </IconBtn>
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
        <Chip icon={CalendarRange}>{template.duration_weeks} semanas</Chip>
        <Chip icon={Dumbbell}>{template.program_days.length} días</Chip>
        <Chip icon={Copy}>{exCount} ejercicios</Chip>
        <Chip icon={Users}>
          {assigned.length === 0
            ? 'Sin asignar'
            : `${assigned.length} ${assigned.length === 1 ? 'cliente' : 'clientes'}${
                active > 0 ? ` · ${active} activo${active === 1 ? '' : 's'}` : ''
              }`}
        </Chip>
      </div>

      {template.progression_rule && (
        <p className="mt-3 text-[12px] text-faint">
          <span className="font-semibold text-muted-foreground">Progresión: </span>
          {template.progression_rule}
        </p>
      )}

      {/* Who's on this program */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" strokeWidth={2} /> Clientes asignados
        </div>
        {assigned.length === 0 ? (
          <p className="text-[12.5px] text-faint">
            Nadie lo tiene todavía. Asígnalo para que aparezca en su app.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigned.map((a) => (
              <span
                key={a.program_id}
                title={`Inicio ${fmtDate(a.start_date)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[12px]"
              >
                <span className="font-medium">{a.client_name}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-wide',
                    STATUS_BADGE[a.status],
                  )}
                >
                  {STATUS_LABEL[a.status]}
                </span>
              </span>
            ))}
          </div>
        )}
        {archived ? (
          <p className="mt-3 text-[12px] text-faint">
            Restaura la plantilla para volver a asignarla.
          </p>
        ) : (
          <Button size="sm" className="mt-3" onClick={onAssign}>
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} /> Asignar a cliente
          </Button>
        )}
      </div>
    </Card>
  );
}

function AssignDialog({
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

  const [clientId, setClientId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(tomorrowISO());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const list = clients ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c.display_name ?? c.email).toLowerCase().includes(q));
  }, [clients, query]);

  const submit = async () => {
    if (template == null || clientId == null) return;
    setSaving(true);
    try {
      await assignTemplate(template.id, clientId, startDate);
      const name = clients?.find((c) => c.id === clientId);
      toast.success(`"${template.name}" asignado a ${name?.display_name ?? name?.email ?? 'el cliente'}`);
      setClientId(null);
      setQuery('');
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar el programa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={template != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Asignar «{template?.name}»</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-muted-foreground">
            Se crea una copia para el cliente y pasa a ser su programa activo — el anterior se
            archiva automáticamente.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-start">Fecha de inicio</Label>
            <Input
              id="as-start"
              type="date"
              className="max-w-[180px]"
              min={todayISO()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-search">Cliente</Label>
            <Input
              id="as-search"
              placeholder="Buscar cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="mt-1 max-h-[260px] overflow-y-auto rounded-lg border border-border">
              {clients == null ? (
                <div className="p-4 text-center text-[12.5px] text-faint">Cargando clientes…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-[12.5px] text-faint">Sin resultados.</div>
              ) : (
                filtered.map((c) => {
                  const selected = clientId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-[13px] last:border-b-0 transition-colors',
                        selected ? 'bg-primary/10 text-primary dark:bg-primary/15' : 'hover:bg-muted',
                      )}
                    >
                      <span className="truncate font-medium">{c.display_name ?? c.email}</span>
                      {selected && <span className="text-[11px] font-bold">Seleccionado</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || clientId == null}>
            {saving ? 'Asignando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconBtn({
  label,
  title,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg border border-border text-faint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        danger ? 'hover:border-primary hover:text-primary' : 'hover:border-secondary hover:text-secondary',
      )}
    >
      {children}
    </button>
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
