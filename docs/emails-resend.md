# E-mails transacionais (Resend)

Convite de ativação, reenvio de convite e redefinição de senha saem por e-mail
direto das Edge Functions, com template HTML da marca.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `supabase/functions/_shared/email.ts` | Templates HTML/texto + envio pela API do Resend |
| `supabase/functions/admin-users/index.ts` | Dispara `invite` (criar usuário) e `reinvite` |
| `supabase/functions/auth-public/index.ts` | Dispara `reset` (esqueci minha senha) |

O webhook antigo (`INVITE_WEBHOOK_URL`) continua funcionando em paralelo — se a
variável não estiver setada, ele é simplesmente ignorado.

## Secrets (Supabase → Edge Functions → Secrets)

| Secret | Obrigatório | Exemplo |
| --- | --- | --- |
| `RESEND_API_KEY` | sim | `re_xxxxxxxxxxxx` |
| `EMAIL_FROM` | sim | `Matter Academy <acesso@matteracademy.ai>` |
| `PUBLIC_APP_URL` | sim | `https://plataforma.matteracademy.ai` |
| `EMAIL_REPLY_TO` | não | `contato@matteracademy.ai` |
| `EMAIL_LOGO_URL` | não | sobrescreve o logo do cabeçalho |

> Sem `RESEND_API_KEY` o envio é ignorado com log `[email] RESEND_API_KEY ausente`
> — o usuário ainda é criado e o link de ativação aparece na tela do admin.

> `PUBLIC_APP_URL` define o domínio dos links do e-mail. Se ficar errado, o
> convite aponta para o lugar errado.

## Templates

| `kind` | Assunto | Link | Validade |
| --- | --- | --- | --- |
| `invite` | Seu acesso à Matter Academy está pronto | `/ativar?token=…` | até definir a senha |
| `reinvite` | Seu novo link de acesso — Matter Academy | `/ativar?token=…` | até definir a senha |
| `reset` | Redefinição de senha — Matter Academy | `/redefinir-senha?token=…` | 24 h |

Cada envio manda HTML + versão texto puro (melhora entregabilidade e evita
cair em spam). O botão usa VML para renderizar certo no Outlook.

### Validade do convite

O link de ativação **não expira por tempo**. `invite_expires_at` é gravado como
`NULL` e `auth-public` valida apenas `status = 'pending'`. Quando o usuário
define a senha, `activate` zera o `invite_token` e move o status para `active` —
é isso que invalida o link. Reenviar o convite gera um token novo e derruba o
anterior.

O link de **redefinição de senha** continua expirando em 24 h, de propósito.

### Logo

Clientes de e-mail (Gmail, Outlook) não renderizam SVG, então o vetor é
rasterizado. `public/logos/matter-academy-email.png` (1080×365) é o lockup
recortado no bounding box real — sem a moldura transparente do
`matter-academy-negative.png`, que é usado na aplicação.

Para regerar a partir do vetor:

```bash
python scripts/svg-to-png.py public/logos/matter-academy-negative.svg public/logos/matter-academy-email.png 1080 16
```

O arquivo precisa estar publicado em `{PUBLIC_APP_URL}/logos/matter-academy-email.png`.

## Deploy

```bash
supabase functions deploy admin-users
supabase functions deploy auth-public
```

## Preview local dos templates

```bash
node --experimental-strip-types scripts/preview-emails.mjs
```
