import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookmarkPlus,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  FileDown,
  LibraryBig,
  Pencil,
  Pill,
  Play,
  Plus,
  Smartphone,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import type {
  ClientWithMeta,
  MealWithItems,
  NutritionPlanWithDetail,
  PlanStatus,
  SupplementPlanWithDetail,
} from '@/types';
import { updateClient } from '@/services/clients';
import {
  deleteNutritionPlan,
  listNutritionTemplates,
  saveNutritionPlanAsTemplate,
  setNutritionPlanStatus,
  assignNutritionTemplate,
} from '@/services/nutritionPlans';
import {
  deleteSupplementPlan,
  listSupplementTemplates,
  saveSupplementPlanAsTemplate,
  setSupplementPlanStatus,
  assignSupplementTemplate,
} from '@/services/supplementPlans';
import { exportNutritionPdf, exportSupplementPdf } from '@/lib/nutritionPdf';
import { NutritionPlanBuilder } from '@/components/nutrition/NutritionPlanBuilder';
import { SupplementPlanBuilder } from '@/components/nutrition/SupplementPlanBuilder';
import { MobileNutritionPreview } from '@/components/nutrition/MobileNutritionPreview';
import { emptyPlanPreview, planToPreview, supplementPlanToPreview } from '@/components/nutrition/previewModel';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { mealPhotoUrl } from '@/lib/mealPhotos';
import { qk } from '@/lib/queryClient';
import { cn, fmtDate, MEAL_TYPE_LABELS, relTime } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, SectionHeader } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { OwnerBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PlanCard, PlanTag, type PlanMenuItem } from '@/components/shared/PlanCard';
import { AssignDialog } from '@/components/shared/AssignDialog';

// Photo column sits first so a day of thumbnails scans as a strip.
const ITEM_GRID = 'grid gap-2 [grid-template-columns:36px_minmax(0,1fr)_56px_40px_40px_40px]';

/** Active first, then newest — the running plan is what a coach opens for. */
const byRelevance = <T extends { status: PlanStatus; start_date: string }>(a: T, b: T) => {
  if (a.status === 'active' && b.status !== 'active') return -1;
  if (b.status === 'active' && a.status !== 'active') return 1;
  return b.start_date.localeCompare(a.start_date);
};

const pdfAction = (run: () => Promise<void>) => () =>
  void run().then(
    () => toast.success('PDF descargado'),
    (e: unknown) => toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF'),
  );

