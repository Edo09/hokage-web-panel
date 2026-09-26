import { cn } from '@/lib/utils';
import { SLUG_GROUP, type MuscleGroup } from '@/lib/muscleMap';
import { BODY_ART } from '@/components/muscles/bodyArt';

/**
 * One human figure (front or back) with each muscle filled by its group.
 * Non-muscle parts (head, hands, feet, joints) stay quiet. Clicking a muscle
 * picks its group; clicking anything else clears. Outlines use a
 * non-scaling stroke, so they're the same width at any figure size.
 */
export function BodyFigure({
  gender,
  side,
  label,
  fillFor,
  outlineFor,
  titleFor,
  onPick,
  className,
}: {
  gender: 'male' | 'female';
  side: 'front' | 'back';
  /** Accessible name of the figure. */
  label: string;
  /** CSS colour for a group's muscles. */
  fillFor: (group: MuscleGroup) => string;
  /** CSS colour of the group's outline, or null for none. */
  outlineFor?: (group: MuscleGroup) => string | null;
  /** Hover tooltip for a group's muscles. */
  titleFor?: (group: MuscleGroup) => string;
  onPick?: (group: MuscleGroup | null) => void;
  className?: string;
}) {
  const art = BODY_ART[gender][side];
  return (
    // Every figure gets the same 1:2 box (the drawings' own viewBoxes differ
    // a little between front/back and male/female); the default
    // preserveAspectRatio centres each drawing in it, so a front and a back
    // side by side line up.
    <svg viewBox={art.viewBox} role="img" aria-label={label} className={cn('aspect-[1/2] w-full', className)}>
      {art.parts.map((part) => {
        const group = SLUG_GROUP.get(part.slug);
        const outline = group ? (outlineFor?.(group) ?? null) : null;
        return (
          <g
            key={part.slug}
            onClick={onPick ? () => onPick(group ?? null) : undefined}
            className={cn(
              group && onPick && 'cursor-pointer transition-opacity hover:opacity-75 motion-reduce:transition-none',
            )}
            style={{ fill: group ? fillFor(group) : 'hsl(var(--border))' }}
            stroke={outline ?? 'none'}
            strokeWidth={outline ? 2 : 0}
            strokeLinejoin="round"
          >
            {group && titleFor && <title>{titleFor(group)}</title>}
            {part.paths.map((d, i) => (
              <path key={i} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
