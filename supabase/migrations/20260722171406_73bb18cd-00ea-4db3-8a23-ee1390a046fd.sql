CREATE OR REPLACE FUNCTION public.shares_turma_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_turmas a
    JOIN public.user_turmas b ON a.turma_id = b.turma_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  );
$$;

CREATE POLICY "Members read profiles in shared turma"
ON public.profiles FOR SELECT
USING (public.shares_turma_with(id));