import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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

interface Props {
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
  /** 'tomorrow' for programs: the server rejects a start before its own
   *  date, and "today" here can already be tomorrow there (UTC). Today is then
   *  not offered at all. */
  defaultStart?: 'today' | 'tomorrow';
  /** Extra settings under the date (e.g. «Solo semana actual»). */
  extra?: (selectedId: string | null) => ReactNode;
  /** Told whenever the picked option changes (to pre-set `extra` from it). */
  onSelectedChange?: (id: string | null) => void;
  submitLabel: (selected: PickOption | null) => string;
  /** Throws to keep the dialog open (the error is shown as a toast). */
  onSubmit: (id: string, startDate: string) => Promise<void>;
}

/**
 * "Assign": pick one thing from a list (a client for a template, or a
 * template for a client) and a start date. Every assign in the panel uses it,
 * so it reads and works the same everywhere.
 */
export function AssignDialog({
  open,
  onOpenChange,
  defaultStart = 'today',
  ...form
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  // A fresh form on every open (nothing carries over from last time), but it
  // stays mounted while the dialog animates out, so it doesn't flash empty.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <AssignForm key={session} {...form} defaultStart={defaultStart} onCancel={() => onOpenChange(false)} />
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
}: Props & { defaultStart: 'today' | 'tomorrow'; onCancel: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstDay = defaultStart === 'tomorrow' ? 1 : 0;
  const [startDate, setStartDate] = useState(iso(plusDays(firstDay)));
  const [saving, setSaving] = useState(false);
  const listId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = useMemo(() => {
    const list = options ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => `${o.title} ${o.subtitle ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);
  const selected = options?.find((o) => o.id === selectedId) ?? null;

  const choose = (id: string) => {
    if (id !== selectedId) onSelectedChange?.(id);
    setSelectedId(id);
  };

  // Radio-group keyboard model: arrows move and select, Home/End jump.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = filtered.findIndex((o) => o.id === selectedId);
    const last = filtered.length - 1;
    const to =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? Math.min(last, at + 1)
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? Math.max(0, at - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (to == null || last < 0) return;
    e.preventDefault();
    choose(filtered[to].id);
    refs.current[to]?.focus();
  };

  const quick = [
    ...(firstDay === 0 ? [{ label: 'Hoy', value: iso(new Date()) }] : []),
    { label: 'Mañana', value: iso(plusDays(1)) },
    { label: `Lunes ${nextMonday().getDate()}`, value: iso(nextMonday()) },
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

  // Which option takes the Tab stop: the chosen one, else the first.
  const tabStop = Math.max(0, filtered.findIndex((o) => o.id === selectedId));

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
              aria-controls={listId}
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto rounded-xl border border-border p-1">
            {options == null ? (
              <p role="status" className="p-4 text-center text-[13px] text-faint">
                Cargando…
              </p>
            ) : filtered.length === 0 ? (
              <p role="status" className="p-4 text-center text-[13px] text-faint">
                {options.length === 0 ? emptyText : 'Sin resultados.'}
              </p>
            ) : (
              <div id={listId} role="radiogroup" aria-label={pickLabel} onKeyDown={onKeyDown} className="flex flex-col gap-0.5">
                {filtered.map((o, i) => {
                  const active = o.id === selectedId;
                  return (
                    <button
                      key={o.id}
                      ref={(el) => (refs.current[i] = el)}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={i === tabStop ? 0 : -1}
                      onClick={() => choose(o.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        active ? 'bg-foreground text-background' : 'hover:bg-muted',
                      )}
                    >
                      {o.leading}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.title}</span>
                        {o.subtitle && (
                          <span className={cn('block truncate text-xs', active ? 'text-background/70' : 'text-faint')}>
                            {o.subtitle}
                          </span>
                        )}
                      </span>
                      {active && <Check className="h-4 w-4 flex-none" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
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
              min={iso(plusDays(firstDay))}
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
