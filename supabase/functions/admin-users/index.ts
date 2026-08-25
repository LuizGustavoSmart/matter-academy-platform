import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildLink, sendTransactionalEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const INVITE_WEBHOOK_URL = Deno.env.get("INVITE_WEBHOOK_URL") ?? "";

type InviteEvent = "invite" | "reinvite";
type UserRole = "admin" | "student" | "professor" | "monitor" | "embaixador";

const ROLE_ALIASES: Record<string, UserRole> = {
  admin: "admin",
  administrador: "admin",
  student: "student",
  aluno: "student",
  professor: "professor",
  monitor: "monitor",
  embaixador: "embaixador",
};

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return ROLE_ALIASES[value.trim().toLowerCase()] ?? null;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Mantém dígitos e um "+" inicial opcional; devolve null se vazio. */
function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? plus + digits : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

type InvitePayload = {
  event: InviteEvent;
  email: string;
  token: string;
  /** null = sem expiração; o link só perde a validade quando a senha é definida. */
  expires_at: string | null;
  role: string;
  nome?: string | null;
};

async function sendInviteWebhook(payload: InvitePayload, link: string) {
  if (!INVITE_WEBHOOK_URL) return;
  const body = {
    event: payload.event,
    email: payload.email,
    link,
    expires_at: payload.expires_at,
    role: payload.role,
  };
  try {
    const res = await fetch(INVITE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[webhook] ${payload.event} -> ${payload.email} status=${res.status}`);
  } catch (e) {
    console.error(`[webhook] failed for ${payload.email}:`, (e as Error).message);
  }
}

/**
 * Entrega o convite: e-mail transacional (Resend) + webhook opcional.
 * Await inline para garantir a entrega em convites em lote, onde a função
 * pode encerrar antes do waitUntil() liberar a requisição.
 */
async function deliverInvite(payload: InvitePayload) {
  const link = buildLink("ativar", payload.token);
  const sent = await sendTransactionalEmail({
    kind: payload.event,
    email: payload.email,
    link,
    nome: payload.nome,
    role: payload.role,
    expires_at: payload.expires_at,
  });
  await sendInviteWebhook(payload, link);
  return sent;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: profile } = await admin.from("profiles").select("role,status").eq("id", userData.user.id).maybeSingle();
  if (!profile || profile.role !== "admin" || profile.status !== "active") return null;
  return { admin, userId: userData.user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ctx = await requireAdmin(req);
    if (!ctx) return json({ error: "Unauthorized" }, 401);
    const { admin } = ctx;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};

    if (req.method === "POST" && action === "create") {
      const { email: rawEmail, nome, sobrenome, telefone, empresa, turma_cursos, turma_ids, role = "student", send_invite = true } = body as {
        email: string;
        nome?: string;
        sobrenome?: string;
        telefone?: string;
        empresa?: string;
        turma_cursos?: { turma_id: string; curso_id: string | null; is_embaixador?: boolean; is_staff?: boolean }[];
        turma_ids?: string[];
        role?: string;
        send_invite?: boolean;
      };
      const email = normalizeEmail(rawEmail);
      const normalizedRole = normalizeRole(role);
      if (!email) return json({ error: "Email obrigatório" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);
      if (!normalizedRole) return json({ error: "Papel inválido" }, 400);

      const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existing) return json({ error: "Email já cadastrado" }, 400);

      const tempPassword = genToken() + "A1!";
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        console.error("[admin-users:create] auth create failed", createErr?.message ?? "missing user");
        return json({ error: createErr?.message ?? "Erro ao criar usuário" }, 400);
      }

      const invite_token = genToken();
      // Convite sem prazo: o link deixa de valer só quando a senha é definida
      // (activate zera o token e move o status para "active").
      const invite_expires_at = null;

      const { error: profErr } = await admin.from("profiles").insert({
        id: created.user.id,
        email,
        nome: cleanText(nome),
        sobrenome: cleanText(sobrenome),
        telefone: normalizePhone(telefone),
        empresa: cleanText(empresa),
        role: normalizedRole,
        status: "pending",
        invite_token,
        invite_expires_at,
      });
      if (profErr) {
        console.error("[admin-users:create] profile insert failed", profErr.message);
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profErr.message }, 400);
      }

      // Suporta turma_cursos (novo formato: pares turma+curso) e turma_ids (legado)
      const pairs: { user_id: string; turma_id: string; curso_id: string | null; is_embaixador: boolean; is_staff: boolean }[] = turma_cursos?.length
        ? turma_cursos.map(({ turma_id, curso_id, is_embaixador, is_staff }) => ({ user_id: created.user.id, turma_id, curso_id, is_embaixador: !!is_embaixador, is_staff: is_staff !== false }))
        : (turma_ids ?? []).map((tid) => ({ user_id: created.user.id, turma_id: tid, curso_id: null, is_embaixador: false, is_staff: true }));

      if (pairs.length) {
        const { error: turmasErr } = await admin.from("user_turmas").insert(pairs);
        if (turmasErr) {
          console.error("[admin-users:create] turma link failed", turmasErr.message);
          await admin.from("profiles").delete().eq("id", created.user.id);
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: turmasErr.message }, 400);
        }
      }

      let email_sent = false;
      let email_error: string | undefined;
      if (send_invite) {
        const delivery = await deliverInvite({
          event: "invite",
          email,
          token: invite_token,
          expires_at: invite_expires_at,
          role: normalizedRole,
          nome: cleanText(nome),
        });
        email_sent = delivery.ok;
        email_error = delivery.error;
      }

      return json({ user_id: created.user.id, invite_token, invite_sent: !!send_invite, email_sent, email_error });
    }

    if (req.method === "POST" && action === "reinvite") {
      const { user_id } = body as { user_id: string };
      const invite_token = genToken();
      const invite_expires_at = null; // ver comentário em "create"
      const { data: updated, error } = await admin.from("profiles")
        .update({ invite_token, invite_expires_at, status: "pending" })
        .eq("id", user_id)
        .select("email,role,nome")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      let email_sent = false;
      let email_error: string | undefined;
      if (updated?.email) {
        const delivery = await deliverInvite({
          event: "reinvite",
          email: updated.email,
          token: invite_token,
          expires_at: invite_expires_at,
          role: updated.role ?? "student",
          nome: updated.nome,
        });
        email_sent = delivery.ok;
        email_error = delivery.error;
      }
      return json({ invite_token, email_sent, email_error });
    }

    if (req.method === "POST" && action === "update") {
      const { user_id, email: rawEmail, nome, sobrenome, telefone, empresa, status, role, turma_cursos, turma_ids } = body as {
        user_id: string; email?: string; nome?: string; sobrenome?: string; telefone?: string; empresa?: string;
        status?: string; role?: string;
        turma_cursos?: { turma_id: string; curso_id: string | null; is_embaixador?: boolean; is_staff?: boolean }[];
        turma_ids?: string[];
      };
      const email = rawEmail !== undefined ? normalizeEmail(rawEmail) : undefined;
      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (nome !== undefined) updates.nome = cleanText(nome);
      if (sobrenome !== undefined) updates.sobrenome = cleanText(sobrenome);
      if (telefone !== undefined) updates.telefone = normalizePhone(telefone);
      if (empresa !== undefined) updates.empresa = cleanText(empresa);
      if (status) updates.status = status;
      if (role) {
        const normalizedRole = normalizeRole(role);
        if (!normalizedRole) return json({ error: "Papel inválido" }, 400);
        updates.role = normalizedRole;
      }

      if (email) {
        const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { email });
        if (authErr) return json({ error: authErr.message }, 400);
      }
      if (Object.keys(updates).length) {
        const { error } = await admin.from("profiles").update(updates).eq("id", user_id);
        if (error) return json({ error: error.message }, 400);
      }
      if (turma_cursos !== undefined || turma_ids !== undefined) {
        await admin.from("user_turmas").delete().eq("user_id", user_id);
        const pairs: { user_id: string; turma_id: string; curso_id: string | null; is_embaixador: boolean; is_staff: boolean }[] = turma_cursos?.length
          ? turma_cursos.map(({ turma_id, curso_id, is_embaixador, is_staff }) => ({ user_id, turma_id, curso_id, is_embaixador: !!is_embaixador, is_staff: is_staff !== false }))
          : (turma_ids ?? []).map((tid) => ({ user_id, turma_id: tid, curso_id: null, is_embaixador: false, is_staff: true }));
        if (pairs.length) {
          await admin.from("user_turmas").insert(pairs);
        }
      }
      return json({ ok: true });
    }

    if (req.method === "POST" && action === "delete") {
      const { user_id } = body as { user_id: string };
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (req.method === "POST" && action === "forgot-link") {
      const { email } = body as { email: string };
      const normalizedEmail = normalizeEmail(email);
      const { data: profile } = await admin.from("profiles").select("id").ilike("email", normalizedEmail).maybeSingle();
      if (!profile) return json({ error: "Usuário não encontrado" }, 404);
      const reset_token = genToken();
      const reset_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await admin.from("profiles").update({ reset_token, reset_expires_at }).eq("id", profile.id);
      return json({ reset_token });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
