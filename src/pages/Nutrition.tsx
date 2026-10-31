import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  CalendarRange,
  Dumbbell,
  FileDown,
  Pencil,
  Pill,
  Plus,
  Smartphone,
  UserPlus,
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
import { emptyPlanPreview, planToPreview, supplementPlanToPreview } from '@/components/nutrition/previewModel';
import { qk } from '@/lib/queryClient';
import { avatarColor, matchesQuery } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/**
 * The reusable nutrition library. Two independent shelves — diets and
 * supplement stacks — because a coach swaps one far more often than the other.
 * Each template is a plan with no client; assigning copies it, so editing here
 * never disturbs a phase someone is already running.
 */
export default function Nutrition() {
  const [tab, setTab] = useState<'nutricion' | 'suplementos'>('nutricion');
  // "New" lives here so the button can sit in the tab row; editing an
  // existing template stays inside each shelf.
  const [creating, setCreating] = useState<'nutricion' | 'suplementos' | null>(null);
  const label = tab === 'nutricion' ? 'Nuevo plan' : 'Nueva suplementación';

  return (
    <div className="flex animate-fade-up flex-col">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex items-center gap-2 border-b border-border">
          <TabsList className="min-w-0 flex-1 border-b-0">
            <TabsTrigger value="nutricion">
              <UtensilsCrossed /> Planes
            </TabsTrigger>
            <TabsTrigger value="suplementos">
              <Pill /> Suplementación
            </TabsTrigger>
          </TabsList>
          <InfoTip label="Cómo funcionan las plantillas" side="bottom">
            Créalas una vez y asígnalas a quien quieras. Cada cliente recibe una copia: editar aquí no cambia el plan que
            alguien ya sigue. Planes y suplementación se asignan por separado.
          </InfoTip>
          <Button onClick={() => setCreating(tab)} aria-label={label} className="ml-1 sm:ml-3">
            <Plus strokeWidth={2.5} />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        </div>
        <TabsContent value="nutricion">
          <NutritionLibrary creating={creating === 'nutricion'} onCreate={() => setCreating('nutricion')} onCreated={() => setCreating(null)} />
        </TabsContent>
        <TabsContent value="suplementos">
          <SupplementLibrary creating={creating === 'suplementos'} onCreate={() => setCreating('suplementos')} onCreated={() => setCreating(null)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const toAssignees = (rows: PlanAssignment[]): PlanAssignee[] =>
  rows.map((a) => ({ key: a.plan_id, clientId: a.client_id, name: a.client_name, status: a.status, startDate: a.start_date }));

/** "2200" or "2000–2400"; null when no calories are set. */
const kcalText = (p: NutritionPlanWithDetail): string | null => {
  const t =
    p.nutrition_plan_targets.find((x) => x.day_type === 'training') ??
    p.nutrition_plan_targets.find((x) => x.day_type === 'both');
  if (!t || (t.kcal_min == null && t.kcal_max == null)) return null;
  const a = t.kcal_min ?? t.kcal_max!;
  const b = t.kcal_max ?? t.kcal_min!;
  return a === b ? a.toLocaleString('en-US') : `${a.toLocaleString('en-US')}–${b.toLocaleString('en-US')}`;
};

const pdfAction = (run: () => Promise<void>) => () =>
  void run().then(
    () => toast.success('PDF descargado'),
    (e: unknown) => toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF'),
  );

/* ---------------- nutrition shelf ---------------- */

function NutritionLibrary({
  creating,
  onCreate,
  onCreated,
}: {
  /** The page's «new» button was pressed. */
  creating: boolean;
  onCreate: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: templates, isPending, isError, refetch } = useQuery({
    queryKey: qk.nutritionTemplates,
    queryFn: listNutritionTemplates,
  });
  const { data: assignments } = useQuery({
    queryKey: qk.nutritionAssignments,
    queryFn: listNutritionAssignments,
  });

  const [editing, setEditing] = useState<NutritionPlanWithDetail | null>(null);
  const [assignTarget, setAssignTarget] = useState<NutritionPlanWithDetail | null>(null);
  const [pendingArchive, setPendingArchive] = useState<NutritionPlanWithDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<NutritionPlanWithDetail | null>(null);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.nutritionTemplates });
    void queryClient.invalidateQueries({ queryKey: qk.nutritionAssignments });
  };
  const closeBuilder = () => {
    onCreated();
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

  const all = (templates ?? []).filter((t) => matchesQuery(query, t.name, t.focus));
  const active = all.filter((t) => t.status === 'active');
  const archived = all.filter((t) => t.status !== 'active');

  const card = (tpl: NutritionPlanWithDetail) => {
    const isArchived = tpl.status !== 'active';
    const foods = tpl.nutrition_plan_meals.reduce(
      (a, m) => a + m.nutrition_plan_options.reduce((b, o) => b + o.nutrition_plan_option_items.length, 0),
      0,
    );
    const kcal = kcalText(tpl);
    const menu: PlanMenuItem[] = [
      { label: 'Vista previa', icon: Smartphone, onSelect: () => setPreviewing(tpl) },
      { label: 'Exportar PDF', icon: FileDown, onSelect: pdfAction(() => exportNutritionPdf(tpl, 'Plantilla')) },
      isArchived
        ? { label: 'Restaurar', icon: ArchiveRestore, onSelect: () => void setShelfState(tpl, false), disabled: busyId === tpl.id, divide: true }
        : { label: 'Archivar', icon: Archive, onSelect: () => setPendingArchive(tpl), disabled: busyId === tpl.id, divide: true },
    ];
    return (
      <PlanCard
        key={tpl.id}
        title={tpl.name}
        subtitle={tpl.focus}
        archived={isArchived}
        facts={[
          { value: tpl.nutrition_plan_meals.length, label: tpl.nutrition_plan_meals.length === 1 ? 'comida' : 'comidas' },
          { value: foods, label: foods === 1 ? 'alimento' : 'alimentos' },
          ...(kcal ? [{ value: kcal, label: 'kcal' }] : []),
        ]}
        tags={
          tpl.day_cycling || tpl.duration_weeks != null ? (
            <>
              {tpl.day_cycling && <PlanTag icon={Dumbbell}>Entreno y descanso</PlanTag>}
              {tpl.duration_weeks != null && <PlanTag icon={CalendarRange}>{tpl.duration_weeks} sem</PlanTag>}
            </>
          ) : undefined
        }
        assigned={toAssignees(assignments?.[tpl.id] ?? [])}
        onOpen={() => setEditing(tpl)}
        openLabel={`Editar ${tpl.name}`}
        menu={menu}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(tpl)}>
              <Pencil /> Editar
            </Button>
            {!isArchived && (
              <Button variant="outline" size="sm" onClick={() => setAssignTarget(tpl)}>
                <UserPlus /> Asignar
              </Button>
            )}
          </>
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {(templates?.length ?? 0) > 4 && <LibrarySearch query={query} onQuery={setQuery} placeholder="Buscar plan" />}

      {(creating || editing) && (
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
        <Card>
          <EmptyState icon={UtensilsCrossed} title="No se pudo cargar la biblioteca" description="Revisa tu conexión e inténtalo otra vez.">
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        </Card>
      ) : isPending ? (
        <LibrarySkeleton />
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={UtensilsCrossed}
            title="Aún no tienes planes"
            description="Crea uno y asígnalo a varios clientes sin volver a armarlo."
          >
            <Button onClick={onCreate}>
              <Plus strokeWidth={2.5} /> Crear el primero
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <>
          {active.length > 0 ? (
            <LibraryGrid>{active.map(card)}</LibraryGrid>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              {query ? 'Ningún plan coincide con la búsqueda.' : 'Todos tus planes están archivados.'}
            </p>
          )}
          <ArchivedToggle count={archived.length} open={showArchived} onToggle={() => setShowArchived((v) => !v)} />
          {showArchived && <LibraryGrid>{archived.map(card)}</LibraryGrid>}
        </>
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileNutritionPreview plan={planToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <AssignClientDialog
        planName={assignTarget?.name ?? null}
        what="plan nutricional"
        onAssign={(clientId, startDate) => assignNutritionTemplate(assignTarget!.id, clientId, startDate)}
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

/* ---------------- supplement shelf ---------------- */

function SupplementLibrary({
  creating,
  onCreate,
  onCreated,
}: {
  /** The page's «new» button was pressed. */
  creating: boolean;
  onCreate: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: templates, isPending, isError, refetch } = useQuery({
    queryKey: qk.supplementTemplates,
    queryFn: listSupplementTemplates,
  });
  const { data: assignments } = useQuery({
    queryKey: qk.supplementAssignments,
    queryFn: listSupplementAssignments,
  });

  const [editing, setEditing] = useState<SupplementPlanWithDetail | null>(null);
  const [assignTarget, setAssignTarget] = useState<SupplementPlanWithDetail | null>(null);
  const [pendingArchive, setPendingArchive] = useState<SupplementPlanWithDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<SupplementPlanWithDetail | null>(null);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.supplementTemplates });
    void queryClient.invalidateQueries({ queryKey: qk.supplementAssignments });
  };
  const closeBuilder = () => {
    onCreated();
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

  const all = (templates ?? []).filter((t) => matchesQuery(query, t.name, t.description));
  const active = all.filter((t) => t.status === 'active');
  const archived = all.filter((t) => t.status !== 'active');

  const card = (tpl: SupplementPlanWithDetail) => {
    const isArchived = tpl.status !== 'active';
    const items = tpl.supplement_plan_items;
    const base = items.filter((i) => i.tier === 'base').length;
    const menu: PlanMenuItem[] = [
      { label: 'Vista previa', icon: Smartphone, onSelect: () => setPreviewing(tpl) },
      { label: 'Exportar PDF', icon: FileDown, onSelect: pdfAction(() => exportSupplementPdf(tpl, 'Plantilla')) },
      isArchived
        ? { label: 'Restaurar', icon: ArchiveRestore, onSelect: () => void setShelfState(tpl, false), disabled: busyId === tpl.id, divide: true }
        : { label: 'Archivar', icon: Archive, onSelect: () => setPendingArchive(tpl), disabled: busyId === tpl.id, divide: true },
    ];
    return (
      <PlanCard
        key={tpl.id}
        title={tpl.name}
        subtitle={tpl.description}
        archived={isArchived}
        facts={[
          { value: items.length, label: items.length === 1 ? 'suplemento' : 'suplementos' },
          ...(base > 0 ? [{ value: base, label: 'base' }] : []),
        ]}
        assigned={toAssignees(assignments?.[tpl.id] ?? [])}
        onOpen={() => setEditing(tpl)}
        openLabel={`Editar ${tpl.name}`}
        menu={menu}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(tpl)}>
              <Pencil /> Editar
            </Button>
            {!isArchived && (
              <Button variant="outline" size="sm" onClick={() => setAssignTarget(tpl)}>
                <UserPlus /> Asignar
              </Button>
            )}
          </>
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {(templates?.length ?? 0) > 4 && <LibrarySearch query={query} onQuery={setQuery} placeholder="Buscar suplementación" />}

      {(creating || editing) && (
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
        <Card>
          <EmptyState icon={Pill} title="No se pudo cargar la biblioteca" description="Revisa tu conexión e inténtalo otra vez.">
            <Button variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </EmptyState>
        </Card>
      ) : isPending ? (
        <LibrarySkeleton />
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Pill}
            title="Aún no tienes suplementación"
            description="Arma un stack con dosis y horarios, y asígnalo a quien lo necesite."
          >
            <Button onClick={onCreate}>
              <Plus strokeWidth={2.5} /> Crear el primero
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <>
          {active.length > 0 ? (
            <LibraryGrid>{active.map(card)}</LibraryGrid>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              {query ? 'Nada coincide con la búsqueda.' : 'Todo está archivado.'}
            </p>
          )}
          <ArchivedToggle count={archived.length} open={showArchived} onToggle={() => setShowArchived((v) => !v)} />
          {showArchived && <LibraryGrid>{archived.map(card)}</LibraryGrid>}
        </>
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileNutritionPreview plan={emptyPlanPreview()} supplements={supplementPlanToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <AssignClientDialog
        planName={assignTarget?.name ?? null}
        what="suplementación"
        onAssign={(clientId, startDate) => assignSupplementTemplate(assignTarget!.id, clientId, startDate)}
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

/* ---------------- shared bits ---------------- */

/** One dialog for both shelves — they differ only in which RPC runs. */
function AssignClientDialog({
  planName,
  what,
  onAssign,
  onClose,
  onAssigned,
}: {
  planName: string | null;
  /** "plan nutricional" / "suplementación" — for the help text. */
  what: string;
  onAssign: (clientId: string, startDate: string) => Promise<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { data: clients } = useQuery({
    queryKey: qk.clientSummaries,
    queryFn: listClientSummaries,
    enabled: planName != null,
  });

  return (
    <AssignDialog
      open={planName != null}
      onOpenChange={(o) => !o && onClose()}
      title={`Asignar «${planName ?? ''}»`}
      description={`Reemplaza su ${what} activo.`}
      tip={`El cliente recibe una copia; su ${what} anterior se archiva. Editar la plantilla después no cambia su copia.`}
      pickLabel="Cliente"
      searchPlaceholder="Buscar cliente"
      emptyText="Aún no tienes clientes."
      options={clients?.map((c) => ({
        id: c.id,
        title: c.display_name ?? c.email,
        subtitle: c.display_name ? c.email : undefined,
        leading: <Avatar name={c.display_name ?? c.email} color={avatarColor(c.id)} size={32} />,
      }))}
      submitLabel={(c) => (c ? `Asignar a ${c.title.split(' ')[0]}` : 'Asignar')}
      onSubmit={async (clientId, startDate) => {
        await onAssign(clientId, startDate);
        const c = clients?.find((x) => x.id === clientId);
        toast.success(`"${planName}" asignado a ${c?.display_name ?? c?.email ?? 'el cliente'}`);
        onAssigned();
      }}
    />
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
          <AlertDialogTitle>¿Archivar «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Deja de aparecer en tu biblioteca, pero no se borra. Los clientes que ya lo tienen no notan nada.
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
