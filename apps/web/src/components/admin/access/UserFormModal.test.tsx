import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { UserFormModal } from './UserFormModal';
import { renderWithProviders } from '../../../test/render-with-providers';
import * as usersApi from '../../../api/users';
import type { AdminUser, UnitSummary } from '../../../types/api';

vi.mock('../../../api/users');

const units: UnitSummary[] = [{ id: 'unit-1', sigla: 'TI', nome: 'Tecnologia' }];

const existingUser: AdminUser = {
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
};

describe('UserFormModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires a provisional password of at least 8 characters when creating a user', async () => {
    renderWithProviders(<UserFormModal isOpen onClose={vi.fn()} units={units} />);

    fireEvent.change(screen.getByLabelText(/^Matrícula/), { target: { value: '002' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'novo@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/^Sobrenome/), { target: { value: 'Souza' } });
    fireEvent.change(screen.getByLabelText(/Senha provisória/), { target: { value: 'curta' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(screen.getByRole('alert')).toHaveTextContent('A senha deve ter ao menos 8 caracteres.');
    expect(usersApi.createUser).not.toHaveBeenCalled();
  });

  it('creates a user once all required fields are valid', async () => {
    vi.mocked(usersApi.createUser).mockResolvedValueOnce(existingUser);
    const onClose = vi.fn();

    renderWithProviders(<UserFormModal isOpen onClose={onClose} units={units} />);

    fireEvent.change(screen.getByLabelText(/^Matrícula/), { target: { value: '002' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'novo@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/^Sobrenome/), { target: { value: 'Souza' } });
    fireEvent.change(screen.getByLabelText(/Senha provisória/), { target: { value: 'senha-forte' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    });

    expect(usersApi.createUser).toHaveBeenCalledWith({
      matricula: '002',
      nome: 'João',
      sobrenome: 'Souza',
      email: 'novo@example.com',
      password: 'senha-forte',
      role: 'OBSERVADOR',
      primaryUnitId: 'unit-1',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // T095/FR-074: cargo funcional obrigatorio para o perfil Aprovador — e
  // estampado no documento selado quando o veredito e emitido.
  it('requires a jobTitle when the role is Aprovador', async () => {
    renderWithProviders(<UserFormModal isOpen onClose={vi.fn()} units={units} />);

    fireEvent.change(screen.getByLabelText(/^Matrícula/), { target: { value: '002' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'novo@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/^Sobrenome/), { target: { value: 'Souza' } });
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: 'APROVADOR' } });
    fireEvent.change(screen.getByLabelText(/Senha provisória/), { target: { value: 'senha-forte' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe o cargo');
    expect(usersApi.createUser).not.toHaveBeenCalled();
  });

  it('creates an Aprovador once the jobTitle is provided', async () => {
    vi.mocked(usersApi.createUser).mockResolvedValueOnce({ ...existingUser, role: 'APROVADOR' });

    renderWithProviders(<UserFormModal isOpen onClose={vi.fn()} units={units} />);

    fireEvent.change(screen.getByLabelText(/^Matrícula/), { target: { value: '002' } });
    fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: 'novo@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText(/^Sobrenome/), { target: { value: 'Souza' } });
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: 'APROVADOR' } });
    fireEvent.change(screen.getByLabelText(/^Cargo/), { target: { value: 'Chefe de Gabinete' } });
    fireEvent.change(screen.getByLabelText(/Senha provisória/), { target: { value: 'senha-forte' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));
    });

    expect(usersApi.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'APROVADOR', jobTitle: 'Chefe de Gabinete' }),
    );
  });

  it('does not render a password field and does not require one when editing', async () => {
    vi.mocked(usersApi.updateUser).mockResolvedValueOnce(existingUser);

    renderWithProviders(<UserFormModal isOpen onClose={vi.fn()} units={units} user={existingUser} />);

    expect(screen.queryByLabelText(/Senha provisória/)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    });

    expect(usersApi.updateUser).toHaveBeenCalledWith('user-1', {
      matricula: '001',
      nome: 'Ana',
      sobrenome: 'Silva',
      email: 'ana@example.com',
      role: 'ELABORADOR',
      primaryUnitId: 'unit-1',
    });
  });
});
