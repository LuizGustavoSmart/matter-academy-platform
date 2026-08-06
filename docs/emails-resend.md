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
| `EMAIL_BANNER_URL` | não | sobrescreve o banner do cabeçalho |

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

### Tema claro + banner do cabeçalho

O corpo do e-mail é claro (fundo cinza-claro/branco) — é o formato que nenhum
cliente tenta converter em dark mode. A marca aparece só na faixa do
cabeçalho, que é `public/logos/matter-academy-email-banner.png` (1200×340,
2x retina): fundo preto sólido **opaco** com o logo negativo já centralizado
dentro do PNG, sem transparência e sem CSS de fundo por trás. Um `<img>`
opaco não tem "cor de fundo" para o Outlook reescrever, então essa é a
defesa mais forte contra o auto-dark-mode — mais forte que qualquer CSS.

As defesas de CSS (`bg()`, atributos `bgcolor=`, regras `[data-ogsb]`/
`[data-ogsc]` e o bloco `@media (prefers-color-scheme: dark)`, tudo gerado
por `darkModeGuardCss()` a partir das constantes em `C`) continuam no
template como rede de segurança para o restante do e-mail — painéis, texto,
botão — que ainda é HTML/CSS de verdade.

Para regerar o banner a partir do vetor:

```bash
python scripts/svg-to-png.py public/logos/matter-academy-negative.svg public/logos/matter-academy-email-banner.png --banner 1200 340 "#0b0c0e" 0.58
```

O arquivo precisa estar publicado em
`{PUBLIC_APP_URL}/logos/matter-academy-email-banner.png`.

## Deploy

```bash
supabase functions deploy admin-users
supabase functions deploy auth-public
```

## Preview local dos templates

```bash
node --experimental-strip-types scripts/preview-emails.mjs
```
