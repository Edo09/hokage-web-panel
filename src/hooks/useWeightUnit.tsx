import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { WeightUnit } from '@/lib/weightUnit';

/** Coach's personal display preference for this browser — mirrors
 *  useTheme.tsx's pattern (localStorage, no backend). Weight always stores in
 *  kg; this only controls how it's shown/entered across the panel. */
const WeightUnitContext = createContext<{ unit: WeightUnit; setUnit: (u: WeightUnit) => void }>({
  unit: 'kg',
  setUnit: () => {},
});

const KEY = 'hokage:weight-unit';

export function WeightUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<WeightUnit>(() =>
    typeof window !== 'undefined' && localStorage.getItem(KEY) === 'lb' ? 'lb' : 'kg',
  );

  useEffect(() => {
    localStorage.setItem(KEY, unit);
  }, [unit]);

  return <WeightUnitContext.Provider value={{ unit, setUnit }}>{children}</WeightUnitContext.Provider>;
}

export const useWeightUnit = () => useContext(WeightUnitContext);
