/* ============================================================
   Domínio de usuários — normalização e validação compartilhadas
   entre a criação individual e a importação por planilha.
   ============================================================ */

export type Role = 'admin' | 'student' | 'professor' | 'monitor';
export type UserStatus = 'pending' | 'active' | 'blocked';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador', professor: 'Professor', monitor: 'Monitor', student: 'Aluno',
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'student', label: 'Aluno' },
  { value: 'professor', label: 'Professor' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'admin', label: 'Administrador' },
];

const ROLE_ALIASES: Record<string, Role> = {
  admin: 'admin', administrador: 'admin', administrator: 'admin',
  student: 'student', aluno: 'student', estudante: 'student',
  professor: 'professor', teacher: 'professor', 'docente': 'professor',
  monitor: 'monitor', tutor: 'monitor',
};

export function parseRole(value: unknown): Role | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return ROLE_ALIASES[key] ?? null;
}

export function statusLabel(status: string): string {
  return status === 'active' ? 'Ativo' : status === 'blocked' ? 'Bloqueado' : 'Pendente';
}

/* ─────────────────────────────── Email ─────────────────────────────── */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/* ─────────────────────────────── Telefone ──────────────────────────── */
/** Mantém dígitos e um "+" inicial opcional. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
/** Formata para exibição no padrão brasileiro quando aplicável. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/[^\d]/g, '');
  const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value;
}

/* ─────────────────────────────── Nome ──────────────────────────────── */
export function fullName(nome?: string | null, sobrenome?: string | null): string {
  return [nome, sobrenome].filter(Boolean).join(' ').trim();
}

/* ───────────────────── Modelo de importação (planilha) ─────────────── */
export const TEMPLATE_COLUMNS = [
  'Nome', 'Sobrenome', 'Email', 'Telefone', 'Empresa', 'Papel', 'Turma', 'Cursos', 'Enviar convite',
] as const;

export const TEMPLATE_SAMPLE_ROWS: string[][] = [
  ['Maria', 'Souza', 'maria.souza@empresa.com', '(11) 98888-0001', 'Acme Ltda', 'Aluno', 'Turma A', 'Introdução; Avançado', 'Sim'],
  ['João', 'Pereira', 'joao.pereira@empresa.com', '11988880002', 'Acme Ltda', 'Professor', 'Turma A', '', 'Não'],
];

/** Campos canônicos que o mapeador tenta reconhecer no cabeçalho. */
export type ImportField =
  | 'nome' | 'sobrenome' | 'email' | 'telefone' | 'empresa' | 'papel' | 'turma' | 'cursos' | 'enviar_convite';

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  nome: 'Nome', sobrenome: 'Sobrenome', email: 'E-mail', telefone: 'Telefone', empresa: 'Empresa',
  papel: 'Papel', turma: 'Turma', cursos: 'Cursos', enviar_convite: 'Enviar convite',
};

export const REQUIRED_IMPORT_FIELDS: ImportField[] = ['nome', 'sobrenome', 'email', 'telefone', 'empresa'];

/** Heurística de auto-mapeamento coluna → campo canônico. */
export function guessField(header: string): ImportField | null {
  const h = header.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const table: Record<string, ImportField> = {
    nome: 'nome', firstname: 'nome', primeironome: 'nome',
    sobrenome: 'sobrenome', lastname: 'sobrenome', surname: 'sobrenome',
    email: 'email', 'e-mail': 'email', mail: 'email',
    telefone: 'telefone', fone: 'telefone', celular: 'telefone', phone: 'telefone', whatsapp: 'telefone',
    empresa: 'empresa', company: 'empresa', organizacao: 'empresa', instituicao: 'empresa',
    papel: 'papel', perfil: 'papel', role: 'papel', funcao: 'papel', tipo: 'papel',
    turma: 'turma', turmas: 'turma', classe: 'turma', class: 'turma',
    curso: 'cursos', cursos: 'cursos', course: 'cursos', courses: 'cursos',
    enviarconvite: 'enviar_convite', convite: 'enviar_convite', invite: 'enviar_convite', sendinvite: 'enviar_convite',
  };
  return table[h] ?? null;
}

/** Interpreta valores booleanos de planilha (Sim/Não, true/false, 1/0). */
export function parseBool(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  if (['sim', 's', 'yes', 'y', 'true', '1', 'x'].includes(s)) return true;
  if (['não', 'nao', 'n', 'no', 'false', '0'].includes(s)) return false;
  return fallback;
}
