DROP POLICY IF EXISTS "update_post_status" ON public.community_posts;
CREATE POLICY "update_post_status" ON public.community_posts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'monitor')
      AND EXISTS (SELECT 1 FROM public.user_turmas ut WHERE ut.user_id = auth.uid() AND ut.turma_id = community_posts.turma_id)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'monitor')
      AND EXISTS (SELECT 1 FROM public.user_turmas ut WHERE ut.user_id = auth.uid() AND ut.turma_id = community_posts.turma_id)
    )
  );