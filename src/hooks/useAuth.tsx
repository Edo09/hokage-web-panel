import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

/**
 * Real Supabase Auth, gated to the single coach account. RLS already blocks
 * a non-coach from reading/writing other users' data — this is the UI-side
 * guard on top of it (docs/ADMIN_WEB_DB_CONNECTION.md §3): anyone who signs
 * in but isn't role='coach' is immediately signed back out.
 */
type AuthStatus = 'loading' | 'authed' | 'guest';

const AuthContext = createContext<{
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}>({
  status: 'loading',
  signIn: async () => ({ error: 'Auth provider not mounted' }),
  signOut: async () => {},
});

async function isCoach(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) return false;
  return data?.role === 'coach';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let mounted = true;

    const evaluate = async (userId: string | undefined) => {
      if (!userId) {
        if (mounted) setStatus('guest');
        return;
      }
      const ok = await isCoach(userId);
      if (!mounted) return;
      if (ok) {
        setStatus('authed');
      } else {
        // Signed in, but not the coach account — refuse and drop the session.
        await supabase.auth.signOut();
        if (mounted) setStatus('guest');
      }
    };

    void supabase.auth.getSession().then(({ data }) => evaluate(data.session?.user.id));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void evaluate(session?.user.id);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'No se pudo iniciar sesión.' };
    const ok = await isCoach(data.user.id);
    if (!ok) {
      await supabase.auth.signOut();
      return { error: 'Esta cuenta no tiene acceso al panel de administración.' };
    }
    setStatus('authed');
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setStatus('guest');
  };

  return <AuthContext.Provider value={{ status, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-faint">
        Cargando…
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
