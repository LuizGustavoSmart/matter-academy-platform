/* Leitura flexível de relatórios de presença (Microsoft Teams e planilhas
   genéricas). Não depende de uma estrutura fixa: detecta o separador, a
   codificação (inclusive UTF-16, padrão do Teams), acha a linha de cabeçalho
   dentro de relatórios em seções ("1. Resumo", "2. Participantes"...) e
   identifica as colunas por semelhança de nome — com fallback por conteúdo
   (coluna com mais e-mails) e possibilidade de mapeamento manual. */
import * as XLSX from 'xlsx';
import { normalizeEmail, isValidEmail } from './users';

export type CampoTeams = 'nome' | 'email' | 'entrada' | 'saida' | 'duracao' | 'funcao';

export type ParticipanteTeams = {
  nome: string;
  email: string;
  duracao: string;
  entrada?: string;
  saida?: string;
  funcao?: string;
};

export type MapaColunas = Record<CampoTeams, number>;

export type PlanilhaPresenca = {
  /** Cabeçalho detectado (ou colunas genéricas "Coluna 1..." quando não houver). */
  headers: string[];
  /** Linhas de dados já normalizadas em texto. */
  rows: string[][];
  /** Mapeamento automático campo → índice da coluna (-1 quando não identificado). */
  map: MapaColunas;
};

export const CAMPO_LABEL: Record<CampoTeams, string> = {
  nome: 'Nome',
  email: 'E-mail',
  entrada: 'Primeira entrada',
  saida: 'Última saída',
  duracao: 'Duração',
  funcao: 'Função',
};

/** Campos sem os quais a importação não funciona (basta e-mail OU nome). */
export const CAMPOS_OBRIGATORIOS: CampoTeams[] = [];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Termos por campo, do mais específico para o mais genérico. */
const SINONIMOS: Record<CampoTeams, string[][]> = {
  email: [['email', 'e mail', 'endereco de email', 'email address', 'mail'], ['upn', 'user principal name', 'usuario', 'login']],
  nome: [
    ['nome', 'nome completo', 'name', 'full name', 'display name', 'nome de exibicao', 'participante', 'participant', 'aluno', 'attendee'],
  ],
  entrada: [['primeira entrada', 'hora de entrada', 'entrada', 'join time', 'first join', 'inicio', 'hora de inicio', 'joined']],
  saida: [['ultima saida', 'hora de saida', 'saida', 'leave time', 'last leave', 'termino', 'hora de termino', 'left']],
  duracao: [['duracao da reuniao', 'duracao', 'duration', 'tempo de participacao', 'in meeting duration', 'tempo', 'attendance duration']],
  funcao: [['funcao', 'role', 'papel', 'perfil']],
};

/** Início de uma nova seção do relatório: "3. Atividades na reunião". */
const RE_SECAO = /^\d+\.\s/;
const RE_EMAIL_VALOR = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pontuaHeader(header: string, termos: string[][]): number {
  const h = norm(header);
  if (!h) return 0;
  for (let tier = 0; tier < termos.length; tier++) {
    const base = 100 - tier * 30;
    for (const t of termos[tier]) {
      if (h === t) return base + 20;
      if (h.startsWith(t) || h.endsWith(t)) return base + 10;
      if (h.includes(t)) return base;
    }
  }
  return 0;
}

/* ─────────────── Leitura do arquivo → matriz de texto ─────────────── */
function decodeTexto(buf: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buf);
  if (!bytes.length) return null;
  const amostra = bytes.subarray(0, Math.min(bytes.length, 4096));
  const utf16le = (bytes[0] === 0xff && bytes[1] === 0xfe) || amostra.filter((_, i) => i % 2 === 1 && amostra[i] === 0).length > amostra.length / 6;
  const utf16be = bytes[0] === 0xfe && bytes[1] === 0xff;
  try {
    if (utf16be) return new TextDecoder('utf-16be').decode(bytes);
    if (utf16le) return new TextDecoder('utf-16le').decode(bytes);
    // Binário (xlsx/xls) — deixa para a lib.
    if (amostra.includes(0)) return null;
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  }
}

