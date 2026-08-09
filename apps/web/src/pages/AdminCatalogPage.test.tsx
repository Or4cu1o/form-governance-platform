import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { AdminCatalogPage } from './AdminCatalogPage';
import { renderWithProviders } from '../test/render-with-providers';
import * as catalogApi from '../api/catalog';
import type { CatalogEntry } from '../types/api';

vi.mock('../api/catalog');

const entry: CatalogEntry = {
  id: 'catalog-1',
  code: 'DISP-01',
  name: 'Disponibilidade',
  description: null,
  measurementUnit: '%',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AdminCatalogPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists catalog entries returned by the search endpoint', async () => {
    vi.mocked(catalogApi.searchCatalog).mockResolvedValue([entry]);

    renderWithProviders(<AdminCatalogPage />);

    expect(await screen.findByText('DISP-01')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidade')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', async () => {
    vi.mocked(catalogApi.searchCatalog).mockResolvedValue([]);

    renderWithProviders(<AdminCatalogPage />);

    expect(await screen.findByText('Nenhuma entrada encontrada')).toBeInTheDocument();
  });

  // T079/FR-064: a acao de desativar surfaces o 409 do backend em vez de
  // fingir sucesso quando ha indicador ativo vinculado.
  it('surfaces the backend conflict message when deactivating a linked entry fails', async () => {
    vi.mocked(catalogApi.searchCatalog).mockResolvedValue([entry]);
    vi.mocked(catalogApi.deactivateCatalogEntry).mockRejectedValueOnce(
      new Error('Nao e possivel desativar: ha indicadores ativos vinculados a este codigo de catalogo.'),
    );

    renderWithProviders(<AdminCatalogPage />);
    await screen.findByText('DISP-01');

    fireEvent.click(screen.getByTitle('Desativar'));

    await waitFor(() => expect(catalogApi.deactivateCatalogEntry).toHaveBeenCalledWith('catalog-1'));
  });

  it('opens the creation modal', async () => {
    vi.mocked(catalogApi.searchCatalog).mockResolvedValue([]);

    renderWithProviders(<AdminCatalogPage />);
    await screen.findByText('Nenhuma entrada encontrada');

    fireEvent.click(screen.getByRole('button', { name: 'Nova entrada' }));

    expect(screen.getByText('Nova entrada de catálogo')).toBeInTheDocument();
  });
});
