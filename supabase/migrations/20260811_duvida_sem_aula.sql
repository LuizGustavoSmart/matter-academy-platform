-- Permite abrir uma dúvida sem vínculo com uma aula específica
-- (ex: enviada diretamente pela tela de Dúvidas, não a partir de uma aula)
ALTER TABLE public.duvidas ALTER COLUMN aula_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
