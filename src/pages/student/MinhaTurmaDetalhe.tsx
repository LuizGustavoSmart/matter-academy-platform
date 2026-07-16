import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Empty } from '../../components/ui';

type Turma = { id: string; nome: string; descricao: string | null; data_inicio: string | null };
type ParticipanteRole = 'student' | 'professor' | 'monitor' | 'admin';
type Participante = {
  id: string;
  email: string;
  nome: string | null;
  role: ParticipanteRole;
  status: string;
  cursoTitulo: string | null;
};

const ROLE_LABEL: Record<ParticipanteRole, string> = {
  student: 'Aluno', professor: 'Professor', monitor: 'Monitor', admin: 'Admin',
};
const ROLE_TONE: Record<ParticipanteRole, 'default' | 'warn' | 'success'> = {
  student: 'default', professor: 'warn', monitor: 'success', admin: 'default',
};

function dateOnlyBR(iso: string | null): string {
  if (!iso) return 'Não definida';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function MinhaTurmaDetalhe() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';

  const [turma, setTurma] = useState<Turma | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!turmaId || !profile || !isStaff) return;
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from('turmas').select('id,nome,descricao,data_inicio').eq('id', turmaId).maybeSingle();
      if (!t) { setNotFound(true); setLoading(false); return; }
      setTurma(t as Turma);

      const { data: uts } = await supabase.from('user_turmas').select('user_id,curso_id').eq('turma_id', turmaId);
      const userIds = [...new Set((uts ?? []).map((r: any) => r.user_id))];
      if (!userIds.length) { setParticipantes([]); setLoading(false); return; }

      const cursoIds = [...new Set((uts ?? []).filter((r: any) => r.curso_id).map((r: any) => r.curso_id as string))];
      const [{ data: profiles }, { data: cs }] = await Promise.all([
        supabase.from('profiles').select('id,email,nome,role,status').in('id', userIds),
        cursoIds.length ? supabase.from('cursos').select('id,titulo').in('id', cursoIds) : Promise.resolve({ data: [] }),
      ]);

      const cursoMap = new Map((cs ?? []).map((c: any) => [c.id, c.titulo]));
      const cursoPorUser = new Map<string, string | null>();
      (uts ?? []).forEach((r: any) => {
        if (r.curso_id && !cursoPorUser.has(r.user_id)) cursoPorUser.set(r.user_id, cursoMap.get(r.curso_id) ?? null);
      });

      const rows: Participante[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        nome: p.nome,
        role: p.role,
        status: p.status,
        cursoTitulo: cursoPorUser.get(p.id) ?? null,
      })).sort((a, b) => (a.nome ?? a.email).localeCompare(b.nome ?? b.email));

      setParticipantes(rows);
      setLoading(false);
    })();
  }, [turmaId, profile]);

  if (profile && !isStaff) return <Navigate to="/dashboard" replace />;

  const filtered = participantes.filter((p) =>
    !search ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    (p.nome ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  if (notFound) return <div className="max-w-5xl mx-auto px-6 py-12"><p className="text-red-400">Turma não encontrada.</p></div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <button onClick={() => nav('/turmas')} className="inline-flex items-center gap-2 text-sm text-[#8b929e] hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Voltar para Minhas Turmas
      </button>

      <div className="mb-8">
        <h1 className="mb-2">{turma?.nome}</h1>
        {turma?.descricao && <p className="text-[#d6deed] mb-2">{turma.descricao}</p>}
        <p className="meta">
          Início da turma: {dateOnlyBR(turma?.data_inicio ?? null)} · {participantes.length} participante{participantes.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#434d5e]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome ou email..." className="!pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Empty
          icon={<Users className="w-8 h-8" />}
          title={search ? 'Nenhum resultado para essa busca' : 'Nenhum participante nesta turma'}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c1f26] text-left">
                <th className="px-4 py-3 font-medium text-[#d6deed]">Nome</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Papel</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Status</th>
                <th className="px-4 py-3 font-medium text-[#d6deed]">Curso vinculado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[#1c1f26] last:border-0 hover:bg-[#111] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-white block truncate max-w-[220px]">{p.nome || p.email}</span>
                    {p.nome && <span className="text-[#8b929e] text-xs">{p.email}</span>}
                  </td>
                  <td className="px-4 py-3"><Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge></td>
                  <td className="px-4 py-3">
                    {p.status === 'active'  && <Badge tone="success">Ativo</Badge>}
                    {p.status === 'pending' && <Badge tone="warn">Pendente</Badge>}
                    {p.status === 'blocked' && <Badge tone="danger">Bloqueado</Badge>}
                  </td>
                  <td className="px-4 py-3 text-[#d6deed]">{p.cursoTitulo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
