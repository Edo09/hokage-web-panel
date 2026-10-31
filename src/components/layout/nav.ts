import {
  Apple,
  CalendarRange,
  CreditCard,
  Dumbbell,
  LayoutGrid,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Daily work — the sidebar's main list and the phone's tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Panel', icon: LayoutGrid },
  { to: '/clients', label: 'Clientes', icon: Users },
  { to: '/programs', label: 'Programas', icon: CalendarRange },
  { to: '/nutrition', label: 'Nutrición', icon: Apple },
];

/** Set-up and less frequent — under "Más" on a phone. */
export const SECONDARY_NAV: NavItem[] = [
  { to: '/exercises', label: 'Ejercicios', icon: Dumbbell },
  { to: '/memberships', label: 'Membresías', icon: CreditCard },
  { to: '/settings', label: 'Ajustes', icon: SlidersHorizontal },
];

export const isActivePath = (pathname: string, to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
