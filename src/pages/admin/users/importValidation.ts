import * as XLSX from 'xlsx';
import {
  normalizeEmail, isValidEmail, isValidPhone, parseBool,
  TEMPLATE_COLUMNS, IMPORT_TEMPLATE_COLUMNS, IMPORT_TEMPLATE_SAMPLE_ROWS, guessField,
  type Role, type ImportField,
} from '../../../lib/users';
import type { Turma, CursoInfo, TurmaSelection } from './pickers';

export type RawRow = {
  _id: string;
  nome: string; sobrenome: string; email: string; telefone: string; empresa: string;
  turma: string; cursos: string; enviar: string;
};

export type RowStatus = 'ready' | 'warn' | 'error';

/** A importação por planilha é só para alunos. */
export type Resolved = {
  turma_cursos: { turma_id: string; curso_id: string }[];
  sendInvite: boolean;
};

export type ValidatedRow = RawRow & {
  status: RowStatus;
  errors: string[];
  warnings: string[];
  existing: boolean;
  resolved: Resolved | null;
};

export type ValidateCtx = {
  turmas: Turma[];
  coursesByTurma: Record<string, CursoInfo[]>;
  existingEmails: Set<string>;
  defaults: { selection: TurmaSelection[]; sendInvite: boolean };
};

const FIELD_ORDER: ImportField[] = ['nome', 'sobrenome', 'email', 'telefone', 'empresa', 'turma', 'cursos', 'enviar_convite'];

let _seq = 0;
const uid = () => `r${Date.now().toString(36)}_${(_seq++).toString(36)}`;

/* ─────────────── Leitura do arquivo (XLSX/XLS/CSV) ─────────────── */
export async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '', raw: false });
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = (matrix[0] ?? []).map((h) => String(h ?? '').trim());
  const rows = matrix.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? '').trim()));
  return { headers, rows };
}

/** Mapeamento inicial: para cada campo canônico, tenta achar a coluna. */
export function autoMap(headers: string[]): Record<ImportField, number> {
  const map = {} as Record<ImportField, number>;
  FIELD_ORDER.forEach((f) => { map[f] = -1; });
  headers.forEach((h, i) => {
    const f = guessField(h);
    if (f && map[f] === -1) map[f] = i;
  });
  return map;
}

/** Constrói as linhas canônicas a partir do mapeamento coluna→campo. */
export function buildRows(rawRows: string[][], map: Record<ImportField, number>): RawRow[] {
  const get = (row: string[], f: ImportField) => (map[f] >= 0 ? (row[map[f]] ?? '').trim() : '');
  return rawRows.map((row) => ({
    _id: uid(),
    nome: get(row, 'nome'), sobrenome: get(row, 'sobrenome'), email: get(row, 'email'),
    telefone: get(row, 'telefone'), empresa: get(row, 'empresa'),
    turma: get(row, 'turma'), cursos: get(row, 'cursos'), enviar: get(row, 'enviar_convite'),
  }));
}

/** A coluna "Turma" aceita o nome da turma OU o código curto dela (ex: "T008"). */
function findTurma(value: string, turmas: Turma[]): Turma | undefined {
  const v = value.trim().toLowerCase();
  return turmas.find((t) => t.nome.toLowerCase() === v || (t.codigo ?? '').toLowerCase() === v);
}

/* ─────────────── Resolução de turma/cursos por linha (só alunos) ─────────────── */
function resolveTurmaCursos(r: RawRow, ctx: ValidateCtx): { value: Partial<Resolved>; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const turma = r.turma.trim() ? findTurma(r.turma, ctx.turmas) : undefined;
  if (r.turma.trim() && !turma) return { value: {}, errors: [`Turma "${r.turma}" não encontrada (use o nome ou o ID/código da turma)`], warnings: [] };
  // Sem turma na linha → usa a turma padrão definida no assistente (se só uma).
  const turmaFinal = turma ?? (ctx.defaults.selection.length === 1 ? ctx.turmas.find((t) => t.id === ctx.defaults.selection[0].turma_id) : undefined);
  if (!turmaFinal) return { value: {}, errors: ['Turma não definida — informe na planilha (nome ou ID) ou defina uma turma padrão'], warnings: [] };

  const avail = ctx.coursesByTurma[turmaFinal.id] ?? [];
  const names = r.cursos.split(/[;,/|]/).map((s) => s.trim()).filter(Boolean);
  let matched: string[];
  if (names.length) {
    const unknown: string[] = [];
    matched = [];
    names.forEach((n) => {
      const c = avail.find((c) => c.titulo.toLowerCase() === n.toLowerCase());
      if (c) matched.push(c.id); else unknown.push(n);
    });
    if (unknown.length) return { value: {}, errors: [`Curso(s) não encontrado(s) em ${turmaFinal.nome}: ${unknown.join(', ')}`], warnings: [] };
  } else {
    // Sem coluna de cursos preenchida: usa os cursos padrão dessa turma (se
    // definidos no assistente) ou, na falta deles, todos os cursos da turma.
    const def = ctx.defaults.selection.find((s) => s.turma_id === turmaFinal.id);
    matched = def?.curso_ids.length ? def.curso_ids : avail.map((c) => c.id);
    if (!matched.length) return { value: {}, errors: [`Turma "${turmaFinal.nome}" não tem cursos vinculados`], warnings: [] };
  }
  return { value: { turma_cursos: matched.map((cid) => ({ turma_id: turmaFinal.id, curso_id: cid })) }, errors, warnings: [] };
}

