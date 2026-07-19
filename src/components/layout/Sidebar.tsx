import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, CreditCard, LayoutGrid, SlidersHorizontal, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { Switch } from '@/components/ui/switch';

const NAV = [
  { to: '/', label: 'Panel', icon: LayoutGrid },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/memberships', label: 'Membresías', icon: CreditCard },
  { to: '/settings', label: 'Ajustes', icon: SlidersHorizontal },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'sticky top-0 flex h-screen flex-none flex-col overflow-hidden border-r border-border bg-card px-3 py-[18px] transition-[width] duration-200',
        collapsed ? 'w-[74px]' : 'w-[232px]',
      )}
    >
      <div
        className={cn(
          'mb-3.5 flex items-center gap-3 border-b border-border pb-[18px] pt-1',
          // px-0 + centered when collapsed: the 74px rail minus paddings can't
          // fit the logo otherwise (preflight's img max-width would squash it)
          collapsed ? 'justify-center px-0' : 'px-2',
        )}
      >
        <img
          src="/logo.jpg"
          alt="The Hokage"
          className={cn(
            'max-w-none flex-none rounded-xl border border-border object-cover',
            collapsed ? 'h-11 w-11' : 'h-14 w-14',
          )}
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="whitespace-nowrap font-heading text-[19px] font-bold tracking-wide">THE HOKAGE</div>
            <div className="whitespace-nowrap text-[12px] text-muted-foreground">Coaching</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                'flex w-full items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-primary/10 text-primary dark:bg-primary/15' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-[17px] w-[17px] flex-none" strokeWidth={1.8} />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Switch renders its own <button role="switch"> — a real <button>
          wrapper would nest button-in-button (invalid HTML). This row acts
          as one control: div+role=button, Switch stays visual/inert. */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className="flex w-full cursor-pointer items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Switch checked={theme === 'light'} aria-label="Cambiar tema" className="pointer-events-none flex-none" />
        {!collapsed && <span className="whitespace-nowrap">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
      </div>

      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        className="flex w-full items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-faint transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft
          className={cn('h-4 w-4 flex-none transition-transform duration-200', collapsed && 'rotate-180')}
          strokeWidth={2}
        />
        {!collapsed && <span className="whitespace-nowrap">Contraer</span>}
      </button>
    </nav>
  );
}
