import { useEffect, useState } from 'react';
import { GraduationCap, Save, Check, Lock, Award, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AvatarUpload from '../../components/AvatarUpload';
import { Card, Field, Input, Select, Button, Badge, Skeleton, cn, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { FAIXA_OPTIONS, ordemDaFaixa, labelDaFaixa } from '../../lib/faixa';

const AULAS_POR_FAIXA = 12;

const FAIXA_DOT: Record<string, string> = {
  branca: 'bg-white border border-line-strong',
  verde: 'bg-emerald-500',
  marrom: 'bg-amber-800',
  preta: 'bg-neutral-900 border border-white/20',
};

type Dados = {
  nome: string; sobrenome: string; telefone: string; data_nascimento: string;
  sexo: string; cargo: string; empresa: string;
};

type FaixaTimelineItem = {
  cursoId: string; faixa: string | null; label: string; done: number; total: number;
  status: 'concluida' | 'atual' | 'futura'; dataInicio: string | null; dataConclusao: string | null;
};
type CursoMinistrado = { id: string; titulo: string; turmaNome: string; dataInicio: string | null; dataFim: string | null; emAndamento: boolean };
type EmbaixadorTurma = { turmaId: string; nome: string };

export default function Profile() {
  const { profile } = useAuth();
  const toast = useToast();
  const isProfessor = profile?.role === 'professor' || profile?.role === 'monitor';
  const isEmbaixador = profile?.role === 'embaixador';

  const [dados, setDados] = useState<Dados>({ nome: '', sobrenome: '', telefone: '', data_nascimento: '', sexo: '', cargo: '', empresa: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [faixaTimeline, setFaixaTimeline] = useState<FaixaTimelineItem[]>([]);
  const [cursosMinistrados, setCursosMinistrados] = useState<CursoMinistrado[]>([]);
  const [embaixadorTurmas, setEmbaixadorTurmas] = useState<EmbaixadorTurma[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      // sexo/cargo/data_nascimento/sobrenome/telefone/empresa ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('profiles')
        .select('nome,sobrenome,telefone,data_nascimento,sexo,cargo,empresa').eq('id', profile.id).maybeSingle();
      setDados({
        nome: data?.nome ?? '', sobrenome: data?.sobrenome ?? '', telefone: data?.telefone ?? '',
        data_nascimento: data?.data_nascimento ?? '', sexo: data?.sexo ?? '', cargo: data?.cargo ?? '', empresa: data?.empresa ?? '',
      });
      setLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setExtraLoading(true);

      if (isProfessor) {
        // faixa/data_inicio/data_fim ainda não estão no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cts } = await (supabase as any).from('curso_turmas').select('turma_id,curso_id,data_inicio,data_fim').eq('professor_id', profile.id);
        const turmaIds = [...new Set((cts ?? []).map((r: { turma_id: string }) => r.turma_id))] as string[];
        const cursoIds = [...new Set((cts ?? []).map((r: { curso_id: string }) => r.curso_id))] as string[];
        const [{ data: turmas }, { data: cursos }] = await Promise.all([
          turmaIds.length ? supabase.from('turmas').select('id,nome').in('id', turmaIds) : Promise.resolve({ data: [] }),
          cursoIds.length ? supabase.from('cursos').select('id,titulo').in('id', cursoIds) : Promise.resolve({ data: [] }),
        ]);
        const turmaMap = new Map((turmas ?? []).map((t) => [t.id, t.nome]));
        const cursoMap = new Map((cursos ?? []).map((c) => [c.id, c.titulo]));
        const hoje = new Date().toISOString().slice(0, 10);
        const list: CursoMinistrado[] = (cts ?? []).map((r: { turma_id: string; curso_id: string; data_inicio: string | null; data_fim: string | null }) => ({
          id: `${r.turma_id}-${r.curso_id}`,
          titulo: cursoMap.get(r.curso_id) ?? '—',
          turmaNome: turmaMap.get(r.turma_id) ?? '—',
          dataInicio: r.data_inicio, dataFim: r.data_fim,
          emAndamento: !r.data_fim || r.data_fim >= hoje,
        }));
        setCursosMinistrados(list);
      } else if (profile.role === 'student' || isEmbaixador) {
        const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
        const pairs = (ut ?? []).filter((r) => r.curso_id) as { turma_id: string; curso_id: string }[];
        const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
        if (!turmaIds.length) { setFaixaTimeline([]); setExtraLoading(false); return; }
        const cursoIds = [...new Set(pairs.map((p) => p.curso_id))];
        // faixa/data_inicio ainda não estão no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [{ data: cursos }, { data: cts }, { data: as }, { data: ps }] = await Promise.all([
          (supabase as any).from('cursos').select('id,faixa').in('id', cursoIds),
          (supabase as any).from('curso_turmas').select('turma_id,curso_id,data_inicio').in('turma_id', turmaIds).in('curso_id', cursoIds),
          (supabase as any).from('lessons_public').select('id,curso_id').in('curso_id', cursoIds),
          supabase.from('progresso').select('aula_id,concluido,updated_at').eq('user_id', profile.id).eq('concluido', true),
        ]);
        const dataConclusaoPorAula = new Map(((ps ?? []) as { aula_id: string; updated_at: string }[]).map((p) => [p.aula_id, p.updated_at]));
        const countsPorCurso: Record<string, { total: number; done: number }> = {};
        const dataConclusaoPorCurso: Record<string, string | null> = {};
        (as ?? []).forEach((a: { id: string; curso_id: string }) => {
          const c = (countsPorCurso[a.curso_id] ??= { total: 0, done: 0 });
          c.total++;
          const concluidaEm = dataConclusaoPorAula.get(a.id);
          if (concluidaEm) {
            c.done++;
            const atual = dataConclusaoPorCurso[a.curso_id];
            if (!atual || concluidaEm > atual) dataConclusaoPorCurso[a.curso_id] = concluidaEm;
          }
        });
        const dataInicioPorCurso: Record<string, string | null> = {};
        (cts ?? []).forEach((r: { curso_id: string; data_inicio: string | null }) => {
          if (!dataInicioPorCurso[r.curso_id]) dataInicioPorCurso[r.curso_id] = r.data_inicio;
        });

        const cursosReais = (cursos ?? []) as { id: string; faixa: string | null }[];
        // As 4 faixas sempre aparecem — a que o aluno ainda não foi vinculado
        // (curso/turma futuros) vira um bloco "virtual" com "Ainda não iniciada".
        const faixasPresentes = new Set(cursosReais.map((c) => c.faixa));
        const cursosVirtuais = FAIXA_OPTIONS.filter((o) => !faixasPresentes.has(o.value)).map((o) => ({
          id: `virtual-${o.value}`, faixa: o.value as string | null,
        }));
        const cursosOrdenados = [...cursosReais, ...cursosVirtuais]
          .sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));
        const base = cursosOrdenados.map((c) => {
          const done = countsPorCurso[c.id]?.done ?? 0;
          const total = Math.max(AULAS_POR_FAIXA, countsPorCurso[c.id]?.total ?? 0);
          const concluida = done >= AULAS_POR_FAIXA;
          return {
            cursoId: c.id, faixa: c.faixa, label: labelDaFaixa(c.faixa) ?? '—', done, total, concluida,
            dataInicio: dataInicioPorCurso[c.id] ?? null,
            dataConclusao: concluida ? (dataConclusaoPorCurso[c.id] ?? null) : null,
          };
        });
        const primeiroIncompletoIdx = base.findIndex((c) => !c.concluida);
        const timeline: FaixaTimelineItem[] = base.map((c, i) => ({
          cursoId: c.cursoId, faixa: c.faixa, label: c.label, done: c.done, total: c.total,
          dataInicio: c.dataInicio, dataConclusao: c.dataConclusao,
          status: c.concluida ? 'concluida' : i === primeiroIncompletoIdx ? 'atual' : 'futura',
        }));
        setFaixaTimeline(timeline);
      }

      if (isEmbaixador) {
        // is_embaixador ainda não está no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ut } = await (supabase as any).from('user_turmas').select('turma_id').eq('user_id', profile.id).eq('is_embaixador', true);
        const turmaIds = [...new Set(((ut ?? []) as { turma_id: string }[]).map((r) => r.turma_id))];
        const { data: turmas } = turmaIds.length ? await supabase.from('turmas').select('id,nome').in('id', turmaIds) : { data: [] };
        setEmbaixadorTurmas((turmas ?? []).map((t) => ({ turmaId: t.id, nome: t.nome })));
      }

      setExtraLoading(false);
    })();
  }, [profile, isProfessor, isEmbaixador]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // sexo/cargo/data_nascimento/sobrenome/telefone/empresa ainda não estão no schema gerado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('profiles').update({
        nome: dados.nome.trim() || null, sobrenome: dados.sobrenome.trim() || null, telefone: dados.telefone.trim() || null,
        data_nascimento: dados.data_nascimento || null, sexo: dados.sexo || null, cargo: dados.cargo.trim() || null, empresa: dados.empresa.trim() || null,
      }).eq('id', profile.id);
      if (error) throw error;
      toast.success('Perfil atualizado.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  function dateOnlyBR(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return new Date(iso).toLocaleDateString('pt-BR');
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <PageHeader title="Meu perfil" subtitle="Seus dados e foto de perfil." />

      <Card className="p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <AvatarUpload size={64} />
          <div>
            <p className="text-fg font-medium">{dados.nome || profile?.email}</p>
            <p className="text-fg-3 text-sm">{profile?.email}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" htmlFor="pf-nome"><Input id="pf-nome" value={dados.nome} onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} /></Field>
              <Field label="Sobrenome" htmlFor="pf-sobrenome"><Input id="pf-sobrenome" value={dados.sobrenome} onChange={(e) => setDados((d) => ({ ...d, sobrenome: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone" htmlFor="pf-telefone"><Input id="pf-telefone" value={dados.telefone} onChange={(e) => setDados((d) => ({ ...d, telefone: e.target.value }))} placeholder="(11) 98888-0000" /></Field>
              <Field label="Data de nascimento" htmlFor="pf-nascimento"><Input id="pf-nascimento" type="date" value={dados.data_nascimento} onChange={(e) => setDados((d) => ({ ...d, data_nascimento: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sexo" htmlFor="pf-sexo">
                <Select id="pf-sexo" value={dados.sexo} onChange={(e) => setDados((d) => ({ ...d, sexo: e.target.value }))}>
                  <option value="">Selecione</option>
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                  <option value="outro">Outro</option>
                  <option value="prefiro_nao_informar">Prefiro não informar</option>
                </Select>
              </Field>
              <Field label="Cargo" htmlFor="pf-cargo"><Input id="pf-cargo" value={dados.cargo} onChange={(e) => setDados((d) => ({ ...d, cargo: e.target.value }))} /></Field>
            </div>
            <Field label="Empresa" htmlFor="pf-empresa"><Input id="pf-empresa" value={dados.empresa} onChange={(e) => setDados((d) => ({ ...d, empresa: e.target.value }))} /></Field>

            <div className="flex justify-end pt-2">
              <Button variant="primary" icon={<Save className="w-4 h-4" />} loading={saving} onClick={save}>Salvar alterações</Button>
            </div>
          </div>
        )}
      </Card>

      {isEmbaixador && (
        <Card className="p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4"><Star className="w-4 h-4 text-fg-2" /><h2 className="text-base">Embaixador</h2></div>
          {extraLoading ? <Skeleton className="h-12 rounded-lg" /> : embaixadorTurmas.length === 0 ? (
            <p className="text-fg-3 text-sm">Você ainda não é embaixador de nenhuma turma.</p>
          ) : (
            <ul className="space-y-2">
              {embaixadorTurmas.map((t) => (
                <li key={t.turmaId} className="flex items-center gap-2.5 rounded-lg border border-brand/25 bg-brand/[0.06] p-3">
                  <Star className="w-4 h-4 text-brand flex-shrink-0" />
                  <span className="text-sm text-fg-2">Você é embaixador da turma <strong className="text-fg">{t.nome}</strong></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {(profile?.role === 'student' || isEmbaixador) && (
        <Card className="p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-5"><Award className="w-4 h-4 text-fg-2" /><h2 className="text-base">Seu Progresso</h2></div>
          {extraLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : faixaTimeline.length === 0 ? (
            <p className="text-fg-2 text-sm">Você está no caminho para a primeira faixa (Branca) — assista às aulas para começar sua jornada.</p>
          ) : (
            <div>
              {faixaTimeline.map((f, i) => {
                const isLast = i === faixaTimeline.length - 1;
                const pct = f.total ? Math.round((f.done / f.total) * 100) : 0;
                return (
                  <div key={f.cursoId} className={cn('relative pl-9', !isLast && 'pb-6')}>
                    {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-line" aria-hidden />}
                    <span className={cn(
                      'absolute left-0 top-0 w-6 h-6 rounded-full grid place-items-center flex-shrink-0',
                      f.status === 'concluida' ? 'bg-ok/15 text-ok' : f.status === 'atual' ? 'bg-brand text-brand-ink shadow-[0_0_0_4px_rgba(203,251,0,0.15)]' : 'bg-panel-3 text-fg-3',
                    )}>
                      {f.status === 'concluida' ? <Check className="w-3.5 h-3.5" /> : f.status === 'futura' ? <Lock className="w-3 h-3" /> : <span className="w-2 h-2 rounded-full bg-brand-ink" />}
                    </span>
                    <div className={cn(
                      'rounded-lg p-3.5',
                      f.status === 'atual' && 'border border-brand/30 bg-brand/[0.06]',
                      f.status === 'futura' && 'opacity-50',
                    )}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={cn('w-3 h-3 rounded-full flex-shrink-0', FAIXA_DOT[f.faixa ?? ''] ?? 'bg-line')} />
                          <span className="text-fg font-medium text-sm">{f.label}</span>
                          {f.status === 'atual' && <Badge tone="brand">Em andamento</Badge>}
                          {f.status === 'concluida' && <Badge tone="success">Concluída</Badge>}
                        </div>
                        {f.status !== 'futura' && <span className="text-fg-3 text-xs tabular-nums">{f.done}/{f.total} aulas</span>}
                      </div>
                      {f.status === 'atual' && (
                        <div className="mt-2.5 h-1.5 w-full max-w-xs rounded-full bg-line/60 overflow-hidden">
                          <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <div className="mt-2.5 text-fg-3 text-xs flex flex-wrap gap-x-4 gap-y-1">
                        {f.status === 'futura' ? (
                          <span>Ainda não iniciada</span>
                        ) : (
                          <>
                            <span>Início: {dateOnlyBR(f.dataInicio)}</span>
                            {f.status === 'concluida' && <span>Conclusão: {dateOnlyBR(f.dataConclusao)}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {isProfessor && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><GraduationCap className="w-4 h-4 text-fg-2" /><h2 className="text-base">Cursos que você ministra</h2></div>
          {extraLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : cursosMinistrados.length === 0 ? (
            <p className="text-fg-3 text-sm">Nenhum curso vinculado ao seu nome ainda.</p>
          ) : (
            <ul className="space-y-2">
              {cursosMinistrados.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
                  <div className="min-w-0">
                    <p className="text-fg text-sm font-medium truncate">{c.titulo}</p>
                    <p className="text-fg-3 text-xs mt-0.5 truncate">{c.turmaNome} · Início: {dateOnlyBR(c.dataInicio)}{c.dataFim ? ` · Fim: ${dateOnlyBR(c.dataFim)}` : ''}</p>
                  </div>
                  <Badge tone={c.emAndamento ? 'success' : 'default'} dot className="flex-shrink-0">{c.emAndamento ? 'Em andamento' : 'Concluído'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
