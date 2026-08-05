import type { Role, UserStatus } from '../../../lib/users';
import type { Turma } from './pickers';

export type UserRow = {
  id: string;
  email: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  empresa: string | null;
  role: Role;
  status: UserStatus;
  created_at: string;
  invite_token: string | null;
  turmas: Turma[];
};
