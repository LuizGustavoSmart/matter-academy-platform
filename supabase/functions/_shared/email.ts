/**
 * E-mails transacionais da Matter Academy — templates + envio via Resend.
 *
 * Secrets necessários (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY   obrigatório — chave da API do Resend (re_...)
 *   EMAIL_FROM       remetente verificado. Ex: "Matter Academy <acesso@matteracademy.ai>"
 *   EMAIL_REPLY_TO   opcional — endereço de resposta. Ex: "contato@matteracademy.ai"
 *   PUBLIC_APP_URL   base da aplicação. Ex: "https://plataforma.matteracademy.ai"
 *   EMAIL_LOGO_URL   opcional — sobrescreve a URL do logo no cabeçalho
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Matter Academy <onboarding@resend.dev>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "";
const PUBLIC_APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "https://plataforma.matteracademy.ai").replace(/\/$/, "");
// PNG recortado no bounding box real do lockup — clientes de e-mail (Gmail,
// Outlook) não renderizam SVG, então o vetor é rasterizado em alta resolução.
const LOGO_URL = Deno.env.get("EMAIL_LOGO_URL") ?? `${PUBLIC_APP_URL}/logos/matter-academy-email.png`;

/* ───────────────────────────── Tokens visuais ───────────────────────────── */
const C = {
  canvas: "#0b0c0e",
  panel: "#121317",
  panel2: "#171a1f",
  line: "#262a32",
  fg: "#f3f5f7",
  fg2: "#b4bcc8",
  fg3: "#868f9c",
  brand: "#cbfb00",
  ink: "#0b0c0e",
};
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

export type EmailKind = "invite" | "reinvite" | "reset";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  student: "Aluno",
  professor: "Professor",
  monitor: "Monitor",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(nome?: string | null, email?: string): string {
  const n = (nome ?? "").trim().split(/\s+/)[0];
  if (n) return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  return (email ?? "").split("@")[0] || "";
}

/** "12/08/2026 às 14h30" no fuso de São Paulo. */
function formatDeadline(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}h${get("minute")}`;
}

/* ────────────────────────────── Blocos de HTML ───────────────────────────── */

/** Botão compatível com Outlook (VML) e demais clientes. */
function ctaButton(href: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr><td align="center">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${href}" style="height:50px;v-text-anchor:middle;width:300px;" arcsize="24%" stroke="f" fillcolor="${C.brand}">
      <w:anchorlock/>
      <center style="color:${C.ink};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${href}" target="_blank" class="ma-cta"
      style="display:inline-block;background:${C.brand};color:${C.ink};font-family:${FONT};font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;width:300px;border-radius:12px;letter-spacing:0.01em;">${label}</a>
    <!--<![endif]-->
  </td></tr>
</table>`;
}

