ALTER TABLE public.atividade_envios ADD COLUMN IF NOT EXISTS texto text;

CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  arquivo_url text,
  arquivo_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read community_messages" ON public.community_messages;
CREATE POLICY "Read community_messages" ON public.community_messages FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id) OR has_access_to_turma_curso(turma_id, curso_id));

DROP POLICY IF EXISTS "Insert community_messages" ON public.community_messages;
CREATE POLICY "Insert community_messages" ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_admin() OR is_professor_of_turma(turma_id) OR has_access_to_turma_curso(turma_id, curso_id))
  );

DROP POLICY IF EXISTS "Delete own community_messages" ON public.community_messages;
CREATE POLICY "Delete own community_messages" ON public.community_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Authenticated users upload comunidade files" ON storage.objects;
CREATE POLICY "Authenticated users upload comunidade files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comunidade');

DROP POLICY IF EXISTS "Owners delete comunidade files" ON storage.objects;
CREATE POLICY "Owners delete comunidade files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comunidade' AND owner = auth.uid());

DROP POLICY IF EXISTS "Public read comunidade files" ON storage.objects;
CREATE POLICY "Public read comunidade files" ON storage.objects FOR SELECT
  USING (bucket_id = 'comunidade');

NOTIFY pgrst, 'reload schema';