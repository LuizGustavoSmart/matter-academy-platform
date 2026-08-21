import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, PlayCircle, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Avatar, cn } from '../../components/ui';
import { SignedImage } from '../../components/SignedImage';
import { FAIXA_OPTIONS, FAIXA_DOT_CLASS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';
import { useFaixaCapas, resolveCapaUrl } from '../../lib/faixaCapas';

const AULAS_POR_FAIXA = 12;
const COLS = 4;

/* ── Constantes de layout — usadas tanto para renderizar quanto para
   calcular a posição vertical exata dos marcos nas laterais. ── */
const TILE = 72;
const ROW_H = 96;
const ROW_CONNECTOR_H = 28;
const BANNER_H = 168;
const BANNER_CONNECTOR_H = 24;
const BOARD_W = COLS * TILE + (COLS - 1) * 12;
const GUTTER_W = 248;

type Aula = { id: string; titulo: string; ordem: number };
type Curso = { id: string; titulo: string; capaUrl: string | null; faixa: string | null };
type Slot = { ordem: number; aula: Aula | null; done: boolean; isCurrent: boolean };
type Marco = { titulo: string; desc: string };
type MarcoPosicionado = Marco & { yCenter: number; side: 'left' | 'right' };

const MARCOS: Record<string, { ordem: number; titulo: string; desc: string }[]> = {
  branca: [
    { ordem: 3, titulo: 'Aula 3 — Usuário Profissional de IA', desc: 'Usa IA generativa de forma profissional, dominando os fundamentos, o ChatGPT e a lógica necessária para transformar tarefas do dia a dia em resultados melhores.' },
    { ordem: 6, titulo: 'Aula 6 — Especialista em Prompt & Pesquisa', desc: 'Estrutura interações mais sofisticadas com IA, utilizando técnicas avançadas de prompting para pesquisar, sintetizar informações e produzir relatórios com mais qualidade e precisão.' },
    { ordem: 9, titulo: 'Aula 9 — Criador Multimídia com IA', desc: 'Amplia a IA para diferentes formatos de trabalho, criando conteúdos visuais e apresentações e utilizando IA para interpretar, explorar e analisar dados.' },
    { ordem: 12, titulo: 'Final — Profissional AI-First', desc: 'Integra IA à sua rotina de trabalho, organizando sua produtividade, estruturando diferentes ferramentas e aplicando princípios de uso responsável para transformar tarefas em fluxos mais eficientes.' },
  ],
  verde: [
    { ordem: 3, titulo: 'Aula 3 — Profissional Multi-IA', desc: 'Combina diferentes ferramentas de IA para pesquisar, analisar e tomar decisões, entendendo como aplicar IA para aumentar produtividade e gerar retorno nos processos de trabalho.' },
    { ordem: 6, titulo: 'Aula 6 — Arquiteto de Processos AI-First', desc: 'Redesenha processos incorporando agentes e múltiplas IAs, transformando atividades tradicionais em fluxos AI-First e criando protótipos de novas formas de trabalhar.' },
    { ordem: 9, titulo: 'Aula 9 — Construtor de Automações', desc: 'Transforma processos redesenhados em automações integradas, conectando ferramentas como Zapier, Make, n8n e Power Automate para reduzir tarefas manuais e fazer diferentes sistemas trabalharem juntos.' },
    { ordem: 12, titulo: 'Final — Profissional AI-First de Processos', desc: 'Projeta, automatiza e avalia processos de ponta a ponta, equilibrando produtividade, integração, governança e limites da automação para gerar ganhos reais e sustentáveis.' },
  ],
  marrom: [
    { ordem: 3, titulo: 'Aula 3 — Construtor de Agentes', desc: 'Cria agentes de IA especializados, definindo seu propósito e incorporando conhecimento para resolver problemas específicos de forma mais consistente.' },
    { ordem: 6, titulo: 'Aula 6 — Prototipador de Produtos AI', desc: 'Transforma agentes em produtos funcionais, utilizando vibe coding, dados vivos e diferentes componentes para construir soluções que vão além de uma simples conversa com IA.' },
    { ordem: 9, titulo: 'Aula 9 — Construtor de Produtos Autônomos', desc: 'Cria produtos capazes de interagir com o mundo e executar ações, conectando-se a sistemas e dados externos com maior autonomia, qualidade e robustez.' },
    { ordem: 12, titulo: 'Final — Criador de Negócios com IA', desc: 'Transforma uma solução de IA em uma proposta de produto viável, entendendo arquitetura, custos e business case e demonstrando seu funcionamento em um produto real.' },
  ],
  preta: [
    { ordem: 3, titulo: 'Aula 3 — Estrategista de IA', desc: 'Enxerga IA a partir da perspectiva do negócio, avaliando a maturidade da organização e construindo uma narrativa estratégica para orientar sua transformação.' },
    { ordem: 6, titulo: 'Aula 6 — Líder da Transformação AI-First', desc: 'Cria as bases para uma transformação organizacional, estruturando governança, cultura e capacitação para que a adoção de IA aconteça de forma consistente e em escala.' },
    { ordem: 9, titulo: 'Aula 9 — Orquestrador da Transformação', desc: 'Transforma estratégia em prioridades e ação, mobilizando stakeholders, conduzindo a mudança e estabelecendo métricas para acompanhar o impacto das iniciativas de IA.' },
    { ordem: 12, titulo: 'Final — Líder Estratégico de IA', desc: 'Constrói e defende uma estratégia de IA para a organização, conectando visão de futuro, prioridades, governança, cultura, capacitação e métricas em um plano estratégico executável.' },
  ],
};

/** Agrupa em linhas de `cols`, invertendo as linhas ímpares — o "efeito cobra" do tabuleiro. */
function paraLinhasEmCobra<T>(itens: T[], cols: number): T[][] {
  const linhas: T[][] = [];
  for (let i = 0; i < itens.length; i += cols) linhas.push(itens.slice(i, i + cols));
  return linhas.map((linha, i) => (i % 2 === 1 ? [...linha].reverse() : linha));
}

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const faixaCapas = useFaixaCapas();
  const nav = useNavigate();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [slotsPorCurso, setSlotsPorCurso] = useState<Record<string, Slot[]>>({});
  const [currentSlotKey, setCurrentSlotKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: ut } = await supabase.from('user_turmas').select('turma_id').eq('user_id', profile.id);
      const turmaIds = [...new Set((ut ?? []).map((r) => r.turma_id))];
      if (!turmaIds.length) { setCursos([]); setLoading(false); return; }

      const { data: ctRows } = await supabase.from('curso_turmas').select('curso_id').in('turma_id', turmaIds);
      const cursoIds = [...new Set((ctRows ?? []).map((r) => r.curso_id))];
      if (!cursoIds.length) { setCursos([]); setLoading(false); return; }

      // faixa/capa_url ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cs } = await (supabase as any).from('cursos').select('id,titulo,capa_url,faixa').in('id', cursoIds);
      const cursosReais: Curso[] = ((cs ?? []) as { id: string; titulo: string; capa_url: string | null; faixa: string | null }[])
        .map((c) => ({ id: c.id, titulo: c.titulo, capaUrl: c.capa_url, faixa: c.faixa }));

      // As 4 faixas sempre aparecem — a que ainda não existe na plataforma
      // vira um bloco "virtual" sem aulas (mostrado como "em breve").
      const faixasPresentes = new Set(cursosReais.map((c) => c.faixa));
      const cursosVirtuais: Curso[] = FAIXA_OPTIONS
        .filter((o) => !faixasPresentes.has(o.value))
        .map((o) => ({ id: `virtual-${o.value}`, titulo: labelDaFaixa(o.value) ?? o.label, capaUrl: null, faixa: o.value }));

      const cursosOrdenados: Curso[] = [...cursosReais, ...cursosVirtuais].sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));

      const cursoIdsReais = cursosReais.map((c) => c.id);
      // lessons_public é uma view não tipada no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: as_ } = cursoIdsReais.length ? await (supabase as any).from('lessons_public').select('id,titulo,ordem,curso_id').in('curso_id', cursoIdsReais) : { data: [] };
      const aulasPorCurso: Record<string, Aula[]> = {};
      (as_ ?? []).forEach((a: { id: string; titulo: string; ordem: number; curso_id: string }) => {
        (aulasPorCurso[a.curso_id] ??= []).push({ id: a.id, titulo: a.titulo, ordem: a.ordem });
      });

      const { data: ps } = await supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true);
      const doneSet = new Set((ps ?? []).map((p) => p.aula_id));

      let currentKey: string | null = null;
      const map: Record<string, Slot[]> = {};
      for (const curso of cursosOrdenados) {
        const vistas = new Set<string>();
        const aulasReais = [...(aulasPorCurso[curso.id] ?? [])]
          .sort((a, b) => a.ordem - b.ordem)
          .filter((a) => { if (vistas.has(a.id)) return false; vistas.add(a.id); return true; });
        const porOrdem = new Map(aulasReais.map((a, i) => [i + 1, a]));
        const total = Math.max(AULAS_POR_FAIXA, aulasReais.length);
        const slots: Slot[] = [];
        for (let ordem = 1; ordem <= total; ordem++) {
          const aula = porOrdem.get(ordem) ?? null;
          const done = aula ? doneSet.has(aula.id) : false;
          slots.push({ ordem, aula, done, isCurrent: false });
        }
        map[curso.id] = slots;
        if (!currentKey) {
          const proxima = slots.find((s) => s.aula && !s.done);
          if (proxima) currentKey = `${curso.id}:${proxima.ordem}`;
        }
      }
      if (currentKey) {
        const [cid, ordemStr] = currentKey.split(':');
        const ordem = Number(ordemStr);
        const slot = map[cid]?.find((s) => s.ordem === ordem);
        if (slot) slot.isCurrent = true;
      }

      setCursos(cursosOrdenados);
      setSlotsPorCurso(map);
      setCurrentSlotKey(currentKey);
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (loading || scrolledRef.current || !currentSlotKey) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => {
      document.getElementById(`slot-${currentSlotKey}`)?.scrollIntoView({ block: 'center' });
    });
  }, [loading, currentSlotKey]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-8 text-center">
        <h1 className="mb-0.5">Cronograma</h1>
        <p className="text-fg-3 text-sm">Sua trilha de aulas — avance faixa por faixa, como num tabuleiro.</p>
      </header>

      {loading ? (
        <div className="space-y-4 max-w-md mx-auto">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : cursos.length === 0 ? (
        <p className="text-fg-3 text-sm text-center">Aguarde o administrador liberar conteúdo para suas turmas.</p>
      ) : (
        <Board cursos={cursos} slotsPorCurso={slotsPorCurso} currentSlotKey={currentSlotKey} nav={nav} faixaCapas={faixaCapas} profile={profile} />
      )}
    </div>
  );
}

