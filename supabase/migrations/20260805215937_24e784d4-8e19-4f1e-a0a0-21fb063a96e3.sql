CREATE OR REPLACE FUNCTION public.storage_can_access_turma_curso(_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[]; t uuid; c uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  parts := string_to_array(coalesce(_path,''), '/');
  BEGIN
    t := parts[1]::uuid; c := parts[2]::uuid;
  EXCEPTION WHEN others THEN RETURN false;
  END;
  RETURN public.has_access_to_turma_curso(t, c) OR public.is_professor_of_turma(t);
END $$;

CREATE OR REPLACE FUNCTION public.storage_can_access_atividade_path(_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[]; a uuid; u uuid; t uuid; c uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  parts := string_to_array(coalesce(_path,''), '/');
  IF parts[1] = 'atividades' THEN
    BEGIN
      t := parts[2]::uuid; c := parts[3]::uuid;
    EXCEPTION WHEN others THEN RETURN false;
    END;
    RETURN public.has_access_to_turma_curso(t, c) OR public.is_professor_of_turma(t);
  ELSIF parts[1] = 'envios' THEN
    BEGIN
      a := parts[2]::uuid; u := parts[3]::uuid;
    EXCEPTION WHEN others THEN RETURN false;
    END;
    IF u = auth.uid() THEN RETURN true; END IF;
    SELECT turma_id INTO t FROM public.atividades WHERE id = a;
    RETURN t IS NOT NULL AND public.is_professor_of_turma(t);
  END IF;
  RETURN false;
END $$;

REVOKE ALL ON FUNCTION public.storage_can_access_turma_curso(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_can_access_atividade_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_can_access_turma_curso(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.storage_can_access_atividade_path(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated read atividades" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update atividades" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete atividades" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload atividades" ON storage.objects;
DROP POLICY IF EXISTS "Public read comunidade files" ON storage.objects;
DROP POLICY IF EXISTS "Public read duvidas files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload comunidade files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload duvidas files" ON storage.objects;

CREATE POLICY "atividades read scoped" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'atividades' AND public.storage_can_access_atividade_path(name));

CREATE POLICY "atividades insert scoped" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'atividades' AND public.storage_can_access_atividade_path(name));

CREATE POLICY "atividades update scoped" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'atividades' AND public.storage_can_access_atividade_path(name))
WITH CHECK (bucket_id = 'atividades' AND public.storage_can_access_atividade_path(name));

CREATE POLICY "atividades delete scoped" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'atividades' AND public.storage_can_access_atividade_path(name));

CREATE POLICY "comunidade read scoped" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comunidade' AND public.storage_can_access_turma_curso(name));

CREATE POLICY "comunidade insert scoped" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comunidade' AND public.storage_can_access_turma_curso(name));

CREATE POLICY "duvidas read scoped" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'duvidas' AND public.storage_can_access_turma_curso(name));

CREATE POLICY "duvidas insert scoped" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'duvidas' AND public.storage_can_access_turma_curso(name));