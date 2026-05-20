import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { callFn } from '../lib/supabase';
import { Button } from '../components/ui';
import { Logo } from '../components/Logo';

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

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-10"><Logo height={110} /></Link>

        {done ? (
          <div className="text-center py-10">
            <CheckCircle2 className="w-12 h-12 text-[#cbfb00] mx-auto mb-4" />
            <h1 className="mb-2">Senha redefinida</h1>
            <p>Redirecionando ao login...</p>
          </div>
        ) : (
          <>
            <h1 className="mb-2">Nova senha</h1>
            {email && <p className="text-[#d6deed] mb-8">Redefinindo senha para <span className="text-white">{email}</span>.</p>}

            {err && !email ? (
              <div className="text-center py-10">
                <p className="text-red-400 mb-4">{err}</p>
                <Link to="/login" className="text-[#cbfb00] hover:underline text-sm">Voltar ao login</Link>
              </div>
            ) : email ? (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label>Nova senha</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div>
                  <label>Confirmar senha</label>
                  <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
                {err && <p className="text-red-400 text-sm">{err}</p>}
                <Button type="submit" variant="primary" loading={loading} className="w-full">Redefinir senha</Button>
              </form>
            ) : (
              <p className="meta">Carregando...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
