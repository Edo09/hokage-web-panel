import { NavLink, useLocation } from 'react-router-dom';
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { Tip } from '@/components/ui/tooltip';
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath, type NavItem } from './nav';

/** Tablet and desktop navigation (phones get MobileNav). */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();

  const item = ({ to, label, icon: Icon }: NavItem) => {
    const active = isActivePath(pathname, to);
    const link = (
      <NavLink
        key={to}
        to={to}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(
          'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed && 'justify-center px-0',
          active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
      >
        {/* The red tick marks where you are (not colour alone: the row is also filled). */}
        {active && <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-1 -skew-y-[20deg] bg-primary" />}
        <Icon className="h-[18px] w-[18px] flex-none" strokeWidth={active ? 2.2 : 1.8} />
        {!collapsed && <span className="truncate">{label}</span>}
      </NavLink>
    );
    return collapsed ? (
      <Tip key={to} label={label} side="right">
        {link}
      </Tip>
    ) : (
      link
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'sticky top-0 hidden h-screen flex-none flex-col border-r border-border bg-rail px-3 py-4 transition-[width] duration-200 md:flex',
        collapsed ? 'w-[72px]' : 'w-[236px]',
      )}
    >
      <div className={cn('mb-6 flex items-center gap-3', collapsed ? 'justify-center' : 'px-1')}>
        <img
          src="/logo.jpg"
          alt="The Hokage"
          className="h-10 w-10 max-w-none flex-none rounded-lg border border-border object-cover"
        />
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="whitespace-nowrap font-brand text-[21px] tracking-wide">THE HOKAGE</div>
            <div className="mt-1 text-xs text-muted-foreground">Panel del coach</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">{PRIMARY_NAV.map(item)}</div>
      <div className="my-4 h-px bg-border" />
      <div className="flex flex-col gap-0.5">{SECONDARY_NAV.map(item)}</div>

      <div className="flex-1" />

      <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : 'items-center')}>
        <Tip label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} side={collapsed ? 'right' : 'top'}>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </button>
        </Tip>
        <Tip label={collapsed ? 'Expandir menú' : 'Contraer menú'} side={collapsed ? 'right' : 'top'}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.8} />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.8} />
            )}
          </button>
        </Tip>
      </div>
    </nav>
  );
}
