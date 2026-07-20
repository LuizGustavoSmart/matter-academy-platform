import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { callFn } from '../lib/supabase';
import { PublicAuthLayout } from '../public/components/PublicAuthLayout';
import { PublicAction } from '../public/components/PublicAction';
import { FormAlert } from '../public/components/PublicStates';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await callFn('auth-public', 'forgot', { email });
      if (r.reset_token) {
        setLink(`${window.location.origin}/redefinir-senha?token=${r.reset_token}`);
      } else {
        setErr('Email não encontrado');
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <PublicAuthLayout state={link ? 'success' : 'form'}>
      <h1 className="mb-2">Recuperar senha</h1>
      <p className="mb-8 text-[color:var(--pub-fg-soft)]">Informe seu email e geraremos um link de redefinição.</p>

      {link ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgba(204,252,0,0.3)] bg-[rgba(204,252,0,0.06)] p-4">
            <p className="pub-meta mb-2">Link de redefinição gerado</p>
            <p className="mb-3 break-all text-sm text-[color:var(--pub-fg)]">{link}</p>
            <PublicAction
              variant="secondary"
              size="sm"
              onClick={copy}
              icon={copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            >
              {copied ? 'Copiado' : 'Copiar link'}
            </PublicAction>
            <span className="sr-only" role="status" aria-live="polite">
              {copied ? 'Link copiado' : ''}
            </span>
          </div>
          <Link to="/login" className="block text-sm text-[color:var(--pub-fg-soft)] hover:text-[color:var(--pub-lime)]">
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
            Gerar link
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
