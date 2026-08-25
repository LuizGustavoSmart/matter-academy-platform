import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { BookOpen, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Badge, EmptyState, Skeleton } from '../../components/ui';
import { SignedImage } from '../../components/SignedImage';
import { labelDaFaixa, ordemDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

type Bloco = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string; cursoDescricao: string | null; capaUrl: string | null; faixa: string | null };

export default function MinhasTurmas() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const faixaCapas = useFaixaCapas();
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';
  const isEmbaixador = profile?.role === 'embaixador';
  const canView = isStaff || isEmbaixador;
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !canView) { setLoading(false); return; }
    (async () => {
      // is_embaixador/is_staff ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: ut } = isEmbaixador
        ? await sb.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id).eq('is_embaixador', true)
        : isStaff
          ? await sb.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id).eq('is_staff', true)
          : await sb.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
      // Só os pares turma+curso onde o usuário realmente é embaixador/staff — não a turma inteira.
      const pares = ((ut ?? []) as { turma_id: string; curso_id: string | null }[]).filter((r) => r.curso_id);
      const turmaIds = [...new Set(pares.map((r) => r.turma_id))];
      if (!turmaIds.length) { setBlocos([]); setLoading(false); return; }
      const [{ data: turmas }, { data: cts }] = await Promise.all([
        supabase.from('turmas').select('id,nome').in('id', turmaIds),
        supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds),
      ]);
      const cursoIds = [...new Set(pares.map((r) => r.curso_id as string))];
      type CursoRow = { id: string; titulo: string; descricao: string | null; capa_url: string | null; faixa: string | null };
      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cursos } = cursoIds.length
        ? await (supabase as any).from('cursos').select('id,titulo,descricao,capa_url,faixa').in('id', cursoIds)
        : { data: [] as CursoRow[] };
      const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t.nome]));
      const cursoMap = new Map((cursos as CursoRow[] ?? []).map((c) => [c.id, c]));
      const cursoTurmaValido = new Set((cts ?? []).map((r) => `${r.turma_id}:${r.curso_id}`));
      const list: Bloco[] = pares
        .filter((r) => turmaMap.has(r.turma_id) && cursoMap.has(r.curso_id as string) && cursoTurmaValido.has(`${r.turma_id}:${r.curso_id}`))
        .map((r) => {
          const c = cursoMap.get(r.curso_id as string)!;
          return { turmaId: r.turma_id, turmaNome: turmaMap.get(r.turma_id)!, cursoId: r.curso_id as string, cursoTitulo: c.titulo, cursoDescricao: c.descricao, capaUrl: c.capa_url, faixa: c.faixa };
        })
        .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome) || ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));
      setBlocos(list);
      setLoading(false);
    })();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (profile && !canView) return <Navigate to="/dashboard" replace />;

  const turmaNomes = [...new Set(blocos.map((b) => b.turmaNome))];
  const multiTurma = turmaNomes.length > 1;

  const renderBloco = (b: Bloco) => {
    const capa = resolveCapaUrl(b.capaUrl, b.faixa, faixaCapas);
    return (
      <Card key={`${b.turmaId}:${b.cursoId}`} className="p-0 overflow-hidden cursor-pointer hover:border-brand/40 transition-colors" onClick={() => nav(`/turmas/${b.turmaId}/cursos/${b.cursoId}`)}>
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
          {labelDaFaixa(b.faixa) && <Badge tone="outline" className="mb-2">{labelDaFaixa(b.faixa)}</Badge>}
          <h3 className="mb-1 line-clamp-1">{b.cursoTitulo}</h3>
          <p className="text-fg-3 text-sm line-clamp-2 min-h-[40px]">{b.cursoDescricao || 'Sem descrição'}</p>
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-7">
        <h1 className="mb-1">Cursos</h1>
        <p className="text-fg-3">{isEmbaixador ? 'Cursos das turmas que você acompanha como embaixador.' : 'Cursos das turmas em que você atua como professor ou monitor.'}</p>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
      ) : blocos.length === 0 ? (
        <EmptyState icon={<Layers className="w-8 h-8" />} title="Nenhum curso disponível" description="O administrador precisa te atribuir a uma turma com cursos." />
      ) : multiTurma ? (
        <div className="space-y-8">
          {turmaNomes.map((nome) => (
            <div key={nome}>
              <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-3">{nome}</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{blocos.filter((b) => b.turmaNome === nome).map(renderBloco)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{blocos.map(renderBloco)}</div>
      )}
    </div>
  );
}
