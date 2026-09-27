import { lazy, Suspense } from 'react';
import type { ClientWithMeta } from '@/types';
import { Card } from '@/components/ui/card';

// Lazy: the body artwork behind it is ~100 KB, only needed where it shows.
const MuscleMapCard = lazy(() => import('@/components/muscles/MuscleMapCard'));

/** The client's muscle map (Resumen and Seguimiento), loaded on demand. */
export function MuscleMap({ client }: { client: ClientWithMeta }) {
  return (
    <Suspense
      fallback={
        <Card className="p-5">
          <div className="text-[13px] text-faint">Cargando músculos…</div>
        </Card>
      }
    >
      <MuscleMapCard client={client} />
    </Suspense>
  );
}
