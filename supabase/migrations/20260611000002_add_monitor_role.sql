/*
  # Add monitor role

  Adiciona 'monitor' como papel válido em profiles.role.
  Monitores têm acesso às mesmas telas de alunos/professores
  (dashboard, cursos, comunidade) e são gerenciados pela tela
  de Professores & Monitores no painel admin.
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'student', 'professor', 'monitor'));
