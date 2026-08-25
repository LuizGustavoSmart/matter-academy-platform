import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, EmptyState, Badge, Skeleton, cn } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

type Block = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string; pendencias: number; capaUrl: string | null; faixa: string | null; matriculado: boolean };

export default function AtividadesIndex() {
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
  const nav = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) { setLoading(false); return; }
    (async () => {
      // is_staff ainda não está no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ut } = await (supabase as any).from('user_turmas').select('turma_id,curso_id,is_staff').eq('user_id', profile.id);
      const pairs = (ut ?? []) as { turma_id: string; curso_id: string | null; is_staff?: boolean }[];
      const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
      if (!turmaIds.length) { setBlocks([]); setLoading(false); return; }
      // is_staff só é relevante para professor/monitor — a coluna tem default
      // true no banco, então para aluno/embaixador ela não deve excluir nada.
      const isProfOrMonitor = profile.role === 'professor' || profile.role === 'monitor';
      const enrolledCursoIds = new Set(pairs.filter((p) => p.curso_id && (!isProfOrMonitor || !p.is_staff)).map((p) => p.curso_id as string));

      // Todos os cursos das turmas do aluno — os que ele não está matriculado
      // especificamente aparecem bloqueados.
      const { data: ctRows } = await supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds);
      const cursoIds = [...new Set([...enrolledCursoIds, ...(ctRows ?? []).map((r) => r.curso_id)])];
      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: turmas }, { data: cursos }] = await Promise.all([
        supabase.from('turmas').select('id,nome').in('id', turmaIds),
        cursoIds.length ? (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds) : Promise.resolve({ data: [] }),
      ]);
      type CursoRow = { id: string; titulo: string; capa_url: string | null; faixa: string | null };
      const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
      const cursoMap = new Map((cursos as CursoRow[] ?? []).map((c) => [c.id, c]));
      // Um bloco por turma+curso realmente vinculados via curso_turmas.
      const pares = (ctRows ?? []).map((r) => ({ turma_id: r.turma_id, curso_id: r.curso_id }));
      const list: Block[] = pares
        .filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
        .map((p) => ({
          turmaId: p.turma_id, turmaNome: turmaMap.get(p.turma_id)!.nome, cursoId: p.curso_id,
          cursoTitulo: cursoMap.get(p.curso_id)!.titulo, capaUrl: cursoMap.get(p.curso_id)!.capa_url, faixa: cursoMap.get(p.curso_id)!.faixa,
          pendencias: 0, matriculado: enrolledCursoIds.has(p.curso_id),
        }));

      // As 4 faixas sempre aparecem — a que ainda não tiver curso criado vira bloco bloqueado "virtual".
      turmaIds.forEach((tId) => {
        if (!turmaMap.has(tId)) return;
        const faixasDaTurma = new Set(list.filter((b) => b.turmaId === tId).map((b) => b.faixa));
        FAIXA_OPTIONS.filter((o) => !faixasDaTurma.has(o.value)).forEach((o) => {
          list.push({
            turmaId: tId, turmaNome: turmaMap.get(tId)!.nome, cursoId: `virtual-${tId}-${o.value}`,
            cursoTitulo: labelDaFaixa(o.value) ?? o.label, capaUrl: null, faixa: o.value, pendencias: 0, matriculado: false,
          });
        });
      });

      list.sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));
      setBlocks(list);
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Atividades" subtitle="Selecione uma faixa para ver suas atividades." />

      {loading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div> :
        blocks.length === 0 ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Nenhuma atividade disponível" description="Aguarde o administrador liberar conteúdo para suas turmas." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{blocks.map((b) => <BlockCard key={`${b.turmaId}:${b.cursoId}`} b={b} label={b.cursoTitulo} nav={nav} faixaCapas={faixaCapas} />)}</div>
        )}
    </div>
  );
}

function BlockCard({ b, label, showPend, nav, faixaCapas }: { b: Block; label: string; showPend?: boolean; nav: (path: string) => void; faixaCapas: Record<string, string | null> }) {
  const capa = resolveCapaUrl(b.capaUrl, b.faixa, faixaCapas);
  return (
    <Card
      className={cn('p-0 overflow-hidden transition-colors', b.matriculado ? 'cursor-pointer hover:border-brand/40' : 'cursor-default')}
      onClick={() => { if (b.matriculado) nav(`/atividades/${b.turmaId}/${b.cursoId}`); }}
    >
      <div className="relative h-40">
        {capa ? (
          <>
            <SignedImage bucket="capas" path={capa} className={cn('absolute inset-0 w-full h-full object-cover', !b.matriculado && 'grayscale opacity-40')} alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-brand/10 grid place-items-center"><ClipboardList className="w-6 h-6 text-brand" /></div>
        )}
        {!b.matriculado && (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 text-white/80" /><span className="text-white/90 text-xs font-semibold uppercase tracking-wider">Bloqueada</span>
          </div>
        )}
        {b.matriculado && showPend && b.pendencias > 0 && <Badge tone="warn" className="absolute top-2 right-2">{b.pendencias} pendente{b.pendencias > 1 ? 's' : ''}</Badge>}
      </div>
      <div className="p-4 pt-3"><p className="text-fg font-medium truncate">{label}</p></div>
    </Card>
  );
}
