import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Empty } from '../../components/ui';

type Row = {
  id: string; titulo: string; status: 'aberta' | 'resolvida'; created_at: string;
  aluno_email?: string; curso_titulo?: string; turma_nome?: string;
};

export default function DuvidasIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor' || profile?.role === 'admin';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    (async () => {
      const query = isStaff
        ? supabase.from('duvidas').select('id,titulo,status,created_at,curso_id,turma_id,aluno_id').order('created_at', { ascending: false })
        : supabase.from('duvidas').select('id,titulo,status,created_at,curso_id,turma_id').eq('aluno_id', profile.id).order('created_at', { ascending: false });
      const { data } = await query;
      const list = (data ?? []) as any[];

      if (isStaff && list.length) {
        const cursoIds = [...new Set(list.map((d) => d.curso_id))];
        const turmaIds = [...new Set(list.map((d) => d.turma_id))];
        const alunoIds = [...new Set(list.map((d) => d.aluno_id))];
        const [{ data: cursos }, { data: turmas }, { data: alunos }] = await Promise.all([
          supabase.from('cursos').select('id,titulo').in('id', cursoIds),
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('profiles').select('id,email').in('id', alunoIds),
        ]);
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c.titulo]));
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t.nome]));
        const alunoMap = new Map((alunos ?? []).map((a) => [a.id, a.email]));
        setRows(list.map((d) => ({
          id: d.id, titulo: d.titulo, status: d.status, created_at: d.created_at,
          curso_titulo: cursoMap.get(d.curso_id), turma_nome: turmaMap.get(d.turma_id), aluno_email: alunoMap.get(d.aluno_id),
        })));
      } else if (list.length) {
        const cursoIds = [...new Set(list.map((d) => d.curso_id))];
        const { data: cursos } = await supabase.from('cursos').select('id,titulo').in('id', cursoIds);
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c.titulo]));
        setRows(list.map((d) => ({ id: d.id, titulo: d.titulo, status: d.status, created_at: d.created_at, curso_titulo: cursoMap.get(d.curso_id) })));
      } else {
        setRows([]);
      }
      setLoading(false);
    })();
  }, [profile]);

  const abertas = rows.filter((r) => r.status === 'aberta');
  const resolvidas = rows.filter((r) => r.status === 'resolvida');

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Dúvidas</h1>
        <p className="text-[#d6deed]">
          {isStaff ? 'Dúvidas enviadas pelos alunos das suas turmas.' : 'Acompanhe suas dúvidas enviadas e as respostas.'}
        </p>
      </div>

      {loading ? <p className="meta">Carregando...</p> : rows.length === 0 ? (
        <Empty icon={<HelpCircle className="w-10 h-10" />} title="Nenhuma dúvida" description={isStaff ? 'Nenhum aluno enviou dúvidas ainda' : 'Use o botão "Tirar dúvida" em qualquer aula'} />
      ) : (
        <div className="space-y-8">
          <Section title={`Abertas (${abertas.length})`} rows={abertas} isStaff={isStaff} nav={nav} />
          <Section title={`Resolvidas (${resolvidas.length})`} rows={resolvidas} isStaff={isStaff} nav={nav} />
        </div>
      )}
    </div>
  );
}

function Section({ title, rows, isStaff, nav }: { title: string; rows: Row[]; isStaff: boolean; nav: (p: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="meta uppercase tracking-wider mb-3">{title}</p>
      <Card>
        <ul>
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-4 px-4 py-3 border-b border-[#1c1f26] last:border-0 hover:bg-[#111] cursor-pointer"
              onClick={() => nav(`/duvidas/${r.id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{r.titulo}</p>
                <p className="meta truncate">
                  {isStaff ? `${r.aluno_email ?? ''} · ${r.turma_nome ?? ''} ${r.curso_titulo ?? ''}` : r.curso_titulo}
                </p>
              </div>
              <Badge tone={r.status === 'resolvida' ? 'success' : 'warn'}>{r.status === 'resolvida' ? 'Resolvida' : 'Aberta'}</Badge>
              <ChevronRight className="w-4 h-4 text-[#434d5e] flex-shrink-0" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
