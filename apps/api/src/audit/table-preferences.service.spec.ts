import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { TablePreferencesService } from './table-preferences.service';

describe('TablePreferencesService', () => {
  let service: TablePreferencesService;
  let findUniqueMock: jest.Mock;
  let upsertMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'user-1',
    matricula: '10001',
    nome: 'Ana',
    sobrenome: 'Auditora',
    email: 'ana@formops.local',
    role: RoleName.OBSERVADOR,
    primaryUnitId: 'unit-1',
  };

  beforeEach(() => {
    findUniqueMock = jest.fn();
    upsertMock = jest.fn();
    const prisma = { userTablePreference: { findUnique: findUniqueMock, upsert: upsertMock } } as unknown as PrismaService;
    service = new TablePreferencesService(prisma);
  });

  it('returns an empty default when no preference was saved yet, without inventing columns', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const result = await service.get('audit-query', user);

    expect(result).toEqual({ userId: 'user-1', tableKey: 'audit-query', columnOrder: [], hiddenColumns: [] });
  });

  it('scopes reads and writes to the requesting user and the given table key', async () => {
    upsertMock.mockResolvedValueOnce({ userId: 'user-1', tableKey: 'audit-query', columnOrder: ['IND-001'], hiddenColumns: [] });

    await service.save('audit-query', { columnOrder: ['IND-001'], hiddenColumns: [] }, user);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_tableKey: { userId: 'user-1', tableKey: 'audit-query' } } }),
    );
  });

  // FR-090: a preferencia so muda apresentacao — nenhuma linha nem
  // agregacao de AuditQueryService depende deste service.
  it('never removes a row or an aggregation: it only stores column order and visibility', async () => {
    upsertMock.mockResolvedValueOnce({});

    await service.save('audit-query', { columnOrder: ['IND-002', 'IND-001'], hiddenColumns: ['IND-003'] }, user);

    const call = upsertMock.mock.calls[0][0];
    expect(Object.keys(call.update)).toEqual(['columnOrder', 'hiddenColumns']);
  });
});
