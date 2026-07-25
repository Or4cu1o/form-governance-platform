import { RoleName } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LdapAuthService } from '../ldap/ldap-auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authenticateMock: jest.Mock;
  let loginMock: jest.Mock;
  let listBootstrapUnitsMock: jest.Mock;

  const user = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Teste',
    sobrenome: 'Usuario',
    email: 'teste@formops.local',
    role: RoleName.ELABORADOR,
    primaryUnitId: 'unit-1',
  };

  beforeEach(() => {
    authenticateMock = jest.fn().mockResolvedValue(user);
    loginMock = jest.fn().mockReturnValue({ accessToken: 'token', user });
    listBootstrapUnitsMock = jest.fn().mockResolvedValue([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);

    const authService = { authenticate: authenticateMock, login: loginMock } as unknown as AuthService;
    const ldapAuthService = { listBootstrapUnits: listBootstrapUnitsMock } as unknown as LdapAuthService;

    controller = new AuthController(authService, ldapAuthService);
  });

  test('login authenticates then signs the JWT', async () => {
    const dto = { identifier: '10001', password: 'senha' };

    const result = await controller.login(dto);

    expect(authenticateMock).toHaveBeenCalledWith(dto);
    expect(loginMock).toHaveBeenCalledWith(user);
    expect(result).toEqual({ accessToken: 'token', user });
  });

  test('ldapUnits delegates to LdapAuthService.listBootstrapUnits', async () => {
    const result = await controller.ldapUnits();

    expect(listBootstrapUnitsMock).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'unit-1', sigla: 'MTZ', nome: 'Matriz' }]);
  });

  test('me returns the currently authenticated user unchanged', () => {
    expect(controller.me(user)).toBe(user);
  });
});
