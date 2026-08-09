import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownloadBlob, apiGet, apiSend, apiUpload, buildQueryString, UNAUTHORIZED_EVENT } from './api-client';
import { ApiError } from './api-error';
import { CSRF_HEADER_NAME } from './csrf';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function setCsrfCookie(value: string): void {
  document.cookie = `formops_csrf_token=${value}`;
}

function clearCsrfCookie(): void {
  document.cookie = 'formops_csrf_token=; Max-Age=0';
}

describe('buildQueryString', () => {
  it('returns an empty string for no meaningful params', () => {
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ a: undefined, b: null, c: '' })).toBe('');
  });

  it('serializes defined, non-empty params', () => {
    const query = buildQueryString({ status: 'PENDENTE', page: 2, active: true });
    const params = new URLSearchParams(query.slice(1));
    expect(params.get('status')).toBe('PENDENTE');
    expect(params.get('page')).toBe('2');
    expect(params.get('active')).toBe('true');
  });
});

describe('api-client requests', () => {
  beforeEach(() => {
    clearCsrfCookie();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCsrfCookie();
  });

  it('apiGet sends the request with credentials so the session cookie is attached', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiGet('/reports');

    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    expect(requestInit?.credentials).toBe('include');
  });

  it('apiSend attaches the CSRF header when the cookie is present', async () => {
    setCsrfCookie('csrf-abc');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: '1' }));

    await apiSend('POST', '/reports', { referenceMonth: '2026-03-01' });

    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    const headers = requestInit?.headers as Record<string, string>;
    expect(headers[CSRF_HEADER_NAME]).toBe('csrf-abc');
    expect(requestInit?.credentials).toBe('include');
  });

  it('apiSend omits the CSRF header when no cookie is present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: '1' }));

    await apiSend('POST', '/reports', { referenceMonth: '2026-03-01' });

    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    const headers = requestInit?.headers as Record<string, string>;
    expect(headers[CSRF_HEADER_NAME]).toBeUndefined();
  });

  it('apiSend sends a JSON body with the given method', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: '1' }));

    await apiSend('POST', '/reports', { referenceMonth: '2026-03-01' });

    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.body).toBe(JSON.stringify({ referenceMonth: '2026-03-01' }));
  });

  it('throws ApiError with the parsed message on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ statusCode: 400, message: 'Dados inválidos' }, { status: 400 }),
    );

    await expect(apiGet('/reports')).rejects.toMatchObject({
      status: 400,
      message: 'Dados inválidos',
    });
  });

  it('joins array error messages with a comma', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ statusCode: 400, message: ['campo A é obrigatório', 'campo B inválido'] }, { status: 400 }),
    );

    await expect(apiGet('/reports')).rejects.toThrow('campo A é obrigatório, campo B inválido');
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not json', { status: 500 }),
    );

    await expect(apiGet('/reports')).rejects.toThrow('Falha na requisicao (500)');
  });

  it('dispatches UNAUTHORIZED_EVENT on a 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, { status: 401 }));

    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(apiGet('/reports')).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it('returns undefined for a 204 No Content response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(apiGet('/reports/1')).resolves.toBeUndefined();
  });

  it('apiUpload sends the file as multipart form data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'evidence-1' }));
    const file = new File(['conteudo'], 'evidencia.pdf', { type: 'application/pdf' });

    await apiUpload('/evidence', file);

    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    expect(requestInit?.body).toBeInstanceOf(FormData);
    expect(requestInit?.method).toBe('POST');
  });

  it('apiDownloadBlob extracts the filename from the content-disposition header', async () => {
    const blob = new Blob(['csv content']);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="relatorio-2026-03.csv"' },
      }),
    );

    const result = await apiDownloadBlob('/export/1');

    expect(result.filename).toBe('relatorio-2026-03.csv');
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('apiDownloadBlob returns a null filename when the header is absent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Blob(['x']), { status: 200 }));

    const result = await apiDownloadBlob('/export/1');

    expect(result.filename).toBeNull();
  });

  it('apiDownloadBlob throws ApiError on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'Não encontrado' }, { status: 404 }),
    );

    await expect(apiDownloadBlob('/export/1')).rejects.toBeInstanceOf(ApiError);
  });
});
