import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, Trash2, Users, CheckCircle, HelpCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Badge, Avatar, EmptyState, Skeleton, useToast, useConfirm, cn } from '../../components/ui';

type PostTipo = 'duvida' | 'outros';
type PostStatus = 'aberta' | 'resolvida';
type Filtro = 'todos' | 'duvida' | 'duvida_aberta';
type Post = { id: string; user_id: string; content: string; tipo: PostTipo; status: PostStatus; created_at: string | null; profiles: { email: string; nome?: string | null; role?: string } | null };
type Comment = { id: string; user_id: string; content: string; created_at: string | null; profiles: { email: string; nome?: string | null; role?: string } | null };

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'agora mesmo';
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' }, { key: 'duvida', label: 'Dúvidas' }, { key: 'duvida_aberta', label: 'Dúvidas abertas' },
];

export default function StudentCommunity() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isMonitor = profile?.role === 'monitor';

  const [turma, setTurma] = useState<{ id: string; nome: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [newTipo, setNewTipo] = useState<PostTipo>('outros');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState<Filtro>(() => (searchParams.get('filtro') === 'duvidas' ? 'duvida_aberta' : 'todos'));

  const loadPosts = async () => {
    const { data } = await supabase.from('community_posts').select('*, profiles(email,nome,role)').eq('turma_id', turmaId!).order('created_at', { ascending: false });
    setPosts((data ?? []) as Post[]);
  };

  useEffect(() => {
    (async () => {
      if (!turmaId || !profile) return;
      const { data: member } = await supabase.from('user_turmas').select('turma_id').eq('turma_id', turmaId).eq('user_id', profile.id).maybeSingle();
      if (!member) { nav('/dashboard'); return; }
      const { data: t } = await supabase.from('turmas').select('id,nome').eq('id', turmaId).maybeSingle();
      if (!t) { nav('/dashboard'); return; }
      setTurma(t); await loadPosts(); setLoading(false);
    })();
  }, [turmaId, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!turmaId) return;
    const channel = supabase.channel(`community_posts:${turmaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts', filter: `turma_id=eq.${turmaId}` }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [turmaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canDeletePost = (p: Post) => p.user_id === profile?.id || isMonitor || profile?.role === 'admin';
  const canDeleteComment = (c: Comment) => c.user_id === profile?.id || isMonitor || profile?.role === 'admin';
  const canResolve = (p: Post) => p.tipo === 'duvida' && p.status === 'aberta' && (p.user_id === profile?.id || isMonitor);

  const submitPost = async () => {
    if (!newContent.trim() || !profile || !turmaId) return;
    setSubmitting(true);
    const { error } = await supabase.from('community_posts').insert({ turma_id: turmaId, user_id: profile.id, content: newContent.trim(), tipo: newTipo });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setNewContent(''); setNewTipo('outros'); loadPosts();
  };
  const resolvePost = async (postId: string) => {
    const { error } = await supabase.from('community_posts').update({ status: 'resolvida' }).eq('id', postId);
    if (error) { toast.error(error.message); return; }
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, status: 'resolvida' } : p));
    toast.success('Dúvida marcada como resolvida.');
  };
  const deletePost = async (postId: string) => {
    const ok = await confirm({ title: 'Excluir publicação', tone: 'danger', confirmLabel: 'Excluir', message: 'Excluir esta publicação e todos os comentários?' });
    if (!ok) return;
    const { error } = await supabase.from('community_posts').delete().eq('id', postId);
    if (error) { toast.error(error.message); return; }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (expandedPost === postId) setExpandedPost(null);
  };
  const loadComments = async (postId: string) => {
    if (comments[postId] !== undefined) return;
    const { data } = await supabase.from('community_comments').select('*, profiles(email,nome,role)').eq('post_id', postId).order('created_at', { ascending: true });
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
    const { data, error } = await supabase.from('community_comments').insert({ post_id: postId, user_id: profile.id, content: text }).select('*, profiles(email,nome,role)').single();
    if (error) { toast.error(error.message); return; }
    setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), data as Comment] }));
    setNewComment((prev) => ({ ...prev, [postId]: '' }));
  };
  const deleteComment = async (postId: string, commentId: string) => {
    const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
    if (error) { toast.error(error.message); return; }
    setComments((prev) => ({ ...prev, [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId) }));
  };

  const duvidasAbertas = posts.filter((p) => p.tipo === 'duvida' && p.status === 'aberta').length;
  const filteredPosts = posts.filter((p) => filtro === 'duvida' ? p.tipo === 'duvida' : filtro === 'duvida_aberta' ? (p.tipo === 'duvida' && p.status === 'aberta') : true);

  if (loading) return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8"><Skeleton className="h-10 w-48 mb-6" /><Skeleton className="h-32 rounded-xl mb-4" /><Skeleton className="h-40 rounded-xl" /></div>;
  if (!turma) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-fg mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center flex-shrink-0"><Users className="w-5 h-5 text-brand" /></span>
          <div><h1 className="mb-0">Comunidade</h1><p className="text-fg-3 text-sm">{turma.nome}</p></div>
        </div>
        {isMonitor && duvidasAbertas > 0 && (
          <button onClick={() => setFiltro('duvida_aberta')} className="flex-shrink-0 bg-warn/10 border border-warn/30 rounded-lg px-3 py-2 text-center hover:bg-warn/20 transition-colors">
            <p className="text-warn font-bold text-lg leading-none tabular-nums">{duvidasAbertas}</p>
            <p className="text-warn/70 text-xs mt-0.5">{duvidasAbertas === 1 ? 'dúvida aberta' : 'dúvidas abertas'}</p>
          </button>
        )}
      </div>

      {/* Compose */}
      <div className="bg-panel border border-line rounded-xl p-4 mb-6">
        <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Compartilhe algo com a turma…" rows={3} maxLength={2000}
          className="w-full !bg-transparent !border-0 !p-0 resize-none text-sm text-fg placeholder:text-fg-3 focus:!ring-0 focus:!shadow-none"
          style={{ boxShadow: 'none' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost(); }} />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <select value={newTipo} onChange={(e) => setNewTipo(e.target.value as PostTipo)} className="!w-auto !py-1.5 !px-2 !text-xs cursor-pointer">
              <option value="outros">Outros</option><option value="duvida">Dúvida</option>
            </select>
            <span className="text-xs text-fg-3 hidden sm:inline">{newContent.length > 0 ? `${newContent.length}/2000` : 'Ctrl+Enter para publicar'}</span>
          </div>
          <Button variant="primary" icon={<Send className="w-4 h-4" />} onClick={submitPost} loading={submitting} disabled={!newContent.trim()}>Publicar</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-thin pb-1">
        {FILTROS.map(({ key, label }) => (
          <button key={key} onClick={() => setFiltro(key)} className={cn('flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border', filtro === key ? 'bg-brand text-brand-ink border-brand' : 'bg-panel border-line text-fg-2 hover:border-line-strong')}>
            {label}
            {key === 'duvida_aberta' && duvidasAbertas > 0 && <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold', filtro === key ? 'bg-brand-ink/20 text-brand-ink' : 'bg-warn/20 text-warn')}>{duvidasAbertas}</span>}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filteredPosts.length === 0 ? (
        <EmptyState icon={<MessageSquare className="w-8 h-8" />} title={filtro === 'todos' ? 'Nenhuma publicação ainda' : 'Nenhum resultado para este filtro'}
          description={filtro === 'todos' ? 'Seja o primeiro a compartilhar algo com a turma.' : 'Tente selecionar outro filtro.'} />
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const isExpanded = expandedPost === post.id;
            const postComments = comments[post.id] ?? [];
            const isDuvida = post.tipo === 'duvida';
            const isResolvida = post.status === 'resolvida';
            return (
              <div key={post.id} className={cn('bg-panel border rounded-xl overflow-hidden transition-all', isResolvida ? 'border-brand/20 opacity-80' : isDuvida ? 'border-warn/30' : 'border-line')}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={post.profiles?.nome} email={post.profiles?.email} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-fg truncate">{post.profiles?.nome || post.profiles?.email || 'Usuário'}</span>
                        {post.profiles?.role === 'monitor' && <Badge tone="info">Monitor</Badge>}
                        {isDuvida && (isResolvida ? <Badge tone="success"><CheckCircle className="w-2.5 h-2.5" /> Resolvida</Badge> : <Badge tone="warn"><HelpCircle className="w-2.5 h-2.5" /> Dúvida</Badge>)}
                        <span className="text-xs text-fg-3 flex-shrink-0">{timeAgo(post.created_at)}</span>
                      </div>
                      <p className="text-sm text-fg-2 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                  <button onClick={() => toggleExpand(post.id)} className={cn('flex items-center gap-1.5 text-xs transition-colors', isExpanded ? 'text-brand' : 'text-fg-3 hover:text-fg-2')}><MessageSquare className="w-3.5 h-3.5" /> Comentários</button>
                  {canResolve(post) && <button onClick={() => resolvePost(post.id)} className="flex items-center gap-1.5 text-xs text-fg-3 hover:text-brand transition-colors"><CheckCircle className="w-3.5 h-3.5" /> Marcar resolvida</button>}
                  {canDeletePost(post) && <button onClick={() => deletePost(post.id)} aria-label="Excluir publicação" className="ml-auto flex items-center gap-1 text-xs text-fg-3 hover:text-danger transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
                {isExpanded && (
                  <div className="border-t border-line bg-canvas/40">
                    {postComments.length > 0 && (
                      <div className="divide-y divide-line/60">
                        {postComments.map((c) => (
                          <div key={c.id} className="px-4 py-3 flex items-start gap-2.5">
                            <Avatar name={c.profiles?.nome} email={c.profiles?.email} size={24} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-xs font-medium text-fg truncate">{c.profiles?.nome || c.profiles?.email || 'Usuário'}</span>
                                {c.profiles?.role === 'monitor' && <Badge tone="info">Monitor</Badge>}
                                <span className="text-[10px] text-fg-3 flex-shrink-0">{timeAgo(c.created_at)}</span>
                              </div>
                              <p className="text-xs text-fg-2 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                            </div>
                            {canDeleteComment(c) && <button onClick={() => deleteComment(post.id, c.id)} aria-label="Excluir comentário" className="text-fg-3 hover:text-danger transition-colors flex-shrink-0 mt-0.5"><Trash2 className="w-3 h-3" /></button>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-4 py-3 flex items-center gap-2">
                      <input value={newComment[post.id] ?? ''} onChange={(e) => setNewComment((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(post.id); } }}
                        placeholder="Escreva um comentário…" maxLength={1000} className="flex-1 !py-1.5 !text-xs" />
                      <button onClick={() => submitComment(post.id)} disabled={!(newComment[post.id] ?? '').trim()} aria-label="Enviar comentário" className="p-1.5 rounded-md text-brand disabled:text-fg-3 hover:bg-brand/10 transition-colors disabled:cursor-not-allowed"><Send className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
