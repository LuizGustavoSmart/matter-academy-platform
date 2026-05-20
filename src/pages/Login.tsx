import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import { Logo } from '../components/Logo';

export default function Login() {
  const nav = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signIn(email, password);
      nav('/');
    } catch (e) {
      setErr((e as Error).message === 'Invalid login credentials' ? 'Email ou senha incorretos' : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-10"><Logo height={110} /></Link>
        <h1 className="mb-2">Bem-vindo de volta</h1>
        <p className="text-[#d6deed] mb-8">Acesse sua conta para continuar aprendendo.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <div>
            <label>Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Entrar <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        <div className="mt-6 text-sm">
          <Link to="/recuperar-senha" className="text-[#d6deed] hover:text-[#cbfb00] transition-colors">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
