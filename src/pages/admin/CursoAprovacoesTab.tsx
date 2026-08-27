import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Avatar, Checkbox, Modal, Button, EmptyState, Skeleton, Select, SearchInput, useToast } from '../../components/ui';

type AlunoRow = {
  id: string; email: string; nome: string | null;
  pctPresenca: number; pctAtividades: number; notaFinal: number | null; aprovado: boolean;
};

const isProjetoFinal = (titulo: string) => titulo.trim().toLowerCase() === 'projeto final';

export default function CursoAprovacoesTab({ turmaId, cursoId, readOnly = false }: { turmaId: string; cursoId: string; readOnly?: boolean }) {
  const toast = useToast();
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [temAprovacoes, setTemAprovacoes] = useState(false);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<'nome_az' | 'nome_za' | 'presenca_desc' | 'atividades_desc' | 'aprovado_primeiro' | 'pendente_primeiro'>('nome_az');
  const [selecionado, setSelecionado] = useState<AlunoRow | null>(null);
  // Alterações de "aprovado" ficam pendentes localmente — só gravam no banco
  // quando "Lançar aprovações" é clicado, mesmo mecanismo do lançamento de presença.
  const [pendentes, setPendentes] = useState<Record<string, boolean>>({});
  const [lancando, setLancando] = useState(false);

  const load = async () => {
    setLoading(true);
    // aulas/atividades/aprovacoes ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: ut }, { data: aulasList }, { data: atividadesList }, { data: aprov }] = await Promise.all([
      supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId).eq('curso_id', cursoId),
      sb.from('aulas').select('id').eq('curso_id', cursoId),
      supabase.from('atividades').select('id,titulo').eq('turma_id', turmaId).eq('curso_id', cursoId),
      sb.from('aprovacoes').select('user_id,aprovado').eq('turma_id', turmaId).eq('curso_id', cursoId),
    ]);
    setTemAprovacoes(!!aprov?.length);
    setPendentes({});

    const userIds = (ut ?? []).map((r: { user_id: string }) => r.user_id);
    if (!userIds.length) { setAlunos([]); setLoading(false); return; }
    const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
    const students = (profiles ?? []).filter((p) => p.role === 'student');
    if (!students.length) { setAlunos([]); setLoading(false); return; }

    const aulaIds = (aulasList ?? []).map((a: { id: string }) => a.id);
    const atividades = (atividadesList ?? []) as { id: string; titulo: string }[];
    const atividadeIds = atividades.map((a) => a.id);
    const studentIds = students.map((s) => s.id);

    const [{ data: presencas }, { data: envios }] = await Promise.all([
      aulaIds.length ? supabase.from('presencas').select('user_id,presente').eq('turma_id', turmaId).in('aula_id', aulaIds).in('user_id', studentIds) : Promise.resolve({ data: [] }),
      atividadeIds.length ? supabase.from('atividade_envios').select('aluno_id,atividade_id,nota,corrigido_em').in('atividade_id', atividadeIds).in('aluno_id', studentIds) : Promise.resolve({ data: [] }),
    ]);

    const presentesPorAluno: Record<string, number> = {};
    ((presencas ?? []) as { user_id: string; presente: boolean }[]).forEach((p) => { if (p.presente) presentesPorAluno[p.user_id] = (presentesPorAluno[p.user_id] ?? 0) + 1; });

    const atividadeTituloMap = new Map(atividades.map((a) => [a.id, a.titulo]));
    const enviosPorAluno: Record<string, { id: string; titulo: string; nota: number | null; corrigido_em: string | null }[]> = {};
    ((envios ?? []) as { aluno_id: string; atividade_id: string; nota: number | null; corrigido_em: string | null }[]).forEach((e) => {
      (enviosPorAluno[e.aluno_id] ??= []).push({ id: e.atividade_id, titulo: atividadeTituloMap.get(e.atividade_id) ?? '', nota: e.nota, corrigido_em: e.corrigido_em });
    });

    const aprovMap = new Map(((aprov ?? []) as { user_id: string; aprovado: boolean }[]).map((a) => [a.user_id, a.aprovado]));

    const aprovadaCount = (list: { titulo: string; nota: number | null; corrigido_em: string | null }[]) =>
      list.filter((e) => e.corrigido_em && (isProjetoFinal(e.titulo) ? (e.nota ?? 0) > 7 : true)).length;

    setAlunos(students.map((s) => {
      const enviosDoAluno = enviosPorAluno[s.id] ?? [];
      const projetoFinal = enviosDoAluno.find((e) => isProjetoFinal(e.titulo));
      return {
        id: s.id, email: s.email, nome: s.nome,
        pctPresenca: aulaIds.length ? Math.round(((presentesPorAluno[s.id] ?? 0) / aulaIds.length) * 100) : 0,
        pctAtividades: atividadeIds.length ? Math.round((aprovadaCount(enviosDoAluno) / atividadeIds.length) * 100) : 0,
        notaFinal: projetoFinal?.nota ?? null,
        aprovado: !!aprovMap.get(s.id),
      };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Valor efetivo (considerando alteração ainda não lançada) de "aprovado" para um aluno. */
  const efetivo = (aluno: AlunoRow) => pendentes[aluno.id] ?? aluno.aprovado;
  const toggleLocal = (aluno: AlunoRow) => setPendentes((prev) => ({ ...prev, [aluno.id]: !efetivo(aluno) }));
  const temPendentes = Object.keys(pendentes).length > 0;

  const lancar = async () => {
    const alteracoes = Object.entries(pendentes);
    if (!alteracoes.length) return;
    setLancando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const rows = alteracoes.map(([userId, aprovado]) => ({
        user_id: userId, turma_id: turmaId, curso_id: cursoId,
        aprovado, aprovado_por: userData.user?.id ?? null, atualizado_em: new Date().toISOString(),
      }));
      // aprovacoes ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('aprovacoes').upsert(rows, { onConflict: 'user_id,turma_id,curso_id' });
      if (error) throw error;
      toast.success(`${alteracoes.length} aprovação(ões) lançada(s).`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLancando(false);
    }
  };

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const nomeDe = (a: AlunoRow) => a.nome || a.email.split('@')[0];
    return alunos
      .filter((a) => !termo || nomeDe(a).toLowerCase().includes(termo) || a.email.toLowerCase().includes(termo))
      .sort((a, b) => {
        if (ordem === 'nome_az') return nomeDe(a).localeCompare(nomeDe(b));
        if (ordem === 'nome_za') return nomeDe(b).localeCompare(nomeDe(a));
        if (ordem === 'presenca_desc') return b.pctPresenca - a.pctPresenca;
        if (ordem === 'atividades_desc') return b.pctAtividades - a.pctAtividades;
        if (ordem === 'aprovado_primeiro') return Number(efetivo(b)) - Number(efetivo(a));
        return Number(efetivo(a)) - Number(efetivo(b));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunos, busca, ordem, pendentes]);

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  if (readOnly && !temAprovacoes) {
    return <EmptyState icon={<GraduationCap className="w-8 h-8" />} title="Curso em Andamento" description="As aprovações desta turma ainda não foram lançadas pelo professor." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-fg-3 text-sm">Presença, atividades e nota do projeto final de cada aluno nesta faixa.</p>
        {temPendentes && <Badge tone="warn">Não lançado</Badge>}
      </div>
      {alunos.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno nesta turma/curso" />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar aluno..." className="flex-1" />
            <Select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="sm:w-64">
              <option value="nome_az">Nome A-Z</option>
              <option value="nome_za">Nome Z-A</option>
              <option value="presenca_desc">Maior presença</option>
              <option value="atividades_desc">Mais atividades aprovadas</option>
              <option value="aprovado_primeiro">Aprovados primeiro</option>
              <option value="pendente_primeiro">Pendentes primeiro</option>
            </Select>
          </div>
          {alunosFiltrados.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno encontrado" /> : (
            <Card className="overflow-hidden">
              <ul>
                {alunosFiltrados.map((a) => {
                  const aprovadoEfetivo = efetivo(a);
                  const alterado = pendentes[a.id] !== undefined;
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors">
                      {!readOnly && (
                        <Checkbox checked={aprovadoEfetivo} onChange={() => toggleLocal(a)} />
                      )}
                      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setSelecionado(a)}>
                        <Avatar name={a.nome} email={a.email} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-fg text-sm font-medium truncate">{a.nome || a.email.split('@')[0]}</p>
                          <p className="text-fg-3 text-xs truncate">{a.email}</p>
                        </div>
                      </div>
                      <span className="text-sm text-fg-2 flex-shrink-0 hidden sm:inline">Presença {a.pctPresenca}%</span>
                      <span className="text-sm text-fg-2 flex-shrink-0 hidden sm:inline">Atividades {a.pctAtividades}%</span>
                      <span className="text-sm text-fg-2 flex-shrink-0 hidden md:inline">Nota final {a.notaFinal ?? '—'}</span>
                      {aprovadoEfetivo
                        ? <Badge tone={alterado ? 'warn' : 'success'} className="flex-shrink-0"><CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />{alterado ? 'Aprovar' : 'Aprovado'}</Badge>
                        : <Badge tone={alterado ? 'warn' : 'default'} className="flex-shrink-0">{alterado ? 'Desaprovar' : 'Pendente'}</Badge>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {!readOnly && (
            <div className="flex justify-end mt-4">
              <Button variant="primary" onClick={lancar} loading={lancando} disabled={!temPendentes}>
                {temPendentes ? `Lançar aprovações (${Object.keys(pendentes).length})` : 'Lançar aprovações'}
              </Button>
            </div>
          )}
        </>
      )}

      {selecionado && (
        <AlunoAprovacaoModal
          turmaId={turmaId} cursoId={cursoId} aluno={selecionado} readOnly={readOnly}
          aprovadoEfetivo={efetivo(selecionado)}
          onClose={() => setSelecionado(null)}
          onToggle={() => { toggleLocal(selecionado); setSelecionado(null); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════ Detalhe + aprovação de um aluno ═══════════════════ */
function AlunoAprovacaoModal({ turmaId, cursoId, aluno, readOnly, aprovadoEfetivo, onClose, onToggle }: {
  turmaId: string; cursoId: string; aluno: AlunoRow; readOnly: boolean; aprovadoEfetivo: boolean; onClose: () => void; onToggle: () => void;
}) {
  type AtividadeRow = { id: string; titulo: string; enviadoEm: string | null; nota: number | null; corrigidoEm: string | null };
  type AulaRow = { id: string; titulo: string; dataHora: string | null; presente: boolean };
  const [atividades, setAtividades] = useState<AtividadeRow[]>([]);
  const [aulas, setAulas] = useState<AulaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // aulas/aula_horarios ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: ats }, { data: aulasList }, { data: hs }, { data: presencas }] = await Promise.all([
        supabase.from('atividades').select('id,ordem,titulo').eq('turma_id', turmaId).eq('curso_id', cursoId).order('ordem').order('created_at', { ascending: true }),
        sb.from('aulas').select('id,ordem,titulo').eq('curso_id', cursoId).order('ordem'),
        sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId).eq('curso_id', cursoId),
        supabase.from('presencas').select('aula_id,presente').eq('turma_id', turmaId).eq('user_id', aluno.id),
      ]);
      const atividadeIds = (ats ?? []).map((a) => a.id);
      const { data: envios } = atividadeIds.length
        ? await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota,corrigido_em').eq('aluno_id', aluno.id).in('atividade_id', atividadeIds)
        : { data: [] };
      const envioMap = new Map((envios ?? []).map((e) => [e.atividade_id, e]));
      setAtividades((ats ?? []).map((a) => {
        const e = envioMap.get(a.id) as { enviado_em: string | null; nota: number | null; corrigido_em: string | null } | undefined;
        return { id: a.id, titulo: a.titulo, enviadoEm: e?.enviado_em ?? null, nota: e?.nota ?? null, corrigidoEm: e?.corrigido_em ?? null };
      }));

      const horariosMap = new Map(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora]));
      const presencaMap = new Map(((presencas ?? []) as { aula_id: string; presente: boolean }[]).map((p) => [p.aula_id, p.presente]));
      setAulas(((aulasList ?? []) as { id: string; titulo: string }[]).map((a) => ({
        id: a.id, titulo: a.titulo, dataHora: horariosMap.get(a.id) ?? null, presente: !!presencaMap.get(a.id),
      })));
      setLoading(false);
    })();
  }, [turmaId, cursoId, aluno.id]);

  const aulasPresentes = aulas.filter((a) => a.presente).length;
  const pctAulas = aulas.length ? Math.round((aulasPresentes / aulas.length) * 100) : 0;

  return (
    <Modal open onClose={onClose} size="lg" title={aluno.nome || aluno.email}
      footer={readOnly ? <Button variant="secondary" onClick={onClose}>Fechar</Button> : (
        <>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          <Button variant={aprovadoEfetivo ? 'danger' : 'primary'} onClick={onToggle}>
            {aprovadoEfetivo ? 'Desmarcar aprovação' : 'Marcar como aprovado'}
          </Button>
        </>
      )}>
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <Badge tone="default">Nota do projeto final: {aluno.notaFinal ?? '—'}</Badge>
            {aprovadoEfetivo && <Badge tone="success"><CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />Aprovado</Badge>}
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-2">Atividades</h3>
              {atividades.length === 0 ? <p className="text-fg-3 text-sm">Nenhuma atividade.</p> : (
                <ul className="space-y-1.5">
                  {atividades.map((a) => (
                    <li key={a.id} className="text-sm text-fg-2">
                      {a.titulo}{a.nota != null ? ` – nota ${a.nota}` : ''} –{' '}
                      <span className={a.corrigidoEm ? 'text-ok font-medium' : a.enviadoEm ? 'text-fg-2' : 'text-fg-3'}>
                        {a.corrigidoEm ? 'Corrigida' : a.enviadoEm ? 'Enviada' : 'Não entregue'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-2">
                Presença ({aulasPresentes}/{aulas.length} – {pctAulas}%)
              </h3>
              {aulas.length === 0 ? <p className="text-fg-3 text-sm">Nenhuma aula.</p> : (
                <ul className="space-y-1.5">
                  {aulas.map((a) => (
                    <li key={a.id} className="text-sm text-fg-2">
                      {a.titulo}{a.dataHora ? ` – ${new Date(a.dataHora).toLocaleDateString('pt-BR')}` : ''} –{' '}
                      <span className={a.presente ? 'text-ok font-medium' : 'text-danger'}>{a.presente ? 'Presente' : 'Ausente'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
