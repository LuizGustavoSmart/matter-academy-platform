-- Capa padrão das aulas de um curso — usada como fallback (dinâmico, não
-- copiado) para qualquer aula do curso que não tenha sua própria capa. Se
-- essa imagem mudar depois, toda aula sem capa própria acompanha.
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS capa_aulas_padrao_url text;

NOTIFY pgrst, 'reload schema';