function highlightRow(icon: string, title: string, desc: string): string {
  return `
<tr>
  <td style="padding:0 0 14px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td width="34" valign="top" style="font-size:18px;line-height:22px;">${icon}</td>
        <td valign="top" style="font-family:${FONT};">
          <div class="ma-fg" style="color:${C.fg};font-size:14px;font-weight:600;line-height:20px;">${title}</div>
          <div class="ma-fg3" style="color:${C.fg3};font-size:13px;line-height:19px;margin-top:2px;">${desc}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

type LayoutInput = {
  preheader: string;
  eyebrow: string;
  title: string;
  lead: string;
  ctaLabel: string;
  link: string;
  deadlineNote: string;
  highlights?: string;
  footerNote: string;
};

function layout(i: LayoutInput): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>${escapeHtml(i.title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* O design já é dark por padrão. O Outlook (desktop e web) "auto-escurece"
     fundos que não reconhece como intencionais, trocando-os por um cinza
     próprio — [data-ogsc]/[data-ogsb] neutraliza isso mantendo nossas cores. */
  [data-ogsc] body, [data-ogsc] table, [data-ogsc] td,
  [data-ogsb] body, [data-ogsb] table, [data-ogsb] td { background-color: inherit !important; }
  [data-ogsc] .ma-fg, [data-ogsb] .ma-fg { color: ${C.fg} !important; }
  [data-ogsc] .ma-fg2, [data-ogsb] .ma-fg2 { color: ${C.fg2} !important; }
  [data-ogsc] .ma-fg3, [data-ogsb] .ma-fg3 { color: ${C.fg3} !important; }
  [data-ogsc] .ma-brand, [data-ogsb] .ma-brand { color: ${C.brand} !important; }
  [data-ogsc] .ma-cta, [data-ogsb] .ma-cta { background-color: ${C.brand} !important; color: ${C.ink} !important; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};" bgcolor="${C.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(i.preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.canvas};" bgcolor="${C.canvas}">
<tr><td align="center" style="padding:32px 16px 48px 16px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

    <!-- Logo -->
    <tr><td align="center" style="padding:6px 0 26px 0;">
      <img src="${LOGO_URL}" alt="Matter Academy" width="236" height="80" style="display:block;width:236px;height:80px;border:0;outline:none;" />
    </td></tr>

    <!-- Card -->
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="background:${C.panel};border:1px solid ${C.line};border-radius:16px;overflow:hidden;" bgcolor="${C.panel}">

        <tr><td style="height:3px;line-height:3px;font-size:0;background:${C.brand};" bgcolor="${C.brand}">&nbsp;</td></tr>

        <tr><td style="padding:38px 40px 34px 40px;" bgcolor="${C.panel}">

          <p class="ma-brand" style="margin:0 0 14px 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${C.brand};">${escapeHtml(i.eyebrow)}</p>

          <h1 class="ma-fg" style="margin:0 0 16px 0;font-family:${FONT};font-size:27px;line-height:34px;font-weight:700;color:${C.fg};letter-spacing:-0.01em;">${escapeHtml(i.title)}</h1>

          <p class="ma-fg2" style="margin:0 0 30px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${C.fg2};">${i.lead}</p>

          ${ctaButton(i.link, i.ctaLabel)}

          <p class="ma-fg3" style="margin:22px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3};text-align:center;">${escapeHtml(i.deadlineNote)}</p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:30px;">
            <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.line};" bgcolor="${C.line}">&nbsp;</td></tr>
          </table>

          ${i.highlights ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;">
            ${i.highlights}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px;">
            <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.line};" bgcolor="${C.line}">&nbsp;</td></tr>
          </table>` : ""}

          <p class="ma-fg3" style="margin:24px 0 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3};">
            Se o botão não funcionar, copie e cole este endereço no seu navegador:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="background:${C.panel2};border:1px solid ${C.line};border-radius:8px;padding:11px 13px;" bgcolor="${C.panel2}">
              <a href="${i.link}" target="_blank" class="ma-brand" style="font-family:Consolas,Menlo,Monaco,'Courier New',monospace;font-size:11px;line-height:17px;color:${C.brand};text-decoration:none;word-break:break-all;">${escapeHtml(i.link)}</a>
            </td></tr>
          </table>

        </td></tr>
      </table>
    </td></tr>

    <!-- Rodapé -->
    <tr><td style="padding:26px 24px 0 24px;">
      <p class="ma-fg3" style="margin:0 0 10px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3};text-align:center;">${i.footerNote}</p>
      <p style="margin:0;font-family:${FONT};font-size:11px;line-height:17px;color:#5b626d;text-align:center;">
        Matter Academy · Plataforma de ensino<br />
        Esta é uma mensagem automática. Não responda a este e-mail.
      </p>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

/* ──────────────────────────────── Templates ─────────────────────────────── */

export type BuildInput = {
  kind: EmailKind;
  email: string;
  link: string;
  nome?: string | null;
  role?: string | null;
  expires_at?: string | null;
};

