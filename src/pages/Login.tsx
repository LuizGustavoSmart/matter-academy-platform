import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PublicAuthLayout } from '../public/components/PublicAuthLayout';
import { PublicAction } from '../public/components/PublicAction';
import { FormAlert } from '../public/components/PublicStates';

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
    <PublicAuthLayout state="form">
      <h1 className="mb-2">Bem-vindo de volta</h1>
      <p className="mb-8 text-[color:var(--pub-fg-soft)]">Acesse sua conta para continuar aprendendo.</p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div>
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <FormAlert error={err} />

        <PublicAction type="submit" loading={loading} glow arrow className="w-full">
          Entrar
        </PublicAction>
      </form>

      <div className="mt-6 text-sm">
        <Link to="/recuperar-senha" className="text-[color:var(--pub-fg-soft)] hover:text-[color:var(--pub-lime)]">
          Esqueci minha senha
        </Link>
      </div>
    </PublicAuthLayout>
  );
}
