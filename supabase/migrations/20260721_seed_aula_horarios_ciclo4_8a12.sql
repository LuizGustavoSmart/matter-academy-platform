-- Preenche a agenda (data/hora) das aulas 8 a 12 já existentes de cada
-- faixa do "4° Ciclo", continuando direto na semana seguinte à aula 7,
-- mesmo horário 08:00-09:00 (America/Sao_Paulo). Não cria aula nova.
DO $$
DECLARE
  v_curso_id uuid;
  v_turma_id uuid;
  v_aula record;
  v_data date;
BEGIN
  -- Faixa Branca — segundas-feiras, a partir de 27/07/2026
  SELECT id INTO v_curso_id FROM public.cursos WHERE titulo = 'Faixa Branca - TD Matter - 4° Ciclo';
  IF v_curso_id IS NOT NULL THEN
    SELECT turma_id INTO v_turma_id FROM public.curso_turmas WHERE curso_id = v_curso_id LIMIT 1;
    v_data := DATE '2026-07-27';
    FOR v_aula IN SELECT id FROM public.aulas WHERE curso_id = v_curso_id AND ordem BETWEEN 8 AND 12 ORDER BY ordem LOOP
      INSERT INTO public.aula_horarios (turma_id, curso_id, aula_id, data_hora)
      VALUES (v_turma_id, v_curso_id, v_aula.id, (v_data::text || ' 08:00:00-03')::timestamptz)
      ON CONFLICT (turma_id, aula_id) DO UPDATE SET data_hora = EXCLUDED.data_hora;
      v_data := v_data + INTERVAL '7 days';
    END LOOP;
  END IF;

  -- Faixa Verde — terças-feiras, a partir de 28/07/2026
  SELECT id INTO v_curso_id FROM public.cursos WHERE titulo = 'Faixa Verde - TD Matter - 4° Ciclo';
  IF v_curso_id IS NOT NULL THEN
    SELECT turma_id INTO v_turma_id FROM public.curso_turmas WHERE curso_id = v_curso_id LIMIT 1;
    v_data := DATE '2026-07-28';
    FOR v_aula IN SELECT id FROM public.aulas WHERE curso_id = v_curso_id AND ordem BETWEEN 8 AND 12 ORDER BY ordem LOOP
      INSERT INTO public.aula_horarios (turma_id, curso_id, aula_id, data_hora)
      VALUES (v_turma_id, v_curso_id, v_aula.id, (v_data::text || ' 08:00:00-03')::timestamptz)
      ON CONFLICT (turma_id, aula_id) DO UPDATE SET data_hora = EXCLUDED.data_hora;
      v_data := v_data + INTERVAL '7 days';
    END LOOP;
  END IF;

  -- Faixa Marrom — quartas-feiras, a partir de 29/07/2026
  SELECT id INTO v_curso_id FROM public.cursos WHERE titulo = 'Faixa Marrom - TD Matter - 4° Ciclo';
  IF v_curso_id IS NOT NULL THEN
    SELECT turma_id INTO v_turma_id FROM public.curso_turmas WHERE curso_id = v_curso_id LIMIT 1;
    v_data := DATE '2026-07-29';
    FOR v_aula IN SELECT id FROM public.aulas WHERE curso_id = v_curso_id AND ordem BETWEEN 8 AND 12 ORDER BY ordem LOOP
      INSERT INTO public.aula_horarios (turma_id, curso_id, aula_id, data_hora)
      VALUES (v_turma_id, v_curso_id, v_aula.id, (v_data::text || ' 08:00:00-03')::timestamptz)
      ON CONFLICT (turma_id, aula_id) DO UPDATE SET data_hora = EXCLUDED.data_hora;
      v_data := v_data + INTERVAL '7 days';
    END LOOP;
  END IF;
END $$;
