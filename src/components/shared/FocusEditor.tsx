import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { FocusPortal } from '@/hooks/useFocusMode';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/**
 * The full-screen frame every builder opens in: a slim top bar (close, what
 * you're editing, tools) and a bar pinned to the bottom with the save action,
 * so it's always one tap away however long the plan gets. The browser's Back
 * runs `onClose` too (see FocusPortal).
 */
export function FocusEditor({
  kicker,
  title,
  onClose,
  dirty,
  closeLabel = 'Cerrar',
  actions,
  footer,
  children,
}: {
  /** What kind of thing this is, small above the title ("Plantilla nutricional"). */
  kicker?: ReactNode;
  title: ReactNode;
  /** The builder's close — it asks before discarding unsaved work. */
  onClose: () => void;
  /** There are unsaved changes: reloading or closing the tab asks first. */
  dirty?: boolean;
  closeLabel?: string;
  /** Tools in the top bar (AI, preview…). */
  actions?: ReactNode;
  /** The bottom bar's content: a summary and the save buttons. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Opening an existing plan autofocuses nothing, and the button that opened
  // it is now hidden: land on the editor's title so keyboard and screen-reader
  // users know where they are.
  useEffect(() => {
    if (!rootRef.current?.contains(document.activeElement)) titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <FocusPortal onBack={onClose} dirty={dirty}>
      <div ref={rootRef} className="flex min-h-[100dvh] flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:h-16 sm:gap-3 sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))]">
            <Tip label={closeLabel}>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}>
                <X />
              </Button>
            </Tip>
            <div className="min-w-0 flex-1 leading-tight">
              {kicker && <div className="truncate text-xs text-muted-foreground">{kicker}</div>}
              <h1 id={titleId} ref={titleRef} tabIndex={-1} className="truncate text-[15px] font-semibold focus:outline-none">
                {title}
              </h1>
            </div>
            {actions && <div className="flex flex-none items-center gap-1 sm:gap-2">{actions}</div>}
          </div>
        </header>

        <main
          aria-labelledby={titleId}
          className="mx-auto w-full max-w-[1600px] flex-1 pb-12 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-7"
        >
          {children}
        </main>

        {footer && (
          <footer className="pb-safe sticky bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
              {footer}
            </div>
          </footer>
        )}
      </div>
    </FocusPortal>
  );
}