/* ─────────────── Validação de todas as linhas ─────────────── */
export function validateRows(rows: RawRow[], ctx: ValidateCtx): ValidatedRow[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const errors: string[] = []; const warnings: string[] = [];
    const email = normalizeEmail(r.email);
    const empty = !r.nome && !r.sobrenome && !r.email && !r.telefone && !r.empresa && !r.turma;

    if (empty) {
      return { ...r, status: 'error', errors: ['Linha vazia'], warnings: [], existing: false, resolved: null };
    }

    // Só e-mail é obrigatório aqui — nome/sobrenome/telefone/empresa podem
    // ficar em branco e ser completados depois. Quando preenchidos, ainda
    // validamos o formato.
    if (!r.email.trim()) errors.push('E-mail ausente');
    else if (!isValidEmail(email)) errors.push('E-mail inválido');
    if (r.telefone.trim() && !isValidPhone(r.telefone)) errors.push('Telefone inválido');

    if (email && isValidEmail(email)) {
      if (seen.has(email)) errors.push('E-mail duplicado na planilha');
      else seen.add(email);
    }

    const existing = !!email && ctx.existingEmails.has(email);
    if (existing) warnings.push('Já cadastrado na plataforma');

    const res = resolveTurmaCursos(r, ctx);
    res.errors.forEach((e) => errors.push(e));
    res.warnings.forEach((w) => warnings.push(w));

    const sendInvite = r.enviar.trim() ? parseBool(r.enviar, ctx.defaults.sendInvite) : ctx.defaults.sendInvite;
    const status: RowStatus = errors.length ? 'error' : warnings.length ? 'warn' : 'ready';
    return {
      ...r, status, errors, warnings, existing,
      resolved: errors.length ? null : { turma_cursos: res.value.turma_cursos ?? [], sendInvite },
    };
  });
}

/* ─────────────── Modelo / relatório (download) ─────────────── */
/** Modelo de importação — só para alunos, sem coluna de Papel. */
export function downloadTemplate() {
  const aoa = [IMPORT_TEMPLATE_COLUMNS as unknown as string[], ...IMPORT_TEMPLATE_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (IMPORT_TEMPLATE_COLUMNS as unknown as string[]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
  XLSX.writeFile(wb, 'modelo-importacao-alunos.xlsx');
}

/** Modelo em branco (somente cabeçalho) — usado pelo botão "Baixar template". */
export function downloadEmptyTemplate() {
  const aoa = [IMPORT_TEMPLATE_COLUMNS as unknown as string[]];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (IMPORT_TEMPLATE_COLUMNS as unknown as string[]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alunos');
  XLSX.writeFile(wb, 'modelo-alunos.xlsx');
}

/** Exporta as linhas visíveis (filtradas) usando o mesmo cabeçalho da importação. */
export type ExportUser = {
  nome: string | null; sobrenome: string | null; email: string;
  telefone: string | null; empresa: string | null; role: Role;
  turmas: { nome: string }[];
};
const ROLE_EXPORT_LABEL: Record<Role, string> = {
  admin: 'Administrador', professor: 'Professor', monitor: 'Monitor', student: 'Aluno', embaixador: 'Embaixador',
};
export function exportUsersToXlsx(users: ExportUser[]) {
  const rows = users.map((u) => [
    u.nome ?? '', u.sobrenome ?? '', u.email, u.telefone ?? '', u.empresa ?? '',
    ROLE_EXPORT_LABEL[u.role], u.turmas.map((t) => t.nome).join('; '), '', '',
  ]);
  const aoa = [TEMPLATE_COLUMNS as unknown as string[], ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (TEMPLATE_COLUMNS as unknown as string[]).map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `usuarios-${stamp}.xlsx`);
}


export function downloadErrorRows(rows: ValidatedRow[]) {
  const errored = rows.filter((r) => r.status === 'error');
  if (!errored.length) return;
  const aoa = [
    [...(IMPORT_TEMPLATE_COLUMNS as unknown as string[]), 'Erros'],
    ...errored.map((r) => [r.nome, r.sobrenome, r.email, r.telefone, r.empresa, r.turma, r.cursos, r.enviar, r.errors.join('; ')]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Erros');
  XLSX.writeFile(wb, 'importacao-linhas-com-erro.xlsx');
}

export function downloadFailureReport(failures: { email: string; error: string }[]) {
  if (!failures.length) return;
  const aoa = [['E-mail', 'Erro'], ...failures.map((f) => [f.email, f.error])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Falhas');
  XLSX.writeFile(wb, 'importacao-falhas.xlsx');
}
