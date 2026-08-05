Os e-mails transacionais (convite, reconvite e redefinição de senha) continuam com dois problemas visuais: o logo não aparece (ícone de imagem quebrada) e o fundo aparece cinza em vez do dark theme da marca quando o cliente de e-mail está em modo escuro (Outlook).

Causa raiz dos dois problemas: **o branch `Marcos` ainda não foi publicado (deploy/sync) em produção.** As correções já estão no código desse branch há alguns commits, mas nunca foram sincronizadas. Confirmei agora mesmo que os dois arquivos de logo continuam retornando 404 em produção:

- `https://plataforma.matteracademy.ai/logos/matter-academy-email.png` → 404
- `https://plataforma.matteracademy.ai/logos/matter-academy-negative.svg` → 404

Enquanto esses arquivos não existirem no domínio de produção, o logo vai continuar quebrado, e enquanto as Edge Functions (`admin-users`, `auth-public`, `_shared/email.ts`) não forem republicadas com o código atual do branch `Marcos`, o e-mail enviado continua sendo a versão antiga do template, sem a correção de dark mode do Outlook.

Pedido:

1. Fazer o deploy/sync completo do branch `Marcos` para produção — isso inclui tanto os arquivos estáticos em `public/logos/` quanto as Edge Functions em `supabase/functions/`.

2. Depois do deploy, confirmar que estas URLs retornam HTTP 200:
   - `https://plataforma.matteracademy.ai/logos/matter-academy-email.png`
   - `https://plataforma.matteracademy.ai/logos/matter-academy-negative.svg`

3. Confirmar que as Edge Functions publicadas são a versão atual: `supabase functions deploy admin-users` e `supabase functions deploy auth-public` (ou o equivalente do fluxo de deploy do Lovable), garantindo que `supabase/functions/_shared/email.ts` também vá junto (é um módulo compartilhado importado pelas duas funções).

4. Reenviar um convite de teste (criar um usuário no admin com um e-mail real) e confirmar visualmente: logo aparecendo no topo, e fundo escuro mantido mesmo com o Outlook em modo escuro.

Anexo o vetor oficial do logo (`matter-academy-negative.svg`) para conferência, embora ele já esteja versionado no repositório — o problema não é o arquivo em si, é ele não estar publicado.
