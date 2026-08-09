import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCatalogEntry, updateCatalogEntry } from '../../../api/catalog';
import { Button, Field, Input, Modal, Textarea, useToast } from '../../ui';
import type { CatalogEntry } from '../../../types/api';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  entry?: CatalogEntry;
};

export function CatalogEntryFormModal({ isOpen, onClose, entry }: Props) {
  const isEditing = Boolean(entry);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [code, setCode] = useState(entry?.code ?? '');
  const [name, setName] = useState(entry?.name ?? '');
  const [measurementUnit, setMeasurementUnit] = useState(entry?.measurementUnit ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const input = { code, name, measurementUnit, description: description || undefined };
      return isEditing ? updateCatalogEntry(entry!.id, input) : createCatalogEntry(input);
    },
    onSuccess: () => {
      showToast(isEditing ? 'Entrada de catálogo atualizada.' : 'Entrada de catálogo criada.', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
      onClose();
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar a entrada de catálogo.'),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || !name.trim() || !measurementUnit.trim()) {
      setError('Preencha código, nome e unidade de medida.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar entrada de catálogo' : 'Nova entrada de catálogo'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Código" htmlFor="catalog-form-code" required hint="Identificador único e estável, ex.: DISP-01.">
          <Input id="catalog-form-code" value={code} onChange={(event) => setCode(event.target.value)} className="font-mono" />
        </Field>

        <Field label="Nome" htmlFor="catalog-form-name" required>
          <Input id="catalog-form-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field
          label="Unidade de medida"
          htmlFor="catalog-form-unit"
          required
          hint={isEditing ? 'Imutável após o primeiro vínculo a um indicador (FR-064).' : undefined}
        >
          <Input
            id="catalog-form-unit"
            value={measurementUnit}
            onChange={(event) => setMeasurementUnit(event.target.value)}
          />
        </Field>

        <Field label="Descrição" htmlFor="catalog-form-description">
          <Textarea id="catalog-form-description" rows={2} value={description ?? ''} onChange={(event) => setDescription(event.target.value)} />
        </Field>

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
            {isEditing ? 'Salvar' : 'Criar entrada'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
