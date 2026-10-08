// TEMPORÁRIA: gera export JSON completo do banco e salva no bucket database_export_08_10_26.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const BUCKET = "database_export_08_10_26";
const FILE = "database_export_08_10_26.json";

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const URL_ = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return j({ error: "Unauthorized" }, 401);
  const { data: p } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (p?.role !== "admin") return j({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const migrations: string[] = body.migrations ?? [];
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
  try {
    const tbls = (await sql`select table_name from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE' order by table_name`).map((r) => r.table_name as string);

    const fks = await sql`select tc.table_name, kcu.column_name, ccu.table_schema ref_schema, ccu.table_name ref_table, ccu.column_name ref_col
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema
      join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
      where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'`;
    const pks = await sql`select tc.table_name, kcu.column_name from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema
      where tc.constraint_type='PRIMARY KEY' and tc.table_schema='public' order by kcu.ordinal_position`;
    const cols = await sql`select table_name, column_name, udt_name, data_type, is_nullable from information_schema.columns
      where table_schema='public' order by table_name, ordinal_position`;
    const enums = await sql`select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid
      join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' order by t.typname, e.enumsortorder`;

    // ordem topológica (pais antes de filhas); auth.users primeiro
    const deps: Record<string, Set<string>> = {};
    tbls.forEach((t) => (deps[t] = new Set()));
    for (const f of fks) if (f.ref_schema === "public" && f.ref_table !== f.table_name) deps[f.table_name].add(f.ref_table);
    const order: string[] = ["auth.users"];
    const done = new Set<string>();
    const visit = (t: string, stack = new Set<string>()) => {
      if (done.has(t) || stack.has(t)) return;
      stack.add(t);
      deps[t].forEach((d) => visit(d, stack));
      done.add(t);
      order.push(t);
    };
    tbls.forEach((t) => visit(t));

    const parts: string[] = [];
    const counts: Record<string, number> = {};

    const authRows = await sql`select coalesce(json_agg(r)::text,'[]') j, count(*)::int c from
      (select id, email, created_at, raw_user_meta_data from auth.users order by created_at) r`;
    counts["auth.users"] = authRows[0].c;
    parts.push(`"auth.users":{"columns":[{"name":"id","type":"uuid","nullable":false},{"name":"email","type":"varchar","nullable":true},{"name":"created_at","type":"timestamptz","nullable":true},{"name":"raw_user_meta_data","type":"jsonb","nullable":true}],"primary_key":["id"],"foreign_keys":[],"rows":${authRows[0].j}}`);

    for (const t of tbls) {
      const c = cols.filter((x) => x.table_name === t).map((x) => ({
        name: x.column_name,
        type: x.data_type === "ARRAY" ? `${String(x.udt_name).replace(/^_/, "")}[]` : x.udt_name,
        nullable: x.is_nullable === "YES",
      }));
      const pk = pks.filter((x) => x.table_name === t).map((x) => x.column_name);
      const fk = fks.filter((x) => x.table_name === t).map((x) => ({
        column: x.column_name,
        references: `${x.ref_schema === "public" ? "" : x.ref_schema + "."}${x.ref_table}.${x.ref_col}`,
      }));
      const ident = sql(t);
      const r = await sql`select coalesce(json_agg(x)::text,'[]') j, count(*)::int c from (select * from public.${ident}) x`;
      counts[t] = r[0].c;
      parts.push(`${JSON.stringify(t)}:{"columns":${JSON.stringify(c)},"primary_key":${JSON.stringify(pk)},"foreign_keys":${JSON.stringify(fk)},"rows":${r[0].j}}`);
    }

    const enumObj: Record<string, string[]> = {};
    for (const e of enums) (enumObj[e.typname] ??= []).push(e.enumlabel);

    const objs = await sql`select bucket_id, name, (metadata->>'size')::bigint size, metadata->>'mimetype' mime, created_at
      from storage.objects order by bucket_id, name`;
    const storage: Record<string, unknown[]> = {};
    const buckets = await sql`select id from storage.buckets order by id`;
    buckets.forEach((b) => (storage[b.id] = []));
    for (const o of objs) (storage[o.bucket_id] ??= []).push({
      path: o.name, size: o.size == null ? null : Number(o.size), mime_type: o.mime, created_at: new Date(o.created_at).toISOString(),
    });

    const meta = {
      exported_at: new Date().toISOString(),
      project: "Matter Academy",
      last_migration: migrations[migrations.length - 1] ?? null,
      migrations_applied: migrations,
      insert_order: order,
      row_counts: counts,
    };
    const out = `{"meta":${JSON.stringify(meta)},"enums":${JSON.stringify(enumObj)},"tables":{${parts.join(",")}},"storage":${JSON.stringify(storage)}}`;
    JSON.parse(out); // valida

    const bytes = new TextEncoder().encode(out);
    const up = await admin.storage.from(BUCKET).upload(FILE, bytes, { contentType: "application/json", upsert: true });
    if (up.error) return j({ error: up.error.message }, 500);
    const signed = await admin.storage.from(BUCKET).createSignedUrl(FILE, 60 * 60 * 24 * 7);
    return j({ size: bytes.length, row_counts: counts, url: signed.data?.signedUrl, insert_order: order });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  } finally {
    await sql.end();
  }
});
