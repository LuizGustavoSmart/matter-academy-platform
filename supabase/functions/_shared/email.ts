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
// Faixa do cabeçalho já "assada" com fundo preto sólido opaco: é uma imagem
// raster única, sem transparência e sem CSS de fundo por trás. Um cliente de
// e-mail não tem "cor de fundo" para reescrever num <img> opaco — a defesa
// contra o auto-dark-mode do Outlook deixa de depender de CSS aqui.
const BANNER_URL = Deno.env.get("EMAIL_BANNER_URL") ?? `${PUBLIC_APP_URL}/logos/matter-academy-email-banner.png`;

/* ───────────────────────────── Tokens visuais ─────────────────────────────
 * Base clara (híbrido neutro): o corpo do e-mail é claro, previsível em
 * qualquer cliente. A marca aparece na faixa do cabeçalho, que é a imagem
 * BANNER_URL (fundo preto + logo já compostos), não CSS. */
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

/**
 * Fundo à prova do "auto dark mode" dos clientes de e-mail.
 *
 * Outlook.com, novo Outlook e Outlook mobile reescrevem `background-color`
 * quando o usuário está em tema escuro — inclusive clareando preto para um
 * cinza próprio, que é exatamente o bug relatado. Eles NÃO reescrevem
 * `background-image`, então um gradiente de cor única pinta a cor real por
 * cima da substituição. O `bgcolor=` no atributo cobre o Outlook desktop
 * (engine do Word), que ignora background via CSS.
 */
function bg(color: string, important = false): string {
  const w = important ? " !important" : "";
  return `background-color:${color}${w};background-image:linear-gradient(${color},${color})${w};`;
}

/** Classes de fundo e de texto, usadas no HTML e nas regras de defesa. */
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


/**
 * Regras que devolvem as cores da marca quando o cliente tenta convertê-las.
 *
 * O Outlook injeta `data-ogsb`/`data-ogsc` (original get style background/color)
 * nos elementos cujo background/cor ele trocou. Cobrimos as duas formas — no
 * próprio elemento e em um ancestral — porque varia conforme a versão. Geradas
 * a partir das mesmas constantes do HTML para não haver divergência.
 */
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
      style="display:inline-block;${bg(C.brand)}color:${C.ink};font-family:${FONT};font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;width:300px;border-radius:12px;letter-spacing:0.01em;">${label}</a>
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
<meta name="color-scheme" content="only light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(i.title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* Base clara declarada como "light only": nenhum cliente precisa converter
     nada. Onde converte mesmo assim, valem as regras abaixo somadas ao
     gradiente aplicado por bg() em cada elemento. */
${darkModeGuardCss()}
</style>
</head>
<body class="ma-canvas" style="margin:0;padding:0;${bg(C.canvas)}" bgcolor="${C.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(i.preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="ma-canvas" style="${bg(C.canvas)}" bgcolor="${C.canvas}">
<tr><td align="center" class="ma-canvas" style="padding:32px 16px 48px 16px;${bg(C.canvas)}" bgcolor="${C.canvas}">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

    <!-- Card -->
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="ma-panel"
        style="${bg(C.panel)}border:1px solid ${C.line};border-radius:16px;overflow:hidden;" bgcolor="${C.panel}">

        <!-- Faixa da marca: imagem única (fundo preto + logo já compostos),
             sem CSS de fundo por trás — nada aqui para o cliente reescrever. -->
        <tr><td class="ma-band" style="padding:0;line-height:0;font-size:0;${bg(C.band)}" bgcolor="${C.band}">
          <img src="${BANNER_URL}" alt="Matter Academy" width="600" height="170" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;font-family:${FONT};font-size:20px;font-weight:700;color:${C.bandFg};" />
        </td></tr>


        <tr><td class="ma-accent" style="height:3px;line-height:3px;font-size:0;${bg(C.brand)}" bgcolor="${C.brand}">&nbsp;</td></tr>

        <tr><td class="ma-panel" style="padding:36px 40px 34px 40px;${bg(C.panel)}" bgcolor="${C.panel}">

          <p class="ma-brand" style="margin:0 0 14px 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${C.accentInk};">${escapeHtml(i.eyebrow)}</p>


          <h1 class="ma-fg" style="margin:0 0 16px 0;font-family:${FONT};font-size:27px;line-height:34px;font-weight:700;color:${C.fg};letter-spacing:-0.01em;">${escapeHtml(i.title)}</h1>

          <p class="ma-fg2" style="margin:0 0 30px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${C.fg2};">${i.lead}</p>

          ${ctaButton(i.link, i.ctaLabel)}

          <p class="ma-fg3" style="margin:22px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3};text-align:center;">${escapeHtml(i.deadlineNote)}</p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:30px;">
            <tr><td class="ma-line" style="height:1px;line-height:1px;font-size:0;${bg(C.line)}" bgcolor="${C.line}">&nbsp;</td></tr>
          </table>

          ${i.highlights ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:26px;">
            ${i.highlights}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px;">
            <tr><td class="ma-line" style="height:1px;line-height:1px;font-size:0;${bg(C.line)}" bgcolor="${C.line}">&nbsp;</td></tr>
          </table>` : ""}

          <p class="ma-fg3" style="margin:24px 0 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.fg3};">
            Se o botão não funcionar, copie e cole este endereço no seu navegador:
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td class="ma-panel2" style="${bg(C.panel2)}border:1px solid ${C.line};border-radius:8px;padding:11px 13px;" bgcolor="${C.panel2}">
              <a href="${i.link}" target="_blank" class="ma-brand" style="font-family:Consolas,Menlo,Monaco,'Courier New',monospace;font-size:11px;line-height:17px;color:${C.accentInk};text-decoration:none;word-break:break-all;">${escapeHtml(i.link)}</a>
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

/** Monta a URL pública de ativação/redefinição a partir do token. */
export function buildLink(path: "ativar" | "redefinir-senha", token: string): string {
  return `${PUBLIC_APP_URL}/${path}?token=${token}`;
}
