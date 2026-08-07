import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Plus, Smartphone, Trash2 } from 'lucide-react';
import type {
  ClientWithMeta,
  DayType,
  PlanStatus,
  SupplementPlanWithDetail,
  SupplementTier,
  SupplementTiming,
} from '@/types';
import {
  createSupplementPlan,
  createSupplementTemplate,
  updateSupplementPlan,
  updateSupplementTemplate,
  type SaveSupplementPlanInput,
  type SupplementItemInput,
} from '@/services/supplementPlans';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MobileNutritionPreview } from '@/components/nutrition/MobileNutritionPreview';
import { draftToSupplementPreview, emptyPlanPreview } from '@/components/nutrition/previewModel';

const TIERS: { value: SupplementTier; label: string; hint: string }[] = [
  { value: 'base', label: 'Base', hint: 'Obligatorios / recomendados firmemente' },
  { value: 'conditional', label: 'Condicionales', hint: 'Según tolerancia y preferencia' },
  { value: 'optional', label: 'Opcionales', hint: 'Menor prioridad' },
];

/** Ordered by where they fall in a day — this order IS the schedule table. */
const TIMINGS: { value: SupplementTiming; label: string }[] = [
  { value: 'wake', label: 'Al despertar' },
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'pre_workout', label: 'Pre-entreno' },
  { value: 'intra_workout', label: 'Durante el entreno' },
  { value: 'post_workout', label: 'Post-entreno' },
  { value: 'lunch', label: 'Almuerzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'bedtime', label: 'Antes de dormir' },
  { value: 'any', label: 'Cualquier momento' },
];

const APPLIES_TO: { value: DayType; label: string }[] = [
  { value: 'both', label: 'Ambos días' },
  { value: 'training', label: 'Solo entreno' },
  { value: 'rest', label: 'Solo descanso' },
];

const STATUSES: { value: PlanStatus; label: string }[] = [
  { value: 'active', label: 'Activo' },
  { value: 'completed', label: 'Completado' },
  { value: 'archived', label: 'Archivado' },
];

const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

interface ItemRow {
  name: string;
  tier: SupplementTier;
  dose: string;
  timingSlot: SupplementTiming;
  timingNote: string;
  purpose: string;
  notes: string;
  appliesTo: DayType;
  /** UI-only: whether the row's advanced disclosure is expanded. Not sent. */
  advOpen: boolean;
}

const emptyItem = (tier: SupplementTier = 'base'): ItemRow => ({
  name: '',
  tier,
  dose: '',
  timingSlot: 'any',
  timingNote: '',
  purpose: '',
  notes: '',
  appliesTo: 'both',
  advOpen: false,
});

const itemsFrom = (p: SupplementPlanWithDetail): ItemRow[] =>
  p.supplement_plan_items.length === 0
    ? [emptyItem()]
    : [...p.supplement_plan_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          name: i.name,
          tier: i.tier,
          dose: i.dose ?? '',
          timingSlot: i.timing_slot,
          timingNote: i.timing_note ?? '',
          purpose: i.purpose ?? '',
          notes: i.notes ?? '',
          appliesTo: i.applies_to,
          advOpen: !!i.timing_note || !!i.purpose || !!i.notes || i.applies_to !== 'both',
        }));

const advSummary = (i: ItemRow): string => {
  const parts: string[] = [];
  if (i.appliesTo !== 'both') {
    parts.push(APPLIES_TO.find((a) => a.value === i.appliesTo)?.label.toLowerCase() ?? '');
  }
  if (i.purpose.trim()) parts.push('con objetivo');
  if (i.notes.trim()) parts.push('con nota');
  return parts.filter(Boolean).join(' · ');
};

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
function FieldCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</span>
      {children}
    </div>
  );
}

/**
 * The supplement-stack builder. Flatter than the nutrition wizard — a plan is
 * just a tiered list, so it needs no steps.
 *
 * Assignable independently of the nutrition plan: a coach changes diets far more
 * often than stacks. Callers mirror the nutrition builder — `client` set saves
 * an assigned plan, omitted saves a reusable TEMPLATE.
 */
