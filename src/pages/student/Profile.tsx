import { useEffect, useState } from 'react';
import { Calendar, GraduationCap, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AvatarUpload from '../../components/AvatarUpload';
import { Card, Field, Input, Select, Button, Badge, Skeleton, useToast } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { FAIXA_OPTIONS, ordemDaFaixa } from '../../lib/faixa';

const AULAS_POR_FAIXA = 12;

type Dados = {
  nome: string; sobrenome: string; telefone: string; data_nascimento: string;
  sexo: string; cargo: string; empresa: string;
};

type FaixaInfo = { faixaAtual: string | null; concluida: boolean; dataInicioCurso: string | null };
type CursoMinistrado = { id: string; titulo: string; turmaNome: string; dataInicio: string | null; dataFim: string | null; emAndamento: boolean };

export default function Profile() {
  const { profile } = useAuth();
  const toast = useToast();
  const isProfessor = profile?.role === 'professor' || profile?.role === 'monitor';

  const [dados, setDados] = useState<Dados>({ nome: '', sobrenome: '', telefone: '', data_nascimento: '', sexo: '', cargo: '', empresa: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [faixaInfo, setFaixaInfo] = useState<FaixaInfo | null>(null);
  const [cursosMinistrados, setCursosMinistrados] = useState<CursoMinistrado[]>([]);
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
      } else if (profile.role === 'student') {
        const { data: ut } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', profile.id);
        const pairs = (ut ?? []).filter((r) => r.curso_id) as { turma_id: string; curso_id: string }[];
        const turmaIds = [...new Set(pairs.map((p) => p.turma_id))];
        if (!turmaIds.length) { setFaixaInfo(null); setExtraLoading(false); return; }
        const cursoIds = [...new Set(pairs.map((p) => p.curso_id))];
        // faixa/data_inicio ainda não estão no schema gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [{ data: cursos }, { data: cts }, { data: as }, { data: ps }] = await Promise.all([
          (supabase as any).from('cursos').select('id,faixa').in('id', cursoIds),
          (supabase as any).from('curso_turmas').select('turma_id,curso_id,data_inicio').in('turma_id', turmaIds).in('curso_id', cursoIds),
          (supabase as any).from('lessons_public').select('id,curso_id').in('curso_id', cursoIds),
          supabase.from('progresso').select('aula_id,concluido').eq('user_id', profile.id).eq('concluido', true),
        ]);
        const doneAulaIds = new Set((ps ?? []).map((p) => p.aula_id));
        const countsPorCurso: Record<string, { total: number; done: number }> = {};
        (as ?? []).forEach((a: { id: string; curso_id: string }) => {
          const c = (countsPorCurso[a.curso_id] ??= { total: 0, done: 0 });
          c.total++;
          if (doneAulaIds.has(a.id)) c.done++;
        });
        const cursosOrdenados = ((cursos ?? []) as { id: string; faixa: string | null }[])
          .sort((a, b) => ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa));
        const concluidasCount = cursosOrdenados.filter((c) => (countsPorCurso[c.id]?.done ?? 0) >= AULAS_POR_FAIXA).length;
        const atual = cursosOrdenados[Math.min(concluidasCount, cursosOrdenados.length - 1)] ?? null;
        const ctAtual = (cts ?? []).find((r: { curso_id: string }) => r.curso_id === atual?.id);
        setFaixaInfo({
          faixaAtual: concluidasCount >= cursosOrdenados.length && cursosOrdenados.length > 0 ? null : (atual ? FAIXA_OPTIONS.find((o) => o.value === atual.faixa)?.label ?? null : null),
          concluida: concluidasCount > 0,
          dataInicioCurso: ctAtual?.data_inicio ?? null,
        });
      }
      setExtraLoading(false);
    })();
  }, [profile, isProfessor]);

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

      {profile?.role === 'student' && (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><GraduationCap className="w-4 h-4 text-fg-2" /><h2 className="text-base">Sua faixa</h2></div>
          {extraLoading ? <Skeleton className="h-16 rounded-lg" /> : !faixaInfo || (!faixaInfo.concluida && !faixaInfo.faixaAtual) ? (
            <p className="text-fg-2 text-sm">Você está no caminho para a primeira faixa (Branca) — assista às aulas para começar sua jornada.</p>
          ) : faixaInfo.faixaAtual ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-fg-3 text-sm">Faixa atual:</span>
                <Badge tone="outline">{faixaInfo.faixaAtual}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-fg-2">
                <Calendar className="w-4 h-4 text-fg-3" />
                Início do curso atual: {dateOnlyBR(faixaInfo.dataInicioCurso)}
              </div>
            </div>
          ) : (
            <p className="text-fg-2 text-sm">Parabéns! Você concluiu todas as faixas disponíveis até agora.</p>
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
