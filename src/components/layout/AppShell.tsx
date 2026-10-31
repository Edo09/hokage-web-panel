import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FocusModeContext } from '@/hooks/useFocusMode';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';

const TITLES: [prefix: string, title: string][] = [
  ['/clients/', 'Cliente'],
  ['/clients', 'Clientes'],
  ['/programs', 'Programas'],
  ['/nutrition', 'Nutrición'],
  ['/exercises', 'Ejercicios'],
  ['/memberships', 'Membresías'],
  ['/settings', 'Ajustes'],
  ['/', 'Panel'],
];

/**
 * Phones: top bar + tab bar at the bottom. Tablets: icon rail. Desktop: the
 * full sidebar. While a builder is open (focus mode) all of it steps aside.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024);

  // Auto-collapse the sidebar at tablet widths
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [focusCount, setFocusCount] = useState(0);
  const [focusRoot, setFocusRoot] = useState<HTMLDivElement | null>(null);
  const enter = useCallback(() => {
    setFocusCount((c) => c + 1);
    return () => setFocusCount((c) => c - 1);
  }, []);
  const focus = focusCount > 0;
  const focusValue = useMemo(() => ({ root: focusRoot, active: focus, enter }), [focusRoot, focus, enter]);

  const title = TITLES.find(([p]) => (p === '/' ? pathname === '/' : pathname.startsWith(p)))?.[1] ?? 'Panel';

  return (
    <FocusModeContext.Provider value={focusValue}>
      {/* Hidden, not unmounted, in focus mode: the page that opened the
          builder keeps its state underneath. */}
      <div className={cn('min-h-screen', focus ? 'hidden' : 'md:flex md:items-stretch')}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={title} />
          <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-16 md:pt-7 lg:px-8">
            <Outlet />
          </main>
        </div>
        <MobileNav />
      </div>
      <div ref={setFocusRoot} />
    </FocusModeContext.Provider>
  );
}
