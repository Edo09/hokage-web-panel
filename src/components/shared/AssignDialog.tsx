import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoTip } from '@/components/ui/info-tip';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface PickOption {
  id: string;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
}

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
/** Next Monday, never today. */
const nextMonday = () => plusDays(((8 - new Date().getDay()) % 7) || 7);

/**
 * "Assign": pick one thing from a list (a client for a template, or a
 * template for a client) and a start date. Every assign in the panel uses it,
 * so it reads and works the same everywhere.
 */
export function AssignDialog({
  open,
  onOpenChange,
  title,
  description,
  tip,
  pickLabel,
  searchPlaceholder,
  options,
  emptyText,
  defaultStart = 'today',
  extra,
  onSelectedChange,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One short line under the title. */
  description?: ReactNode;
  /** The longer explanation, behind an ⓘ next to the description. */
  tip?: ReactNode;
  pickLabel: string;
  searchPlaceholder: string;
  /** Undefined while loading. */
  options: PickOption[] | undefined;
  emptyText: ReactNode;
  defaultStart?: 'today' | 'tomorrow';
  /** Extra settings under the date (e.g. «Solo semana actual»). */
  extra?: (selectedId: string | null) => ReactNode;
  /** Told whenever the picked option changes (to pre-set `extra` from it). */
  onSelectedChange?: (id: string | null) => void;
  submitLabel: (selected: PickOption | null) => string;
  /** Throws to keep the dialog open (the error is shown as a toast). */
  onSubmit: (id: string, startDate: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Remounted on every open, so nothing carries over from last time. */}
        {open && (
          <AssignForm
            title={title}
            description={description}
            tip={tip}
            pickLabel={pickLabel}
            searchPlaceholder={searchPlaceholder}
            options={options}
            emptyText={emptyText}
            defaultStart={defaultStart}
            extra={extra}
            onSelectedChange={onSelectedChange}
            submitLabel={submitLabel}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({
  title,
  description,
  tip,
  pickLabel,
  searchPlaceholder,
  options,
  emptyText,
  defaultStart,
  extra,
  onSelectedChange,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: ReactNode;
  description?: ReactNode;
  tip?: ReactNode;
  pickLabel: string;
  searchPlaceholder: string;
  options: PickOption[] | undefined;
  emptyText: ReactNode;
  defaultStart: 'today' | 'tomorrow';
  extra?: (selectedId: string | null) => ReactNode;
  onSelectedChange?: (id: string | null) => void;
  submitLabel: (selected: PickOption | null) => string;
  onSubmit: (id: string, startDate: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(iso(plusDays(defaultStart === 'tomorrow' ? 1 : 0)));
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const list = options ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => `${o.title} ${o.subtitle ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);
  const selected = options?.find((o) => o.id === selectedId) ?? null;

  const quick = [
    { label: 'Hoy', value: iso(new Date()) },
    { label: 'Mañana', value: iso(plusDays(1)) },
    {
      label: `Lunes ${nextMonday().getDate()}`,
      value: iso(nextMonday()),
    },
  ].filter((q, i, all) => all.findIndex((x) => x.value === q.value) === i);

  const submit = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await onSubmit(selectedId, startDate);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo asignar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription className="flex items-center gap-1.5">
            {description}
            {tip && <InfoTip label="Cómo funciona">{tip}</InfoTip>}
          </DialogDescription>
        )}
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="assign-search">{pickLabel}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              id="assign-search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <div role="listbox" aria-label={pickLabel} className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto rounded-xl border border-border p-1">
            {options == null ? (
              <div className="p-4 text-center text-[13px] text-faint">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-[13px] text-faint">{options.length === 0 ? emptyText : 'Sin resultados.'}</div>
            ) : (
              filtered.map((o) => {
                const active = o.id === selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setSelectedId(o.id);
                      if (o.id !== selectedId) onSelectedChange?.(o.id);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      active ? 'bg-foreground text-background' : 'hover:bg-muted',
                    )}
                  >
                    {o.leading}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.title}</span>
                      {o.subtitle && (
                        <span className={cn('block truncate text-xs', active ? 'text-background/70' : 'text-faint')}>{o.subtitle}</span>
                      )}
                    </span>
                    {active && <Check className="h-4 w-4 flex-none" strokeWidth={2.5} />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="assign-start">Empieza</Label>
          <div className="flex flex-wrap items-center gap-2">
            {quick.map((q) => (
              <button
                key={q.value}
                type="button"
                aria-pressed={startDate === q.value}
                onClick={() => setStartDate(q.value)}
                className={cn(
                  'h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  startDate === q.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                {q.label}
              </button>
            ))}
            <Input
              id="assign-start"
              type="date"
              min={iso(new Date())}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
        </div>

        {extra?.(selectedId)}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={() => void submit()} disabled={saving || !selectedId || !startDate}>
          {saving ? 'Asignando…' : submitLabel(selected)}
        </Button>
      </DialogFooter>
    </>
  );
}
