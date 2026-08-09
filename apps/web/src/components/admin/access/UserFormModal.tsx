import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUser, updateUser } from '../../../api/users';
import { Button, Field, Input, Modal, Select, useToast } from '../../ui';
import { ROLE_LABEL } from '../../../lib/status';
import type { AdminUser, RoleName, UnitSummary } from '../../../types/api';

const ROLES = Object.keys(ROLE_LABEL) as RoleName[];
const MIN_PASSWORD_LENGTH = 8;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  units: UnitSummary[];
  user?: AdminUser;
};

export function UserFormModal({ isOpen, onClose, units, user }: Props) {
  const isEditing = Boolean(user);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [matricula, setMatricula] = useState(user?.matricula ?? '');
  const [nome, setNome] = useState(user?.nome ?? '');
  const [sobrenome, setSobrenome] = useState(user?.sobrenome ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleName>(user?.role ?? 'OBSERVADOR');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [primaryUnitId, setPrimaryUnitId] = useState(user?.primaryUnitId ?? units[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const requiresJobTitle = role === 'APROVADOR';
  const trimmedJobTitle = jobTitle.trim();

  const mutation = useMutation({
    mutationFn: () =>
      isEditing
        ? updateUser(user!.id, {
            matricula,
            nome,
            sobrenome,
            email,
            role,
            primaryUnitId,
            ...(trimmedJobTitle && { jobTitle: trimmedJobTitle }),
          })
        : createUser({
            matricula,
            nome,
            sobrenome,
            email,
            password,
            role,
            primaryUnitId,
            ...(trimmedJobTitle && { jobTitle: trimmedJobTitle }),
          }),
    onSuccess: () => {
      showToast(isEditing ? 'Usuário atualizado.' : 'Usuário criado.', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o usuário.'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!matricula.trim() || !nome.trim() || !sobrenome.trim() || !email.trim() || !primaryUnitId) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!isEditing && password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    // T095/FR-074: cargo funcional obrigatorio para quem pode aprovar — e
    // estampado no documento selado quando o veredito e emitido.
    if (requiresJobTitle && !trimmedJobTitle) {
      setError('Informe o cargo — obrigatório para o perfil Aprovador.');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar usuário' : 'Novo usuário'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Field label="Matrícula" htmlFor="matricula" required>
          <Input id="matricula" value={matricula} onChange={(event) => setMatricula(event.target.value)} />
        </Field>

        <Field label="E-mail" htmlFor="email" required>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>

        <Field label="Nome" htmlFor="nome" required>
          <Input id="nome" value={nome} onChange={(event) => setNome(event.target.value)} />
        </Field>

        <Field label="Sobrenome" htmlFor="sobrenome" required>
          <Input id="sobrenome" value={sobrenome} onChange={(event) => setSobrenome(event.target.value)} />
        </Field>

        <Field label="Role" htmlFor="role" required>
          <Select id="role" value={role} onChange={(event) => setRole(event.target.value as RoleName)}>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Cargo"
          htmlFor="jobTitle"
          required={requiresJobTitle}
          hint={requiresJobTitle ? 'Obrigatório para o perfil Aprovador — estampado no documento selado.' : undefined}
        >
          <Input id="jobTitle" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
        </Field>

        <Field label="Unidade primária" htmlFor="primaryUnitId" required>
          <Select id="primaryUnitId" value={primaryUnitId} onChange={(event) => setPrimaryUnitId(event.target.value)}>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.sigla}
              </option>
            ))}
          </Select>
        </Field>

        {!isEditing && (
          <Field label="Senha provisória" htmlFor="password" required hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        )}

        {error && (
          <p role="alert" className="text-sm text-status-reprovado">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEditing ? 'Salvar' : 'Criar usuário'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
