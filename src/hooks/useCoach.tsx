import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CoachProfile } from '@/types';
import { getCoachProfile, updateCoachProfile } from '@/services/clients';

/** Coach profile shared by the topbar and Settings (kept in sync after saves). */
const CoachContext = createContext<{
  coach: CoachProfile;
  save: (patch: Partial<CoachProfile>) => Promise<void>;
}>({
  coach: { display_name: 'Coach', avatar_url: null, whatsapp: '' },
  save: async () => {},
});

export function CoachProvider({ children }: { children: ReactNode }) {
  const [coach, setCoach] = useState<CoachProfile>({ display_name: 'Coach', avatar_url: null, whatsapp: '' });

  useEffect(() => {
    getCoachProfile().then(setCoach);
  }, []);

  const save = async (patch: Partial<CoachProfile>) => {
    const updated = await updateCoachProfile(patch);
    setCoach(updated);
  };

  return <CoachContext.Provider value={{ coach, save }}>{children}</CoachContext.Provider>;
}

export const useCoach = () => useContext(CoachContext);
