import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { VerifyPage } from './VerifyPage';
import * as verificationApi from '../api/verification';
import type { VerificationEnvelope } from '../api/verification';

vi.mock('../api/verification');

function renderAt(codigo: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/verificar/${codigo}`]}>
        <Routes>
          <Route path="/verificar/:codigo" element={<VerifyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function envelope(overrides: Partial<VerificationEnvelope> = {}): VerificationEnvelope {
  return {
    verdict: 'INTEGRO',
    issuedAt: '2026-08-07T13:45:12.000Z',
    unitAcronym: 'TI',
    referencePeriod: '2026-06',
    reportStatus: 'CONCLUIDO',
    approver: { name: 'Ana Aprovadora', jobTitle: 'Chefe de Gabinete' },
    artifactKind: 'RELATORIO',
    artifactFormat: 'PDF',
    contentDigest: 'content-digest-abc',
    artifactDigest: 'artifact-digest-abc',
    signature: 'sig-abc',
    keyId: 'seal-2026-01',
    sealContractVersion: 'seal-v1',
    revocation: null,
    ...overrides,
  };
}

describe('VerifyPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the plain-language INTEGRO verdict with provenance for an external auditor', async () => {
    vi.mocked(verificationApi.getSeal).mockResolvedValue(envelope());

    renderAt('ABCD-2345-EFGH-6789-C');

    await screen.findByText('Íntegro');
    expect(screen.getByText('TI')).toBeInTheDocument();
    expect(screen.getByText(/Ana Aprovadora/)).toBeInTheDocument();
  });

  // FR-102: nenhum valor de indicador aparece nesta tela — verificado
  // indiretamente pela ausencia de qualquer secao que nao seja o envelope
  // do contrato (a pagina so renderiza os campos de VerificationEnvelope).
  it('shows a not-found message without exposing any internal detail for a nonexistent code', async () => {
    vi.mocked(verificationApi.getSeal).mockResolvedValue(
      envelope({ verdict: 'NAO_ENCONTRADO', unitAcronym: null, referencePeriod: null, reportStatus: null, approver: { name: null, jobTitle: null }, contentDigest: null, artifactDigest: null, signature: null, keyId: null, sealContractVersion: null }),
    );

    renderAt('codigo-invalido');

    await screen.findByText('Código não encontrado');
    expect(screen.queryByLabelText(/Tem o arquivo em mãos/)).not.toBeInTheDocument();
  });

  it('shows the revocation reason and date for a revoked seal', async () => {
    vi.mocked(verificationApi.getSeal).mockResolvedValue(
      envelope({ verdict: 'REVOGADO', revocation: { reason: 'Emitido por engano', revokedAt: '2026-08-08T00:00:00.000Z' } }),
    );

    renderAt('ABCD-2345-EFGH-6789-C');

    await screen.findByText('Selo revogado');
    expect(screen.getByText(/Emitido por engano/)).toBeInTheDocument();
  });

  // T138: o arquivo em si nunca e enviado — so o digest calculado pelo
  // auditor, via POST /verify-artifact.
  it('lets the visitor paste an artifact digest to check it against the stored one, without uploading a file', async () => {
    vi.mocked(verificationApi.getSeal).mockResolvedValue(envelope());
    vi.mocked(verificationApi.verifyArtifact).mockResolvedValue(
      envelope({ verdict: 'CONTEUDO_INTEGRO_ARQUIVO_ADULTERADO' }),
    );

    renderAt('ABCD-2345-EFGH-6789-C');
    await screen.findByText('Íntegro');

    fireEvent.change(screen.getByPlaceholderText(/SHA-256 do arquivo/), { target: { value: 'a'.repeat(64) } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar arquivo' }));

    await waitFor(() => {
      expect(verificationApi.verifyArtifact).toHaveBeenCalledWith('ABCD-2345-EFGH-6789-C', 'a'.repeat(64));
    });
    await screen.findByText('Conteúdo íntegro — arquivo adulterado');
  });
});
