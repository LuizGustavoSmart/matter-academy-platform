ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS codigo text;

ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS capa_url text;

ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS capa_url text;

ALTER TABLE public.curso_turmas ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS "Authenticated users upload capas files" ON storage.objects;

CREATE POLICY "Authenticated users upload capas files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'capas');

DROP POLICY IF EXISTS "Owners update capas files" ON storage.objects;

CREATE POLICY "Owners update capas files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'capas' AND owner = auth.uid())
WITH CHECK (bucket_id = 'capas' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners delete capas files" ON storage.objects;

CREATE POLICY "Owners delete capas files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'capas' AND owner = auth.uid());

DROP POLICY IF EXISTS "Public read capas files" ON storage.objects;

CREATE POLICY "Public read capas files"
ON storage.objects FOR SELECT
USING (bucket_id = 'capas');

NOTIFY pgrst, 'reload schema';