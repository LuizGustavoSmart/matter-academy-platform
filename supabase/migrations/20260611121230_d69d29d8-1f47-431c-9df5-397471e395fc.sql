CREATE TABLE IF NOT EXISTS public.community_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id   uuid REFERENCES public.turmas(id)    ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES public.profiles(id)  ON DELETE CASCADE NOT NULL,
  content    text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
CREATE INDEX IF NOT EXISTS idx_community_posts_turma ON public.community_posts(turma_id, created_at DESC);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read turma posts" ON public.community_posts
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.user_turmas ut
      WHERE ut.turma_id = community_posts.turma_id AND ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Members insert own posts" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.user_turmas ut
      WHERE ut.turma_id = community_posts.turma_id AND ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Author or admin delete post" ON public.community_posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());


CREATE TABLE IF NOT EXISTS public.community_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES public.profiles(id)        ON DELETE CASCADE NOT NULL,
  content    text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON public.community_comments(post_id, created_at);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read comments" ON public.community_comments
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.community_posts cp
      JOIN public.user_turmas ut ON ut.turma_id = cp.turma_id
      WHERE cp.id = community_comments.post_id AND ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Members insert own comments" ON public.community_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.community_posts cp
      JOIN public.user_turmas ut ON ut.turma_id = cp.turma_id
      WHERE cp.id = community_comments.post_id AND ut.user_id = auth.uid()
    )
  );

CREATE POLICY "Author or admin delete comment" ON public.community_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());