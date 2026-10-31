import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Ellipsis, LogOut, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath } from './nav';

const TAB =
  'relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

/** The phone's tab bar: the four daily sections, the rest under "Más". */
export function MobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const moreActive = SECONDARY_NAV.some((n) => isActivePath(pathname, n.to));

  const tick = <span aria-hidden="true" className="absolute top-0 h-[3px] w-8 -skew-x-[20deg] bg-primary" />;

  return (
    <nav
      aria-label="Navegación principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-5">
        {PRIMARY_NAV.map(({ to, label, icon: Icon }) => {
          const active = isActivePath(pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(TAB, active ? 'text-foreground' : 'text-muted-foreground')}
            >
              {active && tick}
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </NavLink>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(TAB, moreActive ? 'text-foreground' : 'text-muted-foreground')}>
            {moreActive && tick}
            <Ellipsis className="h-5 w-5" strokeWidth={moreActive ? 2.2 : 1.8} />
            Más
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="mb-1 w-56">
            {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
              <DropdownMenuItem key={to} onSelect={() => navigate(to)} className="h-11">
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={toggle} className="h-11">
              {theme === 'dark' ? <Sun /> : <Moon />}
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut().then(() => navigate('/login'))} className="h-11">
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
