
-- 1. Remove student SELECT on aulas (admins keep their policy)
DROP POLICY IF EXISTS "Students read accessible aulas" ON public.aulas;

-- 2. lessons_public view (no youtube_url). security_invoker=off so view runs as owner and bypasses aulas RLS, but we filter rows inline.
DROP VIEW IF EXISTS public.lessons_public;
CREATE VIEW public.lessons_public
WITH (security_invoker = off) AS
SELECT a.id, a.curso_id, a.titulo, a.descricao, a.ordem, a.created_at
FROM public.aulas a
WHERE public.is_admin()
   OR EXISTS (
     SELECT 1 FROM public.curso_turmas ct
     JOIN public.user_turmas ut ON ut.turma_id = ct.turma_id
     WHERE ct.curso_id = a.curso_id AND ut.user_id = auth.uid()
   );

REVOKE ALL ON public.lessons_public FROM PUBLIC;
GRANT SELECT ON public.lessons_public TO authenticated;

-- 3. video_access_logs
CREATE TABLE IF NOT EXISTS public.video_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_val_user_time ON public.video_access_logs(user_id, accessed_at DESC);

ALTER TABLE public.video_access_logs ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. service_role bypasses RLS.
