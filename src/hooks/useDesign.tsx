import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Visual style of the panel, independent of light/dark:
 *  - 'poster' — the "Dojo Poster" look shared with the mobile app (Anton
 *    headings, skewed red actions, sharp corners). The default.
 *  - 'legacy' — DEPRECATED: the original rounded slate look, kept switchable
 *    from Ajustes just in case. Scheduled for removal once the new look has
 *    settled; don't build new UI for it.
 *
 * Applied as `data-design` on <html> (index.html sets it before first paint),
 * which drives the `poster:` / `legacy:` Tailwind variants and the token
 * overrides in index.css.
 */
export type Design = 'poster' | 'legacy';

const KEY = 'hokage:design';

const DesignContext = createContext<{ design: Design; setDesign: (d: Design) => void }>({
  design: 'poster',
  setDesign: () => {},
});

export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesign] = useState<Design>(() => {
    try {
      return localStorage.getItem(KEY) === 'legacy' ? 'legacy' : 'poster';
    } catch {
      return 'poster';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.design = design;
    try {
      localStorage.setItem(KEY, design);
    } catch {
      // Private mode / blocked storage: the choice just won't persist.
    }
  }, [design]);

  return <DesignContext.Provider value={{ design, setDesign }}>{children}</DesignContext.Provider>;
}

export const useDesign = () => useContext(DesignContext);
