import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCoach } from '@/hooks/useCoach';
import { cn } from '@/lib/utils';

export function TopBar({ title }: { title: string }) {
  const { signOut } = useAuth();
  const { coach } = useCoach();
  const navigate = useNavigate();

  const today = new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-7 py-4',
        // Poster: the app's header panel — gradient, skewed ghost block, big title.
        'poster:overflow-hidden poster:bg-gradient-to-b poster:from-card poster:to-background poster:py-5',
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-40 hidden h-[260px] w-[240px] -skew-x-[18deg] bg-primary/[0.07] poster:block"
      />
      <div className="relative min-w-0">
        <h1 className="truncate font-heading text-lg font-semibold poster:text-[34px] poster:leading-none">{title}</h1>
        <div className="flex items-center gap-2.5 text-xs text-faint poster:mt-2.5 poster:text-[11.5px] poster:font-bold poster:uppercase poster:tracking-[0.16em] poster:text-muted-foreground">
          <span aria-hidden="true" className="hidden h-[3px] w-[22px] flex-none bg-primary poster:block" />
          {today}
        </div>
      </div>
      <div className="relative flex flex-none items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary dark:bg-primary/15 poster:rounded-none poster:-skew-x-[8deg] poster:bg-primary poster:text-primary-foreground"
          >
            <span className="poster:skew-x-[8deg]">{(coach.display_name || 'C').trim().charAt(0).toUpperCase()}</span>
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{coach.display_name}</div>
            <div className="text-[11.5px] text-faint">Coach</div>
          </div>
        </div>
        <button
          onClick={() => {
            void signOut().then(() => navigate('/login'));
          }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