export function SupplementPlanBuilder({
  client,
  initial,
  onClose,
  onSaved,
}: {
  client?: ClientWithMeta;
  initial?: SupplementPlanWithDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isTemplate = client == null;
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date?.slice(0, 10) ?? todayISO());
  const [status, setStatus] = useState<PlanStatus>(initial?.status ?? 'active');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [items, setItems] = useState<ItemRow[]>(initial ? itemsFrom(initial) : [emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const firstName = client?.display_name?.split(' ')[0] ?? 'el cliente';

  const updItem = (ii: number, patch: Partial<ItemRow>) =>
    setItems((xs) => xs.map((x, i) => (i === ii ? { ...x, ...patch } : x)));

  const submit = async () => {
    const nm = name.trim();
    if (!nm) return toast.error('Ponle nombre al plan de suplementación');

    const outItems: SupplementItemInput[] = items
      .filter((i) => i.name.trim())
      .map((i, idx) => ({
        name: i.name.trim(),
        tier: i.tier,
        dose: i.dose.trim() || null,
        timing_slot: i.timingSlot,
        timing_note: i.timingNote.trim() || null,
        purpose: i.purpose.trim() || null,
        notes: i.notes.trim() || null,
        applies_to: i.appliesTo,
        sort_order: idx,
      }));

    if (outItems.length === 0) return toast.error('Añade al menos un suplemento');

    const payload: SaveSupplementPlanInput = {
      name: nm,
      description: description.trim() || null,
      start_date: startDate,
      status,
      notes: notes.trim() || null,
      items: outItems,
    };

    setSaving(true);
    try {
      if (initial) {
        if (isTemplate) {
          await updateSupplementTemplate(initial.id, payload);
          toast.success('Plantilla actualizada');
        } else {
          await updateSupplementPlan(initial.id, client!.id, payload);
          toast.success('Plan actualizado');
        }
      } else if (isTemplate) {
        await createSupplementTemplate(payload);
        toast.success('Plantilla guardada');
      } else {
        await createSupplementPlan(client!.id, payload);
        toast.success(`Suplementación asignada a ${firstName}`);
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const count = items.filter((i) => i.name.trim()).length;
  const summaryText = `${count} ${count === 1 ? 'suplemento' : 'suplementos'}`;
  const saveLabel = saving
    ? 'Guardando…'
    : initial
      ? 'Guardar cambios'
      : isTemplate
        ? 'Guardar plantilla'
        : `Asignar a ${firstName}`;

  return (
    <Card className="animate-fade-up overflow-hidden border-[1.5px] border-primary p-0">
      <div className="border-b border-border px-[22px] py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-heading text-[15px] font-semibold">
            {isTemplate
              ? initial
                ? 'Editar plantilla'
                : 'Nueva plantilla de suplementación'
              : initial
                ? 'Editar suplementación'
                : 'Nueva suplementación'}
            <span className="ml-1.5 text-[13px] font-normal text-faint">
              {isTemplate ? '· reutilizable' : `· para ${firstName}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Smartphone className="h-3.5 w-3.5" strokeWidth={2} /> Vista previa
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-[22px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="sb-name">
            <Input
              id="sb-name"
              placeholder="Ej. Suplementación Fase 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          {!isTemplate && (
            <Field label="Fecha de inicio" htmlFor="sb-start">
              <Input
                id="sb-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
          )}
        </div>

        {!isTemplate && (
          <Field label="Estado" className="max-w-[220px]">
            <Select value={status} onValueChange={(v) => setStatus(v as PlanStatus)}>
              <SelectTrigger aria-label="Estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Items, grouped visually by tier via each row's own selector. The
            order here is the sort_order — the schedule table derives from
            timing_slot, not from this list. */}
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-faint">
            Un suplemento por fila. El horario que elijas arma solo la tabla de horarios que ve el
            cliente — no hace falta escribirla.
          </p>

          {items.map((item, ii) => {
            const adv = advSummary(item);
            return (
              <div key={ii} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
                    {ii + 1}
                  </span>
                  <Input
                    aria-label="Suplemento"
                    placeholder="Ej. Creatina Monohidrato"
                    className="h-9 min-w-0 flex-1 text-[13.5px] font-medium"
                    value={item.name}
                    onChange={(e) => updItem(ii, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => items.length > 1 && setItems((xs) => xs.filter((_, i) => i !== ii))}
                    aria-label="Quitar suplemento"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border text-faint transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap items-end gap-2 pl-[34px]">
                  <FieldCell label="Dosis" className="w-[190px]">
                    <Input
                      className="h-8 text-[12.5px]"
                      aria-label="Dosis"
                      placeholder="Ej. 5 g al día"
                      value={item.dose}
                      onChange={(e) => updItem(ii, { dose: e.target.value })}
                    />
                  </FieldCell>
                  <FieldCell label="Horario" className="w-[168px]">
                    <Select
                      value={item.timingSlot}
                      onValueChange={(v) => updItem(ii, { timingSlot: v as SupplementTiming })}
                    >
                      <SelectTrigger className="h-8 text-[12.5px]" aria-label="Horario">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMINGS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldCell>
                  <FieldCell label="Prioridad" className="w-[150px]">
                    <Select
                      value={item.tier}
                      onValueChange={(v) => updItem(ii, { tier: v as SupplementTier })}
                    >
                      <SelectTrigger className="h-8 text-[12.5px]" aria-label="Prioridad">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIERS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldCell>
                </div>

                <div className="mt-2.5 pl-[34px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updItem(ii, { advOpen: !item.advOpen })}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary transition-colors hover:text-secondary/80 focus-visible:outline-none"
                    >
                      {item.advOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                      )}
                      Avanzado
                    </button>
                    {!item.advOpen && adv && <span className="text-[11.5px] text-faint">{adv}</span>}
                  </div>

                  {item.advOpen && (
                    <div className="mt-2.5 flex flex-wrap items-end gap-2">
                      <FieldCell label="Detalle del horario" className="w-[260px]">
                        <Input
                          className="h-8 text-[12.5px]"
                          aria-label="Detalle del horario"
                          placeholder="Ej. 30-45 minutos antes del entrenamiento"
                          value={item.timingNote}
                          onChange={(e) => updItem(ii, { timingNote: e.target.value })}
                        />
                      </FieldCell>
                      <FieldCell label="Aparece en" className="w-[150px]">
                        <Select
                          value={item.appliesTo}
                          onValueChange={(v) => updItem(ii, { appliesTo: v as DayType })}
                        >
                          <SelectTrigger className="h-8 text-[12.5px]" aria-label="Aparece en">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {APPLIES_TO.map((a) => (
                              <SelectItem key={a.value} value={a.value}>
                                {a.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldCell>
                      <FieldCell label="Objetivo" className="w-full">
                        <Input
                          className="h-8 text-[12.5px]"
                          aria-label="Objetivo"
                          placeholder="Ej. Mejorar fuerza y volumen muscular"
                          value={item.purpose}
                          onChange={(e) => updItem(ii, { purpose: e.target.value })}
                        />
                      </FieldCell>
                      <FieldCell label="Nota" className="w-full">
                        <Input
                          className="h-8 text-[12.5px]"
                          aria-label="Nota"
                          placeholder="Ej. No requiere fase de carga"
                          value={item.notes}
                          onChange={(e) => updItem(ii, { notes: e.target.value })}
                        />
                      </FieldCell>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setItems((xs) => [...xs, emptyItem(xs[xs.length - 1]?.tier ?? 'base')])}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Añadir suplemento
          </button>
        </div>

        <div className="grid gap-3">
          <Field label="Descripción" htmlFor="sb-desc">
            <Textarea
              id="sb-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Notas para el cliente" htmlFor="sb-notes">
            <Textarea
              id="sb-notes"
              rows={2}
              placeholder='Ej. "Un servicio" es la cantidad que indica el frasco.'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-[22px] py-3.5">
        <span className="text-[12px] text-faint">{summaryText}</span>
        <Button size="sm" disabled={saving} onClick={() => void submit()}>
          {saveLabel}
        </Button>
      </div>

      {/* Preview opens straight on the Suplementos pane, with an empty plan
          shell behind it — the two are independently assignable. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <MobileNutritionPreview
            plan={emptyPlanPreview()}
            supplements={draftToSupplementPreview(name, notes, items)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
