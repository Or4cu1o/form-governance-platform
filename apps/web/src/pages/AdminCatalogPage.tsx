import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PenSquare, PowerOff } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { CatalogEntryFormModal } from '../components/admin/catalog/CatalogEntryFormModal';
import { deactivateCatalogEntry, searchCatalog } from '../api/catalog';
import { Button, EmptyState, Input, Spinner, StatusBadge, Table, TBody, TD, TH, THead, TR, useToast } from '../components/ui';
import type { CatalogEntry } from '../types/api';

type ModalState = { type: 'create' } | { type: 'edit'; entry: CatalogEntry } | null;

export function AdminCatalogPage() {
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ['admin-catalog', query],
    queryFn: () => searchCatalog(query),
  });

  const deactivateMutation = useMutation({
    mutationFn: (entry: CatalogEntry) => deactivateCatalogEntry(entry.id),
    onSuccess: () => {
      showToast('Entrada de catálogo desativada.', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-catalog'] });
    },
    onError: (caught) =>
      showToast(
        caught instanceof Error ? caught.message : 'Não foi possível desativar: há indicador ativo vinculado.',
        'error',
      ),
  });

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Catálogo canônico"
        description="Identidade estável de cada métrica entre formulários distintos (FR-062 a FR-065)."
      />

      <div className="flex flex-col gap-5 p-8">
        <div className="flex items-center justify-between gap-3">
          <Input
            aria-label="Buscar por código ou nome"
            placeholder="Buscar por código ou nome..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="max-w-sm"
          />
          <Button size="sm" onClick={() => setModal({ type: 'create' })}>
            Nova entrada
          </Button>
        </div>

        {isLoading && <Spinner label="Carregando catálogo..." />}
        {isError && <EmptyState title="Falha ao carregar" description="Não foi possível carregar o catálogo." />}
        {!isLoading && !isError && (entries ?? []).length === 0 && (
          <EmptyState title="Nenhuma entrada encontrada" description="Ajuste a busca ou crie uma nova entrada de catálogo." />
        )}

        {!isLoading && !isError && (entries ?? []).length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Código</TH>
                <TH>Nome</TH>
                <TH>Unidade de medida</TH>
                <TH>Status</TH>
                <TH>Ações</TH>
              </TR>
            </THead>
            <TBody>
              {(entries ?? []).map((entry) => (
                <TR key={entry.id}>
                  <TD className="font-mono text-xs text-ink-muted">{entry.code}</TD>
                  <TD className="font-medium text-ink">{entry.name}</TD>
                  <TD className="text-ink-muted">{entry.measurementUnit}</TD>
                  <TD>
                    <StatusBadge tone={entry.isActive ? 'concluido' : 'pendente'} label={entry.isActive ? 'Ativo' : 'Inativo'} />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => setModal({ type: 'edit', entry })}
                        className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink"
                      >
                        <PenSquare className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {entry.isActive && (
                        <button
                          type="button"
                          title="Desativar"
                          onClick={() => deactivateMutation.mutate(entry)}
                          className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink"
                        >
                          <PowerOff className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <CatalogEntryFormModal isOpen={modal?.type === 'create'} onClose={() => setModal(null)} />
      {modal?.type === 'edit' && (
        <CatalogEntryFormModal isOpen onClose={() => setModal(null)} entry={modal.entry} />
      )}
    </>
  );
}
