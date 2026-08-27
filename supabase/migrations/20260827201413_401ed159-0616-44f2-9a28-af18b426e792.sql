-- Observação interna de curso/turma — visível e editável apenas por
-- professor, monitor e admin (nunca exibida para aluno/embaixador no
-- frontend). Mesmo padrão de "não enforced por RLS de coluna", igual às
-- demais colunas administrativas desta tabela — a proteção é por não expor
-- o campo em nenhuma consulta/tela voltada ao aluno.

ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS observacao text;

ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS observacao text;

NOTIFY pgrst, 'reload schema';