
-- 1) Prevent privilege escalation on profiles via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.invite_token IS DISTINCT FROM OLD.invite_token
     OR NEW.invite_expires_at IS DISTINCT FROM OLD.invite_expires_at
     OR NEW.reset_token IS DISTINCT FROM OLD.reset_token
     OR NEW.reset_expires_at IS DISTINCT FROM OLD.reset_expires_at
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected profile columns';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_sensitive_changes ON public.profiles;
CREATE TRIGGER profiles_prevent_sensitive_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_sensitive_changes();

-- 2) Hide sensitive token columns from client SELECTs (service_role bypasses RLS/grants)
REVOKE SELECT (invite_token, invite_expires_at, reset_token, reset_expires_at)
  ON public.profiles FROM authenticated, anon;

-- 3) Add RLS policies for video_access_logs (service_role bypasses RLS; admins can view)
CREATE POLICY "Admins read video_access_logs"
ON public.video_access_logs
FOR SELECT TO authenticated
USING (public.is_admin());

-- 4) Recreate lessons_public view with SECURITY INVOKER
DROP VIEW IF EXISTS public.lessons_public;
CREATE VIEW public.lessons_public
WITH (security_invoker = true)
AS
SELECT id, curso_id, titulo, descricao, ordem, created_at
FROM public.aulas a
WHERE public.is_admin() OR EXISTS (
  SELECT 1
  FROM public.curso_turmas ct
  JOIN public.user_turmas ut ON ut.turma_id = ct.turma_id
  WHERE ct.curso_id = a.curso_id AND ut.user_id = auth.uid()
);

GRANT SELECT ON public.lessons_public TO authenticated;

-- For the invoker view to work, enrolled students need column-level SELECT on aulas
-- (but NOT youtube_url which stays sensitive). Add a SELECT policy too.
CREATE POLICY "Enrolled students read aulas metadata"
ON public.aulas
FOR SELECT TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.curso_turmas ct
    JOIN public.user_turmas ut ON ut.turma_id = ct.turma_id
    WHERE ct.curso_id = aulas.curso_id AND ut.user_id = auth.uid()
  )
);

-- Restrict youtube_url column access; only service_role (edge function) can read it
REVOKE SELECT (youtube_url) ON public.aulas FROM authenticated, anon;
GRANT SELECT (id, curso_id, titulo, descricao, ordem, created_at) ON public.aulas TO authenticated;
