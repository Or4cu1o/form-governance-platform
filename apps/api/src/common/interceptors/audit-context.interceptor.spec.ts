import { Observable } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditContext, AuditContextService } from '../services/audit-context.service';

describe('AuditContextInterceptor', () => {
  const buildExecutionContext = (request: unknown): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

  test('populates the audit context from the request and keeps it visible while the handler runs', async () => {
    const auditContextService = new AuditContextService({} as never);
    const interceptor = new AuditContextInterceptor(auditContextService);
    let capturedContext: AuditContext | undefined;

    const request = {
      ip: '203.0.113.9',
      headers: { 'user-agent': 'jest-agent', 'x-request-id': 'req-abc' },
      user: {
        id: 'user-1',
        nome: 'Ana',
        sobrenome: 'Silva',
        role: RoleName.ELABORADOR,
        primaryUnitId: 'unit-1',
        primaryUnit: { id: 'unit-1', sigla: 'UN1', nome: 'Unidade 1' },
      },
    };
    const next: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          capturedContext = auditContextService.getContext();
          subscriber.next('ok');
          subscriber.complete();
        }),
    };

    const result = await new Promise((resolve, reject) => {
      interceptor.intercept(buildExecutionContext(request), next).subscribe({ next: resolve, error: reject });
    });

    expect(result).toBe('ok');
    expect(capturedContext).toEqual({
      userId: 'user-1',
      sourceIp: '203.0.113.9',
      userAgent: 'jest-agent',
      origin: 'WEB',
      requestId: 'req-abc',
      actorNameSnapshot: 'Ana Silva',
      actorJobTitleSnapshot: null,
      actorRoleSnapshot: RoleName.ELABORADOR,
      actorUnitSnapshot: 'UN1',
    });
  });

  test('generates a request id and leaves actor fields null for anonymous requests', async () => {
    const auditContextService = new AuditContextService({} as never);
    const interceptor = new AuditContextInterceptor(auditContextService);
    let capturedContext: AuditContext | undefined;

    const request = { ip: '203.0.113.9', headers: {} };
    const next: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          capturedContext = auditContextService.getContext();
          subscriber.next('ok');
          subscriber.complete();
        }),
    };

    await new Promise((resolve, reject) => {
      interceptor.intercept(buildExecutionContext(request), next).subscribe({ next: resolve, error: reject });
    });

    expect(capturedContext?.userId).toBeNull();
    expect(capturedContext?.actorNameSnapshot).toBeNull();
    expect(capturedContext?.actorRoleSnapshot).toBeNull();
    expect(typeof capturedContext?.requestId).toBe('string');
    expect(capturedContext?.requestId).not.toHaveLength(0);
  });

  test('leaves no audit context active after the handler completes', async () => {
    const auditContextService = new AuditContextService({} as never);
    const interceptor = new AuditContextInterceptor(auditContextService);
    const request = { ip: '203.0.113.9', headers: {} };
    const next: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          subscriber.next('ok');
          subscriber.complete();
        }),
    };

    await new Promise((resolve, reject) => {
      interceptor.intercept(buildExecutionContext(request), next).subscribe({ next: resolve, error: reject });
    });

    expect(auditContextService.getContext()).toBeUndefined();
  });
});
