import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { callFn } from '../lib/supabase';
import { PublicAuthLayout } from '../public/components/PublicAuthLayout';
import { PublicAction } from '../public/components/PublicAction';
import { FormAlert } from '../public/components/PublicStates';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await callFn('auth-public', 'forgot', { email });
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicAuthLayout state={sent ? 'success' : 'form'}>
      <h1 className="mb-2">Recuperar senha</h1>
      <p className="mb-8 text-[color:var(--pub-fg-soft)]">
        Informe seu email e enviaremos um link para redefinir sua senha.
      </p>

      {sent ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgba(204,252,0,0.3)] bg-[rgba(204,252,0,0.06)] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-[color:var(--pub-lime)]" aria-hidden="true" />
              <p className="pub-meta">Verifique seu email</p>
            </div>
            <p className="text-sm text-[color:var(--pub-fg)]">
              Se existe uma conta associada a <strong>{email}</strong>, você receberá em breve um email com o link para
              redefinir sua senha. O link expira em 24 horas.
            </p>
            <p className="mt-3 text-xs text-[color:var(--pub-fg-soft)]">
              Não recebeu? Confira a caixa de spam ou tente novamente em alguns minutos.
            </p>
          </div>
          <Link
            to="/login"
            className="block text-sm text-[color:var(--pub-fg-soft)] hover:text-[color:var(--pub-lime)]"
          >
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <FormAlert error={err} />
          <PublicAction type="submit" loading={loading} glow className="w-full">
            Enviar link por email
          </PublicAction>
          <Link
            to="/login"
            className="block text-center text-sm text-[color:var(--pub-fg-soft)] hover:text-[color:var(--pub-lime)]"
          >
            Voltar ao login
          </Link>
        </form>
      )}
    </PublicAuthLayout>
  );
}
