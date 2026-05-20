CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin','student','professor')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  invite_token text UNIQUE,
  invite_expires_at timestamptz,
  reset_token text UNIQUE,
  reset_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  activated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_turmas (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, turma_id)
);

CREATE TABLE IF NOT EXISTS public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.curso_turmas (
  curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  PRIMARY KEY (curso_id, turma_id)
);

CREATE TABLE IF NOT EXISTS public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE NOT NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  youtube_url text NOT NULL DEFAULT '',
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aulas_curso_id ON public.aulas(curso_id);

CREATE TABLE IF NOT EXISTS public.progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  aula_id uuid REFERENCES public.aulas(id) ON DELETE CASCADE NOT NULL,
  concluido boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, aula_id)
);
CREATE INDEX IF NOT EXISTS idx_progresso_user ON public.progresso(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progresso ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins read turmas" ON public.turmas FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Students read own turmas" ON public.turmas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_turmas ut WHERE ut.turma_id = turmas.id AND ut.user_id = auth.uid()));
CREATE POLICY "Admins insert turmas" ON public.turmas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update turmas" ON public.turmas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete turmas" ON public.turmas FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Users read own user_turmas" ON public.user_turmas FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins insert user_turmas" ON public.user_turmas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update user_turmas" ON public.user_turmas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete user_turmas" ON public.user_turmas FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins read cursos" ON public.cursos FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Students read accessible cursos" ON public.cursos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.curso_turmas ct
    JOIN public.user_turmas ut ON ut.turma_id = ct.turma_id
    WHERE ct.curso_id = cursos.id AND ut.user_id = auth.uid()
  ));
CREATE POLICY "Admins insert cursos" ON public.cursos FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update cursos" ON public.cursos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete cursos" ON public.cursos FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Users read curso_turmas" ON public.curso_turmas FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.user_turmas ut WHERE ut.turma_id = curso_turmas.turma_id AND ut.user_id = auth.uid()));
CREATE POLICY "Admins insert curso_turmas" ON public.curso_turmas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update curso_turmas" ON public.curso_turmas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete curso_turmas" ON public.curso_turmas FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins read aulas" ON public.aulas FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Students read accessible aulas" ON public.aulas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.curso_turmas ct
    JOIN public.user_turmas ut ON ut.turma_id = ct.turma_id
    WHERE ct.curso_id = aulas.curso_id AND ut.user_id = auth.uid()
  ));
CREATE POLICY "Admins insert aulas" ON public.aulas FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update aulas" ON public.aulas FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete aulas" ON public.aulas FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Users read own progresso" ON public.progresso FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users insert own progresso" ON public.progresso FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own progresso" ON public.progresso FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own progresso" ON public.progresso FOR DELETE TO authenticated USING (user_id = auth.uid());