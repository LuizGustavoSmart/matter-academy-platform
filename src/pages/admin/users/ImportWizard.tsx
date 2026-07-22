import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, Upload, ArrowRight, ArrowLeft, Trash2, CheckCircle2,
  AlertTriangle, XCircle, RotateCcw,
} from 'lucide-react';
import { supabase, callFn } from '../../../lib/supabase';
import {
  Drawer, Button, Select, Switch, Radio, Alert, Badge, Tabs, EmptyState, ProgressBar, Pagination, IconButton, cn,
} from '../../../components/ui';
import { ROLE_OPTIONS, ROLE_LABEL, IMPORT_FIELD_LABEL, REQUIRED_IMPORT_FIELDS, normalizeEmail, type Role, type ImportField } from '../../../lib/users';
import { TurmaCoursePicker, type Turma, type CursoInfo, type TurmaSelection } from './pickers';
import {
  parseSpreadsheet, autoMap, buildRows, validateRows, downloadTemplate, downloadErrorRows, downloadFailureReport,
  type RawRow, type ValidatedRow,
} from './importValidation';

type DupPolicy = 'skip' | 'update' | 'links';
type Report = { created: number; updated: number; skipped: number; failures: { email: string; error: string }[] };

const STEPS = ['Enviar arquivo', 'Mapear colunas', 'Validar e corrigir', 'Revisar', 'Concluído'];
const EDITABLE: (keyof RawRow)[] = ['nome', 'sobrenome', 'email', 'telefone', 'empresa'];
const PAGE_SIZE = 25;

