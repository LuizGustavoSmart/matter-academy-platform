-- Antes desta correção, a presença automática só era registrada ao
-- assistir 80% da aula (LIMITE_PRESENCA_PCT), enquanto a conclusão pessoal
-- ("2/12 aulas") já valia a partir de 70% (LIMITE_CONCLUSAO_PCT). Alunos que
-- assistiram entre 70% e 79% ficavam com a aula marcada como concluída mas
-- sem nenhum registro em `presencas`, então não apareciam na chamada.
--
-- O código-fonte já foi corrigido para usar o mesmo limite (70%) nos dois
-- casos daqui para frente; esta migration preenche retroativamente os
-- registros de presença que ficaram faltando para aulas já concluídas.
INSERT INTO public.presencas (aula_id, user_id, turma_id, presente, origem, percentual_assistido, atualizado_em)
SELECT p.aula_id, p.user_id, ut.turma_id, true, 'plataforma_gravado', p.percentual_assistido, now()
FROM public.progresso p
JOIN public.aulas a ON a.id = p.aula_id
JOIN public.user_turmas ut ON ut.user_id = p.user_id AND ut.curso_id = a.curso_id
WHERE p.concluido = true
ON CONFLICT (aula_id, user_id, turma_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
