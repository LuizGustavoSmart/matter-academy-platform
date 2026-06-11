import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, Send, Trash2, Users,
  CheckCircle, HelpCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Empty, Toast } from '../../components/ui';

type PostTipo   = 'duvida' | 'outros';
type PostStatus = 'aberta' | 'resolvida';
type Filtro     = 'todos'  | 'duvida' | 'duvida_aberta';

type Post = {
  id: string;
  user_id: string;
  content: string;
  tipo: PostTipo;
  status: PostStatus;
  created_at: string | null;
  profiles: { email: string; role?: string } | null;
};

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string | null;
  profiles: { email: string; role?: string } | null;
};

/* ── Helpers ── */
function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',        label: 'Todos' },
  { key: 'duvida',       label: 'Dúvidas' },
  { key: 'duvida_aberta', label: 'Dúvidas abertas' },
];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function StudentCommunity() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();

  const isMonitor = profile?.role === 'monitor';

  const [turma,       setTurma]       = useState<{ id: string; nome: string } | null>(null);
  const [posts,       setPosts]       = useState<Post[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [newContent,  setNewContent]  = useState('');
  const [newTipo,     setNewTipo]     = useState<PostTipo>('outros');
  const [submitting,  setSubmitting]  = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments,    setComments]    = useState<Record<string, Comment[]>>({});
  const [newComment,  setNewComment]  = useState<Record<string, string>>({});
  const [filtro,      setFiltro]      = useState<Filtro>(() =>
    searchParams.get('filtro') === 'duvidas' ? 'duvida_aberta' : 'todos',
  );
  const [toast, setToast] = useState<{ msg: string; tone: 'danger' | 'success' } | null>(null);

  const showToast = (msg: string, tone: 'danger' | 'success') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Carrega posts ── */
  const loadPosts = async () => {
    const { data } = await supabase
      .from('community_posts')
      .select('*, profiles(email,role)')
      .eq('turma_id', turmaId!)
      .order('created_at', { ascending: false });
    setPosts((data ?? []) as Post[]);
  };

  /* ── Init ── */
  useEffect(() => {
    const init = async () => {
      if (!turmaId || !profile) return;

      const { data: member } = await supabase
        .from('user_turmas')
        .select('turma_id')
        .eq('turma_id', turmaId)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (!member) { nav('/dashboard'); return; }

      const { data: t } = await supabase
        .from('turmas')
        .select('id,nome')
        .eq('id', turmaId)
        .maybeSingle();
      if (!t) { nav('/dashboard'); return; }

      setTurma(t);
      await loadPosts();
      setLoading(false);
    };
    init();
  }, [turmaId, profile]);

  /* ── Realtime ── */
  useEffect(() => {
    if (!turmaId) return;
    const channel = supabase
      .channel(`community_posts:${turmaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts', filter: `turma_id=eq.${turmaId}` },
        () => loadPosts(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [turmaId]);

  /* ── Permissões ── */
  const canDeletePost    = (p: Post)    => p.user_id === profile?.id || isMonitor || profile?.role === 'admin';
  const canDeleteComment = (c: Comment) => c.user_id === profile?.id || isMonitor || profile?.role === 'admin';
  const canResolve       = (p: Post)    =>
    p.tipo === 'duvida' && p.status === 'aberta' &&
    (p.user_id === profile?.id || isMonitor);

  /* ── Ações ── */
  const submitPost = async () => {
    if (!newContent.trim() || !profile || !turmaId) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('community_posts')
      .insert({ turma_id: turmaId, user_id: profile.id, content: newContent.trim(), tipo: newTipo });
    setSubmitting(false);
    if (error) { showToast(error.message, 'danger'); return; }
    setNewContent('');
    setNewTipo('outros');
    loadPosts();
  };

  const resolvePost = async (postId: string) => {
    const { error } = await supabase
      .from('community_posts')
      .update({ status: 'resolvida' })
      .eq('id', postId);
    if (error) { showToast(error.message, 'danger'); return; }
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: 'resolvida' } : p));
    showToast('Dúvida marcada como resolvida ✓', 'success');
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Excluir esta publicação e todos os comentários?')) return;
    const { error } = await supabase.from('community_posts').delete().eq('id', postId);
    if (error) { showToast(error.message, 'danger'); return; }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (expandedPost === postId) setExpandedPost(null);
  };

  const loadComments = async (postId: string) => {
    if (comments[postId] !== undefined) return;
    const { data } = await supabase
      .from('community_comments')
      .select('*, profiles(email,role)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    setComments((prev) => ({ ...prev, [postId]: (data ?? []) as Comment[] }));
  };

  const toggleExpand = async (postId: string) => {
    const next = expandedPost === postId ? null : postId;
    setExpandedPost(next);
    if (next) await loadComments(next);
  };

  const submitComment = async (postId: string) => {
    const text = (newComment[postId] ?? '').trim();
    if (!text || !profile) return;
    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: postId, user_id: profile.id, content: text })
      .select('*, profiles(email,role)')
      .single();
    if (error) { showToast(error.message, 'danger'); return; }
    setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data as Comment] }));
    setNewComment((prev) => ({ ...prev, [postId]: '' }));
  };

  const deleteComment = async (postId: string, commentId: string) => {
    const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
    if (error) { showToast(error.message, 'danger'); return; }
    setComments((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
    }));
  };

  /* ── Dados derivados ── */
  const duvidasAbertas = posts.filter((p) => p.tipo === 'duvida' && p.status === 'aberta').length;

  const filteredPosts = posts.filter((p) => {
    if (filtro === 'duvida')       return p.tipo === 'duvida';
    if (filtro === 'duvida_aberta') return p.tipo === 'duvida' && p.status === 'aberta';
    return true;
  });

  /* ── Render ── */
  if (loading) {
    return <div className="max-w-2xl mx-auto px-6 py-12"><p className="meta">Carregando...</p></div>;
  }
  if (!turma) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* ── Header ── */}
      <div className="mb-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#d6deed] hover:text-[#cbfb00] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center flex-shrink-0">
              <Users className="w-5 h-5 text-[#cbfb00]" />
            </div>
            <div>
              <h1 className="!mb-0">Comunidade</h1>
              <p className="meta">{turma.nome}</p>
            </div>
          </div>
          {/* Contador de dúvidas (visível para monitores) */}
          {isMonitor && duvidasAbertas > 0 && (
            <button
              onClick={() => setFiltro('duvida_aberta')}
              className="flex-shrink-0 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-center hover:bg-amber-500/20 transition-colors"
            >
              <p className="text-amber-400 font-bold text-lg leading-none">{duvidasAbertas}</p>
              <p className="text-amber-400/70 text-xs mt-0.5">
                {duvidasAbertas === 1 ? 'dúvida aberta' : 'dúvidas abertas'}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* ── Compose ── */}
      <div className="bg-[#0d0d0d] border border-[#1c1f26] rounded-lg p-4 mb-6">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Compartilhe algo com a turma..."
          rows={3}
          maxLength={2000}
          className="w-full bg-transparent resize-none text-sm text-white placeholder:text-[#434d5e] focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost();
          }}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1c1f26]">
          <div className="flex items-center gap-3">
            <select
              value={newTipo}
              onChange={(e) => setNewTipo(e.target.value as PostTipo)}
              className="bg-[#111] border border-[#1c1f26] rounded-md px-2 py-1.5 text-xs text-[#d6deed] focus:outline-none focus:border-[#434d5e] cursor-pointer"
            >
              <option value="outros">Outros</option>
              <option value="duvida">Dúvida</option>
            </select>
            <span className="text-xs text-[#434d5e] hidden sm:inline">
              {newContent.length > 0 ? `${newContent.length}/2000` : 'Ctrl+Enter para publicar'}
            </span>
          </div>
          <Button
            variant="primary"
            icon={<Send className="w-4 h-4" />}
            onClick={submitPost}
            loading={submitting}
            disabled={!newContent.trim()}
          >
            Publicar
          </Button>
        </div>
      </div>

      {/* ── Filtro tabs ── */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {FILTROS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filtro === key
                ? 'bg-[#cbfb00] text-black'
                : 'bg-[#0d0d0d] border border-[#1c1f26] text-[#d6deed] hover:border-[#434d5e]'
            }`}
          >
            {label}
            {key === 'duvida_aberta' && duvidasAbertas > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filtro === key
                  ? 'bg-black/20 text-black'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {duvidasAbertas}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Feed ── */}
      {filteredPosts.length === 0 ? (
        <Empty
          icon={<MessageSquare className="w-8 h-8" />}
          title={filtro === 'todos' ? 'Nenhuma publicação ainda' : 'Nenhum resultado para este filtro'}
          description={
            filtro === 'todos'
              ? 'Seja o primeiro a compartilhar algo com a turma'
              : 'Tente selecionar outro filtro'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const isExpanded  = expandedPost === post.id;
            const postComments = comments[post.id] ?? [];
            const isDuvida    = post.tipo === 'duvida';
            const isResolvida = post.status === 'resolvida';

            return (
              <div
                key={post.id}
                className={`bg-[#0d0d0d] border rounded-lg overflow-hidden transition-all ${
                  isResolvida
                    ? 'border-[#cbfb00]/20 opacity-75'
                    : isDuvida
                    ? 'border-amber-500/30'
                    : 'border-[#1c1f26]'
                }`}
              >
                {/* Corpo do post */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#cbfb00]/10 border border-[#cbfb00]/20 flex-shrink-0 grid place-items-center">
                      <span className="text-[#cbfb00] text-xs font-bold">
                        {initials(post.profiles?.email ?? '?')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">
                          {post.profiles?.email ?? 'Usuário'}
                        </span>
                        {post.profiles?.role === 'monitor' && (
                          <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded px-1.5 py-0.5 flex-shrink-0">
                            Monitor
                          </span>
                        )}
                        {isDuvida && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0 ${
                            isResolvida
                              ? 'bg-[#cbfb00]/10 text-[#cbfb00] border border-[#cbfb00]/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {isResolvida
                              ? <><CheckCircle className="w-2.5 h-2.5" /> Resolvida</>
                              : <><HelpCircle  className="w-2.5 h-2.5" /> Dúvida</>
                            }
                          </span>
                        )}
                        <span className="text-xs text-[#434d5e] flex-shrink-0">
                          {timeAgo(post.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-[#d6deed] whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Barra de ações */}
                <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => toggleExpand(post.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      isExpanded ? 'text-[#cbfb00]' : 'text-[#8b929e] hover:text-[#d6deed]'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comentários
                  </button>

                  {canResolve(post) && (
                    <button
                      onClick={() => resolvePost(post.id)}
                      className="flex items-center gap-1.5 text-xs text-[#8b929e] hover:text-[#cbfb00] transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Marcar resolvida
                    </button>
                  )}

                  {canDeletePost(post) && (
                    <button
                      onClick={() => deletePost(post.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-[#8b929e] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Comentários */}
                {isExpanded && (
                  <div className="border-t border-[#1c1f26] bg-black/30">
                    {postComments.length > 0 && (
                      <div className="divide-y divide-[#1c1f26]/60">
                        {postComments.map((c) => (
                          <div key={c.id} className="px-4 py-3 flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-[#434d5e]/20 border border-[#434d5e]/30 flex-shrink-0 grid place-items-center">
                              <span className="text-[#d6deed] text-[10px] font-bold">
                                {initials(c.profiles?.email ?? '?')}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-xs font-medium text-white truncate">
                                  {c.profiles?.email ?? 'Usuário'}
                                </span>
                                {c.profiles?.role === 'monitor' && (
                                  <span className="text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded px-1 py-0.5 flex-shrink-0">
                                    Monitor
                                  </span>
                                )}
                                <span className="text-[10px] text-[#434d5e] flex-shrink-0">
                                  {timeAgo(c.created_at)}
                                </span>
                              </div>
                              <p className="text-xs text-[#d6deed] whitespace-pre-wrap leading-relaxed">
                                {c.content}
                              </p>
                            </div>
                            {canDeleteComment(c) && (
                              <button
                                onClick={() => deleteComment(post.id, c.id)}
                                className="text-[#434d5e] hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="px-4 py-3 flex items-center gap-2">
                      <input
                        value={newComment[post.id] ?? ''}
                        onChange={(e) =>
                          setNewComment((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            submitComment(post.id);
                          }
                        }}
                        placeholder="Escreva um comentário..."
                        maxLength={1000}
                        className="flex-1 bg-[#111] border border-[#1c1f26] rounded-md px-3 py-1.5 text-xs text-white placeholder:text-[#434d5e] focus:outline-none focus:border-[#434d5e] transition-colors"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={!(newComment[post.id] ?? '').trim()}
                        className="p-1.5 rounded-md text-[#cbfb00] disabled:text-[#434d5e] hover:bg-[#cbfb00]/10 transition-colors disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Toast message={toast?.msg ?? null} tone={toast?.tone} />
    </div>
  );
}
