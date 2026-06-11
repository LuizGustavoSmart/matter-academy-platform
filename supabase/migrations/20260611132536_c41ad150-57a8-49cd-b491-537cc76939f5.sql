ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'student', 'professor', 'monitor'));

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS tipo   text NOT NULL DEFAULT 'outros'
    CHECK (tipo   IN ('duvida', 'outros')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'resolvida'));

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
  WITH CHECK (true);

DROP POLICY IF EXISTS "monitors_delete_posts" ON public.community_posts;
CREATE POLICY "monitors_delete_posts" ON public.community_posts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'monitor')
    AND EXISTS (SELECT 1 FROM public.user_turmas ut WHERE ut.user_id = auth.uid() AND ut.turma_id = community_posts.turma_id)
  );

DROP POLICY IF EXISTS "monitors_delete_comments" ON public.community_comments;
CREATE POLICY "monitors_delete_comments" ON public.community_comments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'monitor')
    AND EXISTS (
      SELECT 1 FROM public.community_posts cp
      JOIN public.user_turmas ut ON ut.turma_id = cp.turma_id
      WHERE cp.id = community_comments.post_id AND ut.user_id = auth.uid()
    )
  );