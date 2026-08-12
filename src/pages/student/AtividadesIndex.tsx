import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Badge, Skeleton } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { SignedImage } from '../../components/SignedImage';
import { ordemDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

type Block = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string; pendencias: number; capaUrl: string | null; faixa: string | null };

export default function AtividadesIndex() {
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
  const nav = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    (async () => {
      if (isStaff) {
        const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
        const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
        if (!turmaIds.length) { setBlocks([]); setLoading(false); return; }
        const [{ data: turmas }, { data: cts }] = await Promise.all([
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds),
        ]);
        const cursoIds = [...new Set((cts ?? []).map((r) => r.curso_id))];
        // faixa/capa_url ainda não estão no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type CursoRow = { id: string; titulo: string; capa_url: string | null; faixa: string | null };
        const { data: cursos } = cursoIds.length
          ? await (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds)
          : { data: [] as CursoRow[] };
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
        const cursoMap = new Map((cursos as CursoRow[] ?? []).map((c) => [c.id, c]));
        const pairs = (cts ?? []).map((r) => ({ turma_id: r.turma_id, curso_id: r.curso_id }));
        const { data: atividades } = pairs.length ? await supabase.from('atividades').select('id,turma_id,curso_id').in('turma_id', turmaIds) : { data: [] };
        const atividadeIds = (atividades ?? []).map((a) => a.id);
        const { data: envios } = atividadeIds.length ? await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota').in('atividade_id', atividadeIds) : { data: [] };
        const pendMap: Record<string, number> = {};
        (atividades ?? []).forEach((a) => {
          const key = `${a.turma_id}:${a.curso_id}`;
          const pend = (envios ?? []).filter((e) => e.atividade_id === a.id && e.enviado_em && e.nota === null).length;
          pendMap[key] = (pendMap[key] ?? 0) + pend;
        });
        const list: Block[] = pairs
          .filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
          .map((p) => ({
            turmaId: p.turma_id, turmaNome: turmaMap.get(p.turma_id)!.nome, cursoId: p.curso_id,
            cursoTitulo: cursoMap.get(p.curso_id)!.titulo, capaUrl: cursoMap.get(p.curso_id)!.capa_url, faixa: cursoMap.get(p.curso_id)!.faixa,
            pendencias: pendMap[`${p.turma_id}:${p.curso_id}`] ?? 0,
          }))
          .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome) || ordemDaFaixa(cursoMap.get(a.cursoId)?.faixa) - ordemDaFaixa(cursoMap.get(b.cursoId)?.faixa));
        setBlocks(list);
      } else {
        const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id).not('curso_id', 'is', null);
        const pairs = (ut ?? []) as { turma_id: string; curso_id: string }[];
        if (!pairs.length) { setBlocks([]); setLoading(false); return; }
        const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
        const cursoIds = [...new Set(pairs.map((p) => p.curso_id))];
        // faixa/capa_url ainda não estão no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [{ data: turmas }, { data: cursos }] = await Promise.all([
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds),
        ]);
        type CursoRow = { id: string; titulo: string; capa_url: string | null; faixa: string | null };
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
        const cursoMap = new Map((cursos as CursoRow[] ?? []).map((c) => [c.id, c]));
        const list: Block[] = pairs
          .filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
          .map((p) => ({
            turmaId: p.turma_id, turmaNome: turmaMap.get(p.turma_id)!.nome, cursoId: p.curso_id,
            cursoTitulo: cursoMap.get(p.curso_id)!.titulo, capaUrl: cursoMap.get(p.curso_id)!.capa_url, faixa: cursoMap.get(p.curso_id)!.faixa, pendencias: 0,
          }))
          .sort((a, b) => ordemDaFaixa(cursoMap.get(a.cursoId)?.faixa) - ordemDaFaixa(cursoMap.get(b.cursoId)?.faixa));
        setBlocks(list);
      }
      setLoading(false);
    })();
  }, [profile, isStaff]);

  const turmaIds = [...new Set(blocks.map((b) => b.turmaId))];
  const multiTurma = turmaIds.length > 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Atividades" subtitle={isStaff ? 'Selecione uma turma para ver e corrigir as atividades.' : 'Selecione uma faixa para ver suas atividades.'} />

      {loading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div> :
        blocks.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhuma atividade disponível" description={isStaff ? 'Você ainda não está atribuído a nenhuma turma.' : 'Aguarde o administrador liberar conteúdo para suas turmas.'} />
        ) : (isStaff && multiTurma) ? (
          <div className="space-y-8">
            {turmaIds.map((tId) => {
              const group = blocks.filter((b) => b.turmaId === tId);
              return (
                <div key={tId}>
                  <p className="text-fg-3 text-[11px] font-semibold uppercase tracking-wider mb-3">{group[0].turmaNome}</p>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{group.map((b) => <BlockCard key={`${b.turmaId}:${b.cursoId}`} b={b} label={b.cursoTitulo} showPend={isStaff} nav={nav} faixaCapas={faixaCapas} />)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{blocks.map((b) => <BlockCard key={`${b.turmaId}:${b.cursoId}`} b={b} label={isStaff ? `${b.turmaNome} · ${b.cursoTitulo}` : b.cursoTitulo} showPend={isStaff} nav={nav} faixaCapas={faixaCapas} />)}</div>
        )}
    </div>
  );
}

function BlockCard({ b, label, showPend, nav, faixaCapas }: { b: Block; label: string; showPend?: boolean; nav: (path: string) => void; faixaCapas: Record<string, string | null> }) {
  const capa = resolveCapaUrl(b.capaUrl, b.faixa, faixaCapas);
  return (
    <Card className="p-0 overflow-hidden cursor-pointer hover:border-brand/40 transition-colors" onClick={() => nav(`/atividades/${b.turmaId}/${b.cursoId}`)}>
      <div className="relative h-40">
        {capa ? (
          <>
            <SignedImage bucket="capas" path={capa} className="absolute inset-0 w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-brand/10 grid place-items-center"><ClipboardList className="w-6 h-6 text-brand" /></div>
        )}
        {showPend && b.pendencias > 0 && <Badge tone="warn" className="absolute top-2 right-2">{b.pendencias} pendente{b.pendencias > 1 ? 's' : ''}</Badge>}
      </div>
      <div className="p-4 pt-3"><p className="text-fg font-medium truncate">{label}</p></div>
    </Card>
  );
}
