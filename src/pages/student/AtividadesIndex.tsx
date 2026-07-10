import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Empty, Badge } from '../../components/ui';

type Block = { turmaId: string; turmaNome: string; cursoId: string; cursoTitulo: string; pendencias: number };

export default function AtividadesIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  const isStaff = profile?.role === 'professor' || profile?.role === 'monitor';

  useEffect(() => {
    if (!profile) { setLoading(false); return; }

    (async () => {
      if (isStaff) {
        // Turmas em que o professor está atribuído
        const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
        const turmaIds = [...new Set((ut ?? []).map((r: any) => r.turma_id))];
        if (!turmaIds.length) { setBlocks([]); setLoading(false); return; }

        const [{ data: turmas }, { data: cts }] = await Promise.all([
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('curso_turmas').select('turma_id,curso_id').in('turma_id', turmaIds),
        ]);
        const cursoIds = [...new Set((cts ?? []).map((r: any) => r.curso_id))];
        const { data: cursos } = cursoIds.length
          ? await supabase.from('cursos').select('id,titulo').in('id', cursoIds)
          : { data: [] };

        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c]));

        const pairs = (cts ?? []).map((r: any) => ({ turma_id: r.turma_id, curso_id: r.curso_id }));
        const atividadeIds: string[] = [];
        const { data: atividades } = pairs.length
          ? await supabase.from('atividades').select('id,turma_id,curso_id').in('turma_id', turmaIds)
          : { data: [] };
        (atividades ?? []).forEach((a: any) => atividadeIds.push(a.id));

        const { data: envios } = atividadeIds.length
          ? await supabase.from('atividade_envios').select('atividade_id,enviado_em,nota').in('atividade_id', atividadeIds)
          : { data: [] };

        const pendMap: Record<string, number> = {};
        (atividades ?? []).forEach((a: any) => {
          const key = `${a.turma_id}:${a.curso_id}`;
          const pend = (envios ?? []).filter((e: any) => e.atividade_id === a.id && e.enviado_em && e.nota === null).length;
          pendMap[key] = (pendMap[key] ?? 0) + pend;
        });

        const list: Block[] = pairs
          .filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
          .map((p) => ({
            turmaId: p.turma_id,
            turmaNome: turmaMap.get(p.turma_id)!.nome,
            cursoId: p.curso_id,
            cursoTitulo: cursoMap.get(p.curso_id)!.titulo,
            pendencias: pendMap[`${p.turma_id}:${p.curso_id}`] ?? 0,
          }))
          .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome) || a.cursoTitulo.localeCompare(b.cursoTitulo));

        setBlocks(list);
      } else {
        // Aluno: turmas/cursos liberados
        const { data: ut } = await supabase
          .from('user_turmas')
          .select('turma_id,curso_id')
          .eq('user_id', profile.id)
          .not('curso_id', 'is', null);

        const pairs = (ut ?? []) as { turma_id: string; curso_id: string }[];
        if (!pairs.length) { setBlocks([]); setLoading(false); return; }

        const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
        const cursoIds = [...new Set(pairs.map((p) => p.curso_id))];

        const [{ data: turmas }, { data: cursos }] = await Promise.all([
          supabase.from('turmas').select('id,nome').in('id', turmaIds),
          supabase.from('cursos').select('id,titulo').in('id', cursoIds),
        ]);
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t]));
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c]));

        const list: Block[] = pairs
          .filter((p) => turmaMap.has(p.turma_id) && cursoMap.has(p.curso_id))
          .map((p) => ({
            turmaId: p.turma_id,
            turmaNome: turmaMap.get(p.turma_id)!.nome,
            cursoId: p.curso_id,
            cursoTitulo: cursoMap.get(p.curso_id)!.titulo,
            pendencias: 0,
          }));

        setBlocks(list);
      }
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="mb-2">Atividades</h1>
        <p className="text-[#d6deed]">
          {isStaff ? 'Selecione uma turma para ver e corrigir as atividades.' : 'Selecione uma faixa para ver suas atividades.'}
        </p>
      </div>

      {loading ? <p className="meta">Carregando...</p> :
        blocks.length === 0 ? (
          <Empty
            icon={<ClipboardList className="w-10 h-10" />}
            title="Nenhuma atividade disponível"
            description={isStaff ? 'Você ainda não está atribuído a nenhuma turma' : 'Aguarde o administrador liberar conteúdo para suas turmas'}
          />
        ) : isStaff ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {blocks.map((b) => (
              <BlockCard key={`${b.turmaId}:${b.cursoId}`} b={b} label={`${b.turmaNome} ${b.cursoTitulo}`} showPend nav={nav} />
            ))}
          </div>
        ) : (
          (() => {
            const turmaIds = [...new Set(blocks.map((b) => b.turmaId))];
            const multiTurma = turmaIds.length > 1;
            if (!multiTurma) {
              return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {blocks.map((b) => (
                    <BlockCard key={`${b.turmaId}:${b.cursoId}`} b={b} label={b.cursoTitulo} nav={nav} />
                  ))}
                </div>
              );
            }
            return (
              <div className="space-y-8">
                {turmaIds.map((tId) => {
                  const group = blocks.filter((b) => b.turmaId === tId);
                  return (
                    <div key={tId}>
                      <p className="meta uppercase tracking-wider mb-3">{group[0].turmaNome}</p>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {group.map((b) => (
                          <BlockCard key={`${b.turmaId}:${b.cursoId}`} b={b} label={b.cursoTitulo} nav={nav} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
    </div>
  );
}

function BlockCard({ b, label, showPend, nav }: { b: Block; label: string; showPend?: boolean; nav: (path: string) => void }) {
  return (
    <Card
      className="p-5 flex flex-col gap-4 cursor-pointer hover:border-[#cbfb00]/40 transition-colors"
      onClick={() => nav(`/atividades/${b.turmaId}/${b.cursoId}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md bg-[#cbfb00]/10 border border-[#cbfb00]/20 grid place-items-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-[#cbfb00]" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{label}</p>
          </div>
        </div>
        {showPend && b.pendencias > 0 && (
          <Badge tone="warn">{b.pendencias} pendente{b.pendencias > 1 ? 's' : ''}</Badge>
        )}
      </div>
    </Card>
  );
}
