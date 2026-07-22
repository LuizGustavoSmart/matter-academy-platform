import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  email: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  empresa: string | null;
  cargo: string | null;
  avatar_url: string | null;
  avatar_signed_url: string | null;
  role: 'admin' | 'student' | 'professor' | 'monitor';
  status: 'pending' | 'active' | 'blocked';
};

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'nome' | 'sobrenome' | 'telefone' | 'empresa' | 'cargo' | 'avatar_url'>>) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const extendedProfile = await supabase
      .from('profiles')
      .select('id,email,nome,sobrenome,telefone,empresa,cargo,avatar_url,role,status')
      .eq('id', userId)
      .maybeSingle();

    let data: Omit<Profile, 'avatar_signed_url'> | null = null;

    if (!extendedProfile.error) {
      data = extendedProfile.data as Omit<Profile, 'avatar_signed_url'> | null;
    } else {
      // Mantém o login funcional enquanto a migração de preferências/perfil
      // ainda não foi aplicada no projeto Supabase usado pelo preview.
      const legacyProfile = await supabase
        .from('profiles')
        .select('id,email,nome,sobrenome,telefone,empresa,role,status')
        .eq('id', userId)
        .maybeSingle();

      if (!legacyProfile.error && legacyProfile.data) {
        data = {
          ...legacyProfile.data,
          cargo: null,
          avatar_url: null,
        } as Omit<Profile, 'avatar_signed_url'>;
      } else {
        const baseProfile = await supabase
          .from('profiles')
          .select('id,email,nome,role,status')
          .eq('id', userId)
          .maybeSingle();

        if (baseProfile.data) {
          data = {
            ...baseProfile.data,
            sobrenome: null,
            telefone: null,
            empresa: null,
            cargo: null,
            avatar_url: null,
          } as Omit<Profile, 'avatar_signed_url'>;
        }
      }
    }

    if (!data) {
      setProfile(null);
      return;
    }
    let avatarSignedUrl: string | null = null;
    if (data.avatar_url) {
      const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(data.avatar_url, 3600);
      avatarSignedUrl = signed?.signedUrl ?? null;
    }
    setProfile({ ...data, avatar_signed_url: avatarSignedUrl } as Profile);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          await loadProfile(newSession.user.id);
        })();
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const updateProfile: AuthCtx['updateProfile'] = async (patch) => {
    if (!session?.user) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    if (error) throw error;
    await loadProfile(session.user.id);
  };

  return (
    <Ctx.Provider value={{ session, profile, loading, signIn, signOut, refresh, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
