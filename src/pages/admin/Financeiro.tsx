import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, TrendingUp, Repeat, Coins } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, Badge, Empty } from '../../components/ui';
import { TipoCobranca, TIPO_COBRANCA_LABEL, formatBRL, calcTotal, describeCobranca } from '../../lib/financeiro';

type TurmaFin = {
  id: string;
  nome: string;
  tipo_cobranca: TipoCobranca | null;
  valor: number | null;
  alunos: number;
  total: number;
};

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

      const studentIds = new Set((profiles ?? []).filter((p: any) => p.role === 'student').map((p: any) => p.id));
      const alunosPorTurma: Record<string, Set<string>> = {};
      (uts ?? []).forEach((r: any) => {
        if (studentIds.has(r.user_id)) (alunosPorTurma[r.turma_id] ??= new Set()).add(r.user_id);
      });

      const rows: TurmaFin[] = (ts ?? []).map((t: any) => {
        const alunos = alunosPorTurma[t.id]?.size ?? 0;
        return {
          id: t.id, nome: t.nome, tipo_cobranca: t.tipo_cobranca, valor: t.valor,
          alunos,
          total: calcTotal(t.tipo_cobranca, t.valor, alunos),
        };
      });

      setTurmas(rows);
      setLoading(false);
    })();
  }, []);

  const somaPorTipo = (tipo: TipoCobranca) =>
    turmas.filter((t) => t.tipo_cobranca === tipo).reduce((s, t) => s + t.total, 0);

  const totalFixo = somaPorTipo('fixo');
  const totalPorAluno = somaPorTipo('por_aluno');
  const totalMensal = somaPorTipo('recorrente_mensal');
  const semConfig = turmas.filter((t) => !t.tipo_cobranca).length;

  return (
    <div>
      <div className="mb-6">
        <h1>Financeiro</h1>
        <p className="meta mt-1">Visão consolidada da cobrança de todas as turmas</p>
      </div>

      {loading ? <p className="meta">Carregando...</p> : turmas.length === 0 ? (
        <Empty icon={<DollarSign className="w-8 h-8" />} title="Nenhuma turma criada" />
      ) : (
        <div className="space-y-8">
          {/* Totais por tipo */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<Coins className="w-5 h-5 text-[#cbfb00]" />}
              label="Valor fixo (único)"
              value={formatBRL(totalFixo)}
              hint={`${turmas.filter((t) => t.tipo_cobranca === 'fixo').length} turma(s)`}
            />
            <SummaryCard
              icon={<TrendingUp className="w-5 h-5 text-[#cbfb00]" />}
              label="Por aluno (calculado)"
              value={formatBRL(totalPorAluno)}
              hint={`${turmas.filter((t) => t.tipo_cobranca === 'por_aluno').length} turma(s)`}
            />
            <SummaryCard
              icon={<Repeat className="w-5 h-5 text-[#cbfb00]" />}
              label="Recorrente mensal"
              value={`${formatBRL(totalMensal)}/mês`}
              hint={`${turmas.filter((t) => t.tipo_cobranca === 'recorrente_mensal').length} turma(s)`}
            />
          </div>

          {semConfig > 0 && (
            <p className="text-xs text-[#8b929e]">
              {semConfig} turma(s) sem cobrança configurada não entram nos totais acima.
            </p>
          )}

          {/* Tabela por turma */}
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1c1f26] text-left">
                  <th className="px-4 py-3 font-medium text-[#d6deed]">Turma</th>
                  <th className="px-4 py-3 font-medium text-[#d6deed]">Tipo</th>
                  <th className="px-4 py-3 font-medium text-[#d6deed]">Alunos</th>
                  <th className="px-4 py-3 font-medium text-[#d6deed] text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((t) => {
                  const cobranca = describeCobranca(t.tipo_cobranca, t.valor, t.alunos);
                  return (
                    <tr key={t.id} className="border-b border-[#1c1f26] last:border-0 hover:bg-[#111] transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/admin/turmas/${t.id}`} className="text-white hover:text-[#cbfb00] transition-colors">{t.nome}</Link>
                      </td>
                      <td className="px-4 py-3">
                        {t.tipo_cobranca
                          ? <Badge>{TIPO_COBRANCA_LABEL[t.tipo_cobranca]}</Badge>
                          : <span className="text-[#434d5e] italic text-xs">Não configurada</span>}
                      </td>
                      <td className="px-4 py-3 text-[#d6deed]">{t.alunos}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-medium">{cobranca.total}</span>
                        {cobranca.detalhe && <p className="text-xs text-[#8b929e]">{cobranca.detalhe}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        <div className="w-10 h-10 rounded-lg bg-[#cbfb00]/10 flex items-center justify-center flex-shrink-0">{icon}</div>
        <span className="text-xs text-[#8b929e] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-[#8b929e] mt-1">{hint}</p>
    </Card>
  );
}
