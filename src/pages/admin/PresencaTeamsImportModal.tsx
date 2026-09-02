import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, XCircle, Lock, Columns3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Alert, Badge, EmptyState, Tabs, Field, Select, cn } from '../../components/ui';
import { normalizeEmail } from '../../lib/users';
import {
  parsePresencaSheet, participantesFrom, nomesCorrespondem, CAMPO_LABEL, CAMPOS_OBRIGATORIOS,
  type ParticipanteTeams, type PlanilhaPresenca, type MapaColunas, type CampoTeams,
} from '../../lib/teamsAttendance';
import type { Presenca } from '../../lib/presenca';

type AlunoRow = { id: string; email: string; nome: string | null };
type Situacao = 'vinculado' | 'nao_matriculado' | 'nao_encontrado' | 'manual';
type Linha = ParticipanteTeams & { situacao: Situacao; alunoId?: string };

const CAMPOS: CampoTeams[] = ['nome', 'email', 'entrada', 'saida', 'duracao', 'funcao'];

const SITUACAO: Record<Situacao, { label: string; tone: 'success' | 'warn' | 'danger' | 'default'; desc: string }> = {
  vinculado: { label: 'Vinculado', tone: 'success', desc: 'Presença será registrada.' },
  nao_matriculado: { label: 'Não matriculado', tone: 'warn', desc: 'Participou, mas não está matriculado nesta turma/curso.' },
  nao_encontrado: { label: 'Não encontrado', tone: 'danger', desc: 'Nenhum usuário com este e-mail (ou fora das suas turmas).' },
  manual: { label: 'Lançamento manual', tone: 'default', desc: 'Já foi marcado pelo professor — será mantido como está.' },
};

/**
 * Importa qualquer lista de participação (Teams ou planilha equivalente) e cria
 * presença com `origem = 'teams_importado'` para quem está matriculado na
 * turma/curso. As colunas são detectadas automaticamente e podem ser ajustadas
 * manualmente. Registros já editados pelo professor não são sobrescritos.
 */
