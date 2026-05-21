import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) ?? '';

    const body = await req.json().catch(() => ({}));
    const lessonId = body?.lesson_id;
    if (!lessonId || typeof lessonId !== 'string') {
      return json({ error: 'lesson_id obrigatório' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Rate limit: 30 reqs/min per user
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from('video_access_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('accessed_at', oneMinAgo);
    if ((count ?? 0) >= 30) {
      return json({ error: 'Limite de acessos excedido. Tente novamente em instantes.' }, 429);
    }

    // Fetch lesson with youtube_url
    const { data: lesson, error: lessonErr } = await admin
      .from('aulas')
      .select('id, curso_id, youtube_url')
      .eq('id', lessonId)
      .maybeSingle();
    if (lessonErr || !lesson) return json({ error: 'Aula não encontrada' }, 404);

    // Check enrollment
    const { data: enrollment } = await admin
      .from('curso_turmas')
      .select('turma_id, user_turmas!inner(user_id)')
      .eq('curso_id', lesson.curso_id)
      .eq('user_turmas.user_id', userId)
      .limit(1)
      .maybeSingle();

    // also allow admins
    const { data: profile } = await admin
      .from('profiles')
      .select('role, status')
      .eq('id', userId)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    const isActive = profile?.status === 'active';

    if (!isAdmin && (!enrollment || !isActive)) {
      return json({ error: 'Você não tem acesso a esta aula' }, 403);
    }

    // Extract videoId from URL
    const url: string = lesson.youtube_url ?? '';
    const videoId = extractYouTubeId(url);
    if (!videoId) return json({ error: 'Vídeo não disponível' }, 404);

    // Log access
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('cf-connecting-ip') ??
      null;
    const ua = req.headers.get('user-agent') ?? null;
    await admin.from('video_access_logs').insert({
      user_id: userId,
      lesson_id: lessonId,
      ip_address: ip,
      user_agent: ua,
    });

    return json({ videoId, userEmail });
  } catch (e) {
    return json({ error: (e as Error).message || 'Erro interno' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}
