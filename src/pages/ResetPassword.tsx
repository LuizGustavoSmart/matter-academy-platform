import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { callFn } from '../lib/supabase';
import { PublicAuthLayout } from '../public/components/PublicAuthLayout';
import { PublicAction } from '../public/components/PublicAction';
import { FormAlert, LoadingView, SuccessView, ErrorView } from '../public/components/PublicStates';
import type { PublicAuthVisualState } from '../public/types';

export default function ResetPassword() {
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
    callFn('auth-public', 'verify-reset', { token })
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
      await callFn('auth-public', 'reset', { token, password });
      setDone(true);
      setTimeout(() => nav('/login'), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const state: PublicAuthVisualState = done ? 'success' : err && !email ? 'error' : email ? 'form' : 'loading';

  return (
    <PublicAuthLayout state={state}>
      {state === 'success' && <SuccessView title="Senha redefinida" note="Redirecionando ao login..." />}

      {state === 'error' && (
        <>
          <h1 className="mb-2">Nova senha</h1>
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
          <h1 className="mb-2">Nova senha</h1>
          <p className="mb-8 text-[color:var(--pub-fg-soft)]">
            Redefinindo senha para <span className="text-[color:var(--pub-fg)]">{email}</span>.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="reset-password">Nova senha</label>
              <input
                id="reset-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reset-confirm">Confirmar senha</label>
              <input
                id="reset-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <FormAlert error={err} />
            <PublicAction type="submit" loading={loading} glow className="w-full">
              Redefinir senha
            </PublicAction>
          </form>
        </>
      )}

      {state === 'loading' && <LoadingView />}
    </PublicAuthLayout>
  );
}
