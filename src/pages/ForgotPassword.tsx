import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { callFn } from '../lib/supabase';
import { Button } from '../components/ui';
import { Logo } from '../components/Logo';

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
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-10"><Logo height={110} /></Link>

        <h1 className="mb-2">Recuperar senha</h1>
        <p className="text-[#d6deed] mb-8">Informe seu email e geraremos um link de redefinição.</p>

        {link ? (
          <div className="space-y-4">
            <div className="border border-[#cbfb00]/30 bg-[#cbfb00]/5 rounded-md p-4">
              <p className="meta mb-2">Link de redefinição gerado</p>
              <p className="text-sm text-white break-all mb-3">{link}</p>
              <Button onClick={copy} variant="secondary" icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}>
                {copied ? 'Copiado' : 'Copiar link'}
              </Button>
            </div>
            <Link to="/login" className="block text-sm text-[#d6deed] hover:text-[#cbfb00]">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {err && <p className="text-red-400 text-sm">{err}</p>}
            <Button type="submit" variant="primary" loading={loading} className="w-full">Gerar link</Button>
            <Link to="/login" className="block text-center text-sm text-[#d6deed] hover:text-[#cbfb00]">Voltar ao login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
