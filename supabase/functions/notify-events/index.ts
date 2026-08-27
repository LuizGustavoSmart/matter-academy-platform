import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildAppUrl, sendTransactionalEmail, type EmailKind } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ACTIONS = new Set(["nova_aula", "nova_atividade", "atividade_corrigida", "nova_submissao"]);

type Recipient = { user_id: string; email: string; nome?: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireActiveUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: profile } = await admin.from("profiles").select("status").eq("id", userData.user.id).maybeSingle();
  if (!profile || profile.status !== "active") return null;
  return { admin };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    if (!ACTIONS.has(action)) return json({ error: "Ação desconhecida" }, 400);
    if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

    const ctx = await requireActiveUser(req);
    if (!ctx) return json({ error: "Unauthorized" }, 401);
    const { admin } = ctx;

    const body = await req.json().catch(() => ({}));
    const { recipients, titulo, mensagem, link } = body as {
      recipients?: Recipient[];
      titulo?: string;
      mensagem?: string;
      link?: string;
    };

    if (!Array.isArray(recipients) || recipients.length === 0) return json({ error: "Sem destinatários" }, 400);
    if (!titulo || !mensagem) return json({ error: "titulo e mensagem obrigatórios" }, 400);

    const relativeLink = typeof link === "string" && link ? link : "/";
    const absoluteLink = buildAppUrl(relativeLink);

    const rows = recipients
      .filter((r) => r && r.user_id)
      .map((r) => ({ user_id: r.user_id, tipo: action, titulo, mensagem, link: relativeLink }));

    const { error: insertErr } = await admin.from("notificacoes").insert(rows);
    if (insertErr) {
      console.error("[notify-events] insert falhou:", insertErr.message);
      return json({ error: insertErr.message }, 400);
    }

    const emailResults = await Promise.all(
      recipients.filter((r) => r?.email).map((r) =>
        sendTransactionalEmail({
          kind: action as EmailKind,
          email: r.email,
          link: absoluteLink,
          nome: r.nome,
          titulo,
          mensagem,
        })
      ),
    );

    return json({ ok: true, notified: rows.length, emails_sent: emailResults.filter((r) => r.ok).length });
  } catch (e) {
    console.error("[notify-events] erro:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
