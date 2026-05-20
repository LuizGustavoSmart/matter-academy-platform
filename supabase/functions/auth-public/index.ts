import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      const { data: profile } = await admin.from("profiles").select("id,email,invite_expires_at,status").eq("invite_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.status !== "pending") return json({ error: "Conta já ativada" }, 400);
      if (profile.invite_expires_at && new Date(profile.invite_expires_at) < new Date()) {
        return json({ error: "Token expirado" }, 400);
      }
      return json({ email: profile.email });
    }

    if (action === "activate") {
      const { token, password } = body as { token: string; password: string };
      if (!password || password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);
      const { data: profile } = await admin.from("profiles").select("id,invite_expires_at,status").eq("invite_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.status !== "pending") return json({ error: "Conta já ativada" }, 400);
      if (profile.invite_expires_at && new Date(profile.invite_expires_at) < new Date()) {
        return json({ error: "Token expirado" }, 400);
      }
      const { error: authErr } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (authErr) return json({ error: authErr.message }, 400);
      await admin.from("profiles").update({
        status: "active",
        invite_token: null,
        invite_expires_at: null,
        activated_at: new Date().toISOString(),
      }).eq("id", profile.id);
      return json({ ok: true });
    }

    if (action === "forgot") {
      const { email } = body as { email: string };
      const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (!profile) return json({ ok: true, reset_token: null });
      const reset_token = genToken();
      const reset_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await admin.from("profiles").update({ reset_token, reset_expires_at }).eq("id", profile.id);
      return json({ ok: true, reset_token });
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
      const { data: profile } = await admin.from("profiles").select("id,reset_expires_at").eq("reset_token", token).maybeSingle();
      if (!profile) return json({ error: "Token inválido" }, 400);
      if (profile.reset_expires_at && new Date(profile.reset_expires_at) < new Date()) {
        return json({ error: "Token expirado" }, 400);
      }
      const { error: authErr } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (authErr) return json({ error: authErr.message }, 400);
      await admin.from("profiles").update({ reset_token: null, reset_expires_at: null }).eq("id", profile.id);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
