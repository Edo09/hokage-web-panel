import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

/** Marks the history entry a full-screen builder adds (see FocusPortal). */
const ENTRY = 'hokageFocusEditor';

/**
 * Renders its children full-screen, in focus mode. Outside the shell it
 * renders them in place.
 *
 * A builder looks like its own page, so the phone's back gesture is the
 * natural way out: it gets a history entry, and Back runs `onBack` (the
 * builder's own close, which asks before throwing work away) instead of
 * leaving the page. While `dirty`, reloading or closing the tab asks too.
 */
export function FocusPortal({
  children,
  onBack,
  dirty = false,
}: {
  children: ReactNode;
  onBack?: () => void;
  dirty?: boolean;
}) {
  const { root, enter } = useContext(FocusModeContext);
  // Read during the first render — before the shell hides and before an
  // autofocused field inside can scroll the page — so closing returns to
  // where the coach was, focus included.
  const [opened] = useState(() => ({
    y: window.scrollY,
    path: window.location.pathname,
    opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
  }));
  const restore = useRef<number | null>(null);
  const onBackRef = useRef(onBack);
  useLayoutEffect(() => {
    onBackRef.current = onBack;
  });
  // Survives StrictMode's unmount/remount, so dev doesn't push twice.
  const entry = useRef({ pushed: false, drop: 0 });

  useLayoutEffect(() => enter(), [enter]);

  // Open at the top; on close, put the page back where it was and return
  // focus to what opened the builder. A restore still pending when the effect
  // re-runs (StrictMode's remount) is cancelled; a route change skips it.
  useLayoutEffect(() => {
    if (restore.current != null) cancelAnimationFrame(restore.current);
    window.scrollTo(0, 0);
    return () => {
      restore.current = requestAnimationFrame(() => {
        if (window.location.pathname !== opened.path) return;
        window.scrollTo(0, opened.y);
        if (opened.opener?.isConnected) opened.opener.focus({ preventScroll: true });
      });
    };
  }, [opened]);

  // Back closes the builder (through onBack) instead of leaving the page.
  useEffect(() => {
    const e = entry.current;
    window.clearTimeout(e.drop);
    if (!e.pushed) {
      window.history.pushState({ ...window.history.state, [ENTRY]: true }, '');
      e.pushed = true;
    }
    const onPop = () => {
      // Back took us off our entry: stay on the builder and ask it to close.
      window.history.pushState({ ...window.history.state, [ENTRY]: true }, '');
      onBackRef.current?.();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed from inside (save, cancel): take our entry off the history.
      // Deferred, so StrictMode's immediate remount can keep it.
      e.drop = window.setTimeout(() => {
        if (e.pushed && window.history.state?.[ENTRY]) window.history.back();
        e.pushed = false;
      }, 0);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return root ? createPortal(children, root) : <>{children}</>;
}
