import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const INVITE_WEBHOOK_URL = Deno.env.get("INVITE_WEBHOOK_URL") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://matteracademy.lovable.app";

type InviteEvent = "invite" | "reinvite";

async function sendInviteWebhook(payload: {
  event: InviteEvent;
  email: string;
  token: string;
  expires_at: string;
  role: string;
}) {
  if (!INVITE_WEBHOOK_URL) {
    console.log("[webhook] INVITE_WEBHOOK_URL not set, skipping");
    return;
  }
  const link = `${PUBLIC_APP_URL.replace(/\/$/, "")}/ativar?token=${payload.token}`;
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

function fireWebhook(payload: Parameters<typeof sendInviteWebhook>[0]) {
  try {
    // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(sendInviteWebhook(payload));
  } catch {
    sendInviteWebhook(payload);
  }
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
      const { email, turma_ids, role = "student" } = body as { email: string; turma_ids?: string[]; role?: string };
      if (!email) return json({ error: "Email obrigatório" }, 400);
      if (!["admin", "student", "professor"].includes(role)) return json({ error: "Papel inválido" }, 400);

      const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existing) return json({ error: "Email já cadastrado" }, 400);

      const tempPassword = genToken() + "A1!";
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !created.user) return json({ error: createErr?.message ?? "Erro ao criar usuário" }, 400);

      const invite_token = genToken();
      const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: profErr } = await admin.from("profiles").insert({
        id: created.user.id,
        email,
        role,
        status: "pending",
        invite_token,
        invite_expires_at,
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profErr.message }, 400);
      }

      if (turma_ids?.length) {
        await admin.from("user_turmas").insert(turma_ids.map((tid) => ({ user_id: created.user.id, turma_id: tid })));
      }

      fireWebhook({ event: "invite", email, token: invite_token, expires_at: invite_expires_at, role });

      return json({ user_id: created.user.id, invite_token });
    }

    if (req.method === "POST" && action === "reinvite") {
      const { user_id } = body as { user_id: string };
      const invite_token = genToken();
      const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: updated, error } = await admin.from("profiles")
        .update({ invite_token, invite_expires_at, status: "pending" })
        .eq("id", user_id)
        .select("email,role")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (updated?.email) {
        fireWebhook({ event: "reinvite", email: updated.email, token: invite_token, expires_at: invite_expires_at, role: updated.role ?? "student" });
      }
      return json({ invite_token });
    }

    if (req.method === "POST" && action === "update") {
      const { user_id, email, status, role, turma_ids } = body as {
        user_id: string; email?: string; status?: string; role?: string; turma_ids?: string[];
      };
      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (status) updates.status = status;
      if (role && ["admin", "student", "professor"].includes(role)) updates.role = role;

      if (email) {
        const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { email });
        if (authErr) return json({ error: authErr.message }, 400);
      }
      if (Object.keys(updates).length) {
        const { error } = await admin.from("profiles").update(updates).eq("id", user_id);
        if (error) return json({ error: error.message }, 400);
      }
      if (turma_ids) {
        await admin.from("user_turmas").delete().eq("user_id", user_id);
        if (turma_ids.length) {
          await admin.from("user_turmas").insert(turma_ids.map((tid) => ({ user_id, turma_id: tid })));
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
      const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
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
