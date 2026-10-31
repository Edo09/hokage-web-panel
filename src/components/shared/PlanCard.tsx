import { Fragment, type ReactNode } from 'react';
import { Ellipsis, type LucideIcon } from 'lucide-react';
import type { ProgramStatus } from '@/types';
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/programStatus';
import { avatarColor, cn, fmtDate } from '@/lib/utils';
import { Avatar } from '@/components/shared/Avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface PlanFact {
  value: ReactNode;
  label: string;
}

export interface PlanAssignee {
  /** The assigned copy's id (unique per row). */
  key: string;
  clientId: string;
  name: string;
  status: ProgramStatus;
  startDate: string;
}

export interface PlanMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Draw a divider above this item. */
  divide?: boolean;
}

/**
 * A plan or template on a library shelf. The numbers say what's in it, the
 * faces say who's on it; the rest (preview, PDF, archive…) waits in the menu.
 */
export function PlanCard({
  title,
  subtitle,
  facts,
  tags,
  assigned,
  footnote,
  archived,
  onOpen,
  openLabel,
  actions,
  menu,
  children,
}: {
  title: string;
  subtitle?: string | null;
  facts: PlanFact[];
  tags?: ReactNode;
  /** Omit on a client's own plans (it's theirs — no list of people). */
  assigned?: PlanAssignee[];
  /** Shown where the assignees go when there are none to show. */
  footnote?: ReactNode;
  archived?: boolean;
  onOpen: () => void;
  /** What clicking the title does, for screen readers ("Editar Plan X"). */
  openLabel: string;
  actions?: ReactNode;
  menu: PlanMenuItem[];
  /** Anything else worth a glance (a progress bar). */
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col rounded-xl border bg-card transition-colors',
        archived ? 'border-dashed border-border-strong' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="flex items-start gap-1 p-4 pb-0 pr-2">
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="-m-1 min-w-0 flex-1 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Más acciones de ${title}`} className="-mt-0.5">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {menu.map((m) => {
              const Icon = m.icon;
              return (
                <Fragment key={m.label}>
                  {m.divide && <DropdownMenuSeparator />}
                  <DropdownMenuItem destructive={m.destructive} disabled={m.disabled} onSelect={m.onSelect}>
                    <Icon />
                    {m.label}
                  </DropdownMenuItem>
                </Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 pt-4">
        {facts.map((f) => (
          <span key={f.label} className="flex items-baseline gap-1.5">
            <span className="display text-[22px] tabular-nums">{f.value}</span>
            <span className="text-[13px] text-muted-foreground">{f.label}</span>
          </span>
        ))}
      </div>
      {tags && <div className="flex flex-wrap gap-1.5 px-4 pt-3">{tags}</div>}
      {children && <div className="px-4 pt-4">{children}</div>}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <div className="flex w-full items-center gap-2 border-t border-border px-4 py-3">
          {assigned ? <Assignees assigned={assigned} /> : footnote && <span className="min-w-0 truncate text-[13px] text-muted-foreground">{footnote}</span>}
          <div className="ml-auto flex flex-none items-center gap-1.5">{actions}</div>
        </div>
      </div>
    </article>
  );
}

/** A small tag on a card ("Ciclado", "Solo semana actual"). */
export function PlanTag({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

function Assignees({ assigned }: { assigned: PlanAssignee[] }) {
  if (assigned.length === 0) return <span className="text-[13px] text-faint">Sin asignar</span>;

  const people = [...new Map(assigned.map((a) => [a.clientId, a])).values()];
  const active = assigned.filter((a) => a.status === 'active').length;

  return (
    <Popover>
      <PopoverTrigger className="-ml-1 flex min-w-0 items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex flex-none -space-x-1.5">
          {people.slice(0, 4).map((p) => (
            <Avatar key={p.clientId} name={p.name} color={avatarColor(p.clientId)} size={26} className="ring-2 ring-card" />
          ))}
          {people.length > 4 && (
            <span className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-muted px-1 text-[11px] font-bold ring-2 ring-card">
              +{people.length - 4}
            </span>
          )}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {active > 0 ? `${active} ${active === 1 ? 'activo' : 'activos'}` : `${people.length} ${people.length === 1 ? 'cliente' : 'clientes'}`}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="px-2 pb-1.5 pt-1 text-xs font-medium text-faint">Asignado a</div>
        <ul className="flex max-h-72 flex-col overflow-y-auto">
          {assigned.map((a) => (
            <li key={a.key} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <Avatar name={a.name} color={avatarColor(a.clientId)} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.name}</span>
                <span className="block text-xs text-faint">Desde {fmtDate(a.startDate)}</span>
              </span>
              <span className={cn('flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_BADGE[a.status])}>
                {STATUS_LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
