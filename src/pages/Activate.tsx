import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { callFn, supabase } from '../lib/supabase';
import { PublicAuthLayout } from '../public/components/PublicAuthLayout';
import { PublicAction } from '../public/components/PublicAction';
import { FormAlert, LoadingView, SuccessView, ErrorView } from '../public/components/PublicStates';
import type { PublicAuthVisualState } from '../public/types';

type Invite = {
  email: string; role: string;
  nome: string | null; sobrenome: string | null; telefone: string | null; empresa: string | null;
};

export default function Activate() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('token') ?? '';
  const [invite, setInvite] = useState<Invite | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Perfil (exigido apenas para alunos, na mesma tela)
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState('');
  const [cargo, setCargo] = useState('');
  const [empresa, setEmpresa] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setErr('Token não fornecido'); return; }
    callFn('auth-public', 'verify-invite', { token })
      .then((r: Invite) => {
        setInvite(r);
        setNome(r.nome ?? ''); setSobrenome(r.sobrenome ?? ''); setTelefone(r.telefone ?? ''); setEmpresa(r.empresa ?? '');
      })
      .catch((e) => setErr((e as Error).message));
  }, [token]);

  const isStudent = invite?.role === 'student';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr('Senha deve ter ao menos 6 caracteres'); return; }
    if (password !== confirm) { setErr('As senhas não coincidem'); return; }
    if (isStudent) {
      if (!nome.trim() || !sobrenome.trim() || !telefone.trim() || !dataNascimento || !sexo || !cargo.trim() || !empresa.trim()) {
        setErr('Preencha todos os campos para continuar.');
        return;
      }
    }
    setLoading(true);
    try {
      await callFn('auth-public', 'activate', { token, password });
      if (invite?.email) {
        await supabase.auth.signInWithPassword({ email: invite.email, password });
      }
      if (isStudent) {
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;
        if (userId) {
          // sexo/cargo/data_nascimento ainda não estão no schema gerado
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('profiles').update({
            nome: nome.trim(), sobrenome: sobrenome.trim(), telefone: telefone.trim(),
            data_nascimento: dataNascimento, sexo, cargo: cargo.trim(), empresa: empresa.trim(),
          }).eq('id', userId);
        }
      }
      setDone(true);
      setTimeout(() => nav('/'), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const state: PublicAuthVisualState = done ? 'success' : err && !invite ? 'error' : invite ? 'form' : 'loading';

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
            {isStudent ? 'Defina sua senha e complete seu perfil para acessar ' : 'Defina sua senha para acessar '}
            <span className="text-[color:var(--pub-fg)]">{invite?.email}</span>.
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

            {isStudent && (
              <>
                <div className="pt-2 border-t border-[color:var(--pub-line)]" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="activate-nome">Nome</label>
                    <input id="activate-nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria" />
                  </div>
                  <div>
                    <label htmlFor="activate-sobrenome">Sobrenome</label>
                    <input id="activate-sobrenome" required value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Souza" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="activate-telefone">Telefone</label>
                    <input id="activate-telefone" required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 98888-0000" inputMode="tel" />
                  </div>
                  <div>
                    <label htmlFor="activate-nascimento">Data de nascimento</label>
                    <input id="activate-nascimento" type="date" required value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="activate-sexo">Sexo</label>
                    <select id="activate-sexo" required value={sexo} onChange={(e) => setSexo(e.target.value)}>
                      <option value="" disabled>Selecione</option>
                      <option value="feminino">Feminino</option>
                      <option value="masculino">Masculino</option>
                      <option value="outro">Outro</option>
                      <option value="prefiro_nao_informar">Prefiro não informar</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="activate-cargo">Cargo</label>
                    <input id="activate-cargo" required value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Analista" />
                  </div>
                </div>
                <div>
                  <label htmlFor="activate-empresa">Empresa</label>
                  <input id="activate-empresa" required value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Acme Ltda" />
                </div>
              </>
            )}

            <FormAlert error={err} />
            <PublicAction type="submit" loading={loading} glow className="w-full">
              {isStudent ? 'Concluir cadastro' : 'Ativar conta'}
            </PublicAction>
          </form>
        </>
      )}

      {state === 'loading' && <LoadingView />}
    </PublicAuthLayout>
  );
}
