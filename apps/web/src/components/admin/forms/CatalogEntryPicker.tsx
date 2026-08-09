import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search } from 'lucide-react';
import { createCatalogEntry, searchCatalog } from '../../../api/catalog';
import { Button, Field, Input, useToast } from '../../ui';
import { cn } from '../../../lib/cn';
import type { CatalogEntry } from '../../../types/api';

type Props = {
  value: string;
  selectedEntry?: CatalogEntry;
  onChange: (entry: CatalogEntry) => void;
};

// FR-063: criacao de entrada de catalogo sem sair do cadastro de indicador —
// busca por codigo/nome e, se nao existir, cria uma nova entrada aqui mesmo.
export function CatalogEntryPicker({ value, selectedEntry, onChange }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newMeasurementUnit, setNewMeasurementUnit] = useState('');

  const { data: results, isFetching } = useQuery({
    queryKey: ['catalog-search', query],
    queryFn: () => searchCatalog(query),
    enabled: query.trim().length > 0,
  });

  const createMutation = useMutation({
    mutationFn: () => createCatalogEntry({ code: newCode, name: newName, measurementUnit: newMeasurementUnit }),
    onSuccess: (entry) => {
      showToast('Entrada de catálogo criada.', 'success');
      queryClient.invalidateQueries({ queryKey: ['catalog-search'] });
      onChange(entry);
      setIsCreating(false);
      setNewCode('');
      setNewName('');
      setNewMeasurementUnit('');
      setQuery('');
    },
    onError: () => showToast('Não foi possível criar a entrada de catálogo.', 'error'),
  });

  if (isCreating) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border bg-paper-sunken p-3">
        <p className="text-xs font-medium text-ink-muted">Nova entrada de catálogo</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Código" htmlFor="catalog-code" required>
            <Input id="catalog-code" value={newCode} onChange={(event) => setNewCode(event.target.value)} className="font-mono" />
          </Field>
          <Field label="Unidade de medida" htmlFor="catalog-unit" required>
            <Input id="catalog-unit" value={newMeasurementUnit} onChange={(event) => setNewMeasurementUnit(event.target.value)} />
          </Field>
        </div>
        <Field label="Nome" htmlFor="catalog-name" required>
          <Input id="catalog-name" value={newName} onChange={(event) => setNewName(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setIsCreating(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            isLoading={createMutation.isPending}
            disabled={!newCode.trim() || !newName.trim() || !newMeasurementUnit.trim()}
            onClick={() => createMutation.mutate()}
          >
            Criar e usar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {selectedEntry ? (
        <div className="flex items-center justify-between rounded-md border border-accent/40 bg-accent-50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-ink">
            <Check className="h-3.5 w-3.5 text-accent-700" aria-hidden="true" />
            <span className="font-mono text-xs text-ink-muted">{selectedEntry.code}</span>
            {selectedEntry.name}
          </span>
          <button type="button" className="text-xs text-accent-700 underline" onClick={() => setQuery(' ')}>
            Trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <Input
            id="catalogEntrySearch"
            placeholder="Buscar por código ou nome..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {!selectedEntry && query.trim().length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-paper-raised p-1.5">
          {isFetching && <p className="px-2 py-1 text-xs text-ink-faint">Buscando...</p>}
          {!isFetching && (results ?? []).length === 0 && (
            <p className="px-2 py-1 text-xs text-ink-faint">Nenhuma entrada encontrada para &quot;{query.trim()}&quot;.</p>
          )}
          {(results ?? []).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onChange(entry)}
              className={cn(
                'flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-paper-sunken',
                value === entry.id && 'bg-accent-50',
              )}
            >
              <span>
                <span className="font-mono text-xs text-ink-muted">{entry.code}</span> — {entry.name}
              </span>
              <span className="text-xs text-ink-faint">{entry.measurementUnit}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm text-accent-700 hover:bg-paper-sunken"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Criar nova entrada de catálogo
          </button>
        </div>
      )}

      {!selectedEntry && query.trim().length === 0 && (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 self-start text-xs text-accent-700 underline"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Ou crie uma nova entrada de catálogo
        </button>
      )}
    </div>
  );
}
