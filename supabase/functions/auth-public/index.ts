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
const INVITE_WEBHOOK_URL = Deno.env.get("INVITE_WEBHOOK_URL") ?? "";

/** Entrega a redefinição: e-mail transacional (Resend) + webhook opcional. */
async function deliverReset(email: string, nome: string | null, token: string, expires_at: string) {
  const link = buildLink("redefinir-senha", token);
  await sendTransactionalEmail({ kind: "reset", email, link, nome, expires_at });

  if (!INVITE_WEBHOOK_URL) return;
  try {
    const res = await fetch(INVITE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "reset", email, link, expires_at }),
      signal: AbortSignal.timeout(5000),
    });
    console.log(`[webhook] reset -> ${email} status=${res.status}`);
  } catch (e) {
    console.error(`[webhook] reset failed for ${email}:`, (e as Error).message);
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = await req.json().catch(() => ({}));

    if (action === "verify-invite") {
      const { token } = body as { token: string };
      // O convite não expira por tempo: vale enquanto o status for "pending".
      const { data: profile } = await admin.from("profiles")
        .select("id,email,status,role,nome,sobrenome,telefone,empresa")
        .eq("invite_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.status !== "pending") return json({ error: "Conta já ativada" }, 400);
      return json({
        email: profile.email, role: profile.role,
        nome: profile.nome, sobrenome: profile.sobrenome, telefone: profile.telefone, empresa: profile.empresa,
      });
    }

    if (action === "activate") {
      const { token, password } = body as { token: string; password: string };
      if (!password || password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);
      const { data: profile } = await admin.from("profiles").select("id,status").eq("invite_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.status !== "pending") return json({ error: "Conta já ativada" }, 400);
      const { error: authErr } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (authErr) return json({ error: authErr.message }, 400);
      const { error: updErr } = await admin.from("profiles").update({
        status: "active",
        invite_token: null,
        invite_expires_at: null,
        activated_at: new Date().toISOString(),
      }).eq("id", profile.id);
      if (updErr) return json({ error: updErr.message }, 400);
      return json({ ok: true });
    }

    if (action === "forgot") {
      const { email } = body as { email: string };
      const normalizedEmail = (email ?? "").trim().toLowerCase();
      const { data: profile } = await admin.from("profiles").select("id,email,nome").ilike("email", normalizedEmail).maybeSingle();
      // Always return ok to prevent email enumeration
      if (!profile) return json({ ok: true });
      const reset_token = genToken();
      const reset_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await admin.from("profiles").update({ reset_token, reset_expires_at }).eq("id", profile.id);
      await deliverReset(profile.email, profile.nome ?? null, reset_token, reset_expires_at);
      return json({ ok: true });
    }

    if (action === "verify-reset") {
      const { token } = body as { token: string };
      const { data: profile } = await admin.from("profiles").select("id,email,reset_expires_at").eq("reset_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.reset_expires_at && new Date(profile.reset_expires_at) < new Date()) {
        return json({ error: "Token expirado" }, 400);
      }
      return json({ email: profile.email });
    }

    if (action === "reset") {
      const { token, password } = body as { token: string; password: string };
      if (!password || password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);
      const { data: profile } = await admin.from("profiles").select("id,status,reset_expires_at").eq("reset_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.reset_expires_at && new Date(profile.reset_expires_at) < new Date()) {
        return json({ error: "Token expirado" }, 400);
      }
      const { error: authErr } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (authErr) return json({ error: authErr.message }, 400);
      // Aluno que nunca ativou e usou "Esqueci minha senha" passa a ter senha
      // válida; se continuasse "pending", entraria com sessão num perfil que o
      // frontend não aceita (era a origem da tela preta).
      const activation = profile.status === "pending"
        ? { status: "active", invite_token: null, invite_expires_at: null, activated_at: new Date().toISOString() }
        : {};
      await admin.from("profiles").update({ reset_token: null, reset_expires_at: null, ...activation }).eq("id", profile.id);
      return json({ ok: true });
    }

    if (action === "confirm-session") {
      // Quem tem sessão válida já provou conhecer a senha que ele mesmo definiu
      // (ativação, redefinição ou senha anterior ao antigo "reinvite" que
      // voltava contas ativas para pending). Conclui a ativação no servidor.
      const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      const { data: userData } = await admin.auth.getUser(jwt);
      if (!userData?.user) return json({ error: "Sessão inválida" }, 401);
      const { data: profile } = await admin.from("profiles").select("id,status").eq("id", userData.user.id).maybeSingle();
      if (!profile) return json({ error: "Perfil não encontrado" }, 404);
      if (profile.status !== "pending") return json({ status: profile.status });
      const { error: updErr } = await admin.from("profiles").update({
        status: "active",
        invite_token: null,
        invite_expires_at: null,
        activated_at: new Date().toISOString(),
      }).eq("id", profile.id).eq("status", "pending");
      if (updErr) return json({ error: updErr.message }, 400);
      console.log(`[confirm-session] perfil ${profile.id} ativado a partir de sessão válida`);
      return json({ status: "active" });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
