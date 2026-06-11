-- ──────────────────────────────────────────────────────────────────────────
-- Tipos de post na comunidade + moderação de monitores
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Adiciona colunas tipo e status em community_posts
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS tipo   text NOT NULL DEFAULT 'outros'
    CHECK (tipo   IN ('duvida', 'outros')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'resolvida'));

-- 2. Monitor pode fazer UPDATE no post (para marcar como resolvida)
--    Permitido para: autor do post OU monitor que pertence à turma
DROP POLICY IF EXISTS "update_post_status" ON community_posts;
CREATE POLICY "update_post_status" ON community_posts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'monitor'
      )
      AND EXISTS (
        SELECT 1 FROM user_turmas ut
        WHERE ut.user_id = auth.uid() AND ut.turma_id = community_posts.turma_id
      )
    )
  )
  WITH CHECK (true);

-- 3. Monitor pode deletar qualquer post das suas turmas
DROP POLICY IF EXISTS "monitors_delete_posts" ON community_posts;
CREATE POLICY "monitors_delete_posts" ON community_posts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'monitor'
    )
    AND EXISTS (
      SELECT 1 FROM user_turmas ut
      WHERE ut.user_id = auth.uid() AND ut.turma_id = community_posts.turma_id
    )
  );

-- 4. Monitor pode deletar qualquer comentário das suas turmas
DROP POLICY IF EXISTS "monitors_delete_comments" ON community_comments;
CREATE POLICY "monitors_delete_comments" ON community_comments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'monitor'
    )
    AND EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN user_turmas ut ON ut.turma_id = cp.turma_id
      WHERE cp.id = community_comments.post_id
        AND ut.user_id = auth.uid()
    )
  );
