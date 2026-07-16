import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Layers, Users, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Empty } from '../../components/ui';

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
      const turmaIds = [...new Set((ut ?? []).map((r: any) => r.turma_id))];
      if (!turmaIds.length) { setTurmas([]); setLoading(false); return; }

      const [{ data: ts }, { data: allUt }] = await Promise.all([
        supabase.from('turmas').select('id,nome,descricao,data_inicio').in('id', turmaIds).order('nome'),
        supabase.from('user_turmas').select('turma_id,user_id').in('turma_id', turmaIds),
      ]);

      const uniquePerTurma: Record<string, Set<string>> = {};
      (allUt ?? []).forEach((r: any) => {
        (uniquePerTurma[r.turma_id] ??= new Set()).add(r.user_id);
      });
      const c: Record<string, number> = {};
      Object.entries(uniquePerTurma).forEach(([tid, set]) => { c[tid] = set.size; });

      setTurmas((ts ?? []) as Turma[]);
      setCounts(c);
      setLoading(false);
    })();
  }, [profile]);

  if (profile && !isStaff) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Minhas Turmas</h1>
        <p className="text-[#d6deed]">Turmas em que você atua como professor ou monitor.</p>
      </div>

      {loading ? <p className="meta">Carregando...</p> : turmas.length === 0 ? (
        <Empty
          icon={<Layers className="w-10 h-10" />}
          title="Nenhuma turma atribuída"
          description="O administrador precisa te atribuir a uma turma"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Card
              key={t.id}
              className="p-5 cursor-pointer hover:border-[#cbfb00]/40 transition-colors"
              onClick={() => nav(`/turmas/${t.id}`)}
            >
              <h3 className="mb-1">{t.nome}</h3>
              <p className="text-sm mb-4 line-clamp-2 min-h-[40px]">{t.descricao || '—'}</p>
              <div className="flex items-center gap-4 text-sm text-[#d6deed]">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-[#434d5e]" /> {counts[t.id] ?? 0} participante{(counts[t.id] ?? 0) !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-[#434d5e]" /> {dateOnlyBR(t.data_inicio)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
