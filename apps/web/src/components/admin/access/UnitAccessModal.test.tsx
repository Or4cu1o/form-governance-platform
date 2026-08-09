import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { UnitAccessModal } from './UnitAccessModal';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as usersApi from '../../../api/users';
import type { AdminUser, UnitSummary } from '../../../types/api';

vi.mock('../../../api/users');

const units: UnitSummary[] = [
  { id: 'unit-1', sigla: 'TI', nome: 'Tecnologia' },
  { id: 'unit-2', sigla: 'RH', nome: 'Recursos Humanos' },
];

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    matricula: '001',
    nome: 'Ana',
    sobrenome: 'Silva',
    email: 'ana@example.com',
    role: 'ELABORADOR',
    jobTitle: null,
    primaryUnitId: 'unit-1',
    isActive: true,
    primaryUnit: units[0],
    unitAccesses: [],
    ...overrides,
  };
}

describe('UnitAccessModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grants access to the selected unit', async () => {
    vi.mocked(usersApi.grantUnitAccess).mockResolvedValueOnce(makeUser());

    renderWithProviders(<UnitAccessModal isOpen onClose={vi.fn()} user={makeUser()} units={units} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Conceder' }));
    });

    expect(usersApi.grantUnitAccess).toHaveBeenCalledWith('user-1', 'unit-2');
  });

  it('revokes an already-granted unit access', async () => {
    vi.mocked(usersApi.revokeUnitAccess).mockResolvedValueOnce(makeUser());
    const userWithAccess = makeUser({ unitAccesses: [{ unitId: 'unit-2', unit: units[1] }] });

    renderWithProviders(<UnitAccessModal isOpen onClose={vi.fn()} user={userWithAccess} units={units} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revogar acesso a RH' }));
    });

    expect(usersApi.revokeUnitAccess).toHaveBeenCalledWith('user-1', 'unit-2');
  });

  it('hides the grant section when there are no grantable units left', () => {
    const userWithAllAccess = makeUser({ unitAccesses: [{ unitId: 'unit-2', unit: units[1] }] });

    renderWithProviders(<UnitAccessModal isOpen onClose={vi.fn()} user={userWithAllAccess} units={units} />);

    expect(screen.queryByRole('button', { name: 'Conceder' })).not.toBeInTheDocument();
  });
});
