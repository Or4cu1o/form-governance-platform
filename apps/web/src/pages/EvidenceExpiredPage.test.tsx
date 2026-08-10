import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceExpiredPage } from './EvidenceExpiredPage';

describe('EvidenceExpiredPage', () => {
  it('mostra uma tela amigavel, sem qualquer detalhe interno de erro', () => {
    render(<EvidenceExpiredPage />);

    expect(screen.getByText('Vínculo de evidência expirado')).toBeInTheDocument();
    expect(screen.getByText(/uma única vez e por tempo limitado/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/bucket|s3|minio|stack|exception|error/i);
  });
});