export function NutritionTab({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    onChanged();
    void queryClient.invalidateQueries({ queryKey: qk.nutritionAssignments });
    void queryClient.invalidateQueries({ queryKey: qk.supplementAssignments });
  };

  // Meals arrive date-DESC; bucket them per day so the tab lists days, not a
  // wall of undated meal cards.
  const mealsByDay = useMemo(() => {
    const map = new Map<string, MealWithItems[]>();
    for (const m of client.meals) {
      const day = m.date.slice(0, 10);
      const bucket = map.get(day);
      if (bucket) bucket.push(m);
      else map.set(day, [m]);
    }
    return [...map.entries()];
  }, [client.meals]);

  // Only the most recent day starts open — everything else is one click away.
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [seededDay, setSeededDay] = useState<string | null>(null);
  const firstDay = mealsByDay[0]?.[0] ?? null;
  if (firstDay != null && firstDay !== seededDay) {
    setSeededDay(firstDay);
    setOpenDays(new Set([firstDay]));
  }
  const toggleDay = (date: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-5">
        <NutritionPlanSection client={client} onChanged={invalidate} />
        <SupplementPlanSection client={client} onChanged={invalidate} />
      </div>

      <CalorieGoal client={client} onChanged={onChanged} />

      {/* What the client actually ate — one collapsible row per day. */}
      <section aria-labelledby="nt-log" className="flex flex-col gap-3">
        <SectionHeader
          id="nt-log"
          title="Lo que ha comido"
          tip="Lo que registra desde la app, con foto. Las calorías y los macros los calcula la app a partir de la foto."
        />
        {client.meals.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={Camera}
              title="Aún no ha registrado comidas"
              description={`Cuando ${(client.display_name ?? client.email).split(' ')[0]} suba fotos de sus platos, aparecerán aquí.`}
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {mealsByDay.map(([date, meals]) => (
              <DayRow
                key={date}
                date={date}
                meals={meals}
                goal={client.calorie_goal ?? null}
                open={openDays.has(date)}
                onToggle={() => toggleDay(date)}
              />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

/* ---------------- calorie goal ---------------- */

/** The fallback the app shows when the plan sets no calories. */
function CalorieGoal({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = Math.min(6000, Math.max(800, parseInt(input, 10) || client.calorie_goal || 2000));
    setSaving(true);
    try {
      await updateClient(client.id, { calorie_goal: v });
      setEditing(false);
      onChanged();
      toast.success(`Meta guardada: ${v.toLocaleString('en-US')} kcal`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <div className="flex min-w-[200px] flex-1 items-center gap-1.5">
        <span className="text-sm font-semibold">Meta diaria de calorías</span>
        <InfoTip label="Cuándo se usa esta meta">
          La app la muestra en la pantalla de inicio del cliente cuando su plan no tiene objetivo de calorías.
        </InfoTip>
      </div>
      {!editing ? (
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-1.5">
            <span className="display text-[28px] tabular-nums">{(client.calorie_goal ?? 0).toLocaleString('en-US')}</span>
            <span className="text-[13px] text-muted-foreground">kcal</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setInput(String(client.calorie_goal ?? 2000));
              setEditing(true);
            }}
          >
            <Pencil /> Cambiar
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="relative">
            <Input
              type="number"
              inputMode="numeric"
              min={800}
              max={6000}
              step={50}
              aria-label="Meta de calorías"
              className="w-[140px] pr-12 text-[15px] font-semibold"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">kcal</span>
          </div>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      )}
    </Card>
  );
}

/* ---------------- shared section shell ---------------- */

function PlanSectionShell({
  id,
  title,
  icon: Icon,
  current,
  history,
  hasPlans,
  empty,
  onUseTemplate,
  onCreate,
  children,
}: {
  id: string;
  title: string;
  icon: typeof Pill;
  current: ReactNode;
  history: ReactNode[];
  hasPlans: boolean;
  empty: { title: string; description: string };
  onUseTemplate: () => void;
  onCreate: () => void;
  children?: ReactNode;
}) {
  const [showHistory, setShowHistory] = useState(false);
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        id={id}
        title={
          <span className="flex items-center gap-2">
            <Icon className="h-[18px] w-[18px] text-muted-foreground" />
            {title}
          </span>
        }
        actions={
          hasPlans && (
            <>
              <Button variant="ghost" size="sm" onClick={onUseTemplate}>
                <LibraryBig /> Plantilla
              </Button>
              <Button variant="ghost" size="sm" onClick={onCreate}>
                <Plus /> Nuevo
              </Button>
            </>
          )
        }
      />
      {hasPlans ? (
        <>
          {current}
          {history.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                aria-expanded={showHistory}
                className="flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', !showHistory && '-rotate-90')} />
                Anteriores ({history.length})
              </button>
              {showHistory && <div className="flex flex-col gap-3">{history}</div>}
            </>
          )}
        </>
      ) : (
        <Card className="border-dashed">
          <EmptyState icon={Icon} title={empty.title} description={empty.description}>
            <Button variant="outline" onClick={onUseTemplate}>
              <LibraryBig /> Usar plantilla
            </Button>
            <Button onClick={onCreate}>
              <Plus strokeWidth={2.5} /> Crear
            </Button>
          </EmptyState>
        </Card>
      )}
      {children}
    </section>
  );
}

function StatusTag({ status }: { status: PlanStatus }) {
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold', STATUS_BADGE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ---------------- assigned nutrition plan ---------------- */

function NutritionPlanSection({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<NutritionPlanWithDetail | null>(null);
  const [previewing, setPreviewing] = useState<NutritionPlanWithDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NutritionPlanWithDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState<NutritionPlanWithDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: templates } = useQuery({
    queryKey: qk.nutritionTemplates,
    queryFn: listNutritionTemplates,
    enabled: pickerOpen,
  });

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const changeStatus = async (plan: NutritionPlanWithDetail, status: PlanStatus) => {
    setBusy(true);
    try {
      await setNutritionPlanStatus(plan.id, status);
      toast.success(status === 'active' ? 'Plan activado' : 'Plan completado');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteNutritionPlan(pendingDelete.id);
      toast.success('Plan eliminado');
      setPendingDelete(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el plan');
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...client.nutritionPlans].sort(byRelevance);
  const [current, ...older] = sorted;

  const card = (plan: NutritionPlanWithDetail) => {
    const foods = plan.nutrition_plan_meals.reduce(
      (a, m) => a + m.nutrition_plan_options.reduce((b, o) => b + o.nutrition_plan_option_items.length, 0),
      0,
    );
    const t =
      plan.nutrition_plan_targets.find((x) => x.day_type === 'training') ??
      plan.nutrition_plan_targets.find((x) => x.day_type === 'both');
    const kcal = t ? (t.kcal_max ?? t.kcal_min) : null;
    const menu: PlanMenuItem[] = [
      { label: 'Vista previa', icon: Smartphone, onSelect: () => setPreviewing(plan) },
      {
        label: 'Exportar PDF',
        icon: FileDown,
        onSelect: pdfAction(() => exportNutritionPdf(plan, client.display_name ?? client.email)),
      },
      { label: 'Guardar como plantilla', icon: BookmarkPlus, onSelect: () => setSaveAsTemplate(plan) },
      plan.status === 'active'
        ? { label: 'Marcar completado', icon: CheckCircle2, onSelect: () => void changeStatus(plan, 'completed'), disabled: busy, divide: true }
        : { label: 'Activar', icon: Play, onSelect: () => void changeStatus(plan, 'active'), disabled: busy, divide: true },
      { label: 'Eliminar', icon: Trash2, onSelect: () => setPendingDelete(plan), destructive: true },
    ];
    return (
      <PlanCard
        key={plan.id}
        title={plan.name}
        subtitle={plan.focus}
        archived={plan.status !== 'active'}
        facts={[
          { value: plan.nutrition_plan_meals.length, label: plan.nutrition_plan_meals.length === 1 ? 'comida' : 'comidas' },
          { value: foods, label: foods === 1 ? 'alimento' : 'alimentos' },
          ...(kcal != null ? [{ value: kcal.toLocaleString('en-US'), label: 'kcal' }] : []),
        ]}
        tags={
          <>
            <StatusTag status={plan.status} />
            {plan.day_cycling && <PlanTag icon={Dumbbell}>Entreno y descanso</PlanTag>}
            {plan.template_id && <PlanTag icon={LibraryBig}>De plantilla</PlanTag>}
          </>
        }
        footnote={`Desde ${fmtDate(plan.start_date)}`}
        onOpen={() => setEditing(plan)}
        openLabel={`Editar ${plan.name}`}
        menu={menu}
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditing(plan)}>
            <Pencil /> Editar
          </Button>
        }
      />
    );
  };

  return (
    <PlanSectionShell
      id="nt-plan"
      title="Plan nutricional"
      icon={UtensilsCrossed}
      current={current && card(current)}
      history={older.map(card)}
      hasPlans={sorted.length > 0}
      empty={{ title: 'Sin plan nutricional', description: 'Asígnale una plantilla o crea uno a su medida.' }}
      onUseTemplate={() => setPickerOpen(true)}
      onCreate={() => {
        setEditing(null);
        setBuilderOpen(true);
      }}
    >
      {(builderOpen || editing) && (
        <NutritionPlanBuilder
          key={editing?.id ?? 'new'}
          client={client}
          initial={editing ?? undefined}
          onClose={closeBuilder}
          onSaved={() => {
            closeBuilder();
            onChanged();
          }}
        />
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileNutritionPreview plan={planToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog
        planName={saveAsTemplate?.name ?? null}
        clientName={client.display_name?.split(' ')[0] ?? 'el cliente'}
        onClose={() => setSaveAsTemplate(null)}
        onSave={(name) => saveNutritionPlanAsTemplate(saveAsTemplate!.id, name)}
        invalidateKey={qk.nutritionTemplates}
        onSaved={onChanged}
      />

      <TemplatePicker
        open={pickerOpen}
        title="Asignar plan nutricional"
        templates={templates?.filter((t) => t.status === 'active').map((t) => ({
          id: t.id,
          title: t.name,
          subtitle: `${t.nutrition_plan_meals.length} comidas${t.focus ? ` · ${t.focus}` : ''}`,
        }))}
        onAssign={(templateId, startDate) => assignNutritionTemplate(templateId, client.id, startDate)}
        onClose={() => setPickerOpen(false)}
        onAssigned={() => {
          setPickerOpen(false);
          onChanged();
        }}
      />

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{pendingDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra con todas sus comidas y no se puede deshacer. Para retirarlo sin borrarlo, márcalo como completado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlanSectionShell>
  );
}

/* ---------------- assigned supplement plan ---------------- */

function SupplementPlanSection({ client, onChanged }: { client: ClientWithMeta; onChanged: () => void }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<SupplementPlanWithDetail | null>(null);
  const [previewing, setPreviewing] = useState<SupplementPlanWithDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SupplementPlanWithDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState<SupplementPlanWithDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: templates } = useQuery({
    queryKey: qk.supplementTemplates,
    queryFn: listSupplementTemplates,
    enabled: pickerOpen,
  });

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const changeStatus = async (plan: SupplementPlanWithDetail, status: PlanStatus) => {
    setBusy(true);
    try {
      await setSupplementPlanStatus(plan.id, status);
      toast.success(status === 'active' ? 'Suplementación activada' : 'Suplementación completada');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteSupplementPlan(pendingDelete.id);
      toast.success('Suplementación eliminada');
      setPendingDelete(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...client.supplementPlans].sort(byRelevance);
  const [current, ...older] = sorted;

  const card = (plan: SupplementPlanWithDetail) => {
    const items = plan.supplement_plan_items;
    const base = items.filter((i) => i.tier === 'base').length;
    const menu: PlanMenuItem[] = [
      { label: 'Vista previa', icon: Smartphone, onSelect: () => setPreviewing(plan) },
      {
        label: 'Exportar PDF',
        icon: FileDown,
        onSelect: pdfAction(() => exportSupplementPdf(plan, client.display_name ?? client.email)),
      },
      { label: 'Guardar como plantilla', icon: BookmarkPlus, onSelect: () => setSaveAsTemplate(plan) },
      plan.status === 'active'
        ? { label: 'Marcar completada', icon: CheckCircle2, onSelect: () => void changeStatus(plan, 'completed'), disabled: busy, divide: true }
        : { label: 'Activar', icon: Play, onSelect: () => void changeStatus(plan, 'active'), disabled: busy, divide: true },
      { label: 'Eliminar', icon: Trash2, onSelect: () => setPendingDelete(plan), destructive: true },
    ];
    return (
      <PlanCard
        key={plan.id}
        title={plan.name}
        subtitle={plan.description}
        archived={plan.status !== 'active'}
        facts={[
          { value: items.length, label: items.length === 1 ? 'suplemento' : 'suplementos' },
          ...(base > 0 ? [{ value: base, label: 'base' }] : []),
        ]}
        tags={
          <>
            <StatusTag status={plan.status} />
            {plan.template_id && <PlanTag icon={LibraryBig}>De plantilla</PlanTag>}
          </>
        }
        footnote={`Desde ${fmtDate(plan.start_date)}`}
        onOpen={() => setEditing(plan)}
        openLabel={`Editar ${plan.name}`}
        menu={menu}
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditing(plan)}>
            <Pencil /> Editar
          </Button>
        }
      />
    );
  };

  return (
    <PlanSectionShell
      id="nt-supp"
      title="Suplementación"
      icon={Pill}
      current={current && card(current)}
      history={older.map(card)}
      hasPlans={sorted.length > 0}
      empty={{ title: 'Sin suplementación', description: 'Va aparte del plan nutricional.' }}
      onUseTemplate={() => setPickerOpen(true)}
      onCreate={() => {
        setEditing(null);
        setBuilderOpen(true);
      }}
    >
      {(builderOpen || editing) && (
        <SupplementPlanBuilder
          key={editing?.id ?? 'new'}
          client={client}
          initial={editing ?? undefined}
          onClose={closeBuilder}
          onSaved={() => {
            closeBuilder();
            onChanged();
          }}
        />
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileNutritionPreview plan={emptyPlanPreview()} supplements={supplementPlanToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog
        planName={saveAsTemplate?.name ?? null}
        clientName={client.display_name?.split(' ')[0] ?? 'el cliente'}
        onClose={() => setSaveAsTemplate(null)}
        onSave={(name) => saveSupplementPlanAsTemplate(saveAsTemplate!.id, name)}
        invalidateKey={qk.supplementTemplates}
        onSaved={onChanged}
      />

      <TemplatePicker
        open={pickerOpen}
        title="Asignar suplementación"
        templates={templates?.filter((t) => t.status === 'active').map((t) => ({
          id: t.id,
          title: t.name,
          subtitle: `${t.supplement_plan_items.length} suplementos`,
        }))}
        onAssign={(templateId, startDate) => assignSupplementTemplate(templateId, client.id, startDate)}
        onClose={() => setPickerOpen(false)}
        onAssigned={() => {
          setPickerOpen(false);
          onChanged();
        }}
      />

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{pendingDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Se borra con todos sus suplementos y no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlanSectionShell>
  );
}

/* ---------------- shared dialogs ---------------- */

function SaveAsTemplateDialog({
  planName,
  clientName,
  onClose,
  onSave,
  invalidateKey,
  onSaved,
}: {
  planName: string | null;
  clientName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<string>;
  invalidateKey: readonly string[];
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);

  if (planName != null && planName !== seeded) {
    setSeeded(planName);
    setName(planName);
  }

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(name.trim() || planName!);
      toast.success('Guardado en tu biblioteca');
      void queryClient.invalidateQueries({ queryKey: invalidateKey });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={planName != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
          <DialogDescription>Se copia a tu biblioteca; el plan de {clientName} no cambia.</DialogDescription>
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

/** Shared by both sections — they differ only in which library they read and
 *  which assign RPC they call. */
function TemplatePicker({
  open,
  title,
  templates,
  onAssign,
  onClose,
  onAssigned,
}: {
  open: boolean;
  title: string;
  /** Undefined while loading. */
  templates: { id: string; title: string; subtitle?: string }[] | undefined;
  onAssign: (templateId: string, startDate: string) => Promise<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  return (
    <AssignDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description="Reemplaza su plan activo."
      tip="Recibe una copia de la plantilla; su plan activo anterior se archiva."
      pickLabel="Plantilla"
      searchPlaceholder="Buscar plantilla"
      emptyText="No tienes plantillas activas. Créalas en Nutrición."
      options={templates}
      submitLabel={() => 'Asignar'}
      onSubmit={async (templateId, startDate) => {
        await onAssign(templateId, startDate);
        toast.success('Plan asignado');
        onAssigned();
      }}
    />
  );
}

/* ---------------- the client's own log ---------------- */

function DayRow({
  date,
  meals,
  goal,
  open,
  onToggle,
}: {
  date: string;
  meals: MealWithItems[];
  goal: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const tot = meals.reduce(
    (a, m) => {
      for (const i of m.meal_items) {
        a.cal += i.calories;
        a.p += i.protein_g;
        a.c += i.carbs_g;
        a.f += i.fat_g;
        if (i.photo_path) a.photos += 1;
        if (i.plan_option_id) a.planned += 1;
      }
      return a;
    },
    { cal: 0, p: 0, c: 0, f: 0, photos: 0, planned: 0 },
  );
  const pct = goal != null && goal > 0 ? Math.min(100, Math.round((tot.cal / goal) * 100)) : null;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight className={cn('h-4 w-4 flex-none text-faint transition-transform', open && 'rotate-90')} />
        <span className="min-w-[96px] flex-none">
          <span className="block text-sm font-semibold">{relTime(date)}</span>
          <span className="block text-xs text-faint">{fmtDate(date)}</span>
        </span>

        {/* Photo + plan-adherence counts: the two signals a coach scans for. */}
        <span className="flex flex-none items-center gap-3 text-[13px] text-muted-foreground">
          <span>
            {meals.length} {meals.length === 1 ? 'comida' : 'comidas'}
          </span>
          {tot.photos > 0 && (
            <span className="flex items-center gap-1" title={`${tot.photos} con foto`}>
              <Camera className="h-3.5 w-3.5" /> {tot.photos}
            </span>
          )}
          {tot.planned > 0 && (
            <span className="flex items-center gap-1 text-secondary" title={`${tot.planned} del plan`}>
              <UtensilsCrossed className="h-3.5 w-3.5" /> {tot.planned}
            </span>
          )}
        </span>

        <span className="ml-auto flex items-center gap-3">
          {pct != null && (
            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
              <span
                className={cn('block h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-success')}
                style={{ width: `${pct}%` }}
              />
            </span>
          )}
          <span className="text-right text-[13px] tabular-nums">
            <span className="font-semibold text-foreground">{tot.cal.toLocaleString('en-US')}</span>
            {goal != null && <span className="text-faint"> / {goal.toLocaleString('en-US')}</span>}
            <span className="text-faint"> kcal</span>
          </span>
          <span className="hidden items-center gap-2.5 text-xs tabular-nums text-muted-foreground md:flex">
            <Macro dot="bg-protein" label="P" value={tot.p} />
            <Macro dot="bg-carbs" label="C" value={tot.c} />
            <Macro dot="bg-fat" label="G" value={tot.f} />
          </span>
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto bg-muted/30 px-4 pb-3 pt-1">
          <div className="min-w-[460px]">
            <div className={`${ITEM_GRID} border-b border-border pb-1.5 pt-1 text-xs font-medium text-faint`}>
              <span />
              <span>Alimento</span>
              <span className="text-right">kcal</span>
              <span className="text-right">P</span>
              <span className="text-right">C</span>
              <span className="text-right">G</span>
            </div>

            {meals.map((m) => {
              const mt = m.meal_items.reduce(
                (a, i) => ({
                  cal: a.cal + i.calories,
                  p: a.p + i.protein_g,
                  c: a.c + i.carbs_g,
                  f: a.f + i.fat_g,
                }),
                { cal: 0, p: 0, c: 0, f: 0 },
              );
              const typeLabel = MEAL_TYPE_LABELS[m.meal_type] ?? m.meal_type;
              const showName = m.name.toLowerCase() !== typeLabel.toLowerCase();
              return (
                <div key={m.id}>
                  <div className={`${ITEM_GRID} items-center pt-3 text-[13px] font-semibold tabular-nums`}>
                    <span />
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex-none">{typeLabel}</span>
                      {showName && <span className="min-w-0 truncate font-normal text-muted-foreground">{m.name}</span>}
                      {m.assigned_by && <OwnerBadge assignedBy={m.assigned_by} />}
                    </span>
                    <span className="text-right">{mt.cal}</span>
                    <span className="text-right">{Math.round(mt.p)}</span>
                    <span className="text-right">{Math.round(mt.c)}</span>
                    <span className="text-right">{Math.round(mt.f)}</span>
                  </div>

                  {m.meal_items.map((it, i) => (
                    <div key={i} className={`${ITEM_GRID} items-center py-1 text-[13px] tabular-nums`}>
                      {/* The photo the client took — the coach's clearest window
                          into what was actually on the plate. */}
                      {it.photo_path ? (
                        <a
                          href={mealPhotoUrl(it.photo_path)}
                          target="_blank"
                          rel="noreferrer"
                          title={`Ver foto de ${it.name}`}
                          className="block h-8 w-8 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <img src={mealPhotoUrl(it.photo_path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <span />
                      )}
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate">{it.name}</span>
                        {it.portion && <span className="flex-none text-xs text-faint">{it.portion}</span>}
                        {/* Registered straight from a prescribed option. */}
                        {it.plan_option_id && (
                          <span
                            title="Registrado desde el plan"
                            className="flex-none rounded-full bg-secondary/15 px-1.5 text-[11px] font-semibold text-secondary"
                          >
                            del plan
                          </span>
                        )}
                      </span>
                      <span className="text-right text-muted-foreground">{it.calories}</span>
                      <span className="text-right text-muted-foreground">{it.protein_g}</span>
                      <span className="text-right text-muted-foreground">{it.carbs_g}</span>
                      <span className="text-right text-muted-foreground">{it.fat_g}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Macro({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label} {Math.round(value)}
    </span>
  );
}
