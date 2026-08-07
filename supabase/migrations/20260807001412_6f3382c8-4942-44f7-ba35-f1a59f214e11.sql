ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS publicada boolean NOT NULL DEFAULT true;
ALTER TABLE public.atividades ALTER COLUMN publicada SET DEFAULT false;

DROP POLICY IF EXISTS "Read atividades" ON public.atividades;
CREATE POLICY "Read atividades" ON public.atividades FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id) OR (publicada = true AND has_access_to_turma_curso(turma_id, curso_id)));

DROP POLICY IF EXISTS "Students insert own envio" ON public.atividade_envios;
CREATE POLICY "Students insert own envio" ON public.atividade_envios FOR INSERT TO authenticated
  WITH CHECK (
    aluno_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM atividades a
      WHERE a.id = atividade_id
        AND has_access_to_turma_curso(a.turma_id, a.curso_id)
        AND (a.prazo IS NULL OR a.prazo >= now())
    )
  );

DROP POLICY IF EXISTS "Students update own envio before correction" ON public.atividade_envios;
CREATE POLICY "Students update own envio before correction" ON public.atividade_envios FOR UPDATE TO authenticated
  USING (
    aluno_id = auth.uid() AND corrigido_em IS NULL
    AND EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_id AND (a.prazo IS NULL OR a.prazo >= now()))
  )
  WITH CHECK (
    aluno_id = auth.uid() AND corrigido_em IS NULL
    AND EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_id AND (a.prazo IS NULL OR a.prazo >= now()))
  );

ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS capa_url text;

DROP VIEW IF EXISTS public.lessons_public;
CREATE VIEW public.lessons_public
WITH (security_invoker = true)
AS
SELECT id, curso_id, titulo, descricao, ordem, created_at, publicada, capa_url
FROM public.aulas a
WHERE public.is_admin() OR (
  a.publicada = true AND EXISTS (
    SELECT 1
    FROM public.curso_turmas ct
    JOIN public.user_turmas ut ON ut.turma_id = ct.turma_id
    WHERE ct.curso_id = a.curso_id AND ut.user_id = auth.uid()
  )
);
GRANT SELECT ON public.lessons_public TO authenticated;

DROP POLICY IF EXISTS "Authenticated users upload aulas capa files" ON storage.objects;
CREATE POLICY "Authenticated users upload aulas capa files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'aulas');

DROP POLICY IF EXISTS "Owners delete aulas capa files" ON storage.objects;
CREATE POLICY "Owners delete aulas capa files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'aulas' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners update aulas capa files" ON storage.objects;
CREATE POLICY "Owners update aulas capa files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'aulas' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'aulas' AND owner = auth.uid());

DROP POLICY IF EXISTS "Public read aulas capa files" ON storage.objects;
CREATE POLICY "Public read aulas capa files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'aulas');

NOTIFY pgrst, 'reload schema';