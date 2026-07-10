import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, Empty } from '../../components/ui';

type Post = {
  id: string;
  content: string;
  status: 'aberta' | 'resolvida';
  created_at: string | null;
  turma_id: string;
  turmas: { nome: string } | null;
  profiles: { email: string } | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `há ${d}d` : new Date(iso).toLocaleDateString('pt-BR');
}

function initials(email: string): string {
  return email.split('@')[0]?.slice(0, 2).toUpperCase() ?? '??';
}

type Filtro = 'todas' | 'abertas';

export default function Duvidas() {
  const { profile } = useAuth();
  const [posts, setPosts]     = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro]   = useState<Filtro>('todas');

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: ut } = await supabase
        .from('user_turmas')
        .select('turma_id')
        .eq('user_id', profile.id);

      const ids = [...new Set((ut ?? []).map((r: any) => r.turma_id))];
      if (!ids.length) { setLoading(false); return; }

      const { data } = await supabase
        .from('community_posts')
        .select('id,content,status,created_at,turma_id,turmas(nome),profiles(email)')
        .in('turma_id', ids)
        .eq('tipo', 'duvida')
        .order('created_at', { ascending: false })
        .limit(100);

      setPosts((data ?? []) as Post[]);
      setLoading(false);
    })();
  }, [profile]);

  const filtered = filtro === 'abertas' ? posts.filter((p) => p.status === 'aberta') : posts;
  const abertas  = posts.filter((p) => p.status === 'aberta').length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Dúvidas</h1>
        <p className="text-[#d6deed]">Dúvidas publicadas nas suas turmas.</p>
      </div>

      {/* Filter bar */}
      {!loading && posts.length > 0 && (
        <div className="flex gap-2 mb-6">
          {([
            { key: 'todas', label: `Todas (${posts.length})` },
            { key: 'abertas', label: `Abertas (${abertas})` },
          ] as { key: Filtro; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filtro === key
                  ? 'bg-[#cbfb00] text-black'
                  : 'bg-[#1c1f26] text-[#d6deed] hover:bg-[#434d5e]/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="meta">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Empty
          icon={<HelpCircle className="w-10 h-10" />}
          title={filtro === 'abertas' ? 'Nenhuma dúvida em aberto' : 'Nenhuma dúvida publicada'}
          description="As dúvidas aparecem aqui quando publicadas na Comunidade"
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/turma/${p.turma_id}/comunidade?filtro=duvidas`}
            >
              <Card className="p-5 hover:border-[#cbfb00]/40 transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#1c1f26] text-[#d6deed] text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                    {initials(p.profiles?.email ?? '?')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-[#8b929e]">{p.profiles?.email ?? '—'}</span>
                      <span className="text-[#434d5e]">·</span>
                      <span className="text-xs text-[#8b929e]">{timeAgo(p.created_at)}</span>
                      <Badge className="flex-shrink-0">{p.turmas?.nome ?? '—'}</Badge>
                    </div>
                    <p className="text-white text-sm line-clamp-2">{p.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {p.status === 'resolvida' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#cbfb00]">
                          <CheckCircle className="w-3 h-3" /> Resolvida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <Clock className="w-3 h-3" /> Aberta
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-[#8b929e]">
                        <MessageSquare className="w-3 h-3" /> Ver na comunidade
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
