DROP VIEW IF EXISTS public.lessons_public;

CREATE VIEW public.lessons_public
WITH (security_invoker = true)
AS
SELECT id, curso_id, titulo, descricao, ordem, created_at, publicada, capa_url, material_pdf_url, youtube_url
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

NOTIFY pgrst, 'reload schema';