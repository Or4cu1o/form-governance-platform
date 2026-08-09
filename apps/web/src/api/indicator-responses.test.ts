import { describe, expect, it, vi } from 'vitest';
import { getIndicatorResponseVersions, updateIndicatorResponseValues, uploadIndicatorEvidence } from './indicator-responses';
import { apiGet, apiSend, apiUpload } from '../lib/api-client';

vi.mock('../lib/api-client');

describe('indicator-responses api', () => {
  it('updateIndicatorResponseValues PUTs expectedVersionId and variableValues by id (FR-129)', async () => {
    vi.mocked(apiSend).mockResolvedValueOnce({} as never);
    await updateIndicatorResponseValues('response-1', {
      expectedVersionId: 'version-1',
      variableValues: { uptime: 1430 },
    });
    expect(apiSend).toHaveBeenCalledWith('PUT', '/indicator-responses/response-1', {
      expectedVersionId: 'version-1',
      variableValues: { uptime: 1430 },
    });
  });

  it('uploadIndicatorEvidence sends the file to the indicator response evidence endpoint', async () => {
    vi.mocked(apiUpload).mockResolvedValueOnce({} as never);
    const file = new File(['x'], 'evidencia.pdf', { type: 'application/pdf' });
    await uploadIndicatorEvidence('response-1', file);
    expect(apiUpload).toHaveBeenCalledWith('/indicator-responses/response-1/evidence', file);
  });

  it('getIndicatorResponseVersions fetches the version history by id (T062)', async () => {
    vi.mocked(apiGet).mockResolvedValueOnce([] as never);
    await getIndicatorResponseVersions('response-1');
    expect(apiGet).toHaveBeenCalledWith('/indicator-responses/response-1/versions');
  });
});
