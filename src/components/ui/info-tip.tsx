import { useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Help on demand: a small ⓘ that holds the explanation a label would
 * otherwise spell out on screen. Opens on hover with a mouse, and on tap or
 * Enter everywhere (a plain tooltip never opens on touch).
 */
export function InfoTip({
  children,
  label = 'Más información',
  side = 'top',
  className,
}: {
  children: ReactNode;
  /** What a screen reader announces for the button. */
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Opened by a click/tap/key stays open until dismissed; opened by hover
  // closes when the pointer leaves.
  const pinned = useRef(false);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) pinned.current = false;
        setOpen(o);
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          if (open && !pinned.current) {
            pinned.current = true;
            return;
          }
          pinned.current = !open;
          setOpen(!open);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse' && !open) setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && !pinned.current) setOpen(false);
        }}
        className={cn(
          'inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground',
          className,
        )}
      >
        <Info className="h-[15px] w-[15px]" strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className="w-auto max-w-[280px] p-3 text-[13px] leading-snug text-muted-foreground"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
