import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Focus mode: while a builder is open the shell (sidebar, top bar, the page
 * behind it) steps aside and the builder gets the whole screen. AppShell owns
 * the state and the slot the builder renders into; the page that opened the
 * builder stays mounted underneath, so its state survives.
 */
interface FocusModeValue {
  /** Where focus-mode content renders; null outside the shell. */
  root: HTMLElement | null;
  active: boolean;
  /** Enter focus mode; returns the function that leaves it. */
  enter: () => () => void;
}

export const FocusModeContext = createContext<FocusModeValue>({
  root: null,
  active: false,
  enter: () => () => {},
});

export const useFocusModeActive = () => useContext(FocusModeContext).active;

/** Renders its children full-screen, in focus mode. Outside the shell it
 *  renders them in place. */
export function FocusPortal({ children }: { children: ReactNode }) {
  const { root, enter } = useContext(FocusModeContext);
  // Read during the first render — before an autofocused field inside can
  // scroll the page — so closing returns to where the coach really was.
  const [pageY] = useState(() => window.scrollY);
  const restore = useRef<number | null>(null);

  useLayoutEffect(() => enter(), [enter]);

  // Open at the top; on close, put the page back. A restore still pending
  // when the effect re-runs (StrictMode's remount) is cancelled.
  useLayoutEffect(() => {
    if (restore.current != null) cancelAnimationFrame(restore.current);
    window.scrollTo(0, 0);
    return () => {
      restore.current = requestAnimationFrame(() => window.scrollTo(0, pageY));
    };
  }, [pageY]);

  return root ? createPortal(children, root) : <>{children}</>;
}
