import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CoachProfile } from '@/types';
import { getCoachProfile, updateCoachProfile } from '@/services/clients';
import { useAuth } from './useAuth';

/** Coach profile shared by the topbar and Settings (kept in sync after saves). */
const DEFAULT_COACH: CoachProfile = { display_name: 'Coach', avatar_url: null, whatsapp: '' };

const CoachContext = createContext<{
  coach: CoachProfile;
  save: (patch: Partial<CoachProfile>) => Promise<void>;
}>({
  coach: DEFAULT_COACH,
  save: async () => {},
});

export function CoachProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [coach, setCoach] = useState<CoachProfile>(DEFAULT_COACH);

  useEffect(() => {
    // Only fetch once the coach session is confirmed — RLS would just deny
    // (or the query would race the session) if we fetched while a guest.
    if (status !== 'authed') return;
    void getCoachProfile().then(setCoach);
  }, [status]);

  const save = async (patch: Partial<CoachProfile>) => {
    const updated = await updateCoachProfile(patch);
    setCoach(updated);
  };

  return <CoachContext.Provider value={{ coach, save }}>{children}</CoachContext.Provider>;
}

export const useCoach = () => useContext(CoachContext);
