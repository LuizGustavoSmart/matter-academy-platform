-- Atividades (tarefas) vinculadas a um curso ("faixa") dentro de uma turma
CREATE TABLE public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  aula_id uuid REFERENCES public.aulas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  anexo_url text,
  anexo_nome text,
  nota_maxima numeric NOT NULL DEFAULT 10,
  prazo timestamptz,
  professor_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Envios/respostas dos alunos para cada atividade
CREATE TABLE public.atividade_envios (
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

-- Funções auxiliares para as policies
CREATE OR REPLACE FUNCTION public.is_professor_of_turma(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_turmas ut
    JOIN profiles p ON p.id = ut.user_id
    WHERE ut.turma_id = t_id AND ut.user_id = auth.uid() AND p.role = 'professor'
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
CREATE POLICY "Read atividades" ON public.atividades FOR SELECT TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id) OR has_access_to_turma_curso(turma_id, curso_id));

CREATE POLICY "Professors and admins insert atividades" ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_professor_of_turma(turma_id));

CREATE POLICY "Professors and admins update atividades" ON public.atividades FOR UPDATE TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id))
  WITH CHECK (is_admin() OR is_professor_of_turma(turma_id));

CREATE POLICY "Professors and admins delete atividades" ON public.atividades FOR DELETE TO authenticated
  USING (is_admin() OR is_professor_of_turma(turma_id));

-- ATIVIDADE_ENVIOS policies
CREATE POLICY "Read atividade_envios" ON public.atividade_envios FOR SELECT TO authenticated
  USING (
    is_admin()
    OR aluno_id = auth.uid()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma(a.turma_id))
  );

CREATE POLICY "Students insert own envio" ON public.atividade_envios FOR INSERT TO authenticated
  WITH CHECK (
    aluno_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM atividades a
      WHERE a.id = atividade_id AND has_access_to_turma_curso(a.turma_id, a.curso_id)
    )
  );

CREATE POLICY "Students update own envio before correction" ON public.atividade_envios FOR UPDATE TO authenticated
  USING (aluno_id = auth.uid() AND corrigido_em IS NULL)
  WITH CHECK (aluno_id = auth.uid() AND corrigido_em IS NULL);

CREATE POLICY "Professors and admins grade envios" ON public.atividade_envios FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma(a.turma_id))
  )
  WITH CHECK (
    is_admin()
    OR EXISTS (SELECT 1 FROM atividades a WHERE a.id = atividade_envios.atividade_id AND is_professor_of_turma(a.turma_id))
  );

-- Bucket de storage para anexos (envios de alunos e anexos de professores)
INSERT INTO storage.buckets (id, name, public)
VALUES ('atividades', 'atividades', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users upload atividades files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'atividades');

CREATE POLICY "Owners update atividades files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'atividades' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'atividades' AND owner = auth.uid());

CREATE POLICY "Owners delete atividades files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'atividades' AND owner = auth.uid());

CREATE POLICY "Public read atividades files" ON storage.objects FOR SELECT
  USING (bucket_id = 'atividades');