function Board({ cursos, slotsPorCurso, currentSlotKey, nav, faixaCapas, profile }: {
  cursos: Curso[]; slotsPorCurso: Record<string, Slot[]>; currentSlotKey: string | null;
  nav: (path: string) => void; faixaCapas: Record<string, string | null>;
  profile: { nome?: string | null; email?: string; avatar_url?: string | null } | null;
}) {
  // Uma única passada monta o board e já calcula, em pixels, a posição
  // vertical exata de cada marco — assim as laterais alinham perfeitamente
  // com a linha do tabuleiro em que ele acontece, sem depender de medir o DOM.
  const blocks: { key: string; height: number; render: () => ReactNode }[] = [];
  const marcos: MarcoPosicionado[] = [];
  let y = 0;

  cursos.forEach((curso, cursoIdx) => {
    const capa = resolveCapaUrl(curso.capaUrl, curso.faixa, faixaCapas);
    const marcosDoCurso = curso.faixa ? MARCOS[curso.faixa] ?? [] : [];
    blocks.push({
      key: `banner-${curso.id}`, height: BANNER_H,
      render: () => (
        <div className="text-center" style={{ width: BOARD_W }}>
          <div className="relative rounded-xl overflow-hidden h-[104px] mb-2">
            {capa ? <SignedImage bucket="capas" path={capa} className="absolute inset-0 w-full h-full object-cover" alt="" /> : <div className="absolute inset-0 bg-brand/10" />}
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className={cn('w-3 h-3 rounded-full flex-shrink-0', FAIXA_DOT_CLASS[curso.faixa ?? ''] ?? 'bg-line')} />
            <h2 className="text-fg text-sm font-medium truncate">{curso.titulo}</h2>
          </div>
        </div>
      ),
    });
    y += BANNER_H;
    blocks.push({ key: `bannerConn-${curso.id}`, height: BANNER_CONNECTOR_H, render: () => <ConnectorStub side="center" /> });
    y += BANNER_CONNECTOR_H;

    const slots = slotsPorCurso[curso.id] ?? [];
    const linhas = paraLinhasEmCobra(slots, COLS);

    linhas.forEach((linha, linhaIdx) => {
      const rowTop = y;
      const marcosDaLinha: Marco[] = [];
      linha.forEach((slot, colIdx) => {
        const marco = marcosDoCurso.find((m) => m.ordem === slot.ordem);
        if (marco) {
          marcos.push({ ...marco, yCenter: rowTop + ROW_H / 2, side: colIdx < COLS / 2 ? 'left' : 'right' });
          marcosDaLinha.push(marco);
        }
      });
      blocks.push({
        key: `row-${curso.id}-${linhaIdx}`, height: ROW_H,
        render: () => (
          <>
            <div className="flex items-center justify-between" style={{ width: BOARD_W, height: ROW_H }}>
              {linha.map((slot) => (
                <TileButton key={slot.ordem} slot={slot} cursoId={curso.id} nav={nav} isCurrent={`${curso.id}:${slot.ordem}` === currentSlotKey} profile={profile} />
              ))}
            </div>
            {marcosDaLinha.length > 0 && (
              <div className="lg:hidden w-full space-y-2 my-2">
                {marcosDaLinha.map((m, i) => (
                  <div key={i} className="rounded-lg border border-line bg-panel-2/70 p-3 text-xs">
                    <p className="text-fg font-semibold leading-snug mb-1">{m.titulo}</p>
                    <p className="text-fg-3 leading-snug">{m.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ),
      });
      y += ROW_H;
      if (linhaIdx < linhas.length - 1) {
        const side: 'left' | 'right' = linhaIdx % 2 === 0 ? 'right' : 'left';
        blocks.push({ key: `rowConn-${curso.id}-${linhaIdx}`, height: ROW_CONNECTOR_H, render: () => <ConnectorStub side={side} /> });
        y += ROW_CONNECTOR_H;
      }
    });

    if (cursoIdx < cursos.length - 1) {
      blocks.push({ key: `faixaConn-${curso.id}`, height: BANNER_CONNECTOR_H, render: () => <ConnectorStub side="center" /> });
      y += BANNER_CONNECTOR_H;
    }
  });

  const totalHeight = y;
  const esquerda = marcos.filter((m) => m.side === 'left');
  const direita = marcos.filter((m) => m.side === 'right');

  return (
    <div className="flex justify-center gap-6">
      <div className="hidden lg:block relative flex-shrink-0" style={{ width: GUTTER_W, height: totalHeight }}>
        {esquerda.map((m, i) => <MarcoCallout key={i} marco={m} side="left" />)}
      </div>

      <div className="flex flex-col items-center flex-shrink-0" style={{ width: BOARD_W }}>
        {blocks.map((b) => <div key={b.key}>{b.render()}</div>)}
      </div>

      <div className="hidden lg:block relative flex-shrink-0" style={{ width: GUTTER_W, height: totalHeight }}>
        {direita.map((m, i) => <MarcoCallout key={i} marco={m} side="right" />)}
      </div>
    </div>
  );
}

function ConnectorStub({ side }: { side: 'left' | 'right' | 'center' }) {
  const left = side === 'left' ? TILE / 2 : side === 'right' ? BOARD_W - TILE / 2 : BOARD_W / 2;
  return (
    <div className="relative" style={{ width: BOARD_W, height: side === 'center' ? BANNER_CONNECTOR_H : ROW_CONNECTOR_H }}>
      <span className="absolute top-0 bottom-0 border-l-2 border-dashed border-line" style={{ left }} aria-hidden />
    </div>
  );
}

function MarcoCallout({ marco, side }: { marco: MarcoPosicionado; side: 'left' | 'right' }) {
  return (
    <div
      className={cn(
        'absolute rounded-lg border border-line bg-panel-2/70 p-3 text-xs',
        side === 'left' ? 'right-0' : 'left-0',
      )}
      style={{ top: marco.yCenter, width: GUTTER_W - 16, transform: 'translateY(-50%)' }}
    >
      <div className={cn('flex items-center gap-1.5 mb-1', side === 'right' && 'flex-row-reverse')}>
        {side === 'left' ? <ChevronRight className="w-3.5 h-3.5 text-brand flex-shrink-0" /> : <ChevronLeft className="w-3.5 h-3.5 text-brand flex-shrink-0" />}
        <p className={cn('text-fg font-semibold leading-snug', side === 'right' && 'text-right')}>{marco.titulo}</p>
      </div>
      <p className={cn('text-fg-3 leading-snug', side === 'right' && 'text-right')}>{marco.desc}</p>
    </div>
  );
}

function TileButton({ slot, cursoId, nav, isCurrent, profile }: {
  slot: Slot; cursoId: string; nav: (path: string) => void; isCurrent: boolean;
  profile: { nome?: string | null; email?: string; avatar_url?: string | null } | null;
}) {
  const available = !!slot.aula;
  const go = () => { if (available) nav(`/curso/${cursoId}?aula=${slot.aula!.id}`); };
  return (
    <div id={`slot-${cursoId}:${slot.ordem}`} className="relative" style={{ width: TILE, height: TILE }}>
      {isCurrent && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <Avatar name={profile?.nome} email={profile?.email} src={profile?.avatar_url} size={30} />
        </div>
      )}
      <button
        onClick={go}
        disabled={!available}
        title={available ? (slot.aula!.titulo || `Aula ${slot.ordem}`) : 'Em breve'}
        className={cn(
          'w-full h-full rounded-full border-2 grid place-items-center transition-colors relative',
          available ? 'cursor-pointer hover:border-brand/60' : 'cursor-default',
          isCurrent ? 'border-brand ring-4 ring-brand/25 bg-brand/15'
            : slot.done ? 'bg-brand border-brand text-brand-ink'
            : available ? 'bg-panel border-line'
            : 'bg-white/5 border-white/10',
        )}
      >
        {slot.done ? <Check className="w-6 h-6 text-brand-ink" /> : available ? <PlayCircle className="w-6 h-6 text-brand" /> : <Lock className="w-4 h-4 text-white/30" />}
        <span className={cn('absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center text-[10px] font-semibold tabular-nums',
          slot.done ? 'bg-brand-ink text-brand' : 'bg-panel-3 text-fg-3 border border-line')}>
          {slot.ordem}
        </span>
      </button>
    </div>
  );
}
