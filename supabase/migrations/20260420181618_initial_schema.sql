/*
  # Initial Schema for Online Learning Platform

  1. Tables: profiles, turmas, user_turmas, cursos, curso_turmas, aulas, progresso
  2. Security: RLS enabled with admin/student access separation
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin','student')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  invite_token text UNIQUE,
  invite_expires_at timestamptz,
  reset_token text UNIQUE,
  reset_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  activated_at timestamptz
);

CREATE TABLE IF NOT EXISTS turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_turmas (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES turmas(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, turma_id)
);

CREATE TABLE IF NOT EXISTS cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curso_turmas (
  curso_id uuid REFERENCES cursos(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES turmas(id) ON DELETE CASCADE,
  PRIMARY KEY (curso_id, turma_id)
);

CREATE TABLE IF NOT EXISTS aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid REFERENCES cursos(id) ON DELETE CASCADE NOT NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  youtube_url text NOT NULL DEFAULT '',
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aulas_curso_id ON aulas(curso_id);

CREATE TABLE IF NOT EXISTS progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  aula_id uuid REFERENCES aulas(id) ON DELETE CASCADE NOT NULL,
  concluido boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, aula_id)
);
CREATE INDEX IF NOT EXISTS idx_progresso_user ON progresso(user_id);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE progresso ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- PROFILES policies
CREATE POLICY "Users read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update profiles" ON profiles FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins delete profiles" ON profiles FOR DELETE TO authenticated USING (is_admin());

-- TURMAS policies
CREATE POLICY "Admins read turmas" ON turmas FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Students read own turmas" ON turmas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_turmas ut WHERE ut.turma_id = turmas.id AND ut.user_id = auth.uid()));
CREATE POLICY "Admins insert turmas" ON turmas FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update turmas" ON turmas FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins delete turmas" ON turmas FOR DELETE TO authenticated USING (is_admin());

-- USER_TURMAS policies
CREATE POLICY "Users read own user_turmas" ON user_turmas FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Admins insert user_turmas" ON user_turmas FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update user_turmas" ON user_turmas FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins delete user_turmas" ON user_turmas FOR DELETE TO authenticated USING (is_admin());

-- CURSOS policies
CREATE POLICY "Admins read cursos" ON cursos FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Students read accessible cursos" ON cursos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM curso_turmas ct
    JOIN user_turmas ut ON ut.turma_id = ct.turma_id
    WHERE ct.curso_id = cursos.id AND ut.user_id = auth.uid()
  ));
CREATE POLICY "Admins insert cursos" ON cursos FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update cursos" ON cursos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins delete cursos" ON cursos FOR DELETE TO authenticated USING (is_admin());

-- CURSO_TURMAS policies
CREATE POLICY "Users read curso_turmas" ON curso_turmas FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM user_turmas ut WHERE ut.turma_id = curso_turmas.turma_id AND ut.user_id = auth.uid()));
CREATE POLICY "Admins insert curso_turmas" ON curso_turmas FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update curso_turmas" ON curso_turmas FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins delete curso_turmas" ON curso_turmas FOR DELETE TO authenticated USING (is_admin());

-- AULAS policies
CREATE POLICY "Admins read aulas" ON aulas FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Students read accessible aulas" ON aulas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM curso_turmas ct
    JOIN user_turmas ut ON ut.turma_id = ct.turma_id
    WHERE ct.curso_id = aulas.curso_id AND ut.user_id = auth.uid()
  ));
CREATE POLICY "Admins insert aulas" ON aulas FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update aulas" ON aulas FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins delete aulas" ON aulas FOR DELETE TO authenticated USING (is_admin());

-- PROGRESSO policies
CREATE POLICY "Users read own progresso" ON progresso FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Users insert own progresso" ON progresso FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own progresso" ON progresso FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own progresso" ON progresso FOR DELETE TO authenticated USING (user_id = auth.uid());
