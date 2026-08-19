import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthContext } from './authState';
import { clearDraftSessionCache, removeLegacyLocalDraft } from './draftStorage';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password, name) => {
    return supabase.auth.signUp({ email, password, options: { data: { name } } });
  }, []);

  const signIn = useCallback(async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signOut = useCallback(async () => {
    removeLegacyLocalDraft(session?.user?.id);
    clearDraftSessionCache(session?.user?.id);
    const result = await supabase.auth.signOut();
    if (!result.error && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    return result;
  }, [session?.user?.id]);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
