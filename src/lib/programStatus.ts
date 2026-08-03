import type { ProgramStatus } from '@/types';

/** Spanish label per program status. */
export const STATUS_LABEL: Record<ProgramStatus, string> = {
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};

/** Badge tint per status — active pops, completed reads "done", archived recedes. */
export const STATUS_BADGE: Record<ProgramStatus, string> = {
  active: 'bg-primary/10 text-primary dark:bg-primary/15',
  completed: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  archived: 'bg-muted text-muted-foreground',
};
