import { cn, initials } from '@/lib/utils';

/** Initials avatar on a translucent tint of the client's accent color. */
export function Avatar({
  name,
  color,
  size = 36,
  radiusClass = 'rounded-full',
  className,
}: {
  name: string;
  color: string;
  size?: number;
  radiusClass?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex flex-none items-center justify-center font-bold', radiusClass, className)}
      style={{
        width: size,
        height: size,
        background: `${color}26`,
        color,
        fontSize: Math.round(size * 0.35),
      }}
    >
      {initials(name)}
    </span>
  );
}
