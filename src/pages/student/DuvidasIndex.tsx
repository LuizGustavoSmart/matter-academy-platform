import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Avatar, EmptyState, Skeleton } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';

type Row = {
  id: string; titulo: string; status: 'aberta' | 'resolvida'; created_at: string;
  aluno_email?: string; aluno_nome?: string | null; curso_titulo?: string; turma_nome?: string;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (data ?? []) as any[];
      if (isStaff && list.length) {
        const cursoIds = [...new Set(list.map((d) => d.curso_id))];
        const turmaIds = [...new Set(list.map((d) => d.turma_id))];
        const alunoIds = [...new Set(list.map((d) => d.aluno_id))];
        const [{ data: cursos }, { data: turmas }, { data: alunos }] = await Promise.all([
          supabase.from('cursos').select('id,titulo').in('id', cursoIds),
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('profiles').select('id,email,nome').in('id', alunoIds),
        ]);
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c.titulo]));
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t.nome]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const alunoMap = new Map((alunos ?? []).map((a: any) => [a.id, a]));
        setRows(list.map((d) => ({ id: d.id, titulo: d.titulo, status: d.status, created_at: d.created_at, curso_titulo: cursoMap.get(d.curso_id), turma_nome: turmaMap.get(d.turma_id), aluno_email: alunoMap.get(d.aluno_id)?.email, aluno_nome: alunoMap.get(d.aluno_id)?.nome })));
      } else if (list.length) {
        const cursoIds = [...new Set(list.map((d) => d.curso_id))];
        const { data: cursos } = await supabase.from('cursos').select('id,titulo').in('id', cursoIds);
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c.titulo]));
        setRows(list.map((d) => ({ id: d.id, titulo: d.titulo, status: d.status, created_at: d.created_at, curso_titulo: cursoMap.get(d.curso_id) })));
      } else setRows([]);
      setLoading(false);
    })();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const abertas = rows.filter((r) => r.status === 'aberta');
  const resolvidas = rows.filter((r) => r.status === 'resolvida');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Dúvidas" subtitle={isStaff ? 'Dúvidas enviadas pelos alunos das suas turmas.' : 'Acompanhe suas dúvidas enviadas e as respostas.'} />

      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div> : rows.length === 0 ? (
        <EmptyState icon={<HelpCircle className="w-8 h-8" />} title="Nenhuma dúvida" description={isStaff ? 'Nenhum aluno enviou dúvidas ainda.' : 'Use o botão "Tirar dúvida" em qualquer aula.'} />
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
      <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-3">{title}</p>
      <Card className="overflow-hidden">
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 cursor-pointer transition-colors" onClick={() => nav(`/duvidas/${r.id}`)}>
              {isStaff && <Avatar name={r.aluno_nome} email={r.aluno_email} size={30} />}
              <div className="flex-1 min-w-0">
                <p className="text-fg text-sm font-medium truncate">{r.titulo}</p>
                <p className="text-fg-3 text-xs truncate">{isStaff ? `${r.aluno_nome || r.aluno_email || ''} · ${r.turma_nome ?? ''} ${r.curso_titulo ?? ''}` : r.curso_titulo}</p>
              </div>
              <Badge tone={r.status === 'resolvida' ? 'success' : 'warn'} dot>{r.status === 'resolvida' ? 'Resolvida' : 'Aberta'}</Badge>
              <ChevronRight className="w-4 h-4 text-fg-3 flex-shrink-0" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
