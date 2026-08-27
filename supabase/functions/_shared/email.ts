/**
 * E-mails transacionais da Matter Academy — templates + envio via Resend.
 *
 * Secrets necessários (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY   obrigatório — chave da API do Resend (re_...)
 *   EMAIL_FROM       remetente verificado. Ex: "Matter Academy <acesso@matteracademy.ai>"
 *   EMAIL_REPLY_TO   opcional — endereço de resposta. Ex: "contato@matteracademy.ai"
 *   PUBLIC_APP_URL   base da aplicação. Ex: "https://plataforma.matteracademy.ai"
 *   EMAIL_BANNER_URL opcional — sobrescreve a URL do banner do cabeçalho
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Matter Academy <onboarding@resend.dev>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "";
const PUBLIC_APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "https://plataforma.matteracademy.ai").replace(/\/$/, "");
const BANNER_URL = Deno.env.get("EMAIL_BANNER_URL") ?? `${PUBLIC_APP_URL}/logos/matter-academy-email-banner.png`;

const C = {
  canvas: "#f1f3f5",
  panel: "#ffffff",
  panel2: "#f6f7f9",
  line: "#e2e6ea",
  fg: "#14171c",
  fg2: "#4a515c",
  fg3: "#5f6773",
  brand: "#cbfb00",
  ink: "#0b0c0e",
  accentInk: "#4d6100",
};
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";


export type EmailKind =
  | "invite" | "reinvite" | "reset"
  | "nova_aula" | "nova_atividade" | "atividade_corrigida" | "nova_submissao";

const NOTIFICATION_KINDS = new Set<EmailKind>([
  "nova_aula", "nova_atividade", "atividade_corrigida", "nova_submissao",
]);

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

function bg(color: string, important = false): string {
  const w = important ? " !important" : "";
  return `background-color:${color}${w};background-image:linear-gradient(${color},${color})${w};`;
}

const BG_CLASSES: [string, string][] = [
  ["ma-canvas", C.canvas],
  ["ma-panel", C.panel],
  ["ma-panel2", C.panel2],
  ["ma-line", C.line],
  ["ma-accent", C.brand],
];
const FG_CLASSES: [string, string][] = [
  ["ma-fg", C.fg],
  ["ma-fg2", C.fg2],
  ["ma-fg3", C.fg3],
  ["ma-brand", C.accentInk],
];

function darkModeGuardCss(): string {
  const sel = (c: string) =>
    `.${c},[data-ogsb] .${c},.${c}[data-ogsb],[data-ogsc] .${c},.${c}[data-ogsc]`;
  const rules = [
    ...BG_CLASSES.map(([c, v]) => `  ${sel(c)} { ${bg(v, true)} }`),
    ...FG_CLASSES.map(([c, v]) => `  ${sel(c)} { color: ${v} !important; }`),
    `  ${sel("ma-cta")} { ${bg(C.brand, true)} color: ${C.ink} !important; }`,
  ].join("\n");
  const media = [
    ...BG_CLASSES.map(([c, v]) => `    .${c} { ${bg(v, true)} }`),
    ...FG_CLASSES.map(([c, v]) => `    .${c} { color: ${v} !important; }`),
    `    .ma-cta { ${bg(C.brand, true)} color: ${C.ink} !important; }`,
  ].join("\n");
  return `${rules}\n  @media (prefers-color-scheme: dark) {\n${media}\n  }`;
}

function ctaButton(href: string, label: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;line-height:100%;margin:0 auto;width:auto">
      <tr>
        <td align="center" bgcolor="${C.brand}" class="ma-cta" role="presentation" style="${bg(C.brand)}border:none;border-radius:10px;cursor:auto;height:48px;mso-padding-alt:0 28px" valign="middle">
          <a href="${escapeHtml(href)}" style="display:inline-block;color:${C.ink};font-family:${FONT};font-size:15px;font-weight:700;line-height:48px;text-decoration:none;padding:0 28px;mso-text-raise:0" target="_blank">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function highlightRow(icon: string, title: string, desc: string): string {
  return `
  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-collapse:collapse">
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:28px">
        <p class="ma-fg3" style="margin:0;font-family:${FONT};font-size:14px;line-height:20px;color:${C.fg3}">
          ${icon}
        </p>
      </td>
      <td style="padding:10px 0 10px 12px;vertical-align:top">
        <p class="ma-fg" style="margin:0 0 2px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:${C.fg}">
          ${escapeHtml(title)}
        </p>
        <p class="ma-fg2" style="margin:0;font-family:${FONT};font-size:14px;line-height:20px;color:${C.fg2}">
          ${escapeHtml(desc)}
        </p>
      </td>
    </tr>
  </table>
  `;
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
  return `
<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(i.title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    /* Dark-mode guard */
${darkModeGuardCss()}
    @media only screen and (max-width: 620px) {
      .ma-wrapper { width: 100% !important; max-width: 100% !important; }
      .ma-pad { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body class="ma-canvas" style="margin:0;padding:0;${bg(C.canvas)}font-family:${FONT};color:${C.fg}">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">
    ${escapeHtml(i.preheader)}​​​​​​​​​​
  </div>
  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" class="ma-canvas" style="border-collapse:collapse;${bg(C.canvas)}">
    <tr>
      <td align="center" valign="top" style="padding:24px 0">

        <!-- Header -->
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="600" class="ma-wrapper" style="border-collapse:collapse;max-width:600px;width:100%">
          <tr>
            <td align="center" style="padding:0 0 16px 0">
              <a href="${PUBLIC_APP_URL}" target="_blank" style="text-decoration:none">
                <img src="${BANNER_URL}" alt="Matter Academy" width="600" height="auto" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px" class="ma-panel">
              </a>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="600" class="ma-wrapper ma-panel" style="border-collapse:collapse;max-width:600px;width:100%;${bg(C.panel)}border-radius:16px;overflow:hidden">
          <tr>
            <td class="ma-pad" style="padding:36px 40px 28px 40px">

              <p class="ma-fg3" style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.fg3}">
                ${escapeHtml(i.eyebrow)}
              </p>

              <h1 class="ma-fg" style="margin:0 0 16px;font-family:${FONT};font-size:26px;font-weight:800;line-height:34px;color:${C.fg}">
                ${escapeHtml(i.title)}
              </h1>

              <p class="ma-fg2" style="margin:0 0 28px;font-family:${FONT};font-size:16px;line-height:26px;color:${C.fg2}">
                ${i.lead}
              </p>

              ${ctaButton(i.link, i.ctaLabel)}

              <p class="ma-fg3" style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:18px;text-align:center;color:${C.fg3}">
                ${escapeHtml(i.deadlineNote)}
              </p>

            </td>
          </tr>
          ${i.highlights ? `
          <tr>
            <td class="ma-pad ma-panel2" style="padding:28px 40px;border-top:1px solid ${C.line};${bg(C.panel2)}">
              <p class="ma-fg" style="margin:0 0 6px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.fg}">O que você encontra por aqui:</p>
              ${i.highlights}
            </td>
          </tr>
          <tr>
            <td style="padding:0;height:1px;line-height:1px;font-size:1px" class="ma-line">&nbsp;</td>
          </tr>
          ` : ""}
          <tr>
            <td class="ma-pad" style="padding:22px 40px 30px 40px;border-top:1px solid ${C.line}">
              <p class="ma-fg3" style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:18px;color:${C.fg3}">
                Se o botão não funcionar, copie e cole este endereço no seu navegador:
              </p>
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" class="ma-panel2" style="border-collapse:collapse;border-radius:10px;${bg(C.panel2)}">
                <tr>
                  <td style="padding:12px 14px;word-break:break-all">
                    <a href="${escapeHtml(i.link)}" class="ma-fg2" target="_blank" style="font-family:${FONT};font-size:13px;line-height:18px;color:${C.fg2};text-decoration:underline">
                      ${escapeHtml(i.link)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="600" class="ma-wrapper" style="border-collapse:collapse;max-width:600px;width:100%">
          <tr>
            <td class="ma-pad" align="center" style="padding:22px 20px 0">
              <p class="ma-fg3" style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:18px;color:${C.fg3}">
                ${i.footerNote}
              </p>
              <p class="ma-fg3" style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3}">
                Matter Academy · Plataforma de ensino
              </p>
              <p class="ma-fg3" style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3}">
                Esta é uma mensagem automática. Não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export type BuildInput = {
  kind: EmailKind;
  email: string;
  link: string;
  nome?: string | null;
  role?: string | null;
  expires_at?: string | null;
  /** Usados apenas pelos tipos de notificação (nova_aula, nova_atividade, ...). */
  titulo?: string;
  mensagem?: string;
};

