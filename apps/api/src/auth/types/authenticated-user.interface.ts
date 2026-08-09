import { RoleName } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  matricula: string;
  nome: string;
  sobrenome: string;
  email: string;
  role: RoleName;
  jobTitle?: string | null;
  primaryUnitId: string;
  primaryUnit?: {
    id: string;
    sigla: string;
    nome: string;
  };
}
