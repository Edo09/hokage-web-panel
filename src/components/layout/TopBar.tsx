import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCoach } from '@/hooks/useCoach';
import { useTheme } from '@/hooks/useTheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from './NotificationBell';

export function TopBar({ title }: { title: string }) {
  const { signOut } = useAuth();
  const { coach } = useCoach();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const initial = (coach.display_name || 'C').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center gap-3 px-4 sm:px-6 md:h-16 lg:px-8">
        <img src="/logo.jpg" alt="" className="h-8 w-8 flex-none rounded-md border border-border object-cover md:hidden" />
        <h1 className="display min-w-0 truncate pt-0.5 text-[24px] md:text-[30px]">{title}</h1>

        <div className="ml-auto flex flex-none items-center gap-1.5">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Tu cuenta"
              className="flex h-10 items-center gap-2.5 rounded-lg pl-1 pr-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-3"
            >
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">
                {initial}
              </span>
              <span className="hidden max-w-[160px] truncate text-sm font-medium sm:block">{coach.display_name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel className="pb-2">
                <span className="block truncate text-sm font-semibold text-foreground">{coach.display_name}</span>
                <span className="block text-xs font-normal text-muted-foreground">Coach</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/settings')}>
                <SlidersHorizontal />
                Ajustes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggle}>
                {theme === 'dark' ? <Sun /> : <Moon />}
                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut().then(() => navigate('/login'))}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
