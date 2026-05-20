## Objetivo

O ZIP enviado é um app Vite + React 18 + react-router-dom + Supabase (Matter Academy) já completo: páginas (Landing, Login, Activate, ForgotPassword, ResetPassword, área Admin com Usuários/Turmas/Cursos/Aulas e área do Aluno com Dashboard/Curso), `AuthContext`, layouts, integração com Supabase (URL/anon key no `.env`) e 3 Edge Functions (`bootstrap-admin`, `auth-public`, `admin-users`) com 2 migrations.

O projeto atual no Lovable usa um template diferente (TanStack Start). Para rodar o conteúdo enviado como está, vou substituir o template pela estrutura Vite original.

## Passos

1. **Limpar o template TanStack Start**
   - Remover `src/routes/`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/server.ts`, `src/start.ts`, `src/styles.css`, `wrangler.jsonc`, `bunfig.toml` e a configuração TanStack do `vite.config.ts`.
   - Manter `.lovable/`, `.gitignore`, `.prettier*`.

2. **Copiar o conteúdo do ZIP para a raiz**
   - `src/` (App.tsx, main.tsx, index.css, components, contexts, layouts, lib, pages, vite-env.d.ts)
   - `public/` (logos/imagens)
   - `supabase/` (migrations + edge functions — só para referência; o backend já está hospedado em `qysyqcglwyvzltnoddyl.supabase.co`)
   - `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig*.json`, `eslint.config.js`, `.env`

3. **Ajustar `package.json`**
   - Substituir as deps TanStack/Cloudflare por: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `lucide-react` e devDeps (`vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, eslint stack).
   - Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`.

4. **Instalar dependências** com `bun add` para gerar lockfile válido.

5. **Verificar build** (`vite build`) e checar console/preview.

## Observações importantes

- O `.env` aponta para um projeto Supabase **externo** já existente (não o Lovable Cloud). Vou manter como está — é onde vivem as tabelas, RLS e edge functions do Matter Academy. Não vou habilitar Lovable Cloud (criaria um backend vazio e paralelo).
- As Edge Functions e migrations dentro de `supabase/` precisam ser deployadas no projeto Supabase com a CLI do Supabase (`supabase db push`, `supabase functions deploy`) — isso é feito fora do Lovable. Se já estiverem deployadas, o app roda direto.
- Após a substituição, o preview do Lovable continuará funcionando normalmente (Vite dev server padrão).

## Confirmações que preciso

1. Tudo certo em **descartar o template TanStack** e usar a estrutura Vite original?
2. Confirma que o backend Supabase em `qysyqcglwyvzltnoddyl.supabase.co` já está com as migrations e edge functions aplicadas? (Se não, posso te orientar como fazer o deploy.)
