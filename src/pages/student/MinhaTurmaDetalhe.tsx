import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Users, BookOpen, PlayCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Avatar, EmptyState, Skeleton, Alert, SearchInput, StatTile, Tabs, TableWrap, THead, TBody, Tr, Th, Td } from '../../components/ui';
import { statusLabel } from '../../lib/users';
import { SignedImage } from '../../components/SignedImage';
import { labelDaFaixa, ordemDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

type Turma = { id: string; nome: string; descricao: string | null; data_inicio: string | null };
type Curso = { id: string; titulo: string; descricao: string | null; capa_url: string | null; faixa: string | null };
type Tab = 'dashboard' | 'cursos' | 'participantes';
type ParticipanteRole = 'student' | 'professor' | 'monitor' | 'admin';
type Participante = { id: string; email: string; nome: string | null; role: ParticipanteRole; status: string; cursoTitulo: string | null };

const ROLE_LABEL: Record<ParticipanteRole, string> = { student: 'Aluno', professor: 'Professor', monitor: 'Monitor', admin: 'Admin' };
const ROLE_TONE: Record<ParticipanteRole, 'default' | 'warn' | 'info' | 'success'> = { student: 'default', professor: 'warn', monitor: 'info', admin: 'success' };
const STATUS_TONE: Record<string, 'success' | 'warn' | 'danger'> = { active: 'success', pending: 'warn', blocked: 'danger' };

function dateOnlyBR(iso: string | null): string {
  if (!iso) return 'Não definida';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function MinhaTurmaDetalhe() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';

  const [tab, setTab] = useState<Tab>('dashboard');
  const [turma, setTurma] = useState<Turma | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [aulaCounts, setAulaCounts] = useState<Record<string, number>>({});
  const [cursosLoading, setCursosLoading] = useState(false);

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [search, setSearch] = useState('');
  const [participantesLoading, setParticipantesLoading] = useState(false);
  const [alunosCount, setAlunosCount] = useState(0);

  useEffect(() => {
    if (!turmaId || !profile || !isStaff) return;
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from('turmas').select('id,nome,descricao,data_inicio').eq('id', turmaId).maybeSingle();
      if (!t) { setNotFound(true); setLoading(false); return; }
      setTurma(t as Turma);
      const { data: uts } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId);
      const userIds = [...new Set((uts ?? []).map((r) => r.user_id))];
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id,role').in('id', userIds);
        setAlunosCount((profiles ?? []).filter((p) => p.role === 'student').length);
      } else setAlunosCount(0);
      setLoading(false);
    })();
  }, [turmaId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCursos = async () => {
    setCursosLoading(true);
    const { data: cts } = await supabase.from('curso_turmas').select('curso_id').eq('turma_id', turmaId!);
    const cursoIds = (cts ?? []).map((r) => r.curso_id);
    if (cursoIds.length > 0) {
      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: cs }, { data: as }] = await Promise.all([
        (supabase as any).from('cursos').select('*').in('id', cursoIds),
        supabase.from('aulas').select('curso_id').in('curso_id', cursoIds),
      ]);
      setCursos(((cs ?? []) as Curso[]).sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa)));
      const counts: Record<string, number> = {};
      (as ?? []).forEach((a) => { counts[a.curso_id] = (counts[a.curso_id] ?? 0) + 1; });
      setAulaCounts(counts);
    } else { setCursos([]); setAulaCounts({}); }
    setCursosLoading(false);
  };

  const loadParticipantes = async () => {
    setParticipantesLoading(true);
    const { data: uts } = await supabase.from('user_turmas').select('user_id,curso_id').eq('turma_id', turmaId!);
    const userIds = [...new Set((uts ?? []).map((r) => r.user_id))];
    if (!userIds.length) { setParticipantes([]); setParticipantesLoading(false); return; }
    const cursoIds = [...new Set((uts ?? []).filter((r) => r.curso_id).map((r) => r.curso_id as string))];
    const [{ data: profiles }, { data: cs }] = await Promise.all([
      supabase.from('profiles').select('id,email,nome,role,status').in('id', userIds),
      cursoIds.length ? supabase.from('cursos').select('id,titulo').in('id', cursoIds) : Promise.resolve({ data: [] }),
    ]);
    const cursoMap = new Map((cs ?? []).map((c) => [c.id, c.titulo]));
    const cursoPorUser = new Map<string, string | null>();
    (uts ?? []).forEach((r) => { if (r.curso_id && !cursoPorUser.has(r.user_id)) cursoPorUser.set(r.user_id, cursoMap.get(r.curso_id) ?? null); });
    const rows: Participante[] = (profiles ?? []).map((p) => ({
      id: p.id, email: p.email, nome: p.nome, role: p.role as ParticipanteRole, status: p.status, cursoTitulo: cursoPorUser.get(p.id) ?? null,
    })).sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email));
    setParticipantes(rows);
    setParticipantesLoading(false);
  };

  useEffect(() => { if (tab === 'cursos') loadCursos(); }, [tab, turmaId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'participantes') loadParticipantes(); }, [tab, turmaId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (profile && !isStaff) return <Navigate to="/dashboard" replace />;

  const filtered = participantes.filter((p) => !search || p.email.toLowerCase().includes(search.toLowerCase()) || (p.nome ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalAulas = Object.values(aulaCounts).reduce((s, n) => s + n, 0);

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-8 w-56 mb-6" /><Skeleton className="h-64 rounded-xl" /></div>;
  if (notFound) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8"><Alert tone="danger">Turma não encontrada.</Alert></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => nav('/turmas')} className="inline-flex items-center gap-2 text-sm text-fg-3 hover:text-fg mb-6 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar para minhas turmas</button>
      <header className="mb-6">
        <h1 className="mb-1">{turma?.nome}</h1>
        {turma?.descricao && <p className="text-fg-2 mb-2">{turma.descricao}</p>}
        <p className="text-fg-3 text-sm">Início da turma: {dateOnlyBR(turma?.data_inicio ?? null)}</p>
      </header>

      <Tabs className="mb-6" value={tab} onChange={setTab}
        tabs={[{ value: 'dashboard', label: 'Dashboard' }, { value: 'cursos', label: 'Cursos' }, { value: 'participantes', label: 'Participantes' }]} />

      {tab === 'dashboard' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Alunos" value={alunosCount} icon={<Users className="w-4 h-4" />} />
          <StatTile label="Cursos" value={cursos.length || '—'} icon={<BookOpen className="w-4 h-4" />} />
          <StatTile label="Aulas (total)" value={totalAulas || '—'} icon={<PlayCircle className="w-4 h-4" />} />
        </div>
      )}

      {tab === 'cursos' && (
        cursosLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div> :
          cursos.length === 0 ? <EmptyState icon={<BookOpen className="w-8 h-8" />} title="Nenhum curso nesta turma" /> : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cursos.map((c) => {
                const capa = resolveCapaUrl(c.capa_url, c.faixa, faixaCapas);
                return (
                  <Card key={c.id} className="p-0 overflow-hidden cursor-pointer hover:border-line-strong transition-colors" onClick={() => nav(`/turmas/${turmaId}/cursos/${c.id}`)}>
                    <div className="relative h-40">
                      {capa ? (
                        <>
                          <SignedImage bucket="capas" path={capa} className="absolute inset-0 w-full h-full object-cover" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-brand/10 grid place-items-center"><BookOpen className="w-6 h-6 text-brand" /></div>
                      )}
                    </div>
                    <div className="p-4 pt-3">
                      {labelDaFaixa(c.faixa) && <Badge tone="outline" className="mb-2">{labelDaFaixa(c.faixa)}</Badge>}
                      <h3 className="mb-1 line-clamp-1">{c.titulo}</h3>
                      <p className="text-fg-3 text-sm mb-3 line-clamp-2 min-h-[40px]">{c.descricao || 'Sem descrição'}</p>
                      <div className="flex items-center gap-1.5 text-sm text-fg-2"><PlayCircle className="w-4 h-4 text-fg-3" /> {aulaCounts[c.id] ?? 0} aulas</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
      )}

      {tab === 'participantes' && (
        <div>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar nome ou e-mail…" className="mb-4 max-w-sm" />
          {participantesLoading ? <Skeleton className="h-64 rounded-xl" /> :
            filtered.length === 0 ? (
              <EmptyState icon={<Users className="w-8 h-8" />} title={search ? 'Nenhum resultado para essa busca' : 'Nenhum participante nesta turma'} />
            ) : (
              <Card className="overflow-hidden">
                <TableWrap>
                  <THead><Tr><Th>Participante</Th><Th>Papel</Th><Th>Status</Th><Th>Curso vinculado</Th></Tr></THead>
                  <TBody>
                    {filtered.map((p) => (
                      <Tr key={p.id} className="hover:bg-panel-2/40 transition-colors">
                        <Td>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={p.nome} email={p.email} size={32} />
                            <div className="min-w-0"><p className="text-fg truncate max-w-[200px]">{p.nome || p.email.split('@')[0]}</p><p className="text-fg-3 text-xs truncate max-w-[200px]">{p.email}</p></div>
                          </div>
                        </Td>
                        <Td><Badge tone={ROLE_TONE[p.role]} dot>{ROLE_LABEL[p.role]}</Badge></Td>
                        <Td><Badge tone={STATUS_TONE[p.status]} dot>{statusLabel(p.status)}</Badge></Td>
                        <Td className="text-fg-2">{p.cursoTitulo ?? <span className="text-fg-3 text-xs">—</span>}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </TableWrap>
              </Card>
            )}
        </div>
      )}
    </div>
  );
}
