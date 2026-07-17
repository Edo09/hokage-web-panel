import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const TITLES: [prefix: string, title: string][] = [
  ['/clients/', 'Cliente'],
  ['/clients', 'Clientes'],
  ['/memberships', 'Membresías'],
  ['/settings', 'Ajustes'],
  ['/', 'Panel'],
];

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

  const title = TITLES.find(([p]) => (p === '/' ? pathname === '/' : pathname.startsWith(p)))?.[1] ?? 'Panel';

  return (
    <div className="flex min-h-screen items-stretch">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className="w-full max-w-[1440px] flex-1 px-7 pb-16 pt-[26px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
