-- Nome do usuário (hoje só existe email), usado para exibir o nome
-- do aluno para professores/monitores em Atividades, Dúvidas e Comunidade.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome text;

NOTIFY pgrst, 'reload schema';
