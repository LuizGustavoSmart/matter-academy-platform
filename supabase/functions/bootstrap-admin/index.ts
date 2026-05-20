import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: anyAdmin } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
    if (anyAdmin) {
      return new Response(JSON.stringify({ error: "Admin já existe" }), { status: 400, headers });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha obrigatórios" }), { status: 400, headers });
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error || !created.user) {
      return new Response(JSON.stringify({ error: error?.message }), { status: 400, headers });
    }

    await admin.from("profiles").insert({
      id: created.user.id,
      email,
      role: "admin",
      status: "active",
      activated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
});
