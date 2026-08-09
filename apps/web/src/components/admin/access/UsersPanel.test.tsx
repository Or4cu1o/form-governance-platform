import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { UsersPanel } from './UsersPanel';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as usersApi from '../../../api/users';
import * as unitsApi from '../../../api/units';
import type { AdminUser } from '../../../types/api';

vi.mock('../../../api/users');
vi.mock('../../../api/units');

const user: AdminUser = {
  id: 'user-1',
  matricula: '001',
  nome: 'Ana',
  sobrenome: 'Silva',
  email: 'ana@example.com',
  role: 'ELABORADOR',
  jobTitle: null,
  primaryUnitId: 'unit-1',
  isActive: true,
  primaryUnit: { id: 'unit-1', sigla: 'TI', nome: 'Tecnologia' },
  unitAccesses: [],
};

describe('UsersPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the user list from the API', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValueOnce([user]);
    vi.mocked(unitsApi.listUnits).mockResolvedValueOnce([]);

    renderWithProviders(<UsersPanel />);

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
  });

  it('opens the create-user modal', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValueOnce([user]);
    vi.mocked(unitsApi.listUnits).mockResolvedValueOnce([]);

    renderWithProviders(<UsersPanel />);
    await screen.findByText('Ana Silva');

    fireEvent.click(screen.getByRole('button', { name: 'Novo usuário' }));
    expect(screen.getByRole('heading', { name: 'Novo usuário' })).toBeInTheDocument();
  });

  it('toggles a user active status', async () => {
    vi.mocked(usersApi.listUsers).mockResolvedValue([user]);
    vi.mocked(unitsApi.listUnits).mockResolvedValueOnce([]);
    vi.mocked(usersApi.deactivateUser).mockResolvedValueOnce({ ...user, isActive: false });

    renderWithProviders(<UsersPanel />);
    await screen.findByText('Ana Silva');

    await act(async () => {
      fireEvent.click(screen.getByTitle('Desativar'));
    });

    expect(usersApi.deactivateUser).toHaveBeenCalledWith('user-1');
  });
});
