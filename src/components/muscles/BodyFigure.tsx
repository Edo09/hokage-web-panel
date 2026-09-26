import { cn } from '@/lib/utils';
import { SLUG_GROUP, type MuscleGroup } from '@/lib/muscleMap';
import { BODY_ART } from '@/components/muscles/bodyArt';

/**
 * One human figure (front or back) with each muscle filled by its group.
 * Non-muscle parts (head, hands, feet, joints) stay quiet. Hovering a muscle
 * reports its group; clicking picks it (anything else clears); `faded`
 * groups drop back so a picked one stands out.
 */
export function BodyFigure({
  gender,
  side,
  label,
  fillFor,
  fadedFor,
  onHover,
  onPick,
  className,
}: {
  gender: 'male' | 'female';
  side: 'front' | 'back';
  /** Accessible name of the figure. */
  label: string;
  /** CSS colour for a group's muscles. */
  fillFor: (group: MuscleGroup) => string;
  /** Whether a group should drop back (another one is picked). */
  fadedFor?: (group: MuscleGroup) => boolean;
  onHover?: (group: MuscleGroup | null) => void;
  onPick?: (group: MuscleGroup | null) => void;
  className?: string;
}) {
  const art = BODY_ART[gender][side];
  return (
    // Every figure gets the same 1:2 box (the drawings' own viewBoxes differ
    // a little between front/back and male/female); the default
    // preserveAspectRatio centres each drawing in it, so a front and a back
    // side by side line up.
    <svg
      viewBox={art.viewBox}
      role="img"
      aria-label={label}
      className={cn('aspect-[1/2] w-full', className)}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      {art.parts.map((part) => {
        const group = SLUG_GROUP.get(part.slug);
        return (
          <g
            key={part.slug}
            onClick={onPick ? () => onPick(group ?? null) : undefined}
            onMouseEnter={onHover ? () => onHover(group ?? null) : undefined}
            className={cn(
              'transition-opacity motion-reduce:transition-none',
              group && onPick && 'cursor-pointer',
            )}
            style={{
              fill: group ? fillFor(group) : 'hsl(var(--border))',
              opacity: group && fadedFor?.(group) ? 0.22 : 1,
            }}
          >
            {part.paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
