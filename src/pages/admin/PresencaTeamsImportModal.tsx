import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, XCircle, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal, Button, Alert, Badge, EmptyState, Tabs, cn } from '../../components/ui';
import { normalizeEmail } from '../../lib/users';
import { parseTeamsAttendance, type ParticipanteTeams } from '../../lib/teamsAttendance';
import type { Presenca } from '../../lib/presenca';

type AlunoRow = { id: string; email: string; nome: string | null };
type Situacao = 'vinculado' | 'nao_matriculado' | 'nao_encontrado' | 'manual';
type Linha = ParticipanteTeams & { situacao: Situacao; alunoId?: string };

const SITUACAO: Record<Situacao, { label: string; tone: 'success' | 'warn' | 'danger' | 'default'; desc: string }> = {
  vinculado: { label: 'Vinculado', tone: 'success', desc: 'Presença será registrada.' },
  nao_matriculado: { label: 'Não matriculado', tone: 'warn', desc: 'Participou, mas não está matriculado nesta turma/curso.' },
  nao_encontrado: { label: 'Não encontrado', tone: 'danger', desc: 'Nenhum usuário com este e-mail (ou fora das suas turmas).' },
  manual: { label: 'Lançamento manual', tone: 'default', desc: 'Já foi marcado pelo professor — será mantido como está.' },
};

/**
 * Importa a lista de participação exportada do Teams e cria presença com
 * `origem = 'teams_importado'` para quem está matriculado na turma/curso.
 * Registros já editados manualmente pelo professor não são sobrescritos.
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

  const onFile = async (file: File) => {
    setErro(null);
    try {
      const participantes = await parseTeamsAttendance(file);
      if (!participantes.length) {
        setErro('Não encontramos a lista de participantes no arquivo. Exporte o relatório de participação direto da reunião do Teams.');
        return;
      }
      // Quem não é aluno da turma pode existir como usuário da plataforma
      // (outra turma) ou não existir — a consulta separa os dois casos dentro
      // do que a RLS deixa o usuário atual enxergar.
      const desconhecidos = participantes.map((p) => p.email).filter((e) => !porEmail.has(e));
      let cadastrados = new Set<string>();
      if (desconhecidos.length) {
        const { data } = await supabase.from('profiles').select('email').in('email', desconhecidos);
        cadastrados = new Set((data ?? []).map((p) => normalizeEmail(p.email)));
      }

      setFileName(file.name);
      setLinhas(participantes.map((p) => {
        const aluno = porEmail.get(p.email);
        if (!aluno) return { ...p, situacao: cadastrados.has(p.email) ? 'nao_matriculado' : 'nao_encontrado' };
        if (existentes[aluno.id]?.editado_por) return { ...p, situacao: 'manual', alunoId: aluno.id };
        return { ...p, situacao: 'vinculado', alunoId: aluno.id };
      }));
    } catch {
      setErro('Não foi possível ler o arquivo. Envie o XLSX ou CSV exportado pelo Teams.');
    }
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
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" loading={salvando} disabled={!linhas || contagem.vinculado === 0} onClick={confirmar}>
        Registrar {contagem.vinculado} presença{contagem.vinculado === 1 ? '' : 's'}
      </Button>
    </>
  );

  return (
    <Modal open onClose={onClose} size="lg" title="Importar lista do Teams" footer={footer}>
      {resultado ? (
        <div className="text-center py-6">
          <span className="w-12 h-12 rounded-full grid place-items-center mb-3 mx-auto bg-ok/12 text-ok"><CheckCircle2 className="w-6 h-6" /></span>
          <p className="text-fg font-medium">{resultado.criadas} presença{resultado.criadas === 1 ? '' : 's'} registrada{resultado.criadas === 1 ? '' : 's'}</p>
          {resultado.mantidas > 0 && (
            <p className="text-fg-3 text-sm mt-1">{resultado.mantidas} lançamento{resultado.mantidas === 1 ? '' : 's'} manual{resultado.mantidas === 1 ? '' : 'is'} preservado{resultado.mantidas === 1 ? '' : 's'}.</p>
          )}
        </div>
      ) : !linhas ? (
        <div className="space-y-4">
          <button onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-line hover:border-brand/50 rounded-xl py-12 px-6 text-center transition-colors group">
            <span className="w-12 h-12 rounded-full bg-panel-3 grid place-items-center mx-auto mb-3 group-hover:bg-brand/10">
              <Upload className="w-5 h-5 text-fg-2 group-hover:text-brand" />
            </span>
            <p className="text-fg font-medium">Clique para enviar o relatório</p>
            <p className="text-fg-3 text-xs mt-1">XLSX ou CSV exportado pelo Teams</p>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          {erro && <Alert tone="danger">{erro}</Alert>}
        </div>
      ) : (
        <div className="space-y-4">
          {erro && <Alert tone="danger">{erro}</Alert>}
          <Alert tone="info">
            <strong className="text-fg">{fileName}</strong> — {contagem.todas} participante{contagem.todas === 1 ? '' : 's'}.
            {' '}Só quem está matriculado nesta turma/curso recebe presença. Nada é gravado até você confirmar.
          </Alert>

          <Tabs value={filtro} onChange={setFiltro} tabs={[
            { value: 'todas', label: 'Todos', count: contagem.todas },
            { value: 'vinculado', label: 'Vinculados', count: contagem.vinculado },
            { value: 'nao_matriculado', label: 'Não matriculados', count: contagem.nao_matriculado },
            { value: 'nao_encontrado', label: 'Não encontrados', count: contagem.nao_encontrado },
            ...(contagem.manual > 0 ? [{ value: 'manual' as const, label: 'Manuais', count: contagem.manual }] : []),
          ]} />

          {visiveis.length === 0 ? <EmptyState title="Nenhum participante nesta situação" /> : (
            <ul className="border border-line rounded-xl divide-y divide-line max-h-80 overflow-y-auto scrollbar-thin">
              {visiveis.map((l) => {
                const s = SITUACAO[l.situacao];
                const Icon = l.situacao === 'vinculado' ? CheckCircle2
                  : l.situacao === 'nao_matriculado' ? AlertTriangle
                  : l.situacao === 'manual' ? Lock : XCircle;
                return (
                  <li key={l.email} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon className={cn('w-4 h-4 flex-shrink-0',
                      l.situacao === 'vinculado' ? 'text-ok'
                        : l.situacao === 'nao_matriculado' ? 'text-warn'
                        : l.situacao === 'manual' ? 'text-fg-3' : 'text-danger')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-fg text-sm truncate">{l.nome || l.email.split('@')[0]}</p>
                      <p className="text-fg-3 text-xs truncate">{l.email}{l.duracao ? ` · ${l.duracao}` : ''}</p>
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
