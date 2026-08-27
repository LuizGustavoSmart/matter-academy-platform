-- A simulação "ver como" (aluno/professor/embaixador) do admin só trocava o
-- role no cliente, mantendo o próprio id do admin — como o admin não tem
-- nenhuma linha real em user_turmas, todas as telas específicas de
-- turma/curso apareciam vazias. Esta coluna marca uma matrícula TEMPORÁRIA
-- criada só para a simulação, criada ao iniciar e removida ao encerrar.
ALTER TABLE public.user_turmas ADD COLUMN IF NOT EXISTS is_view_as_temp boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
