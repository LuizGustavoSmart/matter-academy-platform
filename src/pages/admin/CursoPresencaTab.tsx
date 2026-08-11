import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PlayCircle, Users, Percent, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card, StatTile, Badge, Avatar, Modal, EmptyState, Skeleton, Switch, Button, useToast,
} from '../../components/ui';
import { ORIGEM_LABEL, ORIGEM_TONE, type OrigemPresenca, type Presenca } from '../../lib/presenca';
import PresencaTeamsImportModal from './PresencaTeamsImportModal';

export type AulaPresenca = { id: string; titulo: string; ordem: number };
type AlunoRow = { id: string; email: string; nome: string | null };

/** Busca os alunos matriculados na turma/curso — inclusive quem ainda não tem presença. */
async function carregarAlunos(turmaId: string, cursoId: string): Promise<AlunoRow[]> {
  const { data: ut } = await supabase.from('user_turmas').select('user_id').eq('turma_id', turmaId).eq('curso_id', cursoId);
  const userIds = (ut ?? []).map((r: { user_id: string }) => r.user_id);
  if (!userIds.length) return [];
  const { data: profiles } = await supabase.from('profiles').select('id,email,nome,role').in('id', userIds);
  return (profiles ?? [])
    .filter((p) => p.role === 'student')
    .map((p) => ({ id: p.id, email: p.email, nome: p.nome }));
}

function nomeDe(a: AlunoRow) {
  return a.nome || a.email.split('@')[0];
}

/* ─────────────────────── Aba: visão geral por aula ─────────────────────── */

