import { AccessLogEventType, ActorKind, RoleName } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AccessLogService } from '../audit/access-log.service';
import { AuthenticatedUser } from './types/authenticated-user.interface';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE_NAME } from './session-cookies.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let validateCredentialsMock: jest.Mock;
  let loginMock: jest.Mock;
  let recordMock: jest.Mock;
  let response: { cookie: jest.Mock; clearCookie: jest.Mock };
  let request: Pick<Request, 'ip' | 'headers'>;

  const user: AuthenticatedUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };

  beforeEach(() => {
    validateCredentialsMock = jest.fn().mockResolvedValue(user);
    loginMock = jest.fn().mockReturnValue({ accessToken: 'signed-jwt', user });
    recordMock = jest.fn().mockResolvedValue(undefined);
    response = { cookie: jest.fn(), clearCookie: jest.fn() };
    request = { ip: '10.0.0.5', headers: { 'user-agent': 'jest-agent' } };

    const authService = { validateCredentials: validateCredentialsMock, login: loginMock } as unknown as AuthService;
    const accessLogService = { record: recordMock } as unknown as AccessLogService;
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    controller = new AuthController(authService, accessLogService, configService);
  });

  test('login validates credentials, issues session cookies and records AccessLog LOGIN_SUCESSO', async () => {
    const result = await controller.login(
      { identifier: '10001', password: 'senha-forte' },
      request as Request,
      response as unknown as Response,
    );

    expect(validateCredentialsMock).toHaveBeenCalledWith('10001', 'senha-forte', '10.0.0.5');
    expect(loginMock).toHaveBeenCalledWith(user);
    expect(result).toEqual({ user });

    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'signed-jwt',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'lax' }),
    );

    expect(recordMock).toHaveBeenCalledWith({
      eventType: AccessLogEventType.LOGIN_SUCESSO,
      userId: user.id,
      actorKind: ActorKind.USUARIO,
      sourceIp: '10.0.0.5',
      userAgent: 'jest-agent',
    });
  });

  test('login records AccessLog LOGIN_FALHA and rethrows when credentials are invalid', async () => {
    const failure = new Error('Credenciais invalidas');
    validateCredentialsMock.mockRejectedValueOnce(failure);

    await expect(
      controller.login({ identifier: '10001', password: 'errada' }, request as Request, response as unknown as Response),
    ).rejects.toThrow(failure);

    expect(response.cookie).not.toHaveBeenCalled();
    expect(recordMock).toHaveBeenCalledWith({
      eventType: AccessLogEventType.LOGIN_FALHA,
      userId: null,
      actorKind: ActorKind.ANONIMO_DECLARADO,
      sourceIp: '10.0.0.5',
      userAgent: 'jest-agent',
    });
  });

  test('logout clears the session and CSRF cookies', () => {
    controller.logout(response as unknown as Response);

    expect(response.clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, { path: '/' });
    expect(response.clearCookie).toHaveBeenCalledWith(CSRF_COOKIE_NAME, { path: '/' });
  });

  test('refresh reissues session cookies for the current user', () => {
    const result = controller.refresh(user, response as unknown as Response);

    expect(loginMock).toHaveBeenCalledWith(user);
    expect(result).toEqual({ user });
    expect(response.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'signed-jwt',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  test('me returns the currently authenticated user unchanged', () => {
    expect(controller.me(user)).toBe(user);
  });
});