function sniffDelimiter(texto: string): string {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  const cands = ['\t', ';', ',', '|'];
  let best = '\t';
  let bestScore = -1;
  for (const d of cands) {
    const counts = linhas.map((l) => l.split(d).length - 1).filter((n) => n > 0);
    const score = counts.length ? counts.reduce((a, b) => a + b, 0) : 0;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function splitLinha(linha: string, d: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (quoted && linha[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === d && !quoted) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^\ufeff/, ''));
}

async function lerMatriz(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const texto = decodeTexto(buf);
  if (texto && /[\t;,|]/.test(texto)) {
    const d = sniffDelimiter(texto);
    return texto.split(/\r?\n/).map((l) => splitLinha(l, d));
  }
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  let matrix = XLSX.utils
    .sheet_to_json<string[]>(ws, { header: 1, blankrows: true, defval: '', raw: false })
    .map((r) => (r ?? []).map((c) => String(c ?? '').trim()));
  if (matrix.length && matrix.every((r) => r.length <= 1)) {
    const d = sniffDelimiter(matrix.map((r) => r[0] ?? '').join('\n'));
    matrix = matrix.map((r) => splitLinha(r[0] ?? '', d));
  }
  return matrix;
}

/* ─────────────── Detecção do cabeçalho e das colunas ─────────────── */
function escolheHeader(matrix: string[][]): number {
  let melhor = -1;
  let melhorScore = 0;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    const preenchidas = row.filter((c) => c).length;
    if (preenchidas < 2) continue;
    // Cabeçalho não contém e-mails nem datas nos valores.
    if (row.some((c) => RE_EMAIL_VALOR.test(c))) continue;
    let score = preenchidas;
    (Object.keys(SINONIMOS) as CampoTeams[]).forEach((f) => {
      const hit = Math.max(...row.map((c) => pontuaHeader(c, SINONIMOS[f])));
      if (hit > 0) score += 40;
    });
    // Precisa reconhecer ao menos dois campos para valer como cabeçalho.
    if (score >= preenchidas + 80 && score > melhorScore) { melhorScore = score; melhor = i; }
  }
  return melhor;
}

