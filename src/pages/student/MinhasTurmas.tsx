import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Layers, Users, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Skeleton } from '../../components/ui';

type Turma = { id: string; nome: string; descricao: string | null; data_inicio: string | null };

function dateOnlyBR(iso: string | null): string {
  if (!iso) return 'Não definida';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
}

export default function MinhasTurmas() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !isStaff) { setLoading(false); return; }
    (async () => {
      const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
      const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
      if (!turmaIds.length) { setTurmas([]); setLoading(false); return; }
      const [{ data: ts }, { data: allUt }] = await Promise.all([
        supabase.from('turmas').select('id,nome,descricao,data_inicio').in('id', turmaIds).order('nome'),
        supabase.from('user_turmas').select('turma_id,user_id').in('turma_id', turmaIds),
      ]);
      const uniquePerTurma: Record<string, Set<string>> = {};
      (allUt ?? []).forEach((r) => { (uniquePerTurma[r.turma_id] ??= new Set()).add(r.user_id); });
      const c: Record<string, number> = {};
      Object.entries(uniquePerTurma).forEach(([tid, set]) => { c[tid] = set.size; });
      setTurmas((ts ?? []) as Turma[]);
      setCounts(c);
      setLoading(false);
    })();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (profile && !isStaff) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-7">
        <h1 className="mb-1">Minhas turmas</h1>
        <p className="text-fg-3">Turmas em que você atua como professor ou monitor.</p>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : turmas.length === 0 ? (
        <EmptyState icon={<Layers className="w-8 h-8" />} title="Nenhuma turma atribuída" description="O administrador precisa te atribuir a uma turma." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Card key={t.id} className="p-5 cursor-pointer hover:border-brand/40 transition-colors" onClick={() => nav(`/turmas/${t.id}`)}>
              <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center mb-3"><Layers className="w-5 h-5 text-brand" /></span>
              <h3 className="mb-1 line-clamp-1">{t.nome}</h3>
              <p className="text-fg-3 text-sm mb-4 line-clamp-2 min-h-[40px]">{t.descricao || 'Sem descrição'}</p>
              <div className="flex items-center gap-4 text-sm text-fg-2">
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-fg-3" /> {counts[t.id] ?? 0} participante{(counts[t.id] ?? 0) !== 1 ? 's' : ''}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-fg-3" /> {dateOnlyBR(t.data_inicio)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
