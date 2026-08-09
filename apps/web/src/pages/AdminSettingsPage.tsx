import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { EvidenceRetentionPanel } from '../components/admin/settings/EvidenceRetentionPanel';
import { PlatformNamingPanel } from '../components/admin/settings/PlatformNamingPanel';
import { SlaSettingsPanel } from '../components/admin/settings/SlaSettingsPanel';
import { ScoreSettingsPanel } from '../components/admin/settings/ScoreSettingsPanel';
import { cn } from '../lib/cn';

type Tab = 'platform' | 'sla' | 'score';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'platform', label: 'Plataforma' },
  { id: 'sla', label: 'Prazos (SLA)' },
  { id: 'score', label: 'Pontuação' },
];

export function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('platform');

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Configuração da plataforma, gerência de prazos de SLA e da nota do relatório."
      />

      <div className="bg-paper-raised px-8 pt-4">
        <div className="flex gap-1 border-b border-border">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-fast ease-out-expo',
                tab === item.id ? 'border-accent text-ink' : 'border-transparent text-ink-faint hover:text-ink-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 pt-6">
        {tab === 'platform' && (
          <div className="flex flex-col gap-6">
            <PlatformNamingPanel />
            <EvidenceRetentionPanel />
          </div>
        )}
        {tab === 'sla' && <SlaSettingsPanel />}
        {tab === 'score' && <ScoreSettingsPanel />}
      </div>
    </>
  );
}
