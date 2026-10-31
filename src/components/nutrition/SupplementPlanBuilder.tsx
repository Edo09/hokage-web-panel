import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { ChevronDown, CopyPlus, Ellipsis, Pill, Plus, Smartphone, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FocusEditor } from '@/components/shared/FocusEditor';
import { DiscardChangesDialog } from '@/components/shared/DiscardChangesDialog';
import { MobileNutritionPreview } from '@/components/nutrition/MobileNutritionPreview';
import { draftToSupplementPreview, emptyPlanPreview } from '@/components/nutrition/previewModel';
import { DAY_META, TIERS, TIMINGS } from '@/components/nutrition/meta';
import { APPLIES_TO, STATUSES, todayISO } from '@/components/nutrition/builderModel';

interface ItemRow {
  name: string;
  tier: SupplementTier;
  dose: string;
  timingSlot: SupplementTiming;
  timingNote: string;
  purpose: string;
  notes: string;
  appliesTo: DayType;
  /** UI-only: whether the row's details are expanded. Not sent. */
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
          advOpen: false,
        }));

/** What's set behind a collapsed row — so configured values are never invisible. */
const detailChips = (i: ItemRow): string[] =>
  [
    i.appliesTo !== 'both' && DAY_META[i.appliesTo].label,
    i.timingNote.trim(),
    i.purpose.trim() && 'Para qué',
    i.notes.trim() && 'Nota',
  ].filter(Boolean) as string[];

const signature = (s: { name: string; description: string; startDate: string; status: PlanStatus; notes: string; items: ItemRow[] }) =>
  JSON.stringify(s, (key, value: unknown) => (key === 'advOpen' ? undefined : value));