export function buildEmail(i: BuildInput): { subject: string; html: string; text: string } {
  const nome = firstName(i.nome, i.email);
  const saudacao = nome ? `Olá, ${escapeHtml(nome)}` : "Olá";
  const papel = ROLE_LABEL[(i.role ?? "").toLowerCase()] ?? "Aluno";
  const prazo = formatDeadline(i.expires_at);

  if (NOTIFICATION_KINDS.has(i.kind)) {
    const titulo = i.titulo ?? "Nova notificação";
    const mensagem = i.mensagem ?? "";
    return {
      subject: titulo,
      html: layout({
        preheader: mensagem,
        eyebrow: "Notificação",
        title: titulo,
        lead: `${saudacao}. ${escapeHtml(mensagem)}`,
        ctaLabel: "Ver no painel",
        link: i.link,
        deadlineNote: "",
        footerNote: "Você recebeu este e-mail porque tem uma conta ativa na Matter Academy.",
      }),
      text: [
        `${nome ? `Olá, ${nome}.` : "Olá."}`,
        "",
        mensagem,
        "",
        i.link,
        "",
        "Matter Academy · Plataforma de ensino",
      ].join("\n"),
    };
  }

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
        lead: `${saudacao}. Recebemos uma solicitação para redefinir a senha da conta ${escapeHtml(i.email)}. Clique no botão abaixo para criar uma nova senha.`,
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
  const deadlineNote = "Este link é pessoal e continua valendo até você definir sua senha.";

  const highlights =
    highlightRow("●", "Trilhas organizadas por turma", "Seus cursos e aulas já ficam prontos no seu painel.") +
    highlightRow("●", "Vídeo-aulas com progresso", "Retome exatamente de onde parou, em qualquer dispositivo.") +
    highlightRow("●", "Comunidade e atividades", "Tire dúvidas, entregue atividades e acompanhe sua evolução.");

  const lead = isReinvite
    ? `${saudacao}. Geramos um novo link para você ativar seu acesso de ${escapeHtml(papel)} na Matter Academy. O link enviado anteriormente deixou de ser válido.`
    : `${saudacao}. Seu acesso de ${escapeHtml(papel)} na plataforma da Matter Academy já está criado. Para começar, defina sua senha: leva menos de um minuto.`;

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
      footerNote: `Você recebeu este e-mail porque um administrador criou um acesso para ${escapeHtml(i.email)}. Se não reconhece este convite, ignore esta mensagem.`,
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

export type SendResult = { ok: boolean; id?: string; error?: string };

export async function sendTransactionalEmail(input: BuildInput): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.log("[email] RESEND_API_KEY ausente — envio ignorado");
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }
  if (!LOVABLE_API_KEY) {
    console.log("[email] LOVABLE_API_KEY ausente — envio ignorado");
    return { ok: false, error: "LOVABLE_API_KEY não configurada" };
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
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
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

export function buildLink(path: "ativar" | "redefinir-senha", token: string): string {
  return `${PUBLIC_APP_URL}/${path}?token=${token}`;
}

export function buildAppUrl(relativePath: string): string {
  return `${PUBLIC_APP_URL}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
}
