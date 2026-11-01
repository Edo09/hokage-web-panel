import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Help on demand: a small ⓘ that holds the explanation a label would
 * otherwise spell out on screen. Opens on hover with a mouse (and stays open
 * while the pointer moves onto it), and on tap or Enter everywhere — a plain
 * tooltip never opens on touch. Screen readers get the text as the button's
 * description, without opening anything.
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
  const descId = useId();
  // Opened by a click/tap/key stays open until dismissed; opened by hover
  // closes shortly after the pointer leaves both the ⓘ and the bubble.
  const pinned = useRef(false);
  const closeTimer = useRef<number>();
  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      if (!pinned.current) setOpen(false);
    }, 150);
  };
  useEffect(() => cancelClose, []);

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
        aria-describedby={descId}
        onClick={(e) => {
          e.preventDefault();
          cancelClose();
          if (open && !pinned.current) {
            pinned.current = true;
            return;
          }
          pinned.current = !open;
          setOpen(!open);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return;
          cancelClose();
          if (!open) setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') scheduleClose();
        }}
        className={cn(
          '-m-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-faint transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground',
          className,
        )}
      >
        <Info className="h-[15px] w-[15px]" strokeWidth={2} />
      </PopoverTrigger>
      <span id={descId} className="sr-only">
        {children}
      </span>
      <PopoverContent
        side={side}
        aria-hidden="true"
        className="w-auto max-w-[280px] p-3 text-[13px] leading-snug text-muted-foreground"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') cancelClose();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') scheduleClose();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
