import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { FocusPortal } from '@/hooks/useFocusMode';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/**
 * The full-screen frame every builder opens in: a slim top bar (close, what
 * you're editing, tools) and a bar pinned to the bottom with the save action,
 * so it's always one tap away however long the plan gets.
 */
export function FocusEditor({
  kicker,
  title,
  onClose,
  closeLabel = 'Cerrar',
  actions,
  footer,
  children,
}: {
  /** What kind of thing this is, small above the title ("Plantilla nutricional"). */
  kicker?: ReactNode;
  title: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  /** Tools in the top bar (AI, preview…). */
  actions?: ReactNode;
  /** The bottom bar's content: a summary and the save buttons. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <FocusPortal>
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-2 px-2 sm:h-16 sm:gap-3 sm:px-5">
            <Tip label={closeLabel}>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={closeLabel}>
                <X />
              </Button>
            </Tip>
            <div className="min-w-0 flex-1 leading-tight">
              {kicker && <div className="truncate text-xs text-muted-foreground">{kicker}</div>}
              <div className="truncate text-[15px] font-semibold">{title}</div>
            </div>
            {actions && <div className="flex flex-none items-center gap-1 sm:gap-2">{actions}</div>}
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-12 pt-5 sm:px-6 sm:pt-7">{children}</div>

        {footer && (
          <footer className="pb-safe sticky bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6">{footer}</div>
          </footer>
        )}
      </div>
    </FocusPortal>
  );
}
