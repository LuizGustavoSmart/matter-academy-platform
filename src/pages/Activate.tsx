import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { callFn, supabase } from '../lib/supabase';
import { PublicAuthLayout } from '../public/components/PublicAuthLayout';
import { PublicAction } from '../public/components/PublicAction';
import { FormAlert, LoadingView, SuccessView, ErrorView } from '../public/components/PublicStates';
import type { PublicAuthVisualState } from '../public/types';

export default function Activate() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setErr('Token não fornecido'); return; }
    callFn('auth-public', 'verify-invite', { token })
      .then((r) => setEmail(r.email))
      .catch((e) => setErr((e as Error).message));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr('Senha deve ter ao menos 6 caracteres'); return; }
    if (password !== confirm) { setErr('As senhas não coincidem'); return; }
    setLoading(true);
    try {
      await callFn('auth-public', 'activate', { token, password });
      if (email) {
        await supabase.auth.signInWithPassword({ email, password });
      }
      setDone(true);
      setTimeout(() => nav('/'), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const state: PublicAuthVisualState = done ? 'success' : err && !email ? 'error' : email ? 'form' : 'loading';

  return (
    <PublicAuthLayout state={state}>
      {state === 'success' && <SuccessView title="Conta ativada!" note="Redirecionando..." />}

      {state === 'error' && (
        <>
          <h1 className="mb-2">Ative sua conta</h1>
          <ErrorView
            message={err ?? ''}
            action={
              <Link to="/login" className="text-sm text-[color:var(--pub-lime)] hover:underline">
                Voltar ao login
              </Link>
            }
          />
        </>
      )}

      {state === 'form' && (
        <>
          <h1 className="mb-2">Ative sua conta</h1>
          <p className="mb-8 text-[color:var(--pub-fg-soft)]">
            Defina sua senha para acessar <span className="text-[color:var(--pub-fg)]">{email}</span>.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="activate-password">Nova senha</label>
              <input
                id="activate-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label htmlFor="activate-confirm">Confirmar senha</label>
              <input
                id="activate-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <FormAlert error={err} />
            <PublicAction type="submit" loading={loading} glow className="w-full">
              Ativar conta
            </PublicAction>
          </form>
        </>
      )}

      {state === 'loading' && <LoadingView />}
    </PublicAuthLayout>
  );
}
