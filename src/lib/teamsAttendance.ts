/* Leitura do relatório de participação do Microsoft Teams.
   Mesma base do import de usuários (lib `xlsx`), mas o arquivo do Teams não é
   uma planilha simples: vem em seções numeradas ("1. Resumo", "2. Participantes",
   "3. Atividades na reunião") e normalmente como TSV em UTF-16. */
import * as XLSX from 'xlsx';
import { normalizeEmail, isValidEmail } from './users';

export type ParticipanteTeams = { nome: string; email: string; duracao: string };

/** Cabeçalhos possíveis em pt-BR e en-US. */
const RE_EMAIL = /e-?mail/i;
const RE_NOME = /^(nome|nome completo|name|full name|participante|participant)$/i;
const RE_DURACAO = /(dura[çc][ãa]o|duration|tempo)/i;
/** Início de uma nova seção do relatório: "3. Atividades na reunião". */
const RE_SECAO = /^\d+\.\s/;

export async function parseTeamsAttendance(file: File): Promise<ParticipanteTeams[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  let matrix = XLSX.utils
    .sheet_to_json<string[]>(ws, { header: 1, blankrows: true, defval: '', raw: false })
    .map((r) => (r ?? []).map((c) => String(c ?? '').trim()));

  // Quando o TSV não é reconhecido, tudo cai numa coluna só — desmembra pelo tab.
  if (matrix.length && matrix.every((r) => r.length <= 1)) {
    matrix = matrix.map((r) => (r[0] ?? '').split('\t').map((c) => c.trim()));
  }

  // A seção de participantes é identificada pela linha de cabeçalho que tem
  // uma coluna de e-mail — não pelo título da seção, que muda com o idioma.
  const headerIdx = matrix.findIndex((r) => r.some((c) => RE_EMAIL.test(c)));
  if (headerIdx < 0) return [];

  const header = matrix[headerIdx];
  const emailCol = header.findIndex((c) => RE_EMAIL.test(c));
  const nomeCol = header.findIndex((c) => RE_NOME.test(c));
  const duracaoCol = header.findIndex((c) => RE_DURACAO.test(c));

  const out: ParticipanteTeams[] = [];
  const vistos = new Set<string>();

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    // Linha em branco ou nova seção encerram a lista de participantes.
    if (row.every((c) => !c)) break;
    if (RE_SECAO.test(row[0] ?? '')) break;

    const email = normalizeEmail(row[emailCol] ?? '');
    if (!email || !isValidEmail(email)) continue;
    // O Teams repete quem entra e sai várias vezes na mesma reunião.
    if (vistos.has(email)) continue;
    vistos.add(email);

    out.push({
      nome: nomeCol >= 0 ? row[nomeCol] ?? '' : '',
      email,
      duracao: duracaoCol >= 0 ? row[duracaoCol] ?? '' : '',
    });
  }

  return out;
}
