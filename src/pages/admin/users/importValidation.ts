import * as XLSX from 'xlsx';
import {
  normalizeEmail, isValidEmail, isValidPhone, parseRole, parseBool,
  TEMPLATE_COLUMNS, TEMPLATE_SAMPLE_ROWS, guessField,
  type Role, type ImportField,
} from '../../../lib/users';
import type { Turma, CursoInfo, TurmaSelection } from './pickers';

export type RawRow = {
  _id: string;
  nome: string; sobrenome: string; email: string; telefone: string; empresa: string;
  papel: string; turma: string; cursos: string; enviar: string;
};

export type RowStatus = 'ready' | 'warn' | 'error';

export type Resolved = {
  role: Role;
  turma_ids?: string[];
  turma_cursos?: { turma_id: string; curso_id: string }[];
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
  defaults: { role: Role; selection: TurmaSelection[]; sendInvite: boolean };
};

const FIELD_ORDER: ImportField[] = ['nome', 'sobrenome', 'email', 'telefone', 'empresa', 'papel', 'turma', 'cursos', 'enviar_convite'];

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
    telefone: get(row, 'telefone'), empresa: get(row, 'empresa'), papel: get(row, 'papel'),
    turma: get(row, 'turma'), cursos: get(row, 'cursos'), enviar: get(row, 'enviar_convite'),
  }));
}

/* ─────────────── Resolução de turmas/cursos por linha ─────────────── */
function resolveTurmaCursos(r: RawRow, role: Role, ctx: ValidateCtx): { value: Partial<Resolved>; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  if (r.turma.trim()) {
    const turma = ctx.turmas.find((t) => t.nome.toLowerCase() === r.turma.trim().toLowerCase());
    if (!turma) return { value: {}, errors: [`Turma "${r.turma}" não encontrada`], warnings: [] };
    if (role === 'student') {
      const names = r.cursos.split(/[;,/|]/).map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) return { value: {}, errors: ['Informe ao menos um curso para o aluno'], warnings: [] };
      const avail = ctx.coursesByTurma[turma.id] ?? [];
      const matched: string[] = []; const unknown: string[] = [];
      names.forEach((n) => {
        const c = avail.find((c) => c.titulo.toLowerCase() === n.toLowerCase());
        if (c) matched.push(c.id); else unknown.push(n);
      });
      if (unknown.length) return { value: {}, errors: [`Curso(s) não encontrado(s) em ${turma.nome}: ${unknown.join(', ')}`], warnings: [] };
      return { value: { turma_cursos: matched.map((cid) => ({ turma_id: turma.id, curso_id: cid })) }, errors, warnings: [] };
    }
    return { value: { turma_ids: [turma.id] }, errors, warnings: [] };
  }
  // Sem turma na linha → usa o padrão global
  const sel = ctx.defaults.selection;
  if (!sel.length) return { value: {}, errors: ['Turma não definida — defina um padrão ou informe na planilha'], warnings: [] };
  if (role === 'student') {
    if (sel.some((s) => s.curso_ids.length === 0)) return { value: {}, errors: ['Defina os cursos padrão para os alunos'], warnings: [] };
    return { value: { turma_cursos: sel.flatMap((s) => s.curso_ids.map((cid) => ({ turma_id: s.turma_id, curso_id: cid }))) }, errors, warnings: [] };
  }
  return { value: { turma_ids: sel.map((s) => s.turma_id) }, errors, warnings: [] };
}

/* ─────────────── Validação de todas as linhas ─────────────── */
export function validateRows(rows: RawRow[], ctx: ValidateCtx): ValidatedRow[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    const errors: string[] = []; const warnings: string[] = [];
    const email = normalizeEmail(r.email);
    const empty = !r.nome && !r.sobrenome && !r.email && !r.telefone && !r.empresa;

    if (empty) {
      return { ...r, status: 'error', errors: ['Linha vazia'], warnings: [], existing: false, resolved: null };
    }

    if (!r.nome.trim()) errors.push('Nome ausente');
    if (!r.sobrenome.trim()) errors.push('Sobrenome ausente');
    if (!r.email.trim()) errors.push('E-mail ausente');
    else if (!isValidEmail(email)) errors.push('E-mail inválido');
    if (!r.telefone.trim()) errors.push('Telefone ausente');
    else if (!isValidPhone(r.telefone)) errors.push('Telefone inválido');
    if (!r.empresa.trim()) errors.push('Empresa ausente');

    let role = ctx.defaults.role;
    if (r.papel.trim()) {
      const pr = parseRole(r.papel);
      if (!pr) errors.push(`Papel "${r.papel}" inválido`);
      else role = pr;
    }

    if (email && isValidEmail(email)) {
      if (seen.has(email)) errors.push('E-mail duplicado na planilha');
      else seen.add(email);
    }

    const existing = !!email && ctx.existingEmails.has(email);
    if (existing) warnings.push('Já cadastrado na plataforma');

    let turmaValue: Partial<Resolved> = {};
    if (role === 'student' || role === 'professor' || role === 'monitor') {
      const res = resolveTurmaCursos(r, role, ctx);
      res.errors.forEach((e) => errors.push(e));
      res.warnings.forEach((w) => warnings.push(w));
      turmaValue = res.value;
    }

    const sendInvite = r.enviar.trim() ? parseBool(r.enviar, ctx.defaults.sendInvite) : ctx.defaults.sendInvite;
    const status: RowStatus = errors.length ? 'error' : warnings.length ? 'warn' : 'ready';
    return {
      ...r, status, errors, warnings, existing,
      resolved: errors.length ? null : { role, ...turmaValue, sendInvite },
    };
  });
}

/* ─────────────── Modelo / relatório (download) ─────────────── */
export function downloadTemplate() {
  const aoa = [TEMPLATE_COLUMNS as unknown as string[], ...TEMPLATE_SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (TEMPLATE_COLUMNS as unknown as string[]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
  XLSX.writeFile(wb, 'modelo-importacao-usuarios.xlsx');
}

/** Modelo em branco (somente cabeçalho) — usado pelo botão "Baixar template". */
export function downloadEmptyTemplate() {
  const aoa = [TEMPLATE_COLUMNS as unknown as string[]];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (TEMPLATE_COLUMNS as unknown as string[]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuários');
  XLSX.writeFile(wb, 'modelo-usuarios.xlsx');
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
    [...(TEMPLATE_COLUMNS as unknown as string[]), 'Erros'],
    ...errored.map((r) => [r.nome, r.sobrenome, r.email, r.telefone, r.empresa, r.papel, r.turma, r.cursos, r.enviar, r.errors.join('; ')]),
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
