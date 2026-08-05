Conecte o Resend a este projeto e sincronize as Edge Functions com o código atual do repositório (branch `Marcos`).

Contexto: as funções `admin-users` e `auth-public` foram alteradas para enviar e-mails transacionais (convite, reconvite e redefinição de senha) diretamente pela API do Resend, usando um template HTML com a identidade visual da Matter Academy. Antes elas só disparavam um webhook opcional. O código novo está em `supabase/functions/_shared/email.ts`, `supabase/functions/admin-users/index.ts` e `supabase/functions/auth-public/index.ts`.

Passos:

1. Conectar a integração nativa do Resend a este projeto (Integrations → Resend), usando a API key já criada na conta Resend, do domínio `matteracademy.ai` (status Verified). Isso deve gravar automaticamente o secret `RESEND_API_KEY` nas Edge Functions.

2. Configurar os secrets abaixo em Edge Functions → Secrets, caso a integração não grave todos automaticamente:

   - `RESEND_API_KEY`: chave da API do Resend (já criada, começa com `re_`)
   - `EMAIL_FROM`: `Matter Academy <plataforma@matteracademy.ai>`
   - `PUBLIC_APP_URL`: `https://plataforma.matteracademy.ai`
   - `EMAIL_REPLY_TO` (opcional): `contato@matteracademy.ai`

   `PUBLIC_APP_URL` é crítico: é ele que monta o link de ativação/redefinição enviado no e-mail. Se estiver ausente ou errado, o link aponta para o domínio errado.

3. Fazer deploy das duas Edge Functions atualizadas a partir do código atual do branch `Marcos`:

   ```
   supabase functions deploy admin-users
   supabase functions deploy auth-public
   ```

4. Confirmar que o arquivo `public/logos/matter-academy-email.png` está publicado e acessível em `https://plataforma.matteracademy.ai/logos/matter-academy-email.png` — é o logo usado no cabeçalho dos e-mails (PNG, pois clientes de e-mail não renderizam SVG).

5. Testar criando um usuário de teste no painel admin com um e-mail real e confirmar que o e-mail chega, com o logo aparecendo corretamente e o botão apontando para `https://plataforma.matteracademy.ai/ativar?token=...`.

Observação sobre o convite: o link de ativação não expira mais por tempo (antes expirava em 7 dias). Ele continua válido enquanto o usuário não definir a senha; ao definir, o token é invalidado automaticamente. Já a redefinição de senha ("esqueci minha senha") continua expirando em 24 horas, como antes.
