-- Reconcilia o schema de atividades: uma migration paralela (do Lovable) criou a
-- tabela `atividades` antes desta, com um schema mínimo e incompatível
-- (sem curso_id, anexo_url, anexo_nome, nota_maxima), além de uma tabela
-- `submissoes` que não é usada pelo app. Esta migration corrige tudo,
-- de forma idempotente (segura para rodar independente do estado atual).

-- Remove a tabela paralela não utilizada pelo app
DROP TABLE IF EXISTS public.submissoes CASCADE;

-- Remove as policies conflitantes criadas para o schema antigo de atividades
DROP POLICY IF EXISTS "atividades_select" ON public.atividades;
DROP POLICY IF EXISTS "atividades_insert" ON public.atividades;
DROP POLICY IF EXISTS "atividades_update" ON public.atividades;
DROP POLICY IF EXISTS "atividades_delete" ON public.atividades;

-- Garante todas as colunas necessárias na tabela atividades
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS aula_id uuid REFERENCES public.aulas(id) ON DELETE SET NULL;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS anexo_url text;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS anexo_nome text;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS nota_maxima numeric NOT NULL DEFAULT 10;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS prazo timestamptz;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES public.profiles(id);

-- Remove qualquer atividade órfã criada com o schema antigo (sem curso_id),
-- já que nunca funcionaram corretamente no app
DELETE FROM public.atividades WHERE curso_id IS NULL;

-- Cria a tabela de envios/respostas dos alunos (não existia ainda)
CREATE TABLE IF NOT EXISTS public.atividade_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  arquivo_url text,
  arquivo_nome text,
  enviado_em timestamptz,
  nota numeric,
  comentario_professor text,
  corrigido_em timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (atividade_id, aluno_id)
);

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_envios ENABLE ROW LEVEL SECURITY;

-- Funções auxiliares (idempotentes)
CREATE OR REPLACE FUNCTION public.is_professor_of_turma(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_turmas ut
    JOIN profiles p ON p.id = ut.user_id
    WHERE ut.turma_id = t_id AND ut.user_id = auth.uid() AND p.role IN ('professor', 'monitor')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_access_to_turma_curso(t_id uuid, c_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_turmas ut
    WHERE ut.turma_id = t_id AND ut.curso_id = c_id AND ut.user_id = auth.uid()
  );
$$;

-- ATIVIDADES policies
DROP POLICY IF EXISTS "Read atividades" ON public.atividades;
CREATE POLICY "Read atividades" ON public.atividades FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id) OR has_access_to_turma_curso(turma_id, curso_id));

DROP POLICY IF EXISTS "Professors and admins insert atividades" ON public.atividades;
CREATE POLICY "Professors and admins insert atividades" ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_professor_of_turma(turma_id));

DROP POLICY IF EXISTS "Professors and admins update atividades" ON public.atividades;
CREATE POLICY "Professors and admins update atividades" ON public.atividades FOR UPDATE TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id))
  WITH CHECK (is_admin() OR is_professor_of_turma(turma_id));

DROP POLICY IF EXISTS "Professors and admins delete atividades" ON public.atividades;
CREATE POLICY "Professors and admins delete atividades" ON public.atividades FOR DELETE TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id));

-- ATIVIDADE_ENVIOS policies
DROP POLICY IF EXISTS "Read atividade_envios" ON public.atividade_envios;
CREATE POLICY "Read atividade_envios" ON public.atividade_envios FOR SELECT TO authenticated
  USING (
    is_admin()
    OR aluno_id = auth.uid()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma(a.turma_id))
  );

DROP POLICY IF EXISTS "Students insert own envio" ON public.atividade_envios;
CREATE POLICY "Students insert own envio" ON public.atividade_envios FOR INSERT TO authenticated
  WITH CHECK (
    aluno_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM atividades a
      WHERE a.id = atividade_id AND has_access_to_turma_curso(a.turma_id, a.curso_id)
    )
  );

DROP POLICY IF EXISTS "Students update own envio before correction" ON public.atividade_envios;
CREATE POLICY "Students update own envio before correction" ON public.atividade_envios FOR UPDATE TO authenticated
  USING (aluno_id = auth.uid() AND corrigido_em IS NULL)
  WITH CHECK (aluno_id = auth.uid() AND corrigido_em IS NULL);

DROP POLICY IF EXISTS "Professors and admins grade envios" ON public.atividade_envios;
CREATE POLICY "Professors and admins grade envios" ON public.atividade_envios FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma(a.turma_id))
  )
  WITH CHECK (
    is_admin()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma(a.turma_id))
  );

-- Bucket de storage para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('atividades', 'atividades', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users upload atividades files" ON storage.objects;
CREATE POLICY "Authenticated users upload atividades files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atividades');

DROP POLICY IF EXISTS "Owners update atividades files" ON storage.objects;
CREATE POLICY "Owners update atividades files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'atividades' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'atividades' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners delete atividades files" ON storage.objects;
CREATE POLICY "Owners delete atividades files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'atividades' AND owner = auth.uid());

DROP POLICY IF EXISTS "Public read atividades files" ON storage.objects;
CREATE POLICY "Public read atividades files" ON storage.objects FOR SELECT
  USING (bucket_id = 'atividades');

NOTIFY pgrst, 'reload schema';
