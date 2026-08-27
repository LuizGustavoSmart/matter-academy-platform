import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  email: string;
  nome: string | null;
  avatar_url?: string | null;
  role: 'admin' | 'student' | 'professor' | 'monitor' | 'embaixador';
  status: 'pending' | 'active' | 'blocked';
  tour_visto?: boolean;
};


export type ViewAsRole = 'student' | 'professor' | 'embaixador';
const VIEW_AS_KEY = 'ma_view_as_role';

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  isImpersonating: boolean;
  startViewAs: (role: ViewAsRole, turmaId: string, cursoId: string) => Promise<void>;
  stopViewAs: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [realProfile, setRealProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewAsRole, setViewAsRole] = useState<ViewAsRole | null>(() => {
    const v = sessionStorage.getItem(VIEW_AS_KEY);
    return v === 'student' || v === 'professor' || v === 'embaixador' ? v : null;
  });

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id,email,nome,avatar_url,role,status,tour_visto')
      .eq('id', userId)
      .maybeSingle();
    setRealProfile(data as Profile | null);
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
        setRealProfile(null);
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
    setRealProfile(null);
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsRole(null);
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  /**
   * A simulação troca o role no cliente, mas o id continua sendo o do
   * próprio admin — sem uma matrícula real, as telas de turma/curso
   * apareceriam todas vazias. Por isso criamos uma linha TEMPORÁRIA em
   * user_turmas (marcada com is_view_as_temp) para a turma/curso escolhida,
   * removida ao encerrar a simulação.
   */
  const startViewAs = async (role: ViewAsRole, turmaId: string, cursoId: string) => {
    if (realProfile?.role !== 'admin') return;
    // is_staff/is_embaixador/is_view_as_temp ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from('user_turmas').delete().eq('user_id', realProfile.id).eq('is_view_as_temp', true);
    const { error } = await sb.from('user_turmas').upsert({
      user_id: realProfile.id, turma_id: turmaId, curso_id: cursoId,
      is_staff: role === 'professor', is_embaixador: role === 'embaixador', is_view_as_temp: true,
    }, { onConflict: 'user_id,turma_id,curso_id' });
    if (error) { console.error('[startViewAs] falha ao criar matrícula temporária', error.message); return; }
    sessionStorage.setItem(VIEW_AS_KEY, role);
    setViewAsRole(role);
  };
  const stopViewAs = async () => {
    if (realProfile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('user_turmas').delete().eq('user_id', realProfile.id).eq('is_view_as_temp', true);
    }
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsRole(null);
  };

  const profile = viewAsRole && realProfile?.role === 'admin' ? { ...realProfile, role: viewAsRole } : realProfile;

  return (
    <Ctx.Provider value={{ session, profile, loading, signIn, signOut, refresh, isImpersonating: !!viewAsRole, startViewAs, stopViewAs }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
