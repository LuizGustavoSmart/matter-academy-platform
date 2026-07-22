import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const PUBLIC_APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "https://matteracademy.lovable.app").replace(/\/$/, "");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFICATION_FROM_EMAIL = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "";
const NOTIFICATION_WEBHOOK_URL = Deno.env.get("NOTIFICATION_WEBHOOK_URL") ?? "";

type Category = "activities" | "deadlines" | "answers" | "community" | "administrative";
type Recipient = { id: string; email: string; nome: string | null };
type Notice = { idempotencyKey: string; category: Category; subject: string; title: string; message: string; href: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]!);
}

async function requireUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await userClient.auth.getUser();
  if (!data.user) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: profile } = await admin.from("profiles").select("id,role,status").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.status !== "active") return null;
  return { admin, userId: data.user.id, role: profile.role as string };
}

async function isStaffForTurma(admin: SupabaseClient, userId: string, role: string, turmaId: string) {
  if (role === "admin") return true;
  if (role !== "professor" && role !== "monitor") return false;
  const { data } = await admin.from("user_turmas").select("user_id").eq("user_id", userId).eq("turma_id", turmaId).limit(1).maybeSingle();
  return !!data;
}

async function emailEnabledRecipients(admin: SupabaseClient, recipients: Recipient[], category: Category) {
  if (!recipients.length) return [];
  const { data: rows } = await admin.from("user_preferences").select("user_id,notification_preferences").in("user_id", recipients.map((item) => item.id));
  const preferences = new Map((rows ?? []).map((row) => [row.user_id, row.notification_preferences as Record<string, unknown>]));
  return recipients.filter((recipient) => {
    const prefs = preferences.get(recipient.id);
    return prefs?.email_enabled !== false && prefs?.[category] !== false;
  });
}

async function sendEmail(recipient: Recipient, notice: Notice) {
  const link = `${PUBLIC_APP_URL}${notice.href}`;
  const firstName = recipient.nome?.trim().split(/\s+/)[0] || "Olá";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f5f2;color:#1a1d1b;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 18px"><div style="background:#111317;border-radius:18px 18px 0 0;padding:18px 22px;color:#cbfb00;font-weight:700">Matter Academy</div><div style="background:#fff;border:1px solid #dde0da;border-top:0;border-radius:0 0 18px 18px;padding:26px 22px"><p style="margin:0 0 16px;color:#69726b;font-size:14px">${escapeHtml(firstName)},</p><h1 style="margin:0 0 10px;font-size:21px">${escapeHtml(notice.title)}</h1><p style="margin:0 0 22px;color:#4c534e;line-height:1.6">${escapeHtml(notice.message)}</p><a href="${escapeHtml(link)}" style="display:inline-block;background:#5c7700;color:#fff;text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:700;font-size:14px">Abrir no Matter Academy</a><p style="margin:24px 0 0;color:#69726b;font-size:11px">Você pode alterar estes avisos em Configurações › Notificações.</p></div></div></body></html>`;

  if (RESEND_API_KEY && NOTIFICATION_FROM_EMAIL) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${notice.idempotencyKey}:${recipient.id}`,
      },
      body: JSON.stringify({ from: NOTIFICATION_FROM_EMAIL, to: [recipient.email], subject: notice.subject, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Resend returned ${response.status}`);
    return;
  }

  if (NOTIFICATION_WEBHOOK_URL) {
    const response = await fetch(NOTIFICATION_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "academy.notification",
        idempotency_key: `${notice.idempotencyKey}:${recipient.id}`,
        category: notice.category,
        email: recipient.email,
        subject: notice.subject,
        title: notice.title,
        message: notice.message,
        link,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    return;
  }

  throw new Error("Email provider is not configured");
}

