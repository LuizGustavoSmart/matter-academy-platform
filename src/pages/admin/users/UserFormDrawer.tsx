import { useEffect, useState } from 'react';
import { Check, Copy, ArrowRight, ArrowLeft, UserPlus, CheckCircle2 } from 'lucide-react';
import { supabase, callFn } from '../../../lib/supabase';
import {
  Drawer, Button, Field, Input, Select, Switch, Badge, Alert, Avatar, useToast,
} from '../../../components/ui';
import {
  ROLE_OPTIONS, ROLE_LABEL, isValidEmail, normalizeEmail, isValidPhone, normalizePhone, formatPhone, fullName,
  type Role,
} from '../../../lib/users';
import { TurmaCoursePicker, loadCoursesByTurma, type Turma, type TurmaSelection, type CursoInfo } from './pickers';
import type { UserRow } from './types';

type Phase = 'form' | 'review' | 'result';
type FieldKey = 'nome' | 'sobrenome' | 'email' | 'telefone' | 'empresa' | 'role' | 'turmas';

export function UserFormDrawer({
  open, mode, user, turmas, onClose, onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  user?: UserRow | null;
  turmas: Turma[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('form');

  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [selection, setSelection] = useState<TurmaSelection[]>([]);
  const [sendInvite, setSendInvite] = useState(true);

  const [coursesByTurma, setCoursesByTurma] = useState<Record<string, CursoInfo[]>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ token: string | null; sent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const isStudent = role === 'student';
  const needsTurmas = role === 'student' || role === 'professor' || role === 'monitor';

  /** Atualiza um campo de texto e limpa o erro correspondente na hora. */
  const clearErr = (k: FieldKey) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  /* ── Reset / prefill ao abrir ── */
  useEffect(() => {
    if (!open) return;
    setPhase('form'); setErrors({}); setServerErr(null); setResult(null); setCopied(false);
    loadCoursesByTurma().then(setCoursesByTurma);

    if (mode === 'edit' && user) {
      setNome(user.nome ?? ''); setSobrenome(user.sobrenome ?? '');
      setEmail(user.email); setTelefone(user.telefone ?? ''); setEmpresa(user.empresa ?? '');
      setRole(user.role); setSendInvite(false);
      supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', user.id).then(({ data }) => {
        const grouped: Record<string, string[]> = {};
        (data ?? []).forEach((r: { turma_id: string; curso_id: string | null }) => {
          (grouped[r.turma_id] ??= []);
          if (r.curso_id) grouped[r.turma_id].push(r.curso_id);
        });
        setSelection(Object.entries(grouped).map(([turma_id, curso_ids]) => ({ turma_id, curso_ids })));
      });
    } else {
      setNome(''); setSobrenome(''); setEmail(''); setTelefone(''); setEmpresa('');
      setRole('student'); setSelection([]); setSendInvite(true);
    }
  }, [open, mode, user]);

  const validate = (): boolean => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!nome.trim()) e.nome = 'Informe o nome';
    if (!sobrenome.trim()) e.sobrenome = 'Informe o sobrenome';
    if (!email.trim()) e.email = 'Informe o e-mail';
    else if (!isValidEmail(email)) e.email = 'E-mail inválido';
    if (!telefone.trim()) e.telefone = 'Informe o telefone';
    else if (!isValidPhone(telefone)) e.telefone = 'Telefone inválido (10 a 15 dígitos)';
    if (!empresa.trim()) e.empresa = 'Informe a empresa';
    if (needsTurmas && selection.length === 0) e.turmas = 'Selecione ao menos uma turma';
    if (isStudent && selection.some((s) => s.curso_ids.length === 0)) e.turmas = 'Selecione ao menos um curso em cada turma';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildPayload = () => {
    const base = {
      email: normalizeEmail(email),
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      telefone: normalizePhone(telefone),
      empresa: empresa.trim(),
      role,
    };
    if (isStudent) {
      return { ...base, turma_cursos: selection.flatMap((s) => s.curso_ids.map((cid) => ({ turma_id: s.turma_id, curso_id: cid }))) };
    }
    if (needsTurmas) return { ...base, turma_ids: selection.map((s) => s.turma_id) };
    return { ...base, turma_ids: [] as string[] };
  };

  const goReview = () => { setServerErr(null); if (validate()) setPhase('review'); };

  const submitCreate = async () => {
    setLoading(true); setServerErr(null);
    try {
      const r = await callFn('admin-users', 'create', { ...buildPayload(), send_invite: sendInvite });
      setResult({ token: r.invite_token ?? null, sent: !!r.invite_sent });
      setPhase('result');
      onSaved();
    } catch (err) {
      setServerErr((err as Error).message);
      setPhase('form');
    } finally { setLoading(false); }
  };

  const submitEdit = async () => {
    if (!user || !validate()) return;
    setLoading(true); setServerErr(null);
    try {
      const payload = buildPayload();
      await callFn('admin-users', 'update', {
        user_id: user.id,
        email: payload.email !== user.email ? payload.email : undefined,
        nome: payload.nome, sobrenome: payload.sobrenome, telefone: payload.telefone, empresa: payload.empresa,
        role: payload.role !== user.role ? payload.role : undefined,
        ...(isStudent ? { turma_cursos: (payload as { turma_cursos: unknown }).turma_cursos } : { turma_ids: (payload as { turma_ids: string[] }).turma_ids }),
      });
      toast.success('Usuário atualizado.');
      onSaved(); onClose();
    } catch (err) {
      setServerErr((err as Error).message);
    } finally { setLoading(false); }
  };

  const activationLink = result?.token ? `${window.location.origin}/ativar?token=${result.token}` : null;
  const copyLink = () => {
    if (!activationLink) return;
    navigator.clipboard.writeText(activationLink);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const title = mode === 'create'
    ? (phase === 'review' ? 'Revisar novo usuário' : phase === 'result' ? 'Usuário criado' : 'Novo usuário')
    : 'Editar usuário';

  const footer = (() => {
    if (phase === 'result') {
      return (
        <>
          <Button variant="secondary" onClick={() => { setPhase('form'); setResult(null);
            setNome(''); setSobrenome(''); setEmail(''); setTelefone(''); setEmpresa(''); setRole('student'); setSelection([]); setSendInvite(true); }}>
            Criar outro
          </Button>
          <Button variant="primary" onClick={onClose}>Concluir</Button>
        </>
      );
    }
    if (mode === 'create' && phase === 'review') {
      return (
        <>
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setPhase('form')}>Voltar</Button>
          <Button variant="primary" loading={loading} icon={<UserPlus className="w-4 h-4" />} onClick={submitCreate}>
            {sendInvite ? 'Criar e enviar convite' : 'Criar usuário'}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        {mode === 'create'
          ? <Button variant="primary" iconRight={<ArrowRight className="w-4 h-4" />} onClick={goReview}>Revisar</Button>
          : <Button variant="primary" loading={loading} onClick={submitEdit}>Salvar alterações</Button>}
      </>
    );
  })();

  const summaryTurmas = selection.map((s) => {
    const t = turmas.find((x) => x.id === s.turma_id);
    const cursos = (coursesByTurma[s.turma_id] ?? []).filter((c) => s.curso_ids.includes(c.id));
    return { nome: t?.nome ?? '—', cursos: cursos.map((c) => c.titulo) };
  });

  return (
    <Drawer open={open} onClose={onClose} title={title}
      subtitle={mode === 'create' && phase === 'form' ? 'Preencha os dados e revise antes de confirmar.' : undefined}
      width="lg" footer={footer}>

      {serverErr && <Alert tone="danger" className="mb-4">{serverErr}</Alert>}

      {/* ─────────── FORM ─────────── */}
      {phase === 'form' && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider">Dados pessoais</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nome" required error={errors.nome} htmlFor="uf-nome">
                <Input id="uf-nome" value={nome} onChange={(e) => { setNome(e.target.value); clearErr('nome'); }} invalid={!!errors.nome} placeholder="Maria" data-autofocus />
              </Field>
              <Field label="Sobrenome" required error={errors.sobrenome} htmlFor="uf-sob">
                <Input id="uf-sob" value={sobrenome} onChange={(e) => { setSobrenome(e.target.value); clearErr('sobrenome'); }} invalid={!!errors.sobrenome} placeholder="Souza" />
              </Field>
            </div>
            <Field label="E-mail" required error={errors.email} htmlFor="uf-email">
              <Input id="uf-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearErr('email'); }} invalid={!!errors.email} placeholder="maria@empresa.com" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Telefone" required error={errors.telefone} htmlFor="uf-tel">
                <Input id="uf-tel" value={telefone} onChange={(e) => { setTelefone(e.target.value); clearErr('telefone'); }} invalid={!!errors.telefone} placeholder="(11) 98888-0000" inputMode="tel" />
              </Field>
              <Field label="Empresa" required error={errors.empresa} htmlFor="uf-emp">
                <Input id="uf-emp" value={empresa} onChange={(e) => { setEmpresa(e.target.value); clearErr('empresa'); }} invalid={!!errors.empresa} placeholder="Acme Ltda" />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider">Acesso</h3>
            <Field label="Papel" required htmlFor="uf-role">
              <Select id="uf-role" value={role} onChange={(e) => { setRole(e.target.value as Role); clearErr('turmas'); }}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            {needsTurmas ? (
              <Field label={isStudent ? 'Turmas e cursos' : 'Turmas'} required error={errors.turmas}
                hint={isStudent ? 'O aluno terá acesso somente aos cursos selecionados.' : 'Vínculo de acompanhamento das turmas.'}>
                <TurmaCoursePicker turmas={turmas} coursesByTurma={coursesByTurma} value={selection} onChange={(v) => { setSelection(v); clearErr('turmas'); }} showCourses={isStudent} />
              </Field>
            ) : (
              <Alert tone="info">Administradores têm acesso a toda a plataforma; nenhum vínculo de turma é necessário.</Alert>
            )}
            {mode === 'create' && (
              <div className="flex items-start gap-3 rounded-lg border border-line bg-panel-3/30 p-3.5">
                <Switch checked={sendInvite} onChange={setSendInvite} />
                <div className="min-w-0">
                  <p className="text-sm text-fg font-medium">Enviar convite imediatamente</p>
                  <p className="text-fg-3 text-xs mt-0.5">Se desativado, o usuário é criado como pendente e você copia o link de ativação manualmente.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─────────── REVIEW ─────────── */}
      {phase === 'review' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={fullName(nome, sobrenome)} email={email} size={44} />
            <div className="min-w-0">
              <p className="text-fg font-medium">{fullName(nome, sobrenome)}</p>
              <p className="text-fg-3 text-sm truncate">{normalizeEmail(email)}</p>
            </div>
            <Badge tone="brand" className="ml-auto">{ROLE_LABEL[role]}</Badge>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-fg-3 text-xs">Telefone</dt><dd className="text-fg-2">{formatPhone(normalizePhone(telefone)) || '—'}</dd></div>
            <div><dt className="text-fg-3 text-xs">Empresa</dt><dd className="text-fg-2">{empresa || '—'}</dd></div>
          </dl>
          {needsTurmas && (
            <div>
              <p className="text-fg-3 text-xs mb-2">Turmas e cursos</p>
              <div className="space-y-2">
                {summaryTurmas.map((t, i) => (
                  <div key={i} className="rounded-lg border border-line p-3">
                    <p className="text-fg text-sm font-medium">{t.nome}</p>
                    {isStudent && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {t.cursos.length ? t.cursos.map((c) => <Badge key={c}>{c}</Badge>) : <span className="text-fg-3 text-xs">Sem cursos</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Alert tone={sendInvite ? 'info' : 'warn'}>
            {sendInvite ? 'O convite de ativação será enviado imediatamente após a criação.' : 'Nenhum convite será enviado agora — você poderá copiar o link de ativação na próxima etapa.'}
          </Alert>
        </div>
      )}

      {/* ─────────── RESULT ─────────── */}
      {phase === 'result' && (
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center py-2">
            <span className="w-12 h-12 rounded-full bg-ok/12 text-ok grid place-items-center mb-3"><CheckCircle2 className="w-6 h-6" /></span>
            <p className="text-fg font-medium">{fullName(nome, sobrenome) || 'Usuário'} criado com sucesso</p>
            <p className="text-fg-3 text-sm mt-1">{result?.sent ? 'Convite de ativação enviado.' : 'Usuário criado como pendente (convite não enviado).'}</p>
          </div>
          {activationLink && (
            <div>
              <label>Link de ativação</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-lg border border-line bg-panel-3/40 px-3 py-2.5 text-xs text-brand break-all font-mono">{activationLink}</div>
                <Button variant="secondary" size="sm" icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} onClick={copyLink}>
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="text-fg-3 text-xs mt-1.5">Válido por 7 dias. Você também pode reenviar o convite pela lista de usuários.</p>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