export default function PresencaTeamsImportModal({ turmaId, aulaId, alunos, onClose, onDone }: {
  turmaId: string;
  aulaId: string;
  alunos: AlunoRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [planilha, setPlanilha] = useState<PlanilhaPresenca | null>(null);
  const [map, setMap] = useState<MapaColunas | null>(null);
  const [etapa, setEtapa] = useState<'upload' | 'mapear' | 'revisar'>('upload');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [filtro, setFiltro] = useState<'todas' | Situacao>('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{ criadas: number; mantidas: number } | null>(null);

  const [existentes, setExistentes] = useState<Record<string, Presenca>>({});
  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from('presencas').select('*').eq('turma_id', turmaId).eq('aula_id', aulaId);
      setExistentes(Object.fromEntries(((data ?? []) as Presenca[]).map((p) => [p.user_id, p])));
    })();
  }, [turmaId, aulaId]);

  const porEmail = useMemo(
    () => new Map(alunos.map((a) => [normalizeEmail(a.email), a])),
    [alunos],
  );

  /** Vínculo pelo nome quando o relatório não traz o e-mail do participante. */
  const acharPorNome = (nome: string): AlunoRow | undefined => {
    if (!nome) return undefined;
    const cands = alunos.filter((a) => {
      const alvo = `${a.nome ?? ''} ${a.email.split('@')[0].replace(/[._-]+/g, ' ')}`;
      return nomesCorrespondem(nome, a.nome ?? '') || nomesCorrespondem(nome, alvo);
    });
    // Só vincula quando não há ambiguidade.
    return cands.length === 1 ? cands[0] : undefined;
  };

  /** Classifica os participantes contra os alunos da turma/curso. */
  const classificar = async (participantes: ParticipanteTeams[]) => {
    const desconhecidos = participantes.map((p) => p.email).filter((e) => e && !porEmail.has(e));
    let cadastrados = new Set<string>();
    if (desconhecidos.length) {
      const { data } = await supabase.from('profiles').select('email').in('email', desconhecidos);
      cadastrados = new Set((data ?? []).map((p) => normalizeEmail(p.email)));
    }
    setLinhas(participantes.map((p) => {
      const aluno = (p.email ? porEmail.get(p.email) : undefined) ?? acharPorNome(p.nome);
      if (!aluno) {
        return { ...p, situacao: p.email && cadastrados.has(p.email) ? 'nao_matriculado' : 'nao_encontrado' };
      }
      if (existentes[aluno.id]?.editado_por) return { ...p, situacao: 'manual', alunoId: aluno.id };
      return { ...p, situacao: 'vinculado', alunoId: aluno.id };
    }));
    setEtapa('revisar');
  };

  const onFile = async (file: File) => {
    setErro(null);
    try {
      const pl = await parsePresencaSheet(file);
      if (!pl.rows.length) {
        setErro('Não conseguimos ler nenhuma linha de dados no arquivo. Envie o relatório de participação (XLSX ou CSV).');
        return;
      }
      setFileName(file.name);
      setPlanilha(pl);
      setMap(pl.map);

      if (pl.map.email < 0 && pl.map.nome < 0) { setEtapa('mapear'); return; }

      const participantes = participantesFrom(pl, pl.map);
      if (!participantes.length) { setEtapa('mapear'); return; }
      await classificar(participantes);
    } catch {
      setErro('Não foi possível ler o arquivo. Envie um XLSX ou CSV do relatório de presença.');
    }
  };

  const aplicarMapeamento = async () => {
    if (!planilha || !map) return;
    const participantes = participantesFrom(planilha, map);
    if (!participantes.length) {
      setErro('Nenhum participante identificado nas colunas escolhidas. Confira o mapeamento de nome e e-mail.');
      return;
    }
    setErro(null);
    await classificar(participantes);
  };


  const contagem = useMemo(() => ({
    todas: linhas?.length ?? 0,
    vinculado: linhas?.filter((l) => l.situacao === 'vinculado').length ?? 0,
    nao_matriculado: linhas?.filter((l) => l.situacao === 'nao_matriculado').length ?? 0,
    nao_encontrado: linhas?.filter((l) => l.situacao === 'nao_encontrado').length ?? 0,
    manual: linhas?.filter((l) => l.situacao === 'manual').length ?? 0,
  }), [linhas]);

  const confirmar = async () => {
    if (!linhas || !profile) return;
    const aImportar = linhas.filter((l) => l.situacao === 'vinculado' && l.alunoId);
    setSalvando(true);
    setErro(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('presencas').upsert(
      aImportar.map((l) => ({
        aula_id: aulaId,
        user_id: l.alunoId!,
        turma_id: turmaId,
        presente: true,
        origem: 'teams_importado',
        // Preserva o quanto já havia sido assistido na plataforma.
        percentual_assistido: existentes[l.alunoId!]?.percentual_assistido ?? null,
        atualizado_em: new Date().toISOString(),
      })),
      { onConflict: 'aula_id,user_id,turma_id' },
    );
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setResultado({ criadas: aImportar.length, mantidas: contagem.manual });
    onDone();
  };

  const visiveis = linhas?.filter((l) => filtro === 'todas' || l.situacao === filtro) ?? [];

  const footer = resultado ? (
    <Button variant="primary" onClick={onClose}>Concluir</Button>
  ) : etapa === 'mapear' ? (
    <>
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" disabled={!map || (map.email < 0 && map.nome < 0)} onClick={aplicarMapeamento}>
        Continuar
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" loading={salvando} disabled={etapa !== 'revisar' || contagem.vinculado === 0} onClick={confirmar}>
        Registrar {contagem.vinculado} presença{contagem.vinculado === 1 ? '' : 's'}
      </Button>
    </>
  );

  return (
    <Modal open onClose={onClose} size="lg" title="Importar lista de presença" footer={footer}>
      {resultado ? (
        <div className="text-center py-6">
          <span className="w-12 h-12 rounded-full grid place-items-center mb-3 mx-auto bg-ok/12 text-ok"><CheckCircle2 className="w-6 h-6" /></span>
          <p className="text-fg font-medium">{resultado.criadas} presença{resultado.criadas === 1 ? '' : 's'} registrada{resultado.criadas === 1 ? '' : 's'}</p>
          {resultado.mantidas > 0 && (
            <p className="text-fg-3 text-sm mt-1">{resultado.mantidas} lançamento{resultado.mantidas === 1 ? '' : 's'} manual{resultado.mantidas === 1 ? '' : 'is'} preservado{resultado.mantidas === 1 ? '' : 's'}.</p>
          )}
        </div>
      ) : etapa === 'upload' ? (
        <div className="space-y-4">
          <button onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-line hover:border-brand/50 rounded-xl py-12 px-6 text-center transition-colors group">
            <span className="w-12 h-12 rounded-full bg-panel-3 grid place-items-center mx-auto mb-3 group-hover:bg-brand/10">
              <Upload className="w-5 h-5 text-fg-2 group-hover:text-brand" />
            </span>
            <p className="text-fg font-medium">Clique para enviar o relatório</p>
            <p className="text-fg-3 text-xs mt-1">XLSX, XLS, CSV ou TSV — colunas detectadas automaticamente</p>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          {erro && <Alert tone="danger">{erro}</Alert>}
        </div>
      ) : etapa === 'mapear' && planilha && map ? (
        <div className="space-y-4">
          {erro && <Alert tone="danger">{erro}</Alert>}
          <Alert tone="info">
            <strong className="text-fg">{fileName}</strong> — {planilha.rows.length} linha{planilha.rows.length === 1 ? '' : 's'}.
            {' '}Confirme de onde vem cada informação. Informe ao menos o nome ou o e-mail.
          </Alert>
          <div className="grid sm:grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <Field key={c} label={CAMPO_LABEL[c]} required={CAMPOS_OBRIGATORIOS.includes(c)}>
                <Select value={String(map[c])} onChange={(e) => setMap({ ...map, [c]: Number(e.target.value) })}>
                  <option value="-1">— não usar —</option>
                  {planilha.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          {planilha.rows[0] && (
            <div className="border border-line rounded-xl overflow-x-auto scrollbar-thin">
              <table className="text-xs w-full">
                <thead><tr>{planilha.headers.map((h, i) => <th key={i} className="text-left px-3 py-2 text-fg-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>
                  {planilha.rows.slice(0, 3).map((r, ri) => (
                    <tr key={ri} className="border-t border-line">
                      {planilha.headers.map((_, i) => <td key={i} className="px-3 py-2 text-fg-2 whitespace-nowrap">{r[i] ?? ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {erro && <Alert tone="danger">{erro}</Alert>}
          <Alert tone="info">
            <strong className="text-fg">{fileName}</strong> — {contagem.todas} participante{contagem.todas === 1 ? '' : 's'}.
            {' '}Só quem está matriculado nesta turma/curso recebe presença. Nada é gravado até você confirmar.
          </Alert>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={filtro} onChange={setFiltro} tabs={[
              { value: 'todas', label: 'Todos', count: contagem.todas },
              { value: 'vinculado', label: 'Vinculados', count: contagem.vinculado },
              { value: 'nao_matriculado', label: 'Não matriculados', count: contagem.nao_matriculado },
              { value: 'nao_encontrado', label: 'Não encontrados', count: contagem.nao_encontrado },
              ...(contagem.manual > 0 ? [{ value: 'manual' as const, label: 'Manuais', count: contagem.manual }] : []),
            ]} />
            <Button variant="ghost" onClick={() => setEtapa('mapear')} className="flex items-center gap-1.5 text-xs">
              <Columns3 className="w-3.5 h-3.5" /> Ajustar colunas
            </Button>
          </div>

          {visiveis.length === 0 ? <EmptyState title="Nenhum participante nesta situação" /> : (
            <ul className="border border-line rounded-xl divide-y divide-line max-h-80 overflow-y-auto scrollbar-thin">
              {visiveis.map((l) => {
                const s = SITUACAO[l.situacao];
                const Icon = l.situacao === 'vinculado' ? CheckCircle2
                  : l.situacao === 'nao_matriculado' ? AlertTriangle
                  : l.situacao === 'manual' ? Lock : XCircle;
                const detalhe = [l.duracao, l.entrada && l.saida ? `${l.entrada} → ${l.saida}` : null].filter(Boolean).join(' · ');
                return (
                  <li key={l.email} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon className={cn('w-4 h-4 flex-shrink-0',
                      l.situacao === 'vinculado' ? 'text-ok'
                        : l.situacao === 'nao_matriculado' ? 'text-warn'
                        : l.situacao === 'manual' ? 'text-fg-3' : 'text-danger')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm truncate">{l.nome || l.email.split('@')[0]}</p>
                      <p className="text-fg-3 text-xs truncate">{l.email}{detalhe ? ` · ${detalhe}` : ''}</p>
                    </div>
                    <Badge tone={s.tone} className="flex-shrink-0">{s.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-fg-3 text-xs">{SITUACAO[filtro === 'todas' ? 'vinculado' : filtro].desc}</p>
        </div>
      )}
    </Modal>
  );
}