function mapeiaColunas(headers: string[], dados: string[][]): MapaColunas {
  const map = { nome: -1, email: -1, entrada: -1, saida: -1, duracao: -1, funcao: -1 } as MapaColunas;
  const usadas = new Set<number>();
  // Ordem importa: campos mais distintivos primeiro.
  const ordem: CampoTeams[] = ['email', 'duracao', 'entrada', 'saida', 'funcao', 'nome'];
  for (const f of ordem) {
    let best = -1;
    let bestScore = 0;
    headers.forEach((h, i) => {
      if (usadas.has(i)) return;
      const s = pontuaHeader(h, SINONIMOS[f]);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    if (best >= 0) { map[f] = best; usadas.add(best); }
  }
  // Fallback por conteúdo: coluna com mais e-mails válidos.
  if (map.email < 0) {
    const nCols = Math.max(headers.length, ...dados.map((r) => r.length), 0);
    let best = -1;
    let bestHits = 0;
    for (let c = 0; c < nCols; c++) {
      const hits = dados.filter((r) => RE_EMAIL_VALOR.test((r[c] ?? '').trim())).length;
      if (hits > bestHits) { bestHits = hits; best = c; }
    }
    if (best >= 0 && bestHits > 0) { map.email = best; usadas.add(best); }
  }
  // Fallback do nome: primeira coluna textual não usada.
  if (map.nome < 0) {
    const nCols = Math.max(headers.length, ...dados.map((r) => r.length), 0);
    for (let c = 0; c < nCols; c++) {
      if (usadas.has(c)) continue;
      const textual = dados.some((r) => (r[c] ?? '').trim().length > 2 && !RE_EMAIL_VALOR.test((r[c] ?? '').trim()));
      if (textual) { map.nome = c; break; }
    }
  }
  return map;
}

/**
 * Lê qualquer relatório de presença e devolve cabeçalho, linhas de dados e o
 * mapeamento automático das colunas — permitindo mapeamento manual depois.
 */
export async function parsePresencaSheet(file: File): Promise<PlanilhaPresenca> {
  const matrix = (await lerMatriz(file)).map((r) => r.map((c) => String(c ?? '').trim()));
  if (!matrix.length) return { headers: [], rows: [], map: mapeiaColunas([], []) };

  const headerIdx = escolheHeader(matrix);
  let headers: string[];
  let corpo: string[][];

  if (headerIdx >= 0) {
    headers = matrix[headerIdx];
    corpo = [];
    for (let i = headerIdx + 1; i < matrix.length; i++) {
      const row = matrix[i];
      if (row.every((c) => !c)) {
        // Linha vazia encerra a seção só se o que vem depois for outra seção.
        const prox = matrix.slice(i + 1).find((r) => r.some((c) => c));
        if (!prox || RE_SECAO.test(prox[0] ?? '')) break;
        continue;
      }
      if (RE_SECAO.test(row[0] ?? '') && row.filter((c) => c).length <= 2) break;
      corpo.push(row);
    }
  } else {
    // Sem cabeçalho reconhecível: usa todas as linhas com conteúdo.
    headers = [];
    corpo = matrix.filter((r) => r.some((c) => c));
  }

  const nCols = Math.max(headers.length, ...corpo.map((r) => r.length), 0);
  const headersFinais = Array.from({ length: nCols }, (_, i) => headers[i] || `Coluna ${i + 1}`);
  const map = mapeiaColunas(headerIdx >= 0 ? Array.from({ length: nCols }, (_, i) => headers[i] ?? '') : [], corpo);

  return { headers: headersFinais, rows: corpo, map };
}

/**
 * Limpa o nome exibido pelo Teams: remove sufixos entre parênteses
 * ("(Externo)", "(Não verificado)", "(PV)") e o nome da empresa após " - ".
 */
export function limpaNomeParticipante(nome: string): string {
  return nome
    .replace(/\((?:[^()]*)\)/g, ' ')
    .split(/\s+[-–|]\s+/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens comparáveis de um nome (sem acentos, minúsculas, sem partículas). */
export function tokensNome(nome: string): string[] {
  const PART = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return norm(limpaNomeParticipante(nome || ''))
    .split(' ')
    .filter((t) => t.length > 1 && !PART.has(t));
}

/**
 * Nomes correspondem quando o conjunto menor de tokens está contido no maior
 * (ex.: "Fernando Mendes" ↔ "Fernando Mauricio de Aquino Mendes").
 */
export function nomesCorrespondem(a: string, b: string): boolean {
  const ta = tokensNome(a);
  const tb = tokensNome(b);
  if (ta.length < 2 || tb.length < 2) return false;
  const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const set = new Set(maior);
  return menor.every((t) => set.has(t));
}

/**
 * Converte as linhas em participantes, dado o mapeamento (auto ou manual).
 * Participantes sem e-mail no relatório também são mantidos — o vínculo pode
 * ser feito pelo nome mais adiante.
 */
export function participantesFrom(planilha: PlanilhaPresenca, map: MapaColunas): ParticipanteTeams[] {
  const val = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
  const out: ParticipanteTeams[] = [];
  const vistos = new Map<string, number>();

  for (const row of planilha.rows) {
    const emailBruto = normalizeEmail(val(row, map.email));
    const email = emailBruto && isValidEmail(emailBruto) ? emailBruto : '';
    const nome = val(row, map.nome);
    // Sem e-mail nem nome não há o que importar.
    if (!email && tokensNome(nome).length === 0) continue;

    const p: ParticipanteTeams = {
      nome,
      email,
      duracao: val(row, map.duracao),
      entrada: val(row, map.entrada) || undefined,
      saida: val(row, map.saida) || undefined,
      funcao: val(row, map.funcao) || undefined,
    };

    // O Teams repete quem entra e sai várias vezes (e repete a lista em outra
    // seção do relatório): mantém a primeira entrada, a última saída e a maior
    // duração informada. A chave é o e-mail ou, na falta dele, o nome.
    const chave = email || `nome:${tokensNome(nome).join(' ')}`;
    const idx = vistos.get(chave);
    if (idx === undefined) { vistos.set(chave, out.length); out.push(p); continue; }
    const atual = out[idx];
    out[idx] = {
      ...atual,
      nome: atual.nome || p.nome,
      email: atual.email || p.email,
      duracao: duracaoSegundos(p.duracao) > duracaoSegundos(atual.duracao) ? p.duracao : atual.duracao,
      entrada: atual.entrada ?? p.entrada,
      saida: p.saida ?? atual.saida,
      funcao: atual.funcao ?? p.funcao,
    };
  }
  return out;
}


/** "27m 54s", "1h 05m", "00:27:54" → segundos (0 quando não reconhecido). */
export function duracaoSegundos(d: string): number {
  if (!d) return 0;
  const s = d.trim().toLowerCase();
  const hms = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) return (+hms[1]) * (hms[3] ? 3600 : 60) + (+hms[2]) * (hms[3] ? 60 : 1) + (+(hms[3] ?? 0));
  let total = 0;
  let achou = false;
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|hora|horas|m|min|minuto|minutos|s|seg|segundo|segundos)/g)) {
    const n = parseFloat(m[1].replace(',', '.'));
    const u = m[2][0];
    total += u === 'h' ? n * 3600 : u === 'm' ? n * 60 : n;
    achou = true;
  }
  return achou ? Math.round(total) : 0;
}

/** Compatibilidade: leitura direta com detecção automática. */
export async function parseTeamsAttendance(file: File): Promise<ParticipanteTeams[]> {
  const planilha = await parsePresencaSheet(file);
  return participantesFrom(planilha, planilha.map);
}