/**
 * The supplement-stack builder: one list per priority tier (base,
 * conditional, optional) — the tier is where a supplement sits, not a field
 * to fill in. The timing each row picks builds the client's daily schedule
 * by itself.
 *
 * Assignable independently of the nutrition plan: a coach changes diets far
 * more often than stacks. `client` set saves an assigned plan, omitted saves a
 * reusable TEMPLATE.
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
  const [notesOpen, setNotesOpen] = useState(!!initial?.notes);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const firstName = client?.display_name?.split(' ')[0] ?? 'el cliente';

  const current = { name, description, startDate, status, notes, items };
  const savedSig = useRef<string | null>(null);
  if (savedSig.current === null) savedSig.current = signature(current);
  const requestClose = () => (signature(current) !== savedSig.current ? setConfirmClose(true) : onClose());

  const updItem = (ii: number, patch: Partial<ItemRow>) =>
    setItems((xs) => xs.map((x, i) => (i === ii ? { ...x, ...patch } : x)));

  /** Focus the name of the item at a position (it must be rendered). */
  const focusItem = (ii: number) => listRef.current?.querySelector<HTMLInputElement>(`[data-item="${ii}"]`)?.focus();

  const addItem = (tier: SupplementTier) => {
    flushSync(() => setItems((xs) => [...xs, emptyItem(tier)]));
    focusItem(items.length);
  };

  const submit = async () => {
    const nm = name.trim();
    if (!nm) {
      nameRef.current?.focus();
      return toast.error('Ponle nombre a la suplementación');
    }

    // Saved grouped by tier (base → conditional → optional), each tier in
    // the order it's listed — the order the client sees.
    const ordered = TIERS.flatMap((t) => items.filter((i) => i.tier === t.value));
    const outItems: SupplementItemInput[] = ordered
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

    if (outItems.length === 0) {
      focusItem(0);
      return toast.error('Añade al menos un suplemento');
    }

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
          toast.success('Plantilla guardada');
        } else {
          await updateSupplementPlan(initial.id, client!.id, payload);
          toast.success('Suplementación guardada');
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
  const saveLabel = saving
    ? 'Guardando…'
    : initial
      ? 'Guardar cambios'
      : isTemplate
        ? 'Guardar plantilla'
        : `Asignar a ${firstName}`;
  const preview = draftToSupplementPreview(name, notes, items);

  return (
    <FocusEditor
      kicker={isTemplate ? 'Suplementación · plantilla' : `Suplementación de ${firstName}`}
      title={isTemplate ? (initial ? 'Editar plantilla' : 'Nueva plantilla') : initial ? 'Editar suplementación' : 'Nueva suplementación'}
      onClose={requestClose}
      actions={
        <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)} aria-label="Vista previa" className="text-foreground xl:hidden">
          <Smartphone />
          <span className="hidden sm:inline">Vista previa</span>
        </Button>
      }
      footer={
        <>
          <div className="hidden min-w-0 flex-1 items-center gap-1.5 text-[13px] text-muted-foreground sm:flex">
            <Pill className="h-4 w-4" />
            <strong className="font-semibold tabular-nums text-foreground">{count}</strong>
            {count === 1 ? 'suplemento' : 'suplementos'}
          </div>
          <Button variant="ghost" onClick={requestClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving} className="flex-1 sm:flex-none">
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto flex w-full min-w-0 max-w-[920px] flex-col gap-8">
          <section aria-label="Datos de la suplementación" className="flex flex-col gap-4">
            <div>
              <label htmlFor="sb-name" className="sr-only">
                Nombre
              </label>
              <input
                id="sb-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del stack"
                autoFocus={!initial}
                className="display w-full border-b-2 border-transparent bg-transparent pb-1 text-[34px] text-foreground transition-colors placeholder:text-faint/50 hover:border-border focus:border-foreground/50 focus:outline-none sm:text-[44px]"
              />
              <input
                aria-label="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Añade una descripción, ej. Fase de definición"
                className="inline-input -mx-2 mt-1 h-9 max-w-xl text-[15px] text-muted-foreground"
              />
            </div>
            {!isTemplate && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Empieza" htmlFor="sb-start" className="w-[170px]">
                  <Input id="sb-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="Estado" className="w-[170px]">
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
              </div>
            )}
          </section>

          <div ref={listRef} className="flex flex-col gap-6">
            {TIERS.map((tier) => {
              const rows = items.map((item, ii) => ({ item, ii })).filter(({ item }) => item.tier === tier.value);
              return (
                <section key={tier.value} aria-labelledby={`sb-tier-${tier.value}`} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h2 id={`sb-tier-${tier.value}`} className="text-base font-semibold">
                      {tier.label}
                    </h2>
                    {rows.length > 0 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                        {rows.length}
                      </span>
                    )}
                    <InfoTip label={`Qué va en «${tier.label}»`}>{tier.tip}</InfoTip>
                  </div>
                  {rows.map(({ item, ii }) => (
                    <SupplementRow
                      key={ii}
                      ii={ii}
                      item={item}
                      canRemove={items.length > 1}
                      onPatch={(p) => updItem(ii, p)}
                      onDuplicate={() =>
                        setItems((xs) => [...xs.slice(0, ii + 1), { ...xs[ii], advOpen: false }, ...xs.slice(ii + 1)])
                      }
                      onRemove={() => setItems((xs) => xs.filter((_, i) => i !== ii))}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(tier.value)}
                    className={cn(
                      'flex h-11 items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      rows.length > 0 && 'w-fit border-transparent px-2 hover:border-transparent hover:bg-muted',
                    )}
                  >
                    <Plus className="h-4 w-4" /> Añadir a {tier.label.toLowerCase()}
                  </button>
                </section>
              );
            })}
          </div>

          <section aria-label="Notas para el cliente">
            {notesOpen ? (
              <Field label="Notas para el cliente" htmlFor="sb-notes" tip="Las ve en su plan, dentro de la app.">
                <Textarea
                  id="sb-notes"
                  rows={3}
                  autoFocus={!initial?.notes}
                  placeholder='Ej. "Un servicio" es la cantidad que indica el frasco.'
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setNotesOpen(true)} className="-ml-3">
                <Plus /> Notas para el cliente
              </Button>
            )}
          </section>
        </div>

        <aside aria-label="Vista previa en la app" className="hidden xl:block">
          <div className="sticky top-[88px] flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Así lo ve el cliente</span>
              <span className="flex items-center gap-1.5 text-xs text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> en vivo
              </span>
            </div>
            <MobileNutritionPreview plan={emptyPlanPreview()} supplements={preview} />
          </div>
        </aside>
      </div>

      <DiscardChangesDialog open={confirmClose} onOpenChange={setConfirmClose} editing={!!initial} onDiscard={onClose} />

      {/* Preview opens straight on the Suplementos pane, with an empty plan
          shell behind it — the two are independently assignable. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Así lo ve el cliente</DialogTitle>
          </DialogHeader>
          <MobileNutritionPreview plan={emptyPlanPreview()} supplements={preview} />
        </DialogContent>
      </Dialog>
    </FocusEditor>
  );
}

function SupplementRow({
  ii,
  item,
  canRemove,
  onPatch,
  onDuplicate,
  onRemove,
}: {
  ii: number;
  item: ItemRow;
  canRemove: boolean;
  onPatch: (p: Partial<ItemRow>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const timing = TIMINGS.find((t) => t.value === item.timingSlot) ?? TIMINGS[TIMINGS.length - 1];
  const TimingIcon = timing.icon;
  const chips = detailChips(item);
  const label = item.name.trim() || 'este suplemento';

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Pill className="h-[18px] w-[18px]" />
        </span>
        <input
          data-item={ii}
          aria-label="Suplemento"
          value={item.name}
          placeholder="Ej. Creatina monohidrato"
          onChange={(e) => onPatch({ name: e.target.value })}
          className="inline-input h-10 min-w-[160px] flex-1 basis-[calc(100%-6.5rem)] text-[15px] font-semibold sm:basis-0"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones de ${label}`} className="order-none sm:order-last">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Mover a</DropdownMenuLabel>
            {TIERS.filter((t) => t.value !== item.tier).map((t) => (
              <DropdownMenuItem key={t.value} onSelect={() => onPatch({ tier: t.value })}>
                {t.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDuplicate}>
              <CopyPlus />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem destructive disabled={!canRemove} onSelect={onRemove}>
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex w-full flex-wrap items-center gap-2 pl-12 sm:w-auto sm:pl-0">
          <Input
            aria-label={`Dosis de ${label}`}
            placeholder="Dosis, ej. 5 g"
            value={item.dose}
            onChange={(e) => onPatch({ dose: e.target.value })}
            className="h-9 w-[132px]"
          />
          <Select value={item.timingSlot} onValueChange={(v) => onPatch({ timingSlot: v as SupplementTiming })}>
            <SelectTrigger aria-label={`Cuándo tomar ${label}`} className="h-9 w-[190px]">
              <span className="flex min-w-0 items-center gap-2">
                <TimingIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{timing.label}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {TIMINGS.map((t) => {
                const TIcon = t.icon;
                return (
                  <SelectItem key={t.value} value={t.value}>
                    <TIcon className="text-muted-foreground" />
                    {t.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
        <button
          type="button"
          onClick={() => onPatch({ advOpen: !item.advOpen })}
          aria-expanded={item.advOpen}
          className="-ml-1 inline-flex h-7 items-center gap-1 rounded-md px-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', !item.advOpen && '-rotate-90')} />
          Detalles
        </button>
        {!item.advOpen &&
          chips.map((c) => (
            <span key={c} className="max-w-[220px] truncate rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {c}
            </span>
          ))}
      </div>

      {item.advOpen && (
        <div className="mt-3 grid gap-3 pl-12 sm:grid-cols-2">
          <Field label="Cuándo, en detalle" optional>
            <Input
              aria-label="Detalle del horario"
              placeholder="Ej. 30–45 min antes de entrenar"
              value={item.timingNote}
              onChange={(e) => onPatch({ timingNote: e.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="Días">
            <Select value={item.appliesTo} onValueChange={(v) => onPatch({ appliesTo: v as DayType })}>
              <SelectTrigger aria-label="Días en que aparece" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLIES_TO.map((a) => {
                  const AIcon = DAY_META[a.value].icon;
                  return (
                    <SelectItem key={a.value} value={a.value}>
                      <AIcon className={DAY_META[a.value].tone} />
                      {a.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Para qué" optional>
            <Input
              aria-label="Objetivo"
              placeholder="Ej. Fuerza y volumen muscular"
              value={item.purpose}
              onChange={(e) => onPatch({ purpose: e.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="Nota" optional>
            <Input
              aria-label="Nota"
              placeholder="Ej. No requiere fase de carga"
              value={item.notes}
              onChange={(e) => onPatch({ notes: e.target.value })}
              className="h-9"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
