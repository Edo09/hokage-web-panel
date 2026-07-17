import { createContext, useContext, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Fake auth for now — a flag in sessionStorage. Replace with Supabase Auth later:
 * supabase.auth.signInWithPassword({ email, password }) etc.
 */
const KEY = 'hokage:auth';

const AuthContext = createContext<{
  isAuthed: boolean;
  signIn: () => void;
  signOut: () => void;
}>({ isAuthed: false, signIn: () => {}, signOut: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem(KEY) === '1');

  const signIn = () => {
    sessionStorage.setItem(KEY, '1');
    setIsAuthed(true);
  };
  const signOut = () => {
    sessionStorage.removeItem(KEY);
    setIsAuthed(false);
  };

  return <AuthContext.Provider value={{ isAuthed, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  const location = useLocation();
  if (!isAuthed) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
