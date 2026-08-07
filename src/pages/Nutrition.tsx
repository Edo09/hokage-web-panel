import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Apple,
  Archive,
  ArchiveRestore,
  FileDown,
  Layers,
  Pencil,
  Pill,
  Plus,
  Smartphone,
  UserPlus,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import type { NutritionPlanWithDetail, PlanAssignment, SupplementPlanWithDetail } from '@/types';
import {
  assignNutritionTemplate,
  listNutritionAssignments,
  listNutritionTemplates,
  setNutritionPlanStatus,
} from '@/services/nutritionPlans';
import {
  assignSupplementTemplate,
  listSupplementAssignments,
  listSupplementTemplates,
  setSupplementPlanStatus,
} from '@/services/supplementPlans';
import { listClientSummaries } from '@/services/clients';
import { exportNutritionPdf, exportSupplementPdf } from '@/lib/nutritionPdf';
import { NutritionPlanBuilder } from '@/components/nutrition/NutritionPlanBuilder';
import { SupplementPlanBuilder } from '@/components/nutrition/SupplementPlanBuilder';
import { MobileNutritionPreview } from '@/components/nutrition/MobileNutritionPreview';
import {
  emptyPlanPreview,
  planToPreview,
  supplementPlanToPreview,
} from '@/components/nutrition/previewModel';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { qk } from '@/lib/queryClient';
import { cn, fmtDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * The reusable nutrition library. Two independent shelves — diets and
 * supplement stacks — because a coach swaps one far more often than the other.
 * Each template is a plan with no client; assigning copies it, so editing here
 * never disturbs a phase someone is already running.
 */
export default function Nutrition() {
  return (
    <div className="flex animate-fade-up flex-col gap-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold">Nutrición</h1>
        <p className="text-[13px] text-muted-foreground">
          Tu biblioteca de planes reutilizables. Créalos una vez y asígnalos a cuantos clientes
          quieras — cada asignación es una copia, así que editar aquí no altera el plan que alguien
          ya está siguiendo. Los planes nutricionales y los de suplementación se asignan por
          separado.
        </p>
      </div>

      <Tabs defaultValue="nutricion">
        <TabsList>
          <TabsTrigger value="nutricion">
            <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={2} /> Planes nutricionales
          </TabsTrigger>
          <TabsTrigger value="suplementos">
            <Pill className="h-3.5 w-3.5" strokeWidth={2} /> Suplementación
          </TabsTrigger>
        </TabsList>
        <TabsContent value="nutricion">
          <NutritionLibrary />
        </TabsContent>
        <TabsContent value="suplementos">
          <SupplementLibrary />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- nutrition shelf ---------------- */

function NutritionLibrary() {
  const queryClient = useQueryClient();
  const { data: templates, isPending, isError, refetch } = useQuery({
    queryKey: qk.nutritionTemplates,
    queryFn: listNutritionTemplates,
  });
  const { data: assignments } = useQuery({
    queryKey: qk.nutritionAssignments,
    queryFn: listNutritionAssignments,
  });

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<NutritionPlanWithDetail | null>(null);
  const [assignTarget, setAssignTarget] = useState<NutritionPlanWithDetail | null>(null);
  const [pendingArchive, setPendingArchive] = useState<NutritionPlanWithDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<NutritionPlanWithDetail | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.nutritionTemplates });
    void queryClient.invalidateQueries({ queryKey: qk.nutritionAssignments });
  };
  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const setShelfState = async (tpl: NutritionPlanWithDetail, archived: boolean) => {
    setBusyId(tpl.id);
    try {
      await setNutritionPlanStatus(tpl.id, archived ? 'archived' : 'active');
      toast.success(archived ? `"${tpl.name}" archivado` : `"${tpl.name}" restaurado`);
      setPendingArchive(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado de la plantilla');
    } finally {
      setBusyId(null);
    }
  };

  const active = (templates ?? []).filter((t) => t.status === 'active');
  const archived = (templates ?? []).filter((t) => t.status !== 'active');

  return (
    <div className="flex flex-col gap-4">
      {!builderOpen && !editing && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Crear plan nutricional
          </Button>
        </div>
      )}

      {(builderOpen || editing) && (
        <NutritionPlanBuilder
          key={editing?.id ?? 'new-nutrition-template'}
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
            icon={Apple}
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
          <div className="p-6 text-center text-[13px] text-faint">Cargando planes…</div>
        </Card>
      ) : templates.length === 0 && !builderOpen ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={UtensilsCrossed}
            title="Sin planes guardados"
            description="Crea tu primer plan reutilizable para asignarlo a varios clientes sin volver a armarlo."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((tpl) => (
            <NutritionCard
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

          {archived.length > 0 && (
            <>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-faint">
                <Archive className="h-3.5 w-3.5" strokeWidth={2} />
                Archivados ({archived.length})
              </div>
              {archived.map((tpl) => (
                <NutritionCard
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
          {previewing && <MobileNutritionPreview plan={planToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <AssignDialog
        planName={assignTarget?.name ?? null}
        blurb="Se crea una copia para el cliente y pasa a ser su plan nutricional activo — el anterior se archiva automáticamente."
        onAssign={(clientId, startDate) =>
          assignNutritionTemplate(assignTarget!.id, clientId, startDate)
        }
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          invalidate();
          void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });
        }}
      />

      <ArchiveAlert
        name={pendingArchive?.name ?? null}
        busy={busyId != null}
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => pendingArchive && void setShelfState(pendingArchive, true)}
      />
    </div>
  );
}

function NutritionCard({
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
  template: NutritionPlanWithDetail;
  assigned: PlanAssignment[];
  busy?: boolean;
  archived?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onAssign?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const mealCount = template.nutrition_plan_meals.length;
  const foodCount = template.nutrition_plan_meals.reduce(
    (a, m) =>
      a + m.nutrition_plan_options.reduce((b, o) => b + o.nutrition_plan_option_items.length, 0),
    0,
  );
  const activeCount = assigned.filter((a) => a.status === 'active').length;

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
        <CardActions
          name={template.name}
          archived={archived}
          busy={busy}
          onPdf={() =>
            exportNutritionPdf(template, 'Plantilla').then(
              () => {
                toast.success('PDF descargado');
              },
              (e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF');
              },
            )
          }
          onPreview={onPreview}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
        <Chip icon={UtensilsCrossed}>
          {mealCount} {mealCount === 1 ? 'comida' : 'comidas'}
        </Chip>
        <Chip icon={Layers}>
          {foodCount} {foodCount === 1 ? 'alimento' : 'alimentos'}
        </Chip>
        {template.day_cycling && <Chip icon={Apple}>Ciclado de carbohidratos</Chip>}
        <Chip icon={Users}>{assignedLabel(assigned.length, activeCount)}</Chip>
      </div>

      <AssignedStrip assigned={assigned} archived={archived} onAssign={onAssign} />
    </Card>
  );
}

/* ---------------- supplement shelf ---------------- */

function SupplementLibrary() {
  const queryClient = useQueryClient();
  const { data: templates, isPending, isError, refetch } = useQuery({
    queryKey: qk.supplementTemplates,
    queryFn: listSupplementTemplates,
  });
  const { data: assignments } = useQuery({
    queryKey: qk.supplementAssignments,
    queryFn: listSupplementAssignments,
  });

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<SupplementPlanWithDetail | null>(null);
  const [assignTarget, setAssignTarget] = useState<SupplementPlanWithDetail | null>(null);
  const [pendingArchive, setPendingArchive] = useState<SupplementPlanWithDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<SupplementPlanWithDetail | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.supplementTemplates });
    void queryClient.invalidateQueries({ queryKey: qk.supplementAssignments });
  };
  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const setShelfState = async (tpl: SupplementPlanWithDetail, archived: boolean) => {
    setBusyId(tpl.id);
    try {
      await setSupplementPlanStatus(tpl.id, archived ? 'archived' : 'active');
      toast.success(archived ? `"${tpl.name}" archivado` : `"${tpl.name}" restaurado`);
      setPendingArchive(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado de la plantilla');
    } finally {
      setBusyId(null);
    }
  };

  const active = (templates ?? []).filter((t) => t.status === 'active');
  const archived = (templates ?? []).filter((t) => t.status !== 'active');

  return (
    <div className="flex flex-col gap-4">
      {!builderOpen && !editing && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Crear suplementación
          </Button>
        </div>
      )}

      {(builderOpen || editing) && (
        <SupplementPlanBuilder
          key={editing?.id ?? 'new-supplement-template'}
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
            icon={Pill}
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
          <div className="p-6 text-center text-[13px] text-faint">Cargando suplementación…</div>
        </Card>
      ) : templates.length === 0 && !builderOpen ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={Pill}
            title="Sin planes de suplementación"
            description="Crea un stack reutilizable con dosis y horarios para asignarlo a varios clientes."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((tpl) => (
            <SupplementCard
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

          {archived.length > 0 && (
            <>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-faint">
                <Archive className="h-3.5 w-3.5" strokeWidth={2} />
                Archivados ({archived.length})
              </div>
              {archived.map((tpl) => (
                <SupplementCard
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
          {previewing && (
            <MobileNutritionPreview
              plan={emptyPlanPreview()}
              supplements={supplementPlanToPreview(previewing)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AssignDialog
        planName={assignTarget?.name ?? null}
        blurb="Se crea una copia para el cliente y pasa a ser su suplementación activa — la anterior se archiva automáticamente."
        onAssign={(clientId, startDate) =>
          assignSupplementTemplate(assignTarget!.id, clientId, startDate)
        }
        onClose={() => setAssignTarget(null)}
        onAssigned={() => {
          setAssignTarget(null);
          invalidate();
          void queryClient.invalidateQueries({ queryKey: qk.clientSummaries });
        }}
      />

      <ArchiveAlert
        name={pendingArchive?.name ?? null}
        busy={busyId != null}
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => pendingArchive && void setShelfState(pendingArchive, true)}
      />
    </div>
  );
}

function SupplementCard({
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
  template: SupplementPlanWithDetail;
  assigned: PlanAssignment[];
  busy?: boolean;
  archived?: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onAssign?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const items = template.supplement_plan_items;
  const base = items.filter((i) => i.tier === 'base').length;
  const activeCount = assigned.filter((a) => a.status === 'active').length;

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
          {template.description && (
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">{template.description}</div>
          )}
        </div>
        <CardActions
          name={template.name}
          archived={archived}
          busy={busy}
          onPdf={() =>
            exportSupplementPdf(template, 'Plantilla').then(
              () => {
                toast.success('PDF descargado');
              },
              (e: unknown) => {
                toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF');
              },
            )
          }
          onPreview={onPreview}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
        <Chip icon={Pill}>
          {items.length} {items.length === 1 ? 'suplemento' : 'suplementos'}
        </Chip>
        {base > 0 && <Chip icon={Layers}>{base} base</Chip>}
        <Chip icon={Users}>{assignedLabel(assigned.length, activeCount)}</Chip>
      </div>

      <AssignedStrip assigned={assigned} archived={archived} onAssign={onAssign} />
    </Card>
  );
}

/* ---------------- shared bits ---------------- */

const assignedLabel = (total: number, active: number): string =>
  total === 0
    ? 'Sin asignar'
    : `${total} ${total === 1 ? 'cliente' : 'clientes'}${
        active > 0 ? ` · ${active} activo${active === 1 ? '' : 's'}` : ''
      }`;

function CardActions({
  name,
  archived,
  busy,
  onPdf,
  onPreview,
  onEdit,
  onArchive,
  onRestore,
}: {
  name: string;
  archived?: boolean;
  busy?: boolean;
  onPdf: () => Promise<void>;
  onPreview: () => void;
  onEdit: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  return (
    <span className="flex flex-none items-center gap-1">
      <IconBtn label={`Exportar ${name} a PDF`} title="Exportar a PDF" onClick={() => void onPdf()}>
        <FileDown className="h-3 w-3" strokeWidth={2.25} />
      </IconBtn>
      <IconBtn label={`Vista previa de ${name}`} title="Vista previa en la app" onClick={onPreview}>
        <Smartphone className="h-3 w-3" strokeWidth={2.25} />
      </IconBtn>
      <IconBtn label={`Editar ${name}`} title="Editar" onClick={onEdit}>
        <Pencil className="h-3 w-3" strokeWidth={2.25} />
      </IconBtn>
      {archived ? (
        <IconBtn
          label={`Restaurar ${name}`}
          title="Restaurar"
          onClick={() => onRestore?.()}
          disabled={busy}
        >
          <ArchiveRestore className="h-3 w-3" strokeWidth={2.25} />
        </IconBtn>
      ) : (
        <IconBtn
          label={`Archivar ${name}`}
          title="Archivar"
          onClick={() => onArchive?.()}
          disabled={busy}
          danger
        >
          <Archive className="h-3 w-3" strokeWidth={2.25} />
        </IconBtn>
      )}
    </span>
  );
}

function AssignedStrip({
  assigned,
  archived,
  onAssign,
}: {
  assigned: PlanAssignment[];
  archived?: boolean;
  onAssign?: () => void;
}) {
  return (
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
              key={a.plan_id}
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
        <p className="mt-3 text-[12px] text-faint">Restaura la plantilla para volver a asignarla.</p>
      ) : (
        <Button size="sm" className="mt-3" onClick={onAssign}>
          <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} /> Asignar a cliente
        </Button>
      )}
    </div>
  );
}

/** One dialog for both shelves — they differ only in which RPC runs. */
function AssignDialog({
  planName,
  blurb,
  onAssign,
  onClose,
  onAssigned,
}: {
  planName: string | null;
  blurb: string;
  onAssign: (clientId: string, startDate: string) => Promise<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { data: clients } = useQuery({
    queryKey: qk.clientSummaries,
    queryFn: listClientSummaries,
    enabled: planName != null,
  });

  const [clientId, setClientId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const list = clients ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => (c.display_name ?? c.email).toLowerCase().includes(q));
  }, [clients, query]);

  const submit = async () => {
    if (planName == null || clientId == null) return;
    setSaving(true);
    try {
      await onAssign(clientId, startDate);
      const c = clients?.find((x) => x.id === clientId);
      toast.success(`"${planName}" asignado a ${c?.display_name ?? c?.email ?? 'el cliente'}`);
      setClientId(null);
      setQuery('');
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar el plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={planName != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Asignar «{planName}»</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-muted-foreground">{blurb}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="na-start">Fecha de inicio</Label>
            <Input
              id="na-start"
              type="date"
              className="max-w-[180px]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="na-search">Cliente</Label>
            <Input
              id="na-search"
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

function ArchiveAlert({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={name != null} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Archivar &quot;{name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Sale de la lista de plantillas disponibles, pero no se borra: puedes restaurarlo cuando
            quieras. Los planes ya asignados a tus clientes siguen intactos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={onConfirm}>
            {busy ? 'Archivando…' : 'Archivar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

function Chip({ icon: Icon, children }: { icon?: typeof Users; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </span>
  );
}
