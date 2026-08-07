import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BookmarkPlus,
  Camera,
  CheckCircle2,
  ChevronRight,
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
import {
  emptyPlanPreview,
  planToPreview,
  supplementPlanToPreview,
} from '@/components/nutrition/previewModel';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { mealPhotoUrl } from '@/lib/mealPhotos';
import { qk } from '@/lib/queryClient';
import { cn, fmtDate, MEAL_TYPE_LABELS, relTime } from '@/lib/utils';
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
import { OwnerBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';

// Photo column sits first so a day of thumbnails scans as a strip.
const ITEM_GRID = 'grid gap-1.5 [grid-template-columns:34px_2fr_60px_44px_44px_44px]';

const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function NutritionTab({
  client,
  onChanged,
}: {
  client: ClientWithMeta;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  const startEdit = () => {
    setInput(String(client.calorie_goal ?? 2000));
    setEditing(true);
  };

  const save = async () => {
    const v = Math.min(6000, Math.max(800, parseInt(input, 10) || client.calorie_goal || 2000));
    setSaving(true);
    try {
      await updateClient(client.id, { calorie_goal: v });
      setEditing(false);
      onChanged();
      toast.success(`Meta actualizada: ${v.toLocaleString('en-US')} kcal`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar la meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <NutritionPlanSection client={client} onChanged={invalidate} />
      <SupplementPlanSection client={client} onChanged={invalidate} />

      {/* Calorie goal — the fallback the app uses when no plan is assigned. */}
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-[220px] flex-1">
          <div className="font-heading text-[14.5px] font-semibold">Meta diaria de calorías</div>
          <p className="mt-0.5 text-[12.5px] text-faint">
            Se muestra al cliente en su pantalla de inicio cuando no tiene objetivos de macros en un
            plan.
          </p>
        </div>
        {!editing ? (
          <div className="flex items-center gap-3.5">
            <span className="font-heading text-[30px] font-bold text-primary">
              {(client.calorie_goal ?? 0).toLocaleString('en-US')}{' '}
              <span className="text-sm font-medium text-faint">kcal</span>
            </span>
            <Button variant="outline" size="sm" onClick={startEdit}>
              Editar
            </Button>
          </div>
        ) : (
          <form
            className="flex items-center gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              type="number"
              aria-label="Meta de calorías"
              className="w-[110px] text-[15px] font-semibold"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <span className="text-[13px] text-faint">kcal</span>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </form>
        )}
      </Card>

      {/* What the client actually ate — one collapsible row per day. */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
          <Camera className="h-3.5 w-3.5" strokeWidth={2} /> Registro del cliente
        </div>
        {client.meals.length === 0 ? (
          <Card className="border-dashed border-border-strong shadow-none">
            <EmptyState
              icon={UtensilsCrossed}
              title="Sin comidas registradas"
              description={`${(client.display_name ?? client.email).split(' ')[0]} aún no ha registrado comidas desde la app.`}
            />
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
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
      </div>
    </div>
  );
}

/* ---------------- assigned nutrition plan ---------------- */

function NutritionPlanSection({
  client,
  onChanged,
}: {
  client: ClientWithMeta;
  onChanged: () => void;
}) {
  const plans = client.nutritionPlans;
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<NutritionPlanWithDetail | null>(null);
  const [previewing, setPreviewing] = useState<NutritionPlanWithDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NutritionPlanWithDetail | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState<NutritionPlanWithDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const changeStatus = async (plan: NutritionPlanWithDetail, status: PlanStatus) => {
    setBusy(true);
    try {
      await setNutritionPlanStatus(plan.id, status);
      toast.success(status === 'active' ? 'Plan activado' : 'Plan marcado como completado');
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

  // Active first, then by start date — the running plan is what a coach opens for.
  const sorted = [...plans].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return b.start_date.localeCompare(a.start_date);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
          <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={2} /> Plan nutricional
        </div>
        {!builderOpen && !editing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplatePickerOpen(true)}>
              <LibraryBig className="h-3.5 w-3.5" strokeWidth={2} /> Usar plantilla
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setBuilderOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Crear plan
            </Button>
          </div>
        )}
      </div>

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

      {sorted.length === 0 && !builderOpen ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={UtensilsCrossed}
            title="Sin plan nutricional"
            description="Asigna una plantilla de tu biblioteca o crea un plan a medida."
          />
        </Card>
      ) : (
        sorted.map((plan) => {
          const mealCount = plan.nutrition_plan_meals.length;
          const foodCount = plan.nutrition_plan_meals.reduce(
            (a, m) =>
              a +
              m.nutrition_plan_options.reduce((b, o) => b + o.nutrition_plan_option_items.length, 0),
            0,
          );
          return (
            <Card key={plan.id} className={cn('p-5', plan.status !== 'active' && 'opacity-75')}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-[15px] font-semibold">{plan.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide',
                        STATUS_BADGE[plan.status],
                      )}
                    >
                      {STATUS_LABEL[plan.status]}
                    </span>
                    {plan.template_id && (
                      <span className="rounded-full bg-muted px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        De plantilla
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {plan.focus ? `${plan.focus} · ` : ''}
                    {mealCount} {mealCount === 1 ? 'comida' : 'comidas'} · {foodCount}{' '}
                    {foodCount === 1 ? 'alimento' : 'alimentos'} · desde {fmtDate(plan.start_date)}
                  </div>
                </div>
                <span className="flex flex-none items-center gap-1">
                  <IconBtn
                    label={`Exportar ${plan.name} a PDF`}
                    title="Exportar a PDF"
                    onClick={() => {
                      void exportNutritionPdf(plan, client.display_name ?? client.email).then(
                        () => {
                          toast.success('PDF descargado');
                        },
                        (e: unknown) => {
                          toast.error(
                            e instanceof Error ? e.message : 'No se pudo generar el PDF',
                          );
                        },
                      );
                    }}
                  >
                    <FileDown className="h-3 w-3" strokeWidth={2.25} />
                  </IconBtn>
                  <IconBtn
                    label={`Vista previa de ${plan.name}`}
                    title="Vista previa en la app"
                    onClick={() => setPreviewing(plan)}
                  >
                    <Smartphone className="h-3 w-3" strokeWidth={2.25} />
                  </IconBtn>
                  <IconBtn
                    label={`Guardar ${plan.name} como plantilla`}
                    title="Guardar como plantilla"
                    onClick={() => setSaveAsTemplate(plan)}
                  >
                    <BookmarkPlus className="h-3 w-3" strokeWidth={2.25} />
                  </IconBtn>
                  <IconBtn
                    label={`Editar ${plan.name}`}
                    title="Editar"
                    onClick={() => {
                      setBuilderOpen(false);
                      setEditing(plan);
                    }}
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2.25} />
                  </IconBtn>
                  <IconBtn
                    label={`Eliminar ${plan.name}`}
                    title="Eliminar"
                    onClick={() => setPendingDelete(plan)}
                    danger
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                  </IconBtn>
                </span>
              </div>

              {plan.status !== 'active' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => void changeStatus(plan, 'active')}
                >
                  <Play className="h-3.5 w-3.5" strokeWidth={2.5} /> Activar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => void changeStatus(plan, 'completed')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Marcar completado
                </Button>
              )}
            </Card>
          );
        })
      )}

      <Dialog open={previewing != null} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vista previa · app del cliente</DialogTitle>
          </DialogHeader>
          {previewing && <MobileNutritionPreview plan={planToPreview(previewing)} />}
        </DialogContent>
      </Dialog>

      <SaveAsTemplateDialog
        planName={saveAsTemplate?.name ?? null}
        onClose={() => setSaveAsTemplate(null)}
        onSave={(name) => saveNutritionPlanAsTemplate(saveAsTemplate!.id, name)}
        invalidateKey={qk.nutritionTemplates}
        onSaved={onChanged}
      />

      <TemplatePicker
        open={templatePickerOpen}
        title="Asignar plan nutricional"
        queryKey={qk.nutritionTemplates}
        queryFn={listNutritionTemplates}
        onAssign={(templateId, startDate) =>
          assignNutritionTemplate(templateId, client.id, startDate)
        }
        onClose={() => setTemplatePickerOpen(false)}
        onAssigned={() => {
          setTemplatePickerOpen(false);
          onChanged();
        }}
      />

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el plan y todas sus comidas. Esta acción no se puede deshacer. Si solo quieres
              retirarlo, márcalo como completado.
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
    </div>
  );
}

/* ---------------- assigned supplement plan ---------------- */

function SupplementPlanSection({
  client,
  onChanged,
}: {
  client: ClientWithMeta;
  onChanged: () => void;
}) {
  const plans = client.supplementPlans;
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<SupplementPlanWithDetail | null>(null);
  const [previewing, setPreviewing] = useState<SupplementPlanWithDetail | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SupplementPlanWithDetail | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState<SupplementPlanWithDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditing(null);
  };

  const changeStatus = async (plan: SupplementPlanWithDetail, status: PlanStatus) => {
    setBusy(true);
    try {
      await setSupplementPlanStatus(plan.id, status);
      toast.success(status === 'active' ? 'Suplementación activada' : 'Marcada como completada');
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

  const sorted = [...plans].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return b.start_date.localeCompare(a.start_date);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-faint">
          <Pill className="h-3.5 w-3.5" strokeWidth={2} /> Suplementación
        </div>
        {!builderOpen && !editing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplatePickerOpen(true)}>
              <LibraryBig className="h-3.5 w-3.5" strokeWidth={2} /> Usar plantilla
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setBuilderOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Crear
            </Button>
          </div>
        )}
      </div>

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

      {sorted.length === 0 && !builderOpen ? (
        <Card className="border-dashed border-border-strong shadow-none">
          <EmptyState
            icon={Pill}
            title="Sin suplementación"
            description="Se asigna por separado del plan nutricional."
          />
        </Card>
      ) : (
        sorted.map((plan) => (
          <Card key={plan.id} className={cn('p-5', plan.status !== 'active' && 'opacity-75')}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-[15px] font-semibold">{plan.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide',
                      STATUS_BADGE[plan.status],
                    )}
                  >
                    {STATUS_LABEL[plan.status]}
                  </span>
                  {plan.template_id && (
                    <span className="rounded-full bg-muted px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      De plantilla
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {plan.supplement_plan_items.length}{' '}
                  {plan.supplement_plan_items.length === 1 ? 'suplemento' : 'suplementos'} · desde{' '}
                  {fmtDate(plan.start_date)}
                </div>
              </div>
              <span className="flex flex-none items-center gap-1">
                <IconBtn
                  label={`Exportar ${plan.name} a PDF`}
                  title="Exportar a PDF"
                  onClick={() => {
                    void exportSupplementPdf(plan, client.display_name ?? client.email).then(
                      () => {
                        toast.success('PDF descargado');
                      },
                      (e: unknown) => {
                        toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF');
                      },
                    );
                  }}
                >
                  <FileDown className="h-3 w-3" strokeWidth={2.25} />
                </IconBtn>
                <IconBtn
                  label={`Vista previa de ${plan.name}`}
                  title="Vista previa en la app"
                  onClick={() => setPreviewing(plan)}
                >
                  <Smartphone className="h-3 w-3" strokeWidth={2.25} />
                </IconBtn>
                <IconBtn
                  label={`Guardar ${plan.name} como plantilla`}
                  title="Guardar como plantilla"
                  onClick={() => setSaveAsTemplate(plan)}
                >
                  <BookmarkPlus className="h-3 w-3" strokeWidth={2.25} />
                </IconBtn>
                <IconBtn
                  label={`Editar ${plan.name}`}
                  title="Editar"
                  onClick={() => {
                    setBuilderOpen(false);
                    setEditing(plan);
                  }}
                >
                  <Pencil className="h-3 w-3" strokeWidth={2.25} />
                </IconBtn>
                <IconBtn
                  label={`Eliminar ${plan.name}`}
                  title="Eliminar"
                  onClick={() => setPendingDelete(plan)}
                  danger
                >
                  <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                </IconBtn>
              </span>
            </div>

            {plan.status !== 'active' ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={busy}
                onClick={() => void changeStatus(plan, 'active')}
              >
                <Play className="h-3.5 w-3.5" strokeWidth={2.5} /> Activar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={busy}
                onClick={() => void changeStatus(plan, 'completed')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} /> Marcar completada
              </Button>
            )}
          </Card>
        ))
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

      <SaveAsTemplateDialog
        planName={saveAsTemplate?.name ?? null}
        onClose={() => setSaveAsTemplate(null)}
        onSave={(name) => saveSupplementPlanAsTemplate(saveAsTemplate!.id, name)}
        invalidateKey={qk.supplementTemplates}
        onSaved={onChanged}
      />

      <TemplatePicker
        open={templatePickerOpen}
        title="Asignar suplementación"
        queryKey={qk.supplementTemplates}
        queryFn={listSupplementTemplates}
        onAssign={(templateId, startDate) =>
          assignSupplementTemplate(templateId, client.id, startDate)
        }
        onClose={() => setTemplatePickerOpen(false)}
        onAssigned={() => {
          setTemplatePickerOpen(false);
          onChanged();
        }}
      />

      <AlertDialog open={pendingDelete != null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{pendingDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el plan y todos sus suplementos. Esta acción no se puede deshacer.
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
    </div>
  );
}

/* ---------------- shared dialogs ---------------- */

function SaveAsTemplateDialog({
  planName,
  onClose,
  onSave,
  invalidateKey,
  onSaved,
}: {
  planName: string | null;
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
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-muted-foreground">
            Se copia a tu biblioteca para reutilizarlo con otros clientes. El plan de este cliente no
            cambia.
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
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PickableTemplate {
  id: string;
  name: string;
  status: PlanStatus;
}

/** Shared by both sections — they differ only in which library they read and
 *  which assign RPC they call. */
function TemplatePicker<T extends PickableTemplate>({
  open,
  title,
  queryKey,
  queryFn,
  onAssign,
  onClose,
  onAssigned,
}: {
  open: boolean;
  title: string;
  queryKey: readonly string[];
  queryFn: () => Promise<T[]>;
  onAssign: (templateId: string, startDate: string) => Promise<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { data: templates } = useQuery({ queryKey, queryFn, enabled: open });
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const available = (templates ?? []).filter((t) => t.status === 'active');

  const submit = async () => {
    if (templateId == null) return;
    setSaving(true);
    try {
      await onAssign(templateId, startDate);
      toast.success('Plan asignado');
      setTemplateId(null);
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-muted-foreground">
            Se crea una copia para este cliente y pasa a ser su plan activo — el anterior se archiva
            automáticamente.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp-start">Fecha de inicio</Label>
            <Input
              id="tp-start"
              type="date"
              className="max-w-[180px]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border">
            {templates == null ? (
              <div className="p-4 text-center text-[12.5px] text-faint">Cargando plantillas…</div>
            ) : available.length === 0 ? (
              <div className="p-4 text-center text-[12.5px] text-faint">
                No tienes plantillas activas. Crea una en la sección Nutrición.
              </div>
            ) : (
              available.map((t) => {
                const selected = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-[13px] last:border-b-0 transition-colors',
                      selected ? 'bg-primary/10 text-primary dark:bg-primary/15' : 'hover:bg-muted',
                    )}
                  >
                    <span className="truncate font-medium">{t.name}</span>
                    {selected && <span className="text-[11px] font-bold">Seleccionada</span>}
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
          <Button onClick={() => void submit()} disabled={saving || templateId == null}>
            {saving ? 'Asignando…' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 flex-none text-faint transition-transform', open && 'rotate-90')}
          strokeWidth={2.25}
        />
        <span className="w-[104px] flex-none text-[13px] font-semibold">{relTime(date)}</span>
        <span className="w-[92px] flex-none text-[12px] text-faint">{fmtDate(date)}</span>

        <span className="flex-none text-[12px] text-faint">
          {meals.length} {meals.length === 1 ? 'comida' : 'comidas'}
        </span>

        {/* Photo + plan-adherence counts: the two signals a coach scans for. */}
        {tot.photos > 0 && (
          <span
            className="flex flex-none items-center gap-1 text-[11.5px] text-faint"
            title={`${tot.photos} con foto`}
          >
            <Camera className="h-3 w-3" strokeWidth={2} />
            {tot.photos}
          </span>
        )}
        {tot.planned > 0 && (
          <span
            className="flex flex-none items-center gap-1 rounded-full bg-secondary/10 px-1.5 py-[1px] text-[11px] font-semibold text-secondary"
            title={`${tot.planned} del plan`}
          >
            <UtensilsCrossed className="h-3 w-3" strokeWidth={2} />
            {tot.planned}
          </span>
        )}

        <span className="ml-auto flex items-center gap-2.5">
          {pct != null && (
            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
              <span
                className={cn('block h-full rounded-full', pct >= 100 ? 'bg-warning' : 'bg-secondary')}
                style={{ width: `${pct}%` }}
              />
            </span>
          )}
          <span className="w-[112px] text-right text-[12.5px] tabular-nums">
            <span className="font-semibold text-primary">{tot.cal.toLocaleString('en-US')}</span>
            {goal != null && <span className="text-faint"> / {goal.toLocaleString('en-US')}</span>}
          </span>
          <span className="hidden w-[128px] text-right text-[11.5px] tabular-nums text-faint md:block">
            P {Math.round(tot.p)} · C {Math.round(tot.c)} · G {Math.round(tot.f)}
          </span>
        </span>
      </button>

      {open && (
        <div className="bg-muted/30 px-4 pb-3 pt-1">
          <div
            className={`${ITEM_GRID} border-b border-border pb-1 text-[10px] font-bold uppercase tracking-wider text-faint`}
          >
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
                <div className={`${ITEM_GRID} items-center pt-2.5 text-[12px] font-bold tabular-nums`}>
                  <span />
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex-none rounded-full bg-secondary/10 px-2 py-[2px] text-[10.5px] font-bold text-secondary dark:bg-secondary/15">
                      {typeLabel}
                    </span>
                    {showName && (
                      <span className="min-w-0 truncate text-[12px] font-semibold text-muted-foreground">
                        {m.name}
                      </span>
                    )}
                    {m.assigned_by && <OwnerBadge assignedBy={m.assigned_by} />}
                  </span>
                  <span className="text-right text-primary">{mt.cal}</span>
                  <span className="text-right">{Math.round(mt.p)}</span>
                  <span className="text-right">{Math.round(mt.c)}</span>
                  <span className="text-right">{Math.round(mt.f)}</span>
                </div>

                {m.meal_items.map((it, i) => (
                  <div key={i} className={`${ITEM_GRID} items-center py-[3px] text-[12px] tabular-nums`}>
                    {/* The photo the client took — the coach's clearest window
                        into what was actually on the plate. */}
                    {it.photo_path ? (
                      <a
                        href={mealPhotoUrl(it.photo_path)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Ver foto de ${it.name}`}
                        className="block h-7 w-7 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <img
                          src={mealPhotoUrl(it.photo_path)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <span />
                    )}
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate">{it.name}</span>
                      {it.portion && (
                        <span className="flex-none text-[10.5px] text-faint">{it.portion}</span>
                      )}
                      {/* Registered straight from a prescribed option. */}
                      {it.plan_option_id && (
                        <span
                          title="Registrado desde el plan"
                          className="flex-none rounded-full bg-secondary/10 px-1.5 text-[9.5px] font-bold uppercase tracking-wide text-secondary"
                        >
                          plan
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
      )}
    </div>
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
  children: ReactNode;
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