async function deliver(admin: SupabaseClient, recipients: Recipient[], notice: Notice) {
  const enabled = await emailEnabledRecipients(admin, recipients, notice.category);
  const results = await Promise.allSettled(enabled.map((recipient) => sendEmail(recipient, notice)));
  return {
    eligible: enabled.length,
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    configured: !!((RESEND_API_KEY && NOTIFICATION_FROM_EMAIL) || NOTIFICATION_WEBHOOK_URL),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const ctx = await requireUser(req);
    if (!ctx) return json({ error: "Unauthorized" }, 401);
    const { admin, userId, role } = ctx;
    const action = new URL(req.url).searchParams.get("action") ?? "";
    const body = await req.json().catch(() => ({})) as Record<string, string>;

    if (action === "activity-created") {
      const { data: activity } = await admin.from("atividades").select("id,titulo,prazo,turma_id,curso_id,professor_id").eq("id", body.activity_id).maybeSingle();
      if (!activity || !(activity.professor_id === userId || await isStaffForTurma(admin, userId, role, activity.turma_id))) return json({ error: "Forbidden" }, 403);
      const { data: memberships } = await admin.from("user_turmas").select("user_id,curso_id").eq("turma_id", activity.turma_id);
      const ids = [...new Set((memberships ?? []).filter((item) => !item.curso_id || item.curso_id === activity.curso_id).map((item) => item.user_id).filter((id) => id !== userId))];
      const { data: profiles } = ids.length ? await admin.from("profiles").select("id,email,nome,role").in("id", ids).eq("status", "active") : { data: [] };
      const recipients = (profiles ?? []).filter((profile) => profile.role === "student").map(({ id, email, nome }) => ({ id, email, nome }));
      const deadline = activity.prazo ? new Date(activity.prazo).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;
      return json(await deliver(admin, recipients, {
        idempotencyKey: `activity-created:${activity.id}`,
        category: "activities",
        subject: `Nova atividade: ${activity.titulo}`,
        title: "Uma nova atividade foi publicada",
        message: deadline ? `${activity.titulo}. Entrega até ${deadline}.` : `${activity.titulo} já está disponível.`,
        href: `/atividade/${activity.id}`,
      }));
    }

    if (action === "doubt-created") {
      const { data: doubt } = await admin.from("duvidas").select("id,titulo,turma_id,aluno_id").eq("id", body.doubt_id).maybeSingle();
      if (!doubt || doubt.aluno_id !== userId) return json({ error: "Forbidden" }, 403);
      const { data: memberships } = await admin.from("user_turmas").select("user_id").eq("turma_id", doubt.turma_id);
      const staffIds = [...new Set((memberships ?? []).map((item) => item.user_id))];
      const [{ data: staff }, { data: admins }] = await Promise.all([
        staffIds.length ? admin.from("profiles").select("id,email,nome,role").in("id", staffIds).in("role", ["professor", "monitor"]).eq("status", "active") : Promise.resolve({ data: [] }),
        admin.from("profiles").select("id,email,nome,role").eq("role", "admin").eq("status", "active"),
      ]);
      const unique = new Map([...(staff ?? []), ...(admins ?? [])].map(({ id, email, nome }) => [id, { id, email, nome }]));
      return json(await deliver(admin, [...unique.values()], {
        idempotencyKey: `doubt-created:${doubt.id}`,
        category: "answers",
        subject: `Nova dúvida: ${doubt.titulo}`,
        title: "Uma dúvida precisa de resposta",
        message: doubt.titulo,
        href: `/duvidas/${doubt.id}`,
      }));
    }

    if (action === "doubt-answered") {
      const { data: doubt } = await admin.from("duvidas").select("id,titulo,turma_id,aluno_id,status").eq("id", body.doubt_id).maybeSingle();
      if (!doubt || doubt.status !== "resolvida" || !await isStaffForTurma(admin, userId, role, doubt.turma_id)) return json({ error: "Forbidden" }, 403);
      const { data: recipient } = await admin.from("profiles").select("id,email,nome").eq("id", doubt.aluno_id).eq("status", "active").maybeSingle();
      return json(await deliver(admin, recipient ? [recipient] : [], {
        idempotencyKey: `doubt-answered:${doubt.id}`,
        category: "answers",
        subject: `Sua dúvida foi respondida: ${doubt.titulo}`,
        title: "Você recebeu uma nova resposta",
        message: `A equipe pedagógica respondeu “${doubt.titulo}”.`,
        href: `/duvidas/${doubt.id}`,
      }));
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[notifications]", error);
    return json({ error: "Unable to deliver notification" }, 500);
  }
});
