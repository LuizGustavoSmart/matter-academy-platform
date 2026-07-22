# Entrega de notificações por e-mail

A função `supabase/functions/notifications` envia e-mails de novas atividades, novas dúvidas e respostas. Ela respeita os filtros e o canal de e-mail salvos em `user_preferences.notification_preferences`.

## Opção 1 — Resend

Configure os secrets da função:

- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL` (por exemplo, `Matter Academy <notificacoes@seudominio.com>`)
- `PUBLIC_APP_URL`

O domínio do remetente precisa estar validado no Resend.

## Opção 2 — Webhook

Configure `NOTIFICATION_WEBHOOK_URL`. O endpoint recebe `email`, `subject`, `title`, `message`, `link`, `html`, `category` e `event=academy.notification`, permitindo usar n8n, Make ou outro provedor transacional.

## Deploy

```sh
supabase functions deploy notifications
```

Sem um provedor configurado, as ações principais continuam funcionando e a central dentro da plataforma permanece disponível; apenas a cópia por e-mail não é enviada.
