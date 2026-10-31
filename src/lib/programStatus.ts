import type { ProgramStatus } from '@/types';

/** Spanish label per program status. */
export const STATUS_LABEL: Record<ProgramStatus, string> = {
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};

/** Badge tint per status — active reads "running" (green), completed "done"
 *  (blue), archived recedes. Red stays for actions. */
export const STATUS_BADGE: Record<ProgramStatus, string> = {
  active: 'bg-success/15 text-success',
  completed: 'bg-secondary/15 text-secondary',
  archived: 'bg-muted text-muted-foreground',
};
