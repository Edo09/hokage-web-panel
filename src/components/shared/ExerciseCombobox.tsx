import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Exercise } from '@/types';

/**
 * Themed, keyboard-navigable exercise autocomplete — a drop-in replacement for
 * the native <datalist>, whose popup Chrome renders itself (unstyleable, clashes
 * with the panel's dark theme, and gets clipped oddly). Filters the catalog as
 * the coach types (accent/case-insensitive), shows the body part as a hint, and
 * still lets them type a name that isn't in the catalog (saved as a custom
 * exercise, resolved back to exercise_id by name at submit — same contract the
 * datalist had). The dropdown is portaled to <body> with fixed positioning so
 * the surrounding `overflow-x-auto` scroll containers can't clip it.
 */

const norm = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const MAX_RESULTS = 60;

interface Props {
  value: string;
  onChange: (name: string) => void;
  catalog: Exercise[] | null;
  disabled?: boolean;
  placeholder?: string;
  /** Classes for the <input> itself (sizing/shape to match its row). */
  inputClassName?: string;
  'aria-label'?: string;
}

export function ExerciseCombobox({
  value,
  onChange,
  catalog,
  disabled,
  placeholder,
  inputClassName,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    if (!catalog) return [];
    const q = norm(value.trim());
    const pool = q ? catalog.filter((e) => norm(e.name).includes(q)) : catalog;
    return pool.slice(0, MAX_RESULTS);
  }, [catalog, value]);

  const exactHit = useMemo(
    () => !!catalog?.some((e) => norm(e.name) === norm(value.trim())),
    [catalog, value],
  );
  const showCustomHint = !!catalog && value.trim() !== '' && !exactHit;
  const hasPanel = open && rect != null && (matches.length > 0 || showCustomHint);

  const place = () => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [open]);

  // Reset the highlight whenever the query or open-state changes.
  useEffect(() => {
    setActive(0);
  }, [value, open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    (listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null)?.scrollIntoView({
      block: 'nearest',
    });
  }, [active, open]);

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      if (matches[active]) {
        e.preventDefault();
        choose(matches[active].name);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Placement: below by default; flip above when there isn't room and the space
  // above is larger — the exercise rows sit low in a tall builder.
  let panelStyle: CSSProperties = {};
  if (rect) {
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const flipUp = below < 200 && above > below;
    const maxHeight = Math.min(300, Math.max(flipUp ? above : below, 120));
    panelStyle = {
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(flipUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    };
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        className={inputClassName}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {hasPanel &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            className="z-[70] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-foreground shadow-xl"
            style={panelStyle}
          >
            {matches.map((e, i) => (
              <button
                key={e.id}
                type="button"
                role="option"
                data-idx={i}
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  choose(e.name);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] transition-colors',
                  i === active ? 'bg-primary/10 text-primary dark:bg-primary/15' : 'hover:bg-muted',
                )}
              >
                <span className="truncate font-medium">{e.name}</span>
                {e.body_part?.name && (
                  <span className="flex-none text-[11px] text-faint">{e.body_part.name}</span>
                )}
              </button>
            ))}
            {showCustomHint && (
              <div
                className={cn(
                  'px-3 py-1.5 text-[11.5px] text-faint',
                  matches.length > 0 && 'mt-1 border-t border-border pt-2',
                )}
              >
                {matches.length === 0
                  ? 'Sin coincidencias en el catálogo · se guardará como ejercicio personalizado.'
                  : 'Escribe un nombre propio para guardarlo como personalizado.'}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
