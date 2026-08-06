import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, PlayCircle, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Skeleton, cn } from '../../components/ui';

type AulaEvento = {
  kind: 'aula';
  key: string;
  date: string; // YYYY-MM-DD local
  ordem: number;
  cursoId: string;
  aulaId: string;
  clickable: boolean;
};
type AtividadeEvento = {
  kind: 'atividade';
  key: string;
  date: string;
  atividadeId: string;
  ordem: number;
};
type Evento = AulaEvento | AtividadeEvento;

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CronogramaIndex() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
      const pairs = (ut ?? []).filter((r) => r.curso_id) as { turma_id: string; curso_id: string }[];
      const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
      const pairSet = new Set(pairs.map((p) => `${p.turma_id}:${p.curso_id}`));

      if (!turmaIds.length) { setEventos([]); setLoading(false); return; }

      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: hs } = await (supabase as any)
        .from('aula_horarios')
        .select('turma_id,curso_id,aula_id,data_hora,aulas(ordem,publicada)')
        .in('turma_id', turmaIds);

      const aulaEventos: AulaEvento[] = (hs ?? [])
        .filter((h: { turma_id: string; curso_id: string }) => pairSet.has(`${h.turma_id}:${h.curso_id}`))
        .map((h: { curso_id: string; aula_id: string; data_hora: string; aulas: { ordem: number; publicada: boolean } | null }) => {
          const t = new Date(h.data_hora).getTime();
          return {
            kind: 'aula' as const,
            key: `aula-${h.aula_id}`,
            date: toLocalDateKey(new Date(h.data_hora)),
            ordem: h.aulas?.ordem ?? 0,
            cursoId: h.curso_id,
            aulaId: h.aula_id,
            clickable: !!h.aulas?.publicada && t <= now,
          };
        });

      const { data: ats } = await supabase
        .from('atividades')
        .select('id,turma_id,curso_id,prazo')
        .in('turma_id', turmaIds)
        .not('prazo', 'is', null);

      const atividadeEventos: AtividadeEvento[] = (ats ?? [])
        .filter((a) => pairSet.has(`${a.turma_id}:${a.curso_id}`))
        .map((a) => ({ kind: 'atividade' as const, key: `atividade-${a.id}`, date: toLocalDateKey(new Date(a.prazo as string)), atividadeId: a.id, ordem: 0 }));

      setEventos([...aulaEventos, ...atividadeEventos]);
      setLoading(false);
    })();
  }, [profile]);

  const eventosPorDia = useMemo(() => {
    const map: Record<string, Evento[]> = {};
    eventos.forEach((e) => { (map[e.date] ??= []).push(e); });
    Object.values(map).forEach((list) => {
      list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'aula' ? -1 : 1));
      let n = 0;
      list.forEach((e) => { if (e.kind === 'atividade') { n += 1; (e as AtividadeEvento).ordem = n; } });
    });
    return map;
  }, [eventos]);

  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const todayKey = toLocalDateKey(new Date());

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="mb-0.5">Cronograma</h1>
          <p className="text-fg-3 text-sm">Aulas e prazos de atividades dos seus cursos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="w-8 h-8 rounded-md border border-line grid place-items-center text-fg-2 hover:bg-panel-2 transition-colors" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-fg text-sm font-medium w-36 text-center">{MESES[cursor.getMonth()]} {cursor.getFullYear()}</span>
          <button onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="w-8 h-8 rounded-md border border-line grid place-items-center text-fg-2 hover:bg-panel-2 transition-colors" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="text-sm text-brand font-medium ml-1 hover:underline">Hoje</button>
        </div>
      </header>

      {loading ? (
        <Skeleton className="h-[560px] rounded-xl" />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line">
            {DIAS_SEMANA.map((d, i) => (
              <div key={i} className="py-2 text-center text-fg-3 text-[11px] font-semibold uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                const key = day ? toLocalDateKey(day) : `empty-${wi}-${di}`;
                const dayEventos = day ? (eventosPorDia[toLocalDateKey(day)] ?? []) : [];
                const isToday = day && toLocalDateKey(day) === todayKey;
                return (
                  <div key={key} className={cn('min-h-[100px] border-b border-r border-line last:border-r-0 p-1.5 sm:p-2', !day && 'bg-panel-3/20')}>
                    {day && (
                      <>
                        <p className={cn('text-xs mb-1.5 w-5 h-5 grid place-items-center rounded-full', isToday ? 'bg-brand text-brand-ink font-semibold' : 'text-fg-3')}>{day.getDate()}</p>
                        <div className="space-y-1">
                          {dayEventos.map((e) => (
                            <EventoItem key={e.key} evento={e} nav={nav} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function EventoItem({ evento, nav }: { evento: Evento; nav: (path: string) => void }) {
  const clickable = evento.kind === 'atividade' || evento.clickable;
  const label = evento.kind === 'aula' ? `Aula ${evento.ordem || ''}`.trim() : `Atividade ${evento.ordem || ''}`.trim();
  const Icon = evento.kind === 'aula' ? PlayCircle : ClipboardList;

  const go = () => {
    if (!clickable) return;
    if (evento.kind === 'aula') nav(`/curso/${evento.cursoId}?aula=${evento.aulaId}`);
    else nav(`/atividade/${evento.atividadeId}`);
  };

  return (
    <button
      onClick={go}
      disabled={!clickable}
      className={cn(
        'flex items-center gap-1 w-full text-left text-[11px] leading-tight',
        clickable ? 'text-brand underline hover:text-brand-hover cursor-pointer' : 'text-fg-3 cursor-default'
      )}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span>{label}</span>
      {clickable && <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />}
    </button>
  );
}
