import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ResetPasswordModal } from './ResetPasswordModal';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as usersApi from '../../../api/users';
import type { AdminUser } from '../../../types/api';

vi.mock('../../../api/users');

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

describe('ResetPasswordModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a password shorter than 8 characters', () => {
    renderWithProviders(<ResetPasswordModal isOpen onClose={vi.fn()} user={user} />);

    fireEvent.change(screen.getByLabelText(/Nova senha provisória/), { target: { value: 'curta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir' }));

    expect(screen.getByText('A senha deve ter ao menos 8 caracteres.')).toBeInTheDocument();
    expect(usersApi.resetPassword).not.toHaveBeenCalled();
  });

  it('resets the password and closes the modal on success', async () => {
    vi.mocked(usersApi.resetPassword).mockResolvedValueOnce({ success: true });
    const onClose = vi.fn();

    renderWithProviders(<ResetPasswordModal isOpen onClose={onClose} user={user} />);

    fireEvent.change(screen.getByLabelText(/Nova senha provisória/), { target: { value: 'senha-nova-123' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Redefinir' }));
    });

    expect(usersApi.resetPassword).toHaveBeenCalledWith('user-1', 'senha-nova-123');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
