import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let findActiveByIdMock: jest.Mock;

  const dbUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@formops.local',
    passwordHash: 'hashed-password',
    role: RoleName.ELABORADOR,
    jobTitle: 'Chefe de Gabinete',
    primaryUnitId: 'unit-1',
  };

  beforeEach(() => {
    findActiveByIdMock = jest.fn();
    const configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    const usersService = { findActiveById: findActiveByIdMock } as unknown as UsersService;
    strategy = new JwtStrategy(configService, usersService);
  });

  // T093/US5-1/US5-3: findActiveById filtra isActive:true e a estrategia
  // roda a cada requisicao (nenhum cache sobrevive) — desativar um usuario ou
  // revogar seu vinculo tem efeito imediato na proxima chamada autenticada.
  test('throws UnauthorizedException when the JWT subject no longer maps to an active user', async () => {
    findActiveByIdMock.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'ghost-user-id', role: RoleName.ELABORADOR, unitId: 'unit-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  test('returns the authenticated user without the passwordHash for a valid, active subject', async () => {
    findActiveByIdMock.mockResolvedValue(dbUser);

    const result = await strategy.validate({ sub: dbUser.id, role: dbUser.role, unitId: dbUser.primaryUnitId });

    expect(findActiveByIdMock).toHaveBeenCalledWith(dbUser.id);
    expect(result).toEqual({
      id: dbUser.id,
      matricula: dbUser.matricula,
      nome: dbUser.nome,
      sobrenome: dbUser.sobrenome,
      email: dbUser.email,
      role: dbUser.role,
      jobTitle: dbUser.jobTitle,
      primaryUnitId: dbUser.primaryUnitId,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