export default function CursoPresencaTab({ turmaId, cursoId }: { turmaId: string; cursoId: string }) {
  const [aulas, setAulas] = useState<AulaPresenca[]>([]);
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [totalAlunos, setTotalAlunos] = useState(0);
  const [presentesPorAula, setPresentesPorAula] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [aulaAberta, setAulaAberta] = useState<AulaPresenca | null>(null);

  const load = async () => {
    setLoading(true);
    // aulas/aula_horarios/presencas ainda não estão no schema gerado
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [{ data: as }, { data: hs }, alunos] = await Promise.all([
      sb.from('aulas').select('id,titulo,ordem').eq('curso_id', cursoId).order('ordem'),
      sb.from('aula_horarios').select('aula_id,data_hora').eq('turma_id', turmaId).eq('curso_id', cursoId),
      carregarAlunos(turmaId, cursoId),
    ]);
    const lista = (as ?? []) as AulaPresenca[];
    setAulas(lista);
    setHorarios(Object.fromEntries(((hs ?? []) as { aula_id: string; data_hora: string }[]).map((h) => [h.aula_id, h.data_hora])));
    setTotalAlunos(alunos.length);

    const aulaIds = lista.map((a) => a.id);
    if (aulaIds.length) {
      const { data: ps } = await sb.from('presencas').select('aula_id,user_id,presente').eq('turma_id', turmaId).in('aula_id', aulaIds);
      const contagem: Record<string, number> = {};
      ((ps ?? []) as { aula_id: string; presente: boolean }[]).forEach((p) => {
        if (p.presente) contagem[p.aula_id] = (contagem[p.aula_id] ?? 0) + 1;
      });
      setPresentesPorAula(contagem);
    } else setPresentesPorAula({});
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId, cursoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pctMedio = useMemo(() => {
    const esperado = aulas.length * totalAlunos;
    if (!esperado) return 0;
    const presentes = aulas.reduce((s, a) => s + (presentesPorAula[a.id] ?? 0), 0);
    return Math.round((presentes / esperado) * 100);
  }, [aulas, totalAlunos, presentesPorAula]);

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <StatTile label="Aulas" value={aulas.length} icon={<PlayCircle className="w-4 h-4" />} />
        <StatTile label="Alunos matriculados" value={totalAlunos} icon={<Users className="w-4 h-4" />} />
        <StatTile label="Presença média" value={`${pctMedio}%`} icon={<Percent className="w-4 h-4" />} />
      </div>

      <p className="text-fg-3 text-sm mb-4">Selecione uma aula para lançar ou revisar a chamada.</p>

      {aulas.length === 0 ? (
        <EmptyState icon={<PlayCircle className="w-8 h-8" />} title="Nenhuma aula" description="Cadastre aulas neste curso para lançar presença." />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {aulas.map((a) => {
              const presentes = presentesPorAula[a.id] ?? 0;
              return (
                <li key={a.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 border-b border-line last:border-0 hover:bg-panel-2/40 transition-colors cursor-pointer"
                  onClick={() => setAulaAberta(a)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-medium truncate">{a.ordem}. {a.titulo}</p>
                    <p className="text-fg-3 text-xs mt-0.5 truncate">
                      {horarios[a.id] ? new Date(horarios[a.id]).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem data/horário agendado'}
                    </p>
                  </div>
                  <Badge tone={presentes > 0 ? 'success' : 'default'} className="flex-shrink-0">
                    {presentes}/{totalAlunos} presentes
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {aulaAberta && (
        <PresencaAulaModal turmaId={turmaId} cursoId={cursoId} aula={aulaAberta}
          onClose={() => setAulaAberta(null)} onSaved={load} />
      )}
    </div>
  );
}

/* ─────────────────────── Chamada de uma aula ─────────────────────── */

/**
 * Lista TODOS os alunos matriculados na turma/curso — quem não tem registro
 * aparece como ausente. Reaproveitada pela aba Presença e pela lista de aulas.
 */
export function PresencaAulaModal({ turmaId, cursoId, aula, onClose, onSaved }: {
  turmaId: string; cursoId: string; aula: AulaPresenca; onClose: () => void; onSaved?: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [presencas, setPresencas] = useState<Record<string, Presenca>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const [lista, { data: ps }] = await Promise.all([
      carregarAlunos(turmaId, cursoId),
      sb.from('presencas').select('*').eq('turma_id', turmaId).eq('aula_id', aula.id),
    ]);
    setAlunos(lista);
    setPresencas(Object.fromEntries(((ps ?? []) as Presenca[]).map((p) => [p.user_id, p])));
    setLoading(false);
  };

  useEffect(() => { load(); }, [turmaId, cursoId, aula.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * A edição manual altera só o `presente`: a origem original é preservada
   * para não perder de onde veio o registro. Sem registro prévio, nasce como
   * lançamento do professor.
   */
  const marcar = async (aluno: AlunoRow, presente: boolean) => {
    if (!profile) return;
    const anterior = presencas[aluno.id];
    setSalvando(aluno.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb.from('presencas').upsert({
      aula_id: aula.id,
      user_id: aluno.id,
      turma_id: turmaId,
      presente,
      origem: (anterior?.origem ?? 'manual_professor') satisfies OrigemPresenca,
      percentual_assistido: anterior?.percentual_assistido ?? null,
      editado_por: profile.id,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'aula_id,user_id,turma_id' }).select().single();
    setSalvando(null);
    if (error) { toast.error(error.message); return; }
    setPresencas((prev) => ({ ...prev, [aluno.id]: data as Presenca }));
    onSaved?.();
  };

  const presentes = alunos.filter((a) => presencas[a.id]?.presente).length;

  return (
    <Modal open onClose={onClose} size="lg"
      title={`Chamada — ${aula.ordem}. ${aula.titulo}`}
      footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}>
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : alunos.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="Nenhum aluno nesta turma/curso" description="Vincule alunos a esta turma em Usuários." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-ok" />
              <span className="text-fg-2"><strong className="text-fg">{presentes}</strong> de {alunos.length} presentes</span>
            </div>
            <Button variant="secondary" size="sm" icon={<Upload className="w-4 h-4" />} onClick={() => setImportOpen(true)}>
              Importar lista do Teams
            </Button>
          </div>
          <ul className="-mx-5">
            {alunos.map((al) => {
              const p = presencas[al.id];
              const presente = !!p?.presente;
              return (
                <li key={al.id} className="flex items-center gap-3 px-5 py-3 border-b border-line last:border-0">
                  <Avatar name={al.nome} email={al.email} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm font-medium truncate">{nomeDe(al)}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p ? (
                        <Badge tone={ORIGEM_TONE[p.origem]} className="flex-shrink-0">{ORIGEM_LABEL[p.origem]}</Badge>
                      ) : (
                        <span className="text-fg-3 text-xs">Sem registro</span>
                      )}
                      {p?.percentual_assistido != null && (
                        <span className="text-fg-3 text-xs tabular-nums">{Math.round(p.percentual_assistido)}% assistido</span>
                      )}
                      {p?.editado_por && <span className="text-fg-3 text-xs">· editado manualmente</span>}
                    </div>
                  </div>
                  <Switch checked={presente} disabled={salvando === al.id} onChange={(v) => marcar(al, v)}
                    label={<span className="text-xs whitespace-nowrap w-14 inline-block">{presente ? 'Presente' : 'Ausente'}</span>} />
                </li>
              );
            })}
          </ul>

          {importOpen && (
            <PresencaTeamsImportModal turmaId={turmaId} aulaId={aula.id} alunos={alunos}
              onClose={() => setImportOpen(false)}
              onDone={() => { load(); onSaved?.(); }} />
          )}
        </>
      )}
    </Modal>
  );
}
