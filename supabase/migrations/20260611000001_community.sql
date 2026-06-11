/*
  # Community Tables — Comunidade da Turma

  Tabelas:
  - community_posts   — publicações dos membros por turma
  - community_comments — comentários por publicação

  RLS: membros da turma podem ler e criar; só podem deletar os próprios registros.
*/

-- ── POSTS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id   uuid REFERENCES turmas(id)    ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id)  ON DELETE CASCADE NOT NULL,
  content    text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_turma
  ON community_posts(turma_id, created_at DESC);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Membros da turma lêem posts
CREATE POLICY "Members read turma posts" ON community_posts
  FOR SELECT TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_turmas ut
      WHERE ut.turma_id = community_posts.turma_id
        AND ut.user_id  = auth.uid()
    )
  );

-- Membros da turma criam posts (apenas o próprio user_id)
CREATE POLICY "Members insert own posts" ON community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_turmas ut
      WHERE ut.turma_id = community_posts.turma_id
        AND ut.user_id  = auth.uid()
    )
  );

-- Autor ou admin pode deletar
CREATE POLICY "Author or admin delete post" ON community_posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());


-- ── COMMENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id)        ON DELETE CASCADE NOT NULL,
  content    text NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments(post_id, created_at);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

-- Membros da turma do post lêem comentários
CREATE POLICY "Members read comments" ON community_comments
  FOR SELECT TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN user_turmas ut ON ut.turma_id = cp.turma_id
      WHERE cp.id        = community_comments.post_id
        AND ut.user_id   = auth.uid()
    )
  );

-- Membros da turma do post criam comentários (apenas o próprio user_id)
CREATE POLICY "Members insert own comments" ON community_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN user_turmas ut ON ut.turma_id = cp.turma_id
      WHERE cp.id       = community_comments.post_id
        AND ut.user_id  = auth.uid()
    )
  );

-- Autor ou admin pode deletar
CREATE POLICY "Author or admin delete comment" ON community_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_admin());