export function ImportWizard({
  open, onClose, turmas, coursesByTurma, existingUsers, onDone,
}: {
  open: boolean;
  onClose: () => void;
  turmas: Turma[];
  coursesByTurma: Record<string, CursoInfo[]>;
  existingUsers: { id: string; email: string }[];
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<ImportField, number>>({} as Record<ImportField, number>);
  const [rows, setRows] = useState<RawRow[]>([]);

  const [defRole, setDefRole] = useState<Role>('student');
  const [defSelection, setDefSelection] = useState<TurmaSelection[]>([]);
  const [defSendInvite, setDefSendInvite] = useState(true);
  const [dupPolicy, setDupPolicy] = useState<DupPolicy>('skip');

  const [filter, setFilter] = useState<'all' | 'ready' | 'warn' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [processing, setProcessing] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const existingEmails = useMemo(() => new Set(existingUsers.map((u) => u.email.toLowerCase())), [existingUsers]);
  const emailToId = useMemo(() => new Map(existingUsers.map((u) => [u.email.toLowerCase(), u.id])), [existingUsers]);

  useEffect(() => {
    if (!open) return;
    setStep(0); setFileName(''); setHeaders([]); setRawRows([]); setRows([]);
    setDefRole('student'); setDefSelection([]); setDefSendInvite(true); setDupPolicy('skip');
    setFilter('all'); setPage(1); setParseErr(null); setProcessing(null); setReport(null);
  }, [open]);

  const validated = useMemo(
    () => validateRows(rows, { turmas, coursesByTurma, existingEmails, defaults: { role: defRole, selection: defSelection, sendInvite: defSendInvite } }),
    [rows, turmas, coursesByTurma, existingEmails, defRole, defSelection, defSendInvite],
  );
  const counts = useMemo(() => ({
    total: validated.length,
    ready: validated.filter((r) => r.status === 'ready').length,
    warn: validated.filter((r) => r.status === 'warn').length,
    error: validated.filter((r) => r.status === 'error').length,
  }), [validated]);

  /* ─────────── Upload ─────────── */
  const onFile = async (file: File) => {
    setParseErr(null);
    try {
      const { headers: h, rows: r } = await parseSpreadsheet(file);
      if (h.length === 0 || r.length === 0) { setParseErr('A planilha está vazia ou não pôde ser lida.'); return; }
      setFileName(file.name); setHeaders(h); setRawRows(r);
      setMap(autoMap(h));
      setStep(1);
    } catch {
      setParseErr('Não foi possível ler o arquivo. Verifique se é um XLSX, XLS ou CSV válido.');
    }
  };

  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((f) => (map[f] ?? -1) < 0);

  const confirmMapping = () => {
    setRows(buildRows(rawRows, map));
    setStep(2);
  };

  const updateCell = (id: string, key: keyof RawRow, value: string) => {
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, [key]: value } : r)));
  };
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));

  /* ─────────── Processing ─────────── */
  const processable = validated.filter((r) => r.status !== 'error' && (!r.existing || dupPolicy !== 'skip'));

  const runProcess = async (list: ValidatedRow[], base: Report) => {
    setStep(4);
    setProcessing({ done: 0, total: list.length });
    const rep: Report = { ...base, failures: [...base.failures] };
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const email = normalizeEmail(r.email);
      try {
        if (r.existing) {
          const id = emailToId.get(email);
          if (!id) throw new Error('Usuário existente não localizado');
          if (dupPolicy === 'update') {
            await callFn('admin-users', 'update', {
              user_id: id, nome: r.nome, sobrenome: r.sobrenome, telefone: r.telefone, empresa: r.empresa,
              role: r.resolved!.role,
              ...(r.resolved!.turma_cursos ? { turma_cursos: r.resolved!.turma_cursos } : { turma_ids: r.resolved!.turma_ids ?? [] }),
            });
            rep.updated++;
          } else if (dupPolicy === 'links') {
            const { data: cur } = await supabase.from('user_turmas').select('turma_id,curso_id').eq('user_id', id);
            const key = (t: string, c: string | null) => `${t}::${c ?? ''}`;
            const have = new Set((cur ?? []).map((x) => key(x.turma_id, x.curso_id)));
            const incoming = r.resolved!.turma_cursos
              ? r.resolved!.turma_cursos.map((p) => ({ turma_id: p.turma_id, curso_id: p.curso_id }))
              : (r.resolved!.turma_ids ?? []).map((t) => ({ turma_id: t, curso_id: null as string | null }));
            const toAdd = incoming.filter((p) => !have.has(key(p.turma_id, p.curso_id)));
            if (toAdd.length) await supabase.from('user_turmas').insert(toAdd.map((p) => ({ user_id: id, ...p })));
            rep.updated++;
          } else { rep.skipped++; }
        } else {
          await callFn('admin-users', 'create', {
            email, nome: r.nome, sobrenome: r.sobrenome, telefone: r.telefone, empresa: r.empresa,
            role: r.resolved!.role, send_invite: r.resolved!.sendInvite,
            ...(r.resolved!.turma_cursos ? { turma_cursos: r.resolved!.turma_cursos } : { turma_ids: r.resolved!.turma_ids ?? [] }),
          });
          rep.created++;
        }
      } catch (err) {
        rep.failures.push({ email: email || '(sem e-mail)', error: (err as Error).message });
      }
      setProcessing({ done: i + 1, total: list.length });
    }
    setProcessing(null);
    setReport(rep);
    onDone();
  };

  const start = () => runProcess(processable, { created: 0, updated: 0, skipped: 0, failures: [] });

  const reprocessFailures = () => {
    if (!report) return;
    const failedEmails = new Set(report.failures.map((f) => f.email));
    const retry = validated.filter((r) => r.status !== 'error' && failedEmails.has(normalizeEmail(r.email)) && (!r.existing || dupPolicy !== 'skip'));
    if (retry.length) runProcess(retry, { created: report.created, updated: report.updated, skipped: report.skipped, failures: [] });
  };

  /* ─────────── Render ─────────── */
  const visible = validated.filter((r) => filter === 'all' || r.status === filter);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const footer = (() => {
    if (step === 0) return <Button variant="secondary" onClick={onClose}>Cancelar</Button>;
    if (step === 1) return (
      <>
        <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setStep(0)}>Voltar</Button>
        <Button variant="primary" iconRight={<ArrowRight className="w-4 h-4" />} disabled={missingRequired.length > 0} onClick={confirmMapping}>Continuar</Button>
      </>
    );
    if (step === 2) return (
      <>
        <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setStep(1)}>Voltar</Button>
        <Button variant="primary" iconRight={<ArrowRight className="w-4 h-4" />} disabled={counts.total === 0 || processable.length === 0} onClick={() => setStep(3)}>
          Revisar ({processable.length})
        </Button>
      </>
    );
    if (step === 3) return (
      <>
        <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setStep(2)}>Voltar</Button>
        <Button variant="primary" loading={!!processing} onClick={start}>Confirmar e importar</Button>
      </>
    );
    return (
      <>
        {report && report.failures.length > 0 && <Button variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={reprocessFailures}>Reprocessar falhas</Button>}
        <Button variant="primary" onClick={onClose}>Concluir</Button>
      </>
    );
  })();

  return (
    <Drawer open={open} onClose={onClose} title="Importar usuários por planilha" width="xl" footer={footer}
      subtitle={fileName ? `Arquivo: ${fileName}` : 'Aceita XLSX, XLS e CSV'}>

      {/* Stepper */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto scrollbar-thin pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
            <span className={cn('w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold',
              i < step ? 'bg-brand text-brand-ink' : i === step ? 'bg-brand/15 text-brand border border-brand/40' : 'bg-panel-3 text-fg-3')}>
              {i < step ? '✓' : i + 1}
            </span>
            <span className={cn('text-xs whitespace-nowrap', i === step ? 'text-fg font-medium' : 'text-fg-3')}>{s}</span>
            {i < STEPS.length - 1 && <span className="w-4 h-px bg-line mx-1" />}
          </div>
        ))}
      </div>

      {/* ─────────── STEP 0: Upload ─────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-3/30 p-4">
            <div className="min-w-0">
              <p className="text-fg text-sm font-medium">Baixe o modelo</p>
              <p className="text-fg-3 text-xs mt-0.5">Planilha com as colunas esperadas e exemplos preenchidos.</p>
            </div>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={downloadTemplate}>Modelo .xlsx</Button>
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-line hover:border-brand/50 rounded-xl py-12 px-6 text-center transition-colors group"
          >
            <span className="w-12 h-12 rounded-full bg-panel-3 grid place-items-center mx-auto mb-3 group-hover:bg-brand/10">
              <Upload className="w-5 h-5 text-fg-2 group-hover:text-brand" />
            </span>
            <p className="text-fg font-medium">Clique para enviar a planilha</p>
            <p className="text-fg-3 text-xs mt-1">XLSX, XLS ou CSV — até ~5 mil linhas</p>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

          {parseErr && <Alert tone="danger">{parseErr}</Alert>}
        </div>
      )}

      {/* ─────────── STEP 1: Mapping ─────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-fg-2 text-sm">Confirme a correspondência entre as colunas da planilha e os campos do sistema. Detectamos {headers.length} colunas e {rawRows.length} linhas.</p>
          {missingRequired.length > 0 && (
            <Alert tone="warn">Mapeie os campos obrigatórios: {missingRequired.map((f) => IMPORT_FIELD_LABEL[f]).join(', ')}.</Alert>
          )}
          <div className="space-y-2.5">
            {(Object.keys(IMPORT_FIELD_LABEL) as ImportField[]).map((f) => {
              const required = REQUIRED_IMPORT_FIELDS.includes(f);
              return (
                <div key={f} className="grid grid-cols-[1fr,auto,1.4fr] items-center gap-3">
                  <span className="text-sm text-fg-2 flex items-center gap-1">{IMPORT_FIELD_LABEL[f]}{required && <span className="text-danger">*</span>}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-fg-3" />
                  <Select value={map[f] ?? -1} onChange={(e) => setMap((m) => ({ ...m, [f]: Number(e.target.value) }))} invalid={required && (map[f] ?? -1) < 0}>
                    <option value={-1}>— não mapear —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────── STEP 2: Validate ─────────── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Definições globais */}
          <div className="rounded-xl border border-line p-4 space-y-4">
            <p className="text-fg text-sm font-medium">Definições aplicadas às linhas sem valor próprio</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label>Papel padrão</label>
                <Select value={defRole} onChange={(e) => setDefRole(e.target.value as Role)}>
                  {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="flex items-end">
                <Switch checked={defSendInvite} onChange={setDefSendInvite} label="Enviar convite por padrão" />
              </div>
            </div>
            {(defRole === 'student' || defRole === 'professor' || defRole === 'monitor') && (
              <div>
                <label>{defRole === 'student' ? 'Turmas e cursos padrão' : 'Turmas padrão'}</label>
                <TurmaCoursePicker turmas={turmas} coursesByTurma={coursesByTurma} value={defSelection} onChange={setDefSelection} showCourses={defRole === 'student'} />
              </div>
            )}
            <div>
              <label>Quando o e-mail já existe</label>
              <div className="flex flex-wrap gap-4 mt-1">
                <Radio checked={dupPolicy === 'skip'} onChange={() => setDupPolicy('skip')} label="Ignorar" name="dup" />
                <Radio checked={dupPolicy === 'update'} onChange={() => setDupPolicy('update')} label="Atualizar dados" name="dup" />
                <Radio checked={dupPolicy === 'links'} onChange={() => setDupPolicy('links')} label="Adicionar apenas vínculos" name="dup" />
              </div>
            </div>
          </div>

          {/* Resumo + filtros */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs
              value={filter}
              onChange={(v) => { setFilter(v); setPage(1); }}
              tabs={[
                { value: 'all', label: 'Todas', count: counts.total },
                { value: 'ready', label: 'Prontas', count: counts.ready },
                { value: 'warn', label: 'Avisos', count: counts.warn },
                { value: 'error', label: 'Erros', count: counts.error },
              ]}
            />
            {counts.error > 0 && <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => downloadErrorRows(validated)}>Baixar erros</Button>}
          </div>

          {visible.length === 0 ? (
            <EmptyState title="Nenhuma linha nesta situação" />
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin border border-line rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-panel-2/50 text-left text-fg-3 text-[11px] uppercase tracking-wider">
                      <th className="px-2 py-2 w-8"></th>
                      {EDITABLE.map((k) => <th key={k} className="px-2 py-2 font-medium">{k}</th>)}
                      <th className="px-2 py-2 font-medium">papel</th>
                      <th className="px-2 py-2 font-medium min-w-[180px]">situação</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r._id} className="border-b border-line last:border-0 align-middle">
                        <td className="px-2 py-1.5 text-center">
                          {r.status === 'ready' ? <CheckCircle2 className="w-4 h-4 text-ok inline" />
                            : r.status === 'warn' ? <AlertTriangle className="w-4 h-4 text-warn inline" />
                            : <XCircle className="w-4 h-4 text-danger inline" />}
                        </td>
                        {EDITABLE.map((k) => (
                          <td key={k} className="px-1 py-1">
                            <input
                              value={r[k]}
                              onChange={(e) => updateCell(r._id, k, e.target.value)}
                              className={cn('!py-1 !px-2 !text-[13px] !bg-transparent !border-transparent hover:!border-line focus:!bg-panel-3',
                                r.errors.some((m) => m.toLowerCase().includes(k)) && '!border-danger/50')}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1">
                          <Select value={r.papel} onChange={(e) => updateCell(r._id, 'papel', e.target.value)}
                            className="!py-1 !px-2 !text-[13px] !bg-transparent !border-transparent hover:!border-line">
                            <option value="">{ROLE_LABEL[defRole]} (padrão)</option>
                            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.label}>{o.label}</option>)}
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {r.errors.map((m, i) => <Badge key={`e${i}`} tone="danger">{m}</Badge>)}
                            {r.warnings.map((m, i) => <Badge key={`w${i}`} tone="warn">{m}</Badge>)}
                            {r.status === 'ready' && <span className="text-fg-3 text-xs">Pronta</span>}
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <IconButton label="Remover linha" variant="danger" size="sm" onClick={() => removeRow(r._id)}><Trash2 className="w-4 h-4" /></IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageCount={pageCount} onPage={setPage} total={visible.length} pageSize={PAGE_SIZE} />
            </>
          )}
        </div>
      )}

      {/* ─────────── STEP 3: Review ─────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-fg-2 text-sm">Confira o resumo antes de processar. Nenhum usuário é criado até você confirmar.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'A criar', value: processable.filter((r) => !r.existing).length, tone: 'text-brand' },
              { label: dupPolicy === 'skip' ? 'Ignorados' : 'A atualizar', value: dupPolicy === 'skip' ? validated.filter((r) => r.existing).length : processable.filter((r) => r.existing).length, tone: 'text-fg' },
              { label: 'Avisos', value: counts.warn, tone: 'text-warn' },
              { label: 'Com erro (fora)', value: counts.error, tone: 'text-danger' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-line p-4">
                <p className={cn('text-2xl font-display font-semibold tabular-nums', c.tone)}>{c.value}</p>
                <p className="text-fg-3 text-xs mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          {counts.error > 0 && <Alert tone="warn">{counts.error} linha(s) com erro não serão processadas. Volte para corrigir ou baixe-as para revisar.</Alert>}
          <Alert tone="info">
            Serão processadas <strong className="text-fg">{processable.length}</strong> linha(s):
            {' '}criar novos usuários{dupPolicy !== 'skip' ? ' e atualizar existentes' : ' (existentes ignorados)'}.
          </Alert>
        </div>
      )}

      {/* ─────────── STEP 4: Processing / Report ─────────── */}
      {step === 4 && (
        <div className="space-y-5">
          {processing ? (
            <div className="py-8 text-center">
              <p className="text-fg font-medium mb-3">Processando {processing.done} de {processing.total}…</p>
              <ProgressBar value={(processing.done / Math.max(1, processing.total)) * 100} className="max-w-md mx-auto" />
              <p className="text-fg-3 text-xs mt-3">Não feche esta janela até concluir.</p>
            </div>
          ) : report ? (
            <>
              <div className="flex flex-col items-center text-center py-2">
                <span className={cn('w-12 h-12 rounded-full grid place-items-center mb-3', report.failures.length ? 'bg-warn/12 text-warn' : 'bg-ok/12 text-ok')}>
                  {report.failures.length ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </span>
                <p className="text-fg font-medium">Importação concluída</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ReportTile label="Criados" value={report.created} tone="text-ok" />
                <ReportTile label="Atualizados" value={report.updated} tone="text-info" />
                <ReportTile label="Ignorados" value={report.skipped} tone="text-fg-2" />
                <ReportTile label="Falhas" value={report.failures.length} tone="text-danger" />
              </div>
              {report.failures.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg-2 text-sm">Falhas</p>
                    <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => downloadFailureReport(report.failures)}>Baixar relatório</Button>
                  </div>
                  <div className="border border-line rounded-lg divide-y divide-line max-h-48 overflow-y-auto scrollbar-thin">
                    {report.failures.map((f, i) => (
                      <div key={i} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                        <span className="text-fg-2 truncate">{f.email}</span>
                        <span className="text-danger text-xs flex-shrink-0">{f.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

function ReportTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className={cn('text-2xl font-display font-semibold tabular-nums', tone)}>{value}</p>
      <p className="text-fg-3 text-xs mt-1">{label}</p>
    </div>
  );
}
