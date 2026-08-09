import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { UsersPanel } from '../components/admin/access/UsersPanel';
import { UnitsPanel } from '../components/admin/access/UnitsPanel';
import { cn } from '../lib/cn';

type Tab = 'users' | 'units';

export function AdminAccessPage() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Controle de Acesso"
        description="Gestão de usuários e unidades. Desativar nunca é excluir: o histórico e a autoria de cada usuário ou unidade permanecem íntegros e consultáveis mesmo depois do desligamento."
      />

      <div className="bg-paper-raised px-8 pt-4">
        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setTab('users')}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-fast ease-out-expo',
              tab === 'users' ? 'border-accent text-ink' : 'border-transparent text-ink-faint hover:text-ink-muted',
            )}
          >
            Usuários
          </button>
          <button
            type="button"
            onClick={() => setTab('units')}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-fast ease-out-expo',
              tab === 'units' ? 'border-accent text-ink' : 'border-transparent text-ink-faint hover:text-ink-muted',
            )}
          >
            Unidades
          </button>
        </div>
      </div>

      <div className="p-8 pt-6">{tab === 'users' ? <UsersPanel /> : <UnitsPanel />}</div>
    </>
  );
}