export function buildEmail(i: BuildInput): { subject: string; html: string; text: string } {
  const nome = firstName(i.nome, i.email);
  const saudacao = nome ? `Olá, ${escapeHtml(nome)}` : "Olá";
  const papel = ROLE_LABEL[(i.role ?? "").toLowerCase()] ?? "Aluno";
  const prazo = formatDeadline(i.expires_at);

  if (i.kind === "reset") {
    const deadlineNote = prazo
      ? `Por segurança, este link expira em ${prazo}.`
      : "Por segurança, este link expira em 24 horas.";
    return {
      subject: "Redefinição de senha da Matter Academy",
      html: layout({
        preheader: "Use o link abaixo para criar uma nova senha de acesso.",
        eyebrow: "Segurança da conta",
        title: "Redefina sua senha",
        lead: `${saudacao}. Recebemos uma solicitação para redefinir a senha da conta <strong style="color:${C.fg};">${escapeHtml(i.email)}</strong>. Clique no botão abaixo para criar uma nova senha.`,
        ctaLabel: "Criar nova senha",
        link: i.link,
        deadlineNote,
        footerNote: "Se você não solicitou esta alteração, ignore este e-mail: sua senha atual permanece válida.",
      }),
      text: [
        `${nome ? `Olá, ${nome}.` : "Olá."}`,
        "",
        `Recebemos uma solicitação para redefinir a senha da conta ${i.email}.`,
        "Acesse o link abaixo para criar uma nova senha:",
        i.link,
        "",
        deadlineNote,
        "Se você não solicitou esta alteração, ignore este e-mail.",
        "",
        "Matter Academy",
      ].join("\n"),
    };
  }

  const isReinvite = i.kind === "reinvite";
  // O convite não tem prazo: o link só deixa de valer depois que a senha é criada.
  const deadlineNote = "Este link é pessoal e continua valendo até você definir sua senha.";

  const highlights =
    highlightRow("&#9679;", "Trilhas organizadas por turma", "Seus cursos e aulas já ficam prontos no seu painel.") +
    highlightRow("&#9679;", "Vídeo-aulas com progresso", "Retome exatamente de onde parou, em qualquer dispositivo.") +
    highlightRow("&#9679;", "Comunidade e atividades", "Tire dúvidas, entregue atividades e acompanhe sua evolução.");

  const lead = isReinvite
    ? `${saudacao}. Geramos um novo link para você ativar seu acesso de <strong style="color:${C.fg};">${escapeHtml(papel)}</strong> na Matter Academy. O link enviado anteriormente deixou de ser válido.`
    : `${saudacao}. Seu acesso de <strong style="color:${C.fg};">${escapeHtml(papel)}</strong> na plataforma da Matter Academy já está criado. Para começar, defina sua senha: leva menos de um minuto.`;

  return {
    subject: isReinvite
      ? "Seu novo link de acesso à Matter Academy"
      : "Seu acesso à Matter Academy está pronto",
    html: layout({
      preheader: isReinvite
        ? "Link renovado: defina sua senha e ative sua conta."
        : "Defina sua senha e comece a estudar hoje mesmo.",
      eyebrow: isReinvite ? "Novo convite" : "Convite de acesso",
      title: isReinvite ? "Seu link foi renovado" : "Bem-vindo à Matter Academy",
      lead,
      ctaLabel: isReinvite ? "Ativar minha conta" : "Definir minha senha",
      link: i.link,
      deadlineNote,
      highlights,
      footerNote: `Você recebeu este e-mail porque um administrador criou um acesso para <strong style="color:${C.fg2};">${escapeHtml(i.email)}</strong>. Se não reconhece este convite, ignore esta mensagem.`,
    }),
    text: [
      `${nome ? `Olá, ${nome}.` : "Olá."}`,
      "",
      isReinvite
        ? `Geramos um novo link para você ativar seu acesso de ${papel} na Matter Academy.`
        : `Seu acesso de ${papel} na plataforma da Matter Academy já está criado.`,
      "Defina sua senha pelo link abaixo:",
      i.link,
      "",
      deadlineNote,
      "",
      "Matter Academy · Plataforma de ensino",
    ].join("\n"),
  };
}

/* ─────────────────────────────── Envio (Resend) ──────────────────────────── */

export type SendResult = { ok: boolean; id?: string; error?: string };

export async function sendTransactionalEmail(input: BuildInput): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.log("[email] RESEND_API_KEY ausente — envio ignorado");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  const { subject, html, text } = buildEmail(input);
  const payload: Record<string, unknown> = {
    from: EMAIL_FROM,
    to: [input.email],
    subject,
    html,
    text,
  };
  if (EMAIL_REPLY_TO) payload.reply_to = EMAIL_REPLY_TO;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data as { message?: string }).message ?? `HTTP ${res.status}`;
      console.error(`[email] ${input.kind} -> ${input.email} FALHOU: ${message}`);
      return { ok: false, error: message };
    }
    console.log(`[email] ${input.kind} -> ${input.email} enviado id=${(data as { id?: string }).id ?? "?"}`);
    return { ok: true, id: (data as { id?: string }).id };
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[email] ${input.kind} -> ${input.email} erro de rede: ${message}`);
    return { ok: false, error: message };
  }
}

/** Monta a URL pública de ativação/redefinição a partir do token. */
export function buildLink(path: "ativar" | "redefinir-senha", token: string): string {
  return `${PUBLIC_APP_URL}/${path}?token=${token}`;
}
