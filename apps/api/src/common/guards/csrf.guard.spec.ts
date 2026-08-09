import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../auth/session-cookies.constants';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  let getAllAndOverrideMock: jest.Mock;
  let guard: CsrfGuard;

  beforeEach(() => {
    getAllAndOverrideMock = jest.fn().mockReturnValue(false);
    const reflector = { getAllAndOverride: getAllAndOverrideMock } as unknown as Reflector;
    guard = new CsrfGuard(reflector);
  });

  test('allows safe methods without inspecting cookie or header', () => {
    const request = { method: 'GET', cookies: {}, header: jest.fn() };

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(request.header).not.toHaveBeenCalled();
  });

  test('allows public routes without a CSRF pair', () => {
    getAllAndOverrideMock.mockReturnValue(true);
    const request = { method: 'POST', cookies: {}, header: jest.fn().mockReturnValue(undefined) };

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  test('allows a write request when the header echoes the cookie value', () => {
    const request = {
      method: 'POST',
      cookies: { [CSRF_COOKIE_NAME]: 'token-abc' },
      header: jest.fn((name: string) => (name === CSRF_HEADER_NAME ? 'token-abc' : undefined)),
    };

    expect(guard.canActivate(buildContext(request))).toBe(true);
  });

  test('rejects a write request with no CSRF cookie', () => {
    const request = { method: 'POST', cookies: {}, header: jest.fn().mockReturnValue('token-abc') };

    expect(() => guard.canActivate(buildContext(request))).toThrow(ForbiddenException);
  });

  test('rejects a write request with no CSRF header', () => {
    const request = {
      method: 'POST',
      cookies: { [CSRF_COOKIE_NAME]: 'token-abc' },
      header: jest.fn().mockReturnValue(undefined),
    };

    expect(() => guard.canActivate(buildContext(request))).toThrow(ForbiddenException);
  });

  test('rejects a write request when the header does not match the cookie', () => {
    const request = {
      method: 'POST',
      cookies: { [CSRF_COOKIE_NAME]: 'token-abc' },
      header: jest.fn().mockReturnValue('token-different'),
    };

    expect(() => guard.canActivate(buildContext(request))).toThrow(ForbiddenException);
  });
});
