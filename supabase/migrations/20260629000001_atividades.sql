-- Tabela de atividades criadas por professores
CREATE TABLE IF NOT EXISTS public.atividades (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id   UUID        NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  titulo     TEXT        NOT NULL,
  descricao  TEXT,
  prazo      TIMESTAMPTZ,
  criado_por UUID        REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de envios dos alunos
CREATE TABLE IF NOT EXISTS public.submissoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID        NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  aluno_id     UUID        NOT NULL REFERENCES public.profiles(id),
  conteudo     TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atividade_id, aluno_id)
);

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissoes  ENABLE ROW LEVEL SECURITY;

-- atividades: todos autenticados lêem
CREATE POLICY "atividades_select" ON public.atividades
  FOR SELECT TO authenticated USING (true);

-- professores e admins criam
CREATE POLICY "atividades_insert" ON public.atividades
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('professor','admin'))
  );

-- criador ou admin atualiza/exclui
CREATE POLICY "atividades_update" ON public.atividades
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "atividades_delete" ON public.atividades
  FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- submissoes: aluno vê a própria; professor/admin/monitor vê todas
CREATE POLICY "submissoes_select" ON public.submissoes
  FOR SELECT TO authenticated
  USING (
    aluno_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('professor','admin','monitor'))
  );

-- aluno insere a própria
CREATE POLICY "submissoes_insert" ON public.submissoes
  FOR INSERT TO authenticated
  WITH CHECK (aluno_id = auth.uid());

-- aluno atualiza a própria
CREATE POLICY "submissoes_update" ON public.submissoes
  FOR UPDATE TO authenticated
  USING (aluno_id = auth.uid());
