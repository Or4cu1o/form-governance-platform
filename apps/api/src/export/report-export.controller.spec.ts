import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { ReportExportController } from './report-export.controller';
import { ReportExportService } from './report-export.service';

describe('ReportExportController', () => {
  let controller: ReportExportController;
  let exportMock: jest.Mock;
  let setMock: jest.Mock;

  const user: AuthenticatedUser = {
    id: 'aprovador-1',
    matricula: '10004',
    nome: 'Ana',
    sobrenome: 'Aprovadora',
    email: 'aprovador@formops.local',
    role: RoleName.APROVADOR,
    primaryUnitId: 'unit-matriz',
  };

  beforeEach(() => {
    exportMock = jest.fn();
    setMock = jest.fn();
    const reportExportService = { export: exportMock } as unknown as ReportExportService;
    controller = new ReportExportController(reportExportService);
  });

  test('sets Content-Type/Content-Disposition headers and returns the file body', async () => {
    exportMock.mockResolvedValue({
      filename: 'FIL01_2026-07-14.csv',
      contentType: 'text/csv',
      body: 'a,b,c',
      seal: { verificationCode: 'ABCD2345EFGH6789C', contentDigest: 'd', artifactDigest: 'a', keyId: 'seal-2026-01' },
    });
    const res = { set: setMock } as unknown as Response;

    const result = await controller.export('report-1', { format: 'csv' }, user, res);

    expect(exportMock).toHaveBeenCalledWith('report-1', 'csv', user);
    expect(setMock).toHaveBeenCalledWith({
      'Content-Type': 'text/csv',
      'Content-Disposition': "attachment; filename=\"FIL01_2026-07-14.csv\"; filename*=UTF-8''FIL01_2026-07-14.csv",
      'X-Seal-Verification-Code': 'ABCD2345EFGH6789C',
    });
    expect(result).toBe('a,b,c');
  });

  test('replaces non-ASCII characters in the ASCII filename fallback while keeping the UTF-8 filename* intact', async () => {
    exportMock.mockResolvedValue({
      filename: 'Filial Contém Acentuação Ç.json',
      contentType: 'application/json',
      body: '{}',
      seal: { verificationCode: 'ABCD2345EFGH6789C', contentDigest: 'd', artifactDigest: 'a', keyId: 'seal-2026-01' },
    });
    const res = { set: setMock } as unknown as Response;

    await controller.export('report-1', { format: 'json' }, user, res);

    const headers = setMock.mock.calls[0][0];
    expect(headers['Content-Disposition']).toContain('filename="Filial Cont_m Acentua__o _.json"');
    expect(headers['Content-Disposition']).toContain(encodeURIComponent('Filial Contém Acentuação Ç.json'));
  });
});
