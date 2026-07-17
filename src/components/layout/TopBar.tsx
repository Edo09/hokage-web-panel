import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCoach } from '@/hooks/useCoach';

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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-7 py-4">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-lg font-semibold">{title}</h1>
        <div className="text-xs text-faint">{today}</div>
      </div>
      <div className="flex flex-none items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary dark:bg-primary/15"
          >
            {(coach.display_name || 'C').trim().charAt(0).toUpperCase()}
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{coach.display_name}</div>
            <div className="text-[11.5px] text-faint">Coach</div>
          </div>
        </div>
        <button
          onClick={() => {
            signOut();
            navigate('/login');
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
