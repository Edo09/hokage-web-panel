import { cn } from '@/lib/utils';
import { BODY_ART, type BodySlug } from '@/components/muscles/bodyArt';

/**
 * A quiet body silhouette with a few muscles lit — the exercise library's
 * category art. Same drawings as BodyFigure, but lit by muscle (slug)
 * instead of by muscle-map group, and not interactive.
 */
export function MuscleSilhouette({
  side,
  slugs,
  className,
}: {
  side: 'front' | 'back';
  slugs: BodySlug[];
  className?: string;
}) {
  const art = BODY_ART.male[side];
  const lit = new Set(slugs);
  return (
    <svg viewBox={art.viewBox} aria-hidden className={cn('aspect-[1/2]', className)}>
      {art.parts.map((part) => (
        <g
          key={part.slug}
          style={{ fill: lit.has(part.slug) ? 'hsl(var(--primary))' : 'hsl(var(--border-strong))' }}
        >
          {part.paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      ))}
    </svg>
  );
}
