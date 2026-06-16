import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Empty } from '../../components/ui';

type Turma = { id: string; nome: string; descricao: string | null };

export default function CommunityIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: ut } = await supabase
        .from('user_turmas')
        .select('turma_id')
        .eq('user_id', profile.id);

      const ids = [...new Set((ut ?? []).map((r: any) => r.turma_id))];
      if (!ids.length) { setLoading(false); return; }

      const { data: ts } = await supabase
        .from('turmas')
        .select('id,nome,descricao')
        .in('id', ids)
        .order('nome');

      setTurmas(ts ?? []);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Comunidade</h1>
        <p className="text-[#d6deed]">Acesse a comunidade de cada turma para trocar ideias com colegas.</p>
      </div>

      {turmas.length === 0 ? (
        <Empty
          icon={<MessageSquare className="w-10 h-10" />}
          title="Nenhuma turma atribuída"
          description="O administrador precisa te atribuir a uma turma"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((t) => (
            <Card
              key={t.id}
              className="p-5 flex flex-col gap-4 cursor-pointer hover:border-[#cbfb00]/40 transition-colors"
              onClick={() => nav(`/turma/${t.id}/comunidade`)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-[#cbfb00]" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{t.nome}</p>
                  {t.descricao && <p className="meta text-xs mt-0.5 line-clamp-2">{t.descricao}</p>}
                </div>
              </div>
              <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors bg-[#cbfb00]/10 border border-[#cbfb00]/30 text-[#cbfb00] hover:bg-[#cbfb00]/20">
                <MessageSquare className="w-4 h-4" />
                Entrar na comunidade
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
