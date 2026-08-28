-- Material (PDF) de cada aula, mostrado na tela de aula entre a descrição e
-- a navegação entre aulas.
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS material_pdf_url text;

DROP VIEW IF EXISTS public.lessons_public;
CREATE VIEW public.lessons_public
WITH (security_invoker = true)
AS
SELECT id, curso_id, titulo, descricao, ordem, created_at, publicada, capa_url, material_pdf_url
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

-- Bucket de storage para os PDFs de material das aulas
INSERT INTO storage.buckets (id, name, public)
VALUES ('materiais', 'materiais', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users upload materiais files" ON storage.objects;
CREATE POLICY "Authenticated users upload materiais files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materiais');

DROP POLICY IF EXISTS "Owners update materiais files" ON storage.objects;
CREATE POLICY "Owners update materiais files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'materiais' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'materiais' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners delete materiais files" ON storage.objects;
CREATE POLICY "Owners delete materiais files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'materiais' AND owner = auth.uid());

DROP POLICY IF EXISTS "Public read materiais files" ON storage.objects;
CREATE POLICY "Public read materiais files" ON storage.objects FOR SELECT
  USING (bucket_id = 'materiais');

NOTIFY pgrst, 'reload schema';
