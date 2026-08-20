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

  const deleteAccount = useCallback(async () => {
    if (!session) return { error: new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.') };
    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { error: new Error(body.error || '회원탈퇴에 실패했습니다.') };
    }
    removeLegacyLocalDraft(session.user.id);
    clearDraftSessionCache(session.user.id);
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    return { error: null };
  }, [session]);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    signOut,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
