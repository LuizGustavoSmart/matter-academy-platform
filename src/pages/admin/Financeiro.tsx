import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, TrendingUp, Repeat, Coins } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Badge, EmptyState, Skeleton, Alert, TableWrap, THead, TBody, Tr, Th, Td } from '../../components/ui';
import { PageHeader } from '../../layouts/AppShell';
import { TipoCobranca, TIPO_COBRANCA_LABEL, formatBRL, calcTotal, describeCobranca } from '../../lib/financeiro';

type TurmaFin = { id: string; nome: string; tipo_cobranca: TipoCobranca | null; valor: number | null; alunos: number; total: number };

export default function Financeiro() {
  const [turmas, setTurmas] = useState<TurmaFin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: ts }, { data: uts }, { data: profiles }] = await Promise.all([
        supabase.from('turmas').select('id,nome,tipo_cobranca,valor').order('nome'),
        supabase.from('user_turmas').select('turma_id,user_id'),
        supabase.from('profiles').select('id,role'),
      ]);
      const studentIds = new Set((profiles ?? []).filter((p) => p.role === 'student').map((p) => p.id));
      const alunosPorTurma: Record<string, Set<string>> = {};
      (uts ?? []).forEach((r) => { if (studentIds.has(r.user_id)) (alunosPorTurma[r.turma_id] ??= new Set()).add(r.user_id); });
      const rows: TurmaFin[] = (ts ?? []).map((t) => {
        const alunos = alunosPorTurma[t.id]?.size ?? 0;
        return { id: t.id, nome: t.nome, tipo_cobranca: t.tipo_cobranca as TipoCobranca | null, valor: t.valor, alunos, total: calcTotal(t.tipo_cobranca as TipoCobranca | null, t.valor, alunos) };
      });
      setTurmas(rows);
      setLoading(false);
    })();
  }, []);

  const somaPorTipo = (tipo: TipoCobranca) => turmas.filter((t) => t.tipo_cobranca === tipo).reduce((s, t) => s + t.total, 0);
  const nTipo = (tipo: TipoCobranca) => turmas.filter((t) => t.tipo_cobranca === tipo).length;
  const semConfig = turmas.filter((t) => !t.tipo_cobranca).length;

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Visão consolidada da cobrança de todas as turmas." />

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : turmas.length === 0 ? (
        <EmptyState icon={<DollarSign className="w-8 h-8" />} title="Nenhuma turma criada" description="Crie turmas e configure a cobrança para ver o consolidado." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard icon={<Coins className="w-5 h-5 text-brand" />} label="Valor fixo (único)" value={formatBRL(somaPorTipo('fixo'))} hint={`${nTipo('fixo')} turma(s)`} />
            <SummaryCard icon={<TrendingUp className="w-5 h-5 text-brand" />} label="Por aluno (calculado)" value={formatBRL(somaPorTipo('por_aluno'))} hint={`${nTipo('por_aluno')} turma(s)`} />
            <SummaryCard icon={<Repeat className="w-5 h-5 text-brand" />} label="Recorrente mensal" value={`${formatBRL(somaPorTipo('recorrente_mensal'))}/mês`} hint={`${nTipo('recorrente_mensal')} turma(s)`} />
          </div>

          {semConfig > 0 && <Alert tone="info">{semConfig} turma(s) sem cobrança configurada não entram nos totais acima.</Alert>}

          <Card className="overflow-hidden">
            <TableWrap>
              <THead>
                <Tr><Th>Turma</Th><Th>Tipo</Th><Th>Alunos</Th><Th className="text-right">Total</Th></Tr>
              </THead>
              <TBody>
                {turmas.map((t) => {
                  const cobranca = describeCobranca(t.tipo_cobranca, t.valor, t.alunos);
                  return (
                    <Tr key={t.id} className="hover:bg-panel-2/40 transition-colors">
                      <Td><Link to={`/admin/turmas/${t.id}`} className="text-fg hover:text-brand transition-colors font-medium">{t.nome}</Link></Td>
                      <Td>{t.tipo_cobranca ? <Badge>{TIPO_COBRANCA_LABEL[t.tipo_cobranca]}</Badge> : <span className="text-fg-3 italic text-xs">Não configurada</span>}</Td>
                      <Td className="text-fg-2 tabular-nums">{t.alunos}</Td>
                      <Td className="text-right"><span className="text-fg font-medium tabular-nums">{cobranca.total}</span>{cobranca.detalhe && <p className="text-fg-3 text-xs">{cobranca.detalhe}</p>}</Td>
                    </Tr>
                  );
                })}
              </TBody>
            </TableWrap>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 grid place-items-center flex-shrink-0">{icon}</span>
        <span className="text-fg-3 text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-display font-semibold text-fg tabular-nums">{value}</p>
      <p className="text-fg-3 text-xs mt-1">{hint}</p>
    </Card>
  );
}
