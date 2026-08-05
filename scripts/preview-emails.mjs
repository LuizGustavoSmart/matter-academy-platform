/**
 * Renderiza os templates de e-mail em HTML para inspeção visual.
 *
 *   node --experimental-strip-types scripts/preview-emails.mjs
 *
 * Gera preview-invite.html, preview-reinvite.html e preview-reset.html
 * em .preview-emails/ (ignorado pelo git).
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, '.preview-emails');
const LOGO = 'matter-academy-email.png';

// Shim mínimo do Deno para conseguir importar o módulo das Edge Functions.
// O logo aponta para uma cópia local para o preview funcionar offline.
const ENV = {
  PUBLIC_APP_URL: 'https://plataforma.matteracademy.ai',
  EMAIL_LOGO_URL: `./${LOGO}`,
};
globalThis.Deno = { env: { get: (k) => ENV[k] } };

const { buildEmail } = await import(
  pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/email.ts')).href
);

const SAMPLE = {
  email: 'aluno.exemplo@empresa.com.br',
  nome: 'Marcos Moreira',
  role: 'student',
  token: '4a1d49c4d6fd9b8d4d62159754512479a7e722c509c4d175',
};

mkdirSync(OUT, { recursive: true });
copyFileSync(resolve(ROOT, 'public/logos', LOGO), resolve(OUT, LOGO));

for (const kind of ['invite', 'reinvite', 'reset']) {
  const isReset = kind === 'reset';
  const { subject, html } = buildEmail({
    kind,
    email: SAMPLE.email,
    nome: SAMPLE.nome,
    role: SAMPLE.role,
    link: `${ENV.PUBLIC_APP_URL}/${isReset ? 'redefinir-senha' : 'ativar'}?token=${SAMPLE.token}`,
    expires_at: new Date(Date.now() + (isReset ? 24 : 7 * 24) * 3600 * 1000).toISOString(),
  });
  writeFileSync(resolve(OUT, `preview-${kind}.html`), html);
  console.log(`${kind.padEnd(9)} → .preview-emails/preview-${kind}.html   "${subject}"`);
}
